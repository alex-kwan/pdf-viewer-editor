import { describe, expect, it } from 'vitest'
import {
  pagePointToViewportPoint,
  pageRectToViewportRect,
  rectFromPoints,
  viewportPointToPagePoint,
} from './geometry'

describe('annotation geometry utilities', () => {
  it('round-trips points across zoom levels', () => {
    const pagePoint = { x: 128, y: 256 }
    const viewportPoint = pagePointToViewportPoint(pagePoint, 1.75)

    expect(viewportPoint).toEqual({ x: 224, y: 448 })
    expect(viewportPointToPagePoint(viewportPoint, 1.75)).toEqual(pagePoint)
  })

  it('normalizes rectangles from drag points', () => {
    expect(rectFromPoints({ x: 220, y: 180 }, { x: 120, y: 80 })).toEqual({
      x: 120,
      y: 80,
      width: 100,
      height: 100,
    })
  })

  it('scales rectangles into viewport space', () => {
    expect(pageRectToViewportRect({ x: 20, y: 40, width: 100, height: 50 }, 1.5)).toEqual({
      x: 30,
      y: 60,
      width: 150,
      height: 75,
    })
  })
})
