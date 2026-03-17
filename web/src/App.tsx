import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import './App.css'
import {
  distanceBetweenPoints,
  getAnnotationBounds,
  getHandlePoint,
  pagePointToViewportPoint,
  pageRectToViewportRect,
  rectFromPoints,
  resizeAnnotation,
  translateAnnotation,
  viewportPointToPagePoint,
} from './annotations/geometry'
import {
  annotationHistoryReducer,
  canRedo,
  canUndo,
  createAnnotationHistory,
  createEmptySnapshot,
} from './annotations/reducer'
import {
  isRectAnnotation,
  PEN_HANDLES,
  RECT_HANDLES,
  toolSupportsStrokeWidth,
  type Annotation,
  type PagePoint,
  type PageSize,
  type RectAnnotation,
  type ResizeHandle,
  type Tool,
} from './annotations/types'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type FitMode = 'width' | 'page' | null

type LoadedFileMeta = {
  name: string
  sizeInBytes: number
}

type InteractionState =
  | {
      kind: 'create'
      tool: Tool
      origin: PagePoint
      preview: Annotation
    }
  | {
      kind: 'move'
      annotationId: string
      origin: PagePoint
      initial: Annotation
      preview: Annotation
    }
  | {
      kind: 'resize'
      annotationId: string
      handle: ResizeHandle
      initial: Annotation
      preview: Annotation
    }

const TOOLBAR_TOOLS: Tool[] = [
  'select',
  'highlight',
  'underline',
  'pen',
  'rectangle',
  'ellipse',
  'line',
  'note',
]

const TOOL_LABELS: Record<Tool, string> = {
  select: 'Select',
  highlight: 'Highlight',
  underline: 'Underline',
  pen: 'Pen',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  note: 'Note',
}

const TOOL_COLORS: Record<Tool, string> = {
  select: '#b86f1f',
  highlight: 'rgba(255, 230, 77, 0.45)',
  underline: '#f59e0b',
  pen: '#0f766e',
  rectangle: '#2563eb',
  ellipse: '#9333ea',
  line: '#dc2626',
  note: '#facc15',
}

const NOTE_DEFAULT_SIZE = { width: 180, height: 96 }
const MIN_ANNOTATION_SIZE = 6

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `annotation-${Math.random().toString(36).slice(2, 10)}`

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'
}

const getStorageKey = (fileMeta: LoadedFileMeta | null) =>
  fileMeta ? `pdf-viewer-editor:draft:${fileMeta.name}:${fileMeta.sizeInBytes}` : null

const createAnnotationFromTool = (
  tool: Tool,
  page: number,
  point: PagePoint,
  strokeWidth: number,
): Annotation => {
  const base = {
    id: createId(),
    page,
    color: TOOL_COLORS[tool],
    strokeWidth,
  }

  switch (tool) {
    case 'highlight':
    case 'underline':
    case 'rectangle':
    case 'ellipse':
      return {
        ...base,
        type: tool,
        bounds: { x: point.x, y: point.y, width: 0, height: 0 },
      }
    case 'note':
      return {
        ...base,
        type: 'note',
        bounds: { x: point.x, y: point.y, width: 0, height: 0 },
        text: 'New note',
      }
    case 'line':
      return {
        ...base,
        type: 'line',
        start: point,
        end: point,
      }
    case 'pen':
      return {
        ...base,
        type: 'pen',
        points: [point],
      }
    case 'select':
      throw new Error('Select does not create annotations')
  }
}

const updateDraftAnnotation = (
  annotation: Annotation,
  tool: Tool,
  origin: PagePoint,
  point: PagePoint,
): Annotation => {
  if (tool === 'pen' && annotation.type === 'pen') {
    return {
      ...annotation,
      points: [...annotation.points, point],
    }
  }

  if (tool === 'line' && annotation.type === 'line') {
    return {
      ...annotation,
      end: point,
    }
  }

  if (isRectAnnotation(annotation)) {
    return {
      ...annotation,
      bounds: rectFromPoints(origin, point),
    }
  }

  return annotation
}

