export type Tool =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'pen'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'note'

export type PagePoint = {
  x: number
  y: number
}

export type PageRect = {
  x: number
  y: number
  width: number
  height: number
}

export type PageSize = {
  width: number
  height: number
}

export type ResizeHandle =
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw'
  | 'start'
  | 'end'

export type RectAnnotationType = 'highlight' | 'underline' | 'rectangle' | 'ellipse' | 'note'

type AnnotationBase = {
  id: string
  page: number
  color: string
  strokeWidth: number
}

export type RectAnnotation = AnnotationBase & {
  type: RectAnnotationType
  bounds: PageRect
  text?: string
}

export type PenAnnotation = AnnotationBase & {
  type: 'pen'
  points: PagePoint[]
}

export type LineAnnotation = AnnotationBase & {
  type: 'line'
  start: PagePoint
  end: PagePoint
}

export type Annotation = RectAnnotation | PenAnnotation | LineAnnotation

export type AnnotationPages = Record<number, Annotation[]>

export type AnnotationSnapshot = {
  pages: AnnotationPages
}

export type AnnotationHistory = {
  past: AnnotationSnapshot[]
  present: AnnotationSnapshot
  future: AnnotationSnapshot[]
}

export const RECT_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const PEN_HANDLES: ResizeHandle[] = ['nw', 'ne', 'se', 'sw']

export const RECT_ANNOTATION_TYPES: RectAnnotationType[] = [
  'highlight',
  'underline',
  'rectangle',
  'ellipse',
  'note',
]

export const isRectAnnotation = (annotation: Annotation): annotation is RectAnnotation =>
  RECT_ANNOTATION_TYPES.includes(annotation.type as RectAnnotationType)

export const toolSupportsStrokeWidth = (tool: Tool) =>
  ['highlight', 'underline', 'pen', 'rectangle', 'ellipse', 'line'].includes(tool)
