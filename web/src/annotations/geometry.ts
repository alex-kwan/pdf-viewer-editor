import {
  type Annotation,
  type PagePoint,
  type PageRect,
  type ResizeHandle,
} from './types'

export const viewportPointToPagePoint = (point: PagePoint, scale: number): PagePoint => ({
  x: point.x / scale,
  y: point.y / scale,
})

export const pagePointToViewportPoint = (point: PagePoint, scale: number): PagePoint => ({
  x: point.x * scale,
  y: point.y * scale,
})

export const rectFromPoints = (start: PagePoint, end: PagePoint): PageRect => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export const pageRectToViewportRect = (rect: PageRect, scale: number): PageRect => ({
  x: rect.x * scale,
  y: rect.y * scale,
  width: rect.width * scale,
  height: rect.height * scale,
})

export const translateRect = (rect: PageRect, deltaX: number, deltaY: number): PageRect => ({
  ...rect,
  x: rect.x + deltaX,
  y: rect.y + deltaY,
})

const rectFromEdges = (left: number, top: number, right: number, bottom: number): PageRect => ({
  x: Math.min(left, right),
  y: Math.min(top, bottom),
  width: Math.abs(right - left),
  height: Math.abs(bottom - top),
})

export const getAnnotationBounds = (annotation: Annotation): PageRect => {
  if ('bounds' in annotation) {
    return annotation.bounds
  }

  if (annotation.type === 'line') {
    return rectFromPoints(annotation.start, annotation.end)
  }

  const xs = annotation.points.map((point) => point.x)
  const ys = annotation.points.map((point) => point.y)

  return rectFromEdges(
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  )
}

export const translateAnnotation = (annotation: Annotation, deltaX: number, deltaY: number): Annotation => {
  if ('bounds' in annotation) {
    return {
      ...annotation,
      bounds: translateRect(annotation.bounds, deltaX, deltaY),
    }
  }

  if (annotation.type === 'line') {
    return {
      ...annotation,
      start: { x: annotation.start.x + deltaX, y: annotation.start.y + deltaY },
      end: { x: annotation.end.x + deltaX, y: annotation.end.y + deltaY },
    }
  }

  return {
    ...annotation,
    points: annotation.points.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    })),
  }
}

export const getHandlePoint = (rect: PageRect, handle: ResizeHandle): PagePoint => {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height

  switch (handle) {
    case 'nw':
      return { x: rect.x, y: rect.y }
    case 'n':
      return { x: centerX, y: rect.y }
    case 'ne':
      return { x: right, y: rect.y }
    case 'e':
      return { x: right, y: centerY }
    case 'se':
      return { x: right, y: bottom }
    case 's':
      return { x: centerX, y: bottom }
    case 'sw':
      return { x: rect.x, y: bottom }
    case 'w':
      return { x: rect.x, y: centerY }
    case 'start':
      return { x: rect.x, y: rect.y }
    case 'end':
      return { x: right, y: bottom }
  }
}

export const resizeRect = (rect: PageRect, handle: ResizeHandle, point: PagePoint): PageRect => {
  const left = rect.x
  const top = rect.y
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height

  switch (handle) {
    case 'nw':
      return rectFromEdges(point.x, point.y, right, bottom)
    case 'n':
      return rectFromEdges(left, point.y, right, bottom)
    case 'ne':
      return rectFromEdges(left, point.y, point.x, bottom)
    case 'e':
      return rectFromEdges(left, top, point.x, bottom)
    case 'se':
      return rectFromEdges(left, top, point.x, point.y)
    case 's':
      return rectFromEdges(left, top, right, point.y)
    case 'sw':
      return rectFromEdges(point.x, top, right, point.y)
    case 'w':
      return rectFromEdges(point.x, top, right, bottom)
    case 'start':
      return rectFromEdges(point.x, point.y, right, bottom)
    case 'end':
      return rectFromEdges(left, top, point.x, point.y)
  }
}

const scalePointWithinRect = (point: PagePoint, fromRect: PageRect, toRect: PageRect): PagePoint => {
  const ratioX = fromRect.width === 0 ? 0 : (point.x - fromRect.x) / fromRect.width
  const ratioY = fromRect.height === 0 ? 0 : (point.y - fromRect.y) / fromRect.height

  return {
    x: toRect.x + ratioX * toRect.width,
    y: toRect.y + ratioY * toRect.height,
  }
}

export const resizeAnnotation = (
  annotation: Annotation,
  handle: ResizeHandle,
  point: PagePoint,
): Annotation => {
  if ('bounds' in annotation) {
    return {
      ...annotation,
      bounds: resizeRect(annotation.bounds, handle, point),
    }
  }

  if (annotation.type === 'line') {
    if (handle === 'start') {
      return {
        ...annotation,
        start: point,
      }
    }

    return {
      ...annotation,
      end: point,
    }
  }

  const initialBounds = getAnnotationBounds(annotation)
  const nextBounds = resizeRect(initialBounds, handle, point)

  return {
    ...annotation,
    points: annotation.points.map((entry) => scalePointWithinRect(entry, initialBounds, nextBounds)),
  }
}

export const distanceBetweenPoints = (start: PagePoint, end: PagePoint) =>
  Math.hypot(end.x - start.x, end.y - start.y)