const finalizeAnnotation = (annotation: Annotation): Annotation | null => {
  if (annotation.type === 'pen') {
    return annotation.points.length > 1 ? annotation : null
  }

  if (annotation.type === 'line') {
    return distanceBetweenPoints(annotation.start, annotation.end) >= MIN_ANNOTATION_SIZE
      ? annotation
      : null
  }

  if (annotation.type === 'note') {
    return {
      ...annotation,
      bounds:
        annotation.bounds.width < MIN_ANNOTATION_SIZE && annotation.bounds.height < MIN_ANNOTATION_SIZE
          ? { ...annotation.bounds, ...NOTE_DEFAULT_SIZE }
          : {
              ...annotation.bounds,
              width: Math.max(annotation.bounds.width, 120),
              height: Math.max(annotation.bounds.height, 72),
            },
    }
  }

  return annotation.bounds.width >= MIN_ANNOTATION_SIZE || annotation.bounds.height >= MIN_ANNOTATION_SIZE
    ? annotation
    : null
}

function App() {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [fileMeta, setFileMeta] = useState<LoadedFileMeta | null>(null)
  const [error, setError] = useState<string>('')
  const [pageCount, setPageCount] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [isRendering, setIsRendering] = useState<boolean>(false)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [interaction, setInteraction] = useState<InteractionState | null>(null)
  const [pageMetrics, setPageMetrics] = useState<{ page: PageSize; viewport: PageSize } | null>(null)

  const [annotationHistory, dispatchAnnotations] = useReducer(
    annotationHistoryReducer,
    undefined,
    () => createAnnotationHistory(),
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const storageKey = getStorageKey(fileMeta)
  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < pageCount

  const currentPageAnnotations = annotationHistory.present.pages[currentPage] ?? []
  const selectedAnnotation = currentPageAnnotations.find((entry) => entry.id === selectedAnnotationId)

  const documentMeta = useMemo(() => {
    if (!fileMeta) {
      return null
    }

    return {
      name: fileMeta.name,
      pageCount,
      size: `${(fileMeta.sizeInBytes / (1024 * 1024)).toFixed(2)} MB`,
    }
  }, [fileMeta, pageCount])

  useEffect(() => {
    const initializePageMetrics = async () => {
      if (!pdfDoc) {
        return
      }

      try {
        const page = await pdfDoc.getPage(currentPage)
        const unitViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale })

        setPageMetrics({
          page: { width: unitViewport.width, height: unitViewport.height },
          viewport: { width: viewport.width, height: viewport.height },
        })
      } catch {
        // Continue; metrics will be set by render effect
      }
    }

    void initializePageMetrics()
  }, [pdfDoc, currentPage, scale])

  const renderableAnnotations = useMemo(() => {
    if (!interaction || interaction.preview.page !== currentPage) {
      return currentPageAnnotations
    }

    return [
      ...currentPageAnnotations.filter((entry) => entry.id !== interaction.preview.id),
      interaction.preview,
    ]
  }, [currentPage, currentPageAnnotations, interaction])

  const noteAnnotations = renderableAnnotations.filter(
    (annotation): annotation is RectAnnotation => annotation.type === 'note',
  )

  const shapeAnnotations = renderableAnnotations.filter((annotation) => annotation.type !== 'note')

  const getPagePointFromClient = (clientX: number, clientY: number) => {
    const element = overlayRef.current
    if (!element) {
      return null
    }

    const rect = element.getBoundingClientRect()

    return viewportPointToPagePoint(
      {
        x: clientX - rect.left,
        y: clientY - rect.top,
      },
      scale,
    )
  }

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) {
        return
      }

      setIsRendering(true)

      try {
        const page = await pdfDoc.getPage(currentPage)
        const unitViewport = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        const metrics = {
          page: { width: unitViewport.width, height: unitViewport.height },
          viewport: { width: viewport.width, height: viewport.height },
        }
        setPageMetrics(metrics)

        if (!context) {
          return
        }

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: context, viewport }).promise
      } finally {
        setIsRendering(false)
      }
    }

    void renderPage()
  }, [pdfDoc, currentPage, scale])

  useEffect(() => {
    if (!pdfDoc) {
      setThumbnails({})
      return
    }

    let cancelled = false
    const preloadRadius = 2

    const pagesToBuild = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
      (pageIndex) => Math.abs(pageIndex - currentPage) <= preloadRadius && !thumbnails[pageIndex],
    )

    const buildNearbyThumbnails = async () => {
      for (const pageIndex of pagesToBuild) {
        const page = await pdfDoc.getPage(pageIndex)
        const baseViewport = page.getViewport({ scale: 1 })
        const thumbScale = 140 / baseViewport.width
        const thumbViewport = page.getViewport({ scale: thumbScale })
        const thumbCanvas = document.createElement('canvas')
        const context = thumbCanvas.getContext('2d')

        thumbCanvas.width = Math.floor(thumbViewport.width)
        thumbCanvas.height = Math.floor(thumbViewport.height)

        if (!context) {
          continue
        }

        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height)

        await page.render({ canvasContext: context, viewport: thumbViewport }).promise

        if (cancelled) {
          return
        }

        setThumbnails((previous) => ({
          ...previous,
          [pageIndex]: thumbCanvas.toDataURL('image/png'),
        }))
      }
    }

    void buildNearbyThumbnails()

    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageCount, currentPage, thumbnails])

  useEffect(() => {
    if (!pdfDoc || !fitMode) {
      return
    }

    const updateFitScale = async () => {
      const viewportElement = viewportRef.current
      if (!viewportElement) {
        return
      }

      const page = await pdfDoc.getPage(currentPage)
      const unitViewport = page.getViewport({ scale: 1 })
      const padding = 24
      const widthScale = (viewportElement.clientWidth - padding) / unitViewport.width
      const pageScale = Math.min(
        widthScale,
        (viewportElement.clientHeight - padding) / unitViewport.height,
      )

      const nextScale = Number(Math.max(0.25, Math.min(4, fitMode === 'width' ? widthScale : pageScale)).toFixed(2))
      setScale((currentScale) => (nextScale !== currentScale ? nextScale : currentScale))
    }

    let timeoutId: ReturnType<typeof setTimeout>

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        void updateFitScale()
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    void updateFitScale()

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [pdfDoc, currentPage, fitMode])

  useEffect(() => {
    if (!storageKey) {
      return
    }

    try {
      const rawSnapshot = window.localStorage.getItem(storageKey)
      const snapshot = rawSnapshot ? (JSON.parse(rawSnapshot) as { pages?: Record<number, Annotation[]> }) : null

      dispatchAnnotations({
        type: 'replaceSnapshot',
        snapshot: snapshot?.pages ? { pages: snapshot.pages } : createEmptySnapshot(),
      })
    } catch {
      dispatchAnnotations({ type: 'replaceSnapshot', snapshot: createEmptySnapshot() })
    }

    setSelectedAnnotationId(null)
    setEditingNoteId(null)
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) {
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(annotationHistory.present))
  }, [annotationHistory.present, storageKey])

  useEffect(() => {
    if (!selectedAnnotationId) {
      return
    }

    const exists = Object.values(annotationHistory.present.pages)
      .flat()
      .some((annotation) => annotation.id === selectedAnnotationId)

    if (!exists) {
      setSelectedAnnotationId(null)
      setEditingNoteId(null)
    }
  }, [annotationHistory.present, selectedAnnotationId])

  useEffect(() => {
    if (!interaction) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const point = getPagePointFromClient(event.clientX, event.clientY)
      if (!point) {
        return
      }

      setInteraction((current) => {
        if (!current) {
          return current
        }

        switch (current.kind) {
          case 'create':
            return {
              ...current,
              preview: updateDraftAnnotation(current.preview, current.tool, current.origin, point),
            }
          case 'move':
            return {
              ...current,
              preview: translateAnnotation(
                current.initial,
                point.x - current.origin.x,
                point.y - current.origin.y,
              ),
            }
          case 'resize':
            return {
              ...current,
              preview: resizeAnnotation(current.initial, current.handle, point),
            }
        }
      })
    }

    const handlePointerUp = () => {
      setInteraction((current) => {
        if (!current) {
          return current
        }

        if (current.kind === 'create') {
          const finalized = finalizeAnnotation(current.preview)

          if (finalized) {
            dispatchAnnotations({ type: 'create', annotation: finalized })
            setSelectedAnnotationId(finalized.id)

            if (finalized.type === 'note') {
              setEditingNoteId(finalized.id)
              setActiveTool('select')
            }
          }

          return null
        }

        dispatchAnnotations({ type: 'update', annotation: current.preview })
        setSelectedAnnotationId(current.preview.id)
        return null
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [interaction, scale])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatchAnnotations({ type: event.shiftKey ? 'redo' : 'undo' })
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        dispatchAnnotations({ type: 'redo' })
        return
      }

      if (event.key === 'Escape') {
        setInteraction(null)
        setSelectedAnnotationId(null)
        setEditingNoteId(null)
        setActiveTool('select')
        return
      }

      if (isTextInputTarget(event.target)) {
        return
      }

      if (event.key === 'Delete' && selectedAnnotation) {
        event.preventDefault()
        dispatchAnnotations({
          type: 'delete',
          annotationId: selectedAnnotation.id,
          page: selectedAnnotation.page,
        })
        setSelectedAnnotationId(null)
        setEditingNoteId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedAnnotation])

  const openPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.')
      return
    }

    setError('')
    setCurrentPage(1)
    setFitMode('width')
    setInteraction(null)
    setSelectedAnnotationId(null)
    setEditingNoteId(null)

    try {
      const buffer = await file.arrayBuffer()
      const loadingTask = getDocument({ data: buffer })
      const loaded = await loadingTask.promise

      setPdfDoc(loaded)
      setPageCount(loaded.numPages)
      setFileMeta({
        name: file.name,
        sizeInBytes: file.size,
      })
      setThumbnails({})
    } catch (loadError) {
      const message =
        loadError instanceof Error && loadError.message.toLowerCase().includes('password')
          ? 'This PDF is password-protected and cannot be opened yet.'
          : 'Unable to load this PDF. Please try another file.'

      setError(message)
      setPdfDoc(null)
      setPageCount(0)
      setThumbnails({})
      setFileMeta(null)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await openPdf(file)
  }

  const zoomIn = () => {
    setFitMode(null)
    setScale((previous) => Math.min(4, Number((previous + 0.1).toFixed(2))))
  }

  const zoomOut = () => {
    setFitMode(null)
    setScale((previous) => Math.max(0.25, Number((previous - 0.1).toFixed(2))))
  }

  const handleOverlayPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'select') {
      setSelectedAnnotationId(null)
      setEditingNoteId(null)
      return
    }

    const point = getPagePointFromClient(event.clientX, event.clientY)
    if (!point) {
      return
    }

    event.preventDefault()
    setEditingNoteId(null)

    setInteraction({
      kind: 'create',
      tool: activeTool,
      origin: point,
      preview: createAnnotationFromTool(activeTool, currentPage, point, strokeWidth),
    })
  }

  const startMoveAnnotation = (annotation: Annotation, event: React.PointerEvent) => {
    if (activeTool !== 'select') {
      return
    }

    const point = getPagePointFromClient(event.clientX, event.clientY)
    if (!point) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedAnnotationId(annotation.id)
    setEditingNoteId(annotation.type === 'note' ? annotation.id : null)
    setInteraction({
      kind: 'move',
      annotationId: annotation.id,
      origin: point,
      initial: annotation,
      preview: annotation,
    })
  }

  const startResizeAnnotation = (
    annotation: Annotation,
    handle: ResizeHandle,
    event: React.PointerEvent,
  ) => {
    if (activeTool !== 'select') {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSelectedAnnotationId(annotation.id)
    setEditingNoteId(null)
    setInteraction({
      kind: 'resize',
      annotationId: annotation.id,
      handle,
      initial: annotation,
      preview: annotation,
    })
  }

  const updateNoteText = (annotation: RectAnnotation, nextText: string) => {
    dispatchAnnotations({
      type: 'update',
      annotation: {
        ...annotation,
        text: nextText,
      },
    })
  }

  const renderSelectionHandles = (annotation: Annotation) => {
    const bounds = getAnnotationBounds(annotation)
    const selectionStroke = '#b86f1f'
    const viewportBounds = pageRectToViewportRect(bounds, scale)
    const handles = annotation.type === 'line' ? (['start', 'end'] as ResizeHandle[]) : annotation.type === 'pen' ? PEN_HANDLES : RECT_HANDLES

    return (
      <>
        <rect
          className="annotation-selection-box"
          x={viewportBounds.x}
          y={viewportBounds.y}
          width={Math.max(viewportBounds.width, 1)}
          height={Math.max(viewportBounds.height, 1)}
        />
        {handles.map((handle) => {
          const point =
            annotation.type === 'line' && handle === 'start'
              ? annotation.start
              : annotation.type === 'line' && handle === 'end'
                ? annotation.end
                : getHandlePoint(bounds, handle)
          const viewportPoint = pagePointToViewportPoint(point, scale)

          return (
            <rect
              key={`${annotation.id}-${handle}`}
              data-testid={`handle-${annotation.id}-${handle}`}
              className="annotation-handle"
              x={viewportPoint.x - 5}
              y={viewportPoint.y - 5}
              width={10}
              height={10}
              fill={selectionStroke}
              onPointerDown={(event) => startResizeAnnotation(annotation, handle, event)}
            />
          )
        })}
      </>
    )
  }

  const renderShapeAnnotation = (annotation: Annotation) => {
    const isSelected = activeTool === 'select' && annotation.id === selectedAnnotationId
    const bounds = getAnnotationBounds(annotation)
    const viewportBounds = pageRectToViewportRect(bounds, scale)

    if (annotation.type === 'highlight') {
      return (
        <g
          key={annotation.id}
          data-testid={annotation.id}
          data-annotation-type={annotation.type}
          data-x={annotation.bounds.x}
          data-y={annotation.bounds.y}
          data-width={annotation.bounds.width}
          data-height={annotation.bounds.height}
          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
        >
          <rect
            className="annotation-shape"
            x={viewportBounds.x}
            y={viewportBounds.y}
            width={Math.max(viewportBounds.width, 1)}
            height={Math.max(viewportBounds.height, 1)}
            fill={annotation.color}
          />
          {isSelected ? renderSelectionHandles(annotation) : null}
        </g>
      )
    }

    if (annotation.type === 'underline') {
      return (
        <g
          key={annotation.id}
          data-testid={annotation.id}
          data-annotation-type={annotation.type}
          data-x={annotation.bounds.x}
          data-y={annotation.bounds.y}
          data-width={annotation.bounds.width}
          data-height={annotation.bounds.height}
          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
        >
          <line
            className="annotation-shape"
            x1={viewportBounds.x}
            y1={viewportBounds.y + viewportBounds.height}
            x2={viewportBounds.x + viewportBounds.width}
            y2={viewportBounds.y + viewportBounds.height}
            stroke={annotation.color}
            strokeWidth={Math.max(annotation.strokeWidth, 2)}
            strokeLinecap="round"
          />
          {isSelected ? renderSelectionHandles(annotation) : null}
        </g>
      )
    }

    if (annotation.type === 'rectangle') {
      return (
        <g
          key={annotation.id}
          data-testid={annotation.id}
          data-annotation-type={annotation.type}
          data-x={annotation.bounds.x}
          data-y={annotation.bounds.y}
          data-width={annotation.bounds.width}
          data-height={annotation.bounds.height}
          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
        >
          <rect
            className="annotation-shape"
            x={viewportBounds.x}
            y={viewportBounds.y}
            width={Math.max(viewportBounds.width, 1)}
            height={Math.max(viewportBounds.height, 1)}
            fill="transparent"
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
            rx={6}
          />
          {isSelected ? renderSelectionHandles(annotation) : null}
        </g>
      )
    }

    if (annotation.type === 'ellipse') {
      return (
        <g
          key={annotation.id}
          data-testid={annotation.id}
          data-annotation-type={annotation.type}
          data-x={annotation.bounds.x}
          data-y={annotation.bounds.y}
          data-width={annotation.bounds.width}
          data-height={annotation.bounds.height}
          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
        >
          <ellipse
            className="annotation-shape"
            cx={viewportBounds.x + viewportBounds.width / 2}
            cy={viewportBounds.y + viewportBounds.height / 2}
            rx={Math.max(viewportBounds.width / 2, 1)}
            ry={Math.max(viewportBounds.height / 2, 1)}
            fill="transparent"
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
          />
          {isSelected ? renderSelectionHandles(annotation) : null}
        </g>
      )
    }

    if (annotation.type === 'line') {
      const start = pagePointToViewportPoint(annotation.start, scale)
      const end = pagePointToViewportPoint(annotation.end, scale)

      return (
        <g
          key={annotation.id}
          data-testid={annotation.id}
          data-annotation-type={annotation.type}
          data-x={annotation.start.x}
          data-y={annotation.start.y}
          data-width={annotation.end.x - annotation.start.x}
          data-height={annotation.end.y - annotation.start.y}
          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
        >
          <line
            className="annotation-shape"
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
            strokeLinecap="round"
          />
          {isSelected ? renderSelectionHandles(annotation) : null}
        </g>
      )
    }

    if (annotation.type === 'note') {
      return null
    }

    if (annotation.type !== 'pen') {
      return null
    }

    const points = annotation.points.map((point: PagePoint) => pagePointToViewportPoint(point, scale))

    return (
      <g
        key={annotation.id}
        data-testid={annotation.id}
        data-annotation-type={annotation.type}
        data-x={bounds.x}
        data-y={bounds.y}
        data-width={bounds.width}
        data-height={bounds.height}
        onPointerDown={(event) => startMoveAnnotation(annotation, event)}
      >
        <polyline
          className="annotation-shape"
          points={points.map((point: PagePoint) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isSelected ? renderSelectionHandles(annotation) : null}
      </g>
    )
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>PDF Viewer Milestone 2</h1>
          <p className="subtitle">Annotation core with overlay editing, history, and local draft snapshots.</p>
        </div>
        <label
          className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragActive(true)
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragActive(false)
            const dropped = event.dataTransfer.files?.[0]
            if (dropped) {
              void openPdf(dropped)
            }
          }}
        >
          <input type="file" accept="application/pdf,.pdf" onChange={handleFileSelect} />
          <span>{fileMeta ? 'Replace PDF' : 'Upload PDF'}</span>
          <small>Drag and drop or click to browse</small>
        </label>
      </header>

      {error ? <p className="error-msg">{error}</p> : null}

      <main className="workspace">
        <aside className="thumbs-panel">
          <div className="panel-head">
            <h2>Pages</h2>
            <span className="annotation-count">{currentPageAnnotations.length} annotations</span>
          </div>
          <div className="thumbs-list">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`thumb ${page === currentPage ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(page)
                  setSelectedAnnotationId(null)
                  setEditingNoteId(null)
                }}
              >
                {thumbnails[page] ? (
                  <img src={thumbnails[page]} alt={`Page ${page} thumbnail`} />
                ) : (
                  <div className="thumb-placeholder">Loading...</div>
                )}
                <span>Page {page}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="viewer-area">
          <div className="viewer-controls viewer-toolbar">
            <button type="button" disabled={!canGoPrevious} onClick={() => setCurrentPage((page) => page - 1)}>
              Prev
            </button>
            <div className="page-input-wrap">
              <input
                type="number"
                min={1}
                max={Math.max(1, pageCount)}
                value={currentPage}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isNaN(next)) {
                    return
                  }
                  setCurrentPage(Math.max(1, Math.min(pageCount || 1, next)))
                }}
              />
              <span>/ {pageCount || 0}</span>
            </div>
            <button type="button" disabled={!canGoNext} onClick={() => setCurrentPage((page) => page + 1)}>
              Next
            </button>
            <button type="button" onClick={zoomOut}>
              -
            </button>
            <button type="button" onClick={zoomIn}>
              +
            </button>
            <button type="button" onClick={() => setFitMode('width')}>
              Fit Width
            </button>
            <button type="button" onClick={() => setFitMode('page')}>
              Fit Page
            </button>
            <button type="button" disabled={!canUndo(annotationHistory)} onClick={() => dispatchAnnotations({ type: 'undo' })}>
              Undo
            </button>
            <button type="button" disabled={!canRedo(annotationHistory)} onClick={() => dispatchAnnotations({ type: 'redo' })}>
              Redo
            </button>
            <span className="zoom-tag">{Math.round(scale * 100)}%</span>
          </div>

          <div className="toolbelt" role="toolbar" aria-label="Annotation tools">
            {TOOLBAR_TOOLS.map((tool) => (
              <button
                key={tool}
                type="button"
                className={`tool-button ${activeTool === tool ? 'active' : ''}`}
                aria-pressed={activeTool === tool}
                onClick={() => {
                  setActiveTool(tool)
                  if (tool !== 'select') {
                    setSelectedAnnotationId(null)
                    setEditingNoteId(null)
                  }
                }}
              >
                {TOOL_LABELS[tool]}
              </button>
            ))}
            <label className="stroke-control">
              Stroke
              <input
                type="range"
                min={1}
                max={12}
                value={strokeWidth}
                disabled={!toolSupportsStrokeWidth(activeTool)}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
              <span>{strokeWidth}px</span>
            </label>
          </div>

          <div className="canvas-viewport" ref={viewportRef}>
            {pdfDoc && pageMetrics ? (
              <div
                className="page-stage"
                ref={overlayRef}
                style={{
                  width: `${pageMetrics.viewport.width}px`,
                  height: `${pageMetrics.viewport.height}px`,
                }}
              >
                <canvas ref={canvasRef} aria-label="PDF page canvas" className="page-canvas" />
                <svg
                  className="annotation-overlay"
                  data-testid="annotation-overlay"
                  width={pageMetrics.viewport.width}
                  height={pageMetrics.viewport.height}
                  onPointerDown={handleOverlayPointerDown}
                >
                  {shapeAnnotations.map(renderShapeAnnotation)}
                </svg>
                <div className="annotation-html-layer">
                  {noteAnnotations.map((annotation) => {
                      const viewportBounds = pageRectToViewportRect(annotation.bounds, scale)
                      const isSelected = activeTool === 'select' && annotation.id === selectedAnnotationId

                      return (
                        <div
                          key={annotation.id}
                          className={`annotation-note ${isSelected ? 'selected' : ''}`}
                          data-testid={annotation.id}
                          data-annotation-type={annotation.type}
                          data-x={annotation.bounds.x}
                          data-y={annotation.bounds.y}
                          data-width={annotation.bounds.width}
                          data-height={annotation.bounds.height}
                          style={{
                            left: `${viewportBounds.x}px`,
                            top: `${viewportBounds.y}px`,
                            width: `${Math.max(viewportBounds.width, 1)}px`,
                            height: `${Math.max(viewportBounds.height, 1)}px`,
                          }}
                          onPointerDown={(event) => startMoveAnnotation(annotation, event)}
                        >
                          {editingNoteId === annotation.id ? (
                            <textarea
                              aria-label="Note text"
                              value={annotation.text ?? ''}
                              onChange={(event) => updateNoteText(annotation, event.target.value)}
                              onBlur={() => setEditingNoteId(null)}
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              className="annotation-note-content"
                              onDoubleClick={() => setEditingNoteId(annotation.id)}
                            >
                              {annotation.text}
                            </button>
                          )}
                        </div>
                      )
                    })}
                </div>
                <svg className="annotation-overlay annotation-overlay--handles" width={pageMetrics.viewport.width} height={pageMetrics.viewport.height}>
                  {noteAnnotations
                    .filter((annotation) => activeTool === 'select' && annotation.id === selectedAnnotationId)
                    .map((annotation) => renderSelectionHandles(annotation))}
                </svg>
              </div>
            ) : pdfDoc ? (
              <div className="page-stage loading-stage">
                <p>Preparing page metrics...</p>
              </div>
            ) : (
              <p>Upload a PDF to start.</p>
            )}
            {isRendering ? <div className="render-badge">Rendering...</div> : null}
          </div>

          <div className="meta-row">
            {documentMeta ? (
              <p>
                <strong>{documentMeta.name}</strong> - {documentMeta.pageCount} pages - {documentMeta.size}
                {' '} - Active tool: <strong>{TOOL_LABELS[activeTool]}</strong>
              </p>
            ) : (
              <p>No document loaded</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
