import { useEffect, useMemo, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import './App.css'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type FitMode = 'width' | 'page' | null

type LoadedFileMeta = {
  name: string
  sizeInBytes: number
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < pageCount

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
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) {
        return
      }

      setIsRendering(true)

      try {
        const page = await pdfDoc.getPage(currentPage)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (!context) {
          return
        }

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)

        // Ensure each render starts from a neutral canvas transform.
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)

        await page
          .render({
            canvasContext: context,
            viewport,
            // Normalize upside-down/mirrored previews in some environments.
            transform: [1, 0, 0, -1, 0, viewport.height],
          })
          .promise
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

    const pagesToBuild = Array.from({ length: pageCount }, (_, idx) => idx + 1).filter(
      (pageIndex) => Math.abs(pageIndex - currentPage) <= preloadRadius && !thumbnails[pageIndex],
    )

    const buildNearbyThumbnails = async () => {
      for (const pageIndex of pagesToBuild) {
        const page = await pdfDoc.getPage(pageIndex)
        const baseViewport = page.getViewport({ scale: 1 })
        const thumbScale = 140 / baseViewport.width
        const thumbViewport = page.getViewport({ scale: thumbScale })

        const thumbCanvas = document.createElement('canvas')
        thumbCanvas.width = Math.floor(thumbViewport.width)
        thumbCanvas.height = Math.floor(thumbViewport.height)
        const ctx = thumbCanvas.getContext('2d')

        if (!ctx) {
          continue
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height)

        await page
          .render({
            canvasContext: ctx,
            viewport: thumbViewport,
            // Keep thumbnail orientation aligned with the main preview.
            transform: [1, 0, 0, -1, 0, thumbViewport.height],
          })
          .promise

        if (cancelled) {
          return
        }

        const dataUrl = thumbCanvas.toDataURL('image/png')
        setThumbnails((prev) => {
          if (prev[pageIndex]) {
            return prev
          }
          return {
            ...prev,
            [pageIndex]: dataUrl,
          }
        })
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

      const nextScale = fitMode === 'width' ? widthScale : pageScale
      setScale(Number(Math.max(0.25, Math.min(4, nextScale)).toFixed(2)))
    }

    void updateFitScale()

    const handleResize = () => {
      void updateFitScale()
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [pdfDoc, currentPage, fitMode])

  const openPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.')
      return
    }

    setError('')
    setCurrentPage(1)
    setFitMode('width')

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

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await openPdf(file)
  }

  const zoomIn = () => {
    setFitMode(null)
    setScale((prev) => Math.min(4, Number((prev + 0.1).toFixed(2))))
  }

  const zoomOut = () => {
    setFitMode(null)
    setScale((prev) => Math.max(0.25, Number((prev - 0.1).toFixed(2))))
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>PDF Viewer Milestone 1</h1>
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
          <h2>Pages</h2>
          <div className="thumbs-list">
            {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`thumb ${page === currentPage ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
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
          <div className="viewer-controls">
            <button type="button" disabled={!canGoPrevious} onClick={() => setCurrentPage((p) => p - 1)}>
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
            <button type="button" disabled={!canGoNext} onClick={() => setCurrentPage((p) => p + 1)}>
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
            <span className="zoom-tag">{Math.round(scale * 100)}%</span>
          </div>

          <div className="canvas-viewport" ref={viewportRef}>
            {pdfDoc ? <canvas ref={canvasRef} aria-label="PDF page canvas" /> : <p>Upload a PDF to start.</p>}
            {isRendering ? <div className="render-badge">Rendering...</div> : null}
          </div>

          <div className="meta-row">
            {documentMeta ? (
              <p>
                <strong>{documentMeta.name}</strong> - {documentMeta.pageCount} pages - {documentMeta.size}
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
