import { describe, expect, it } from 'vitest'
import { annotationHistoryReducer, createAnnotationHistory } from './reducer'
import type { Annotation } from './types'

const note: Annotation = {
  id: 'annotation-1',
  type: 'note',
  page: 1,
  color: '#facc15',
  strokeWidth: 4,
  bounds: { x: 20, y: 40, width: 100, height: 60 },
  text: 'New note',
}

describe('annotation history reducer', () => {
  it('creates, updates, and deletes annotations', () => {
    const created = annotationHistoryReducer(createAnnotationHistory(), {
      type: 'create',
      annotation: note,
    })

    expect(created.present.pages[1]).toHaveLength(1)

    const updated = annotationHistoryReducer(created, {
      type: 'update',
      annotation: {
        ...note,
        bounds: { ...note.bounds, x: 80 },
      },
    })

    expect(updated.present.pages[1][0]).toMatchObject({
      bounds: { x: 80, y: 40, width: 100, height: 60 },
    })

    const deleted = annotationHistoryReducer(updated, {
      type: 'delete',
      annotationId: note.id,
      page: 1,
    })

    expect(deleted.present.pages[1]).toHaveLength(0)
  })

  it('undoes and redoes core operations', () => {
    const created = annotationHistoryReducer(createAnnotationHistory(), {
      type: 'create',
      annotation: note,
    })

    const undone = annotationHistoryReducer(created, { type: 'undo' })
    expect(undone.present.pages[1]).toBeUndefined()

    const redone = annotationHistoryReducer(undone, { type: 'redo' })
    expect(redone.present.pages[1][0]).toEqual(note)
  })
})
