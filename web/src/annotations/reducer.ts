import type { Annotation, AnnotationHistory, AnnotationPages, AnnotationSnapshot } from './types'

export type AnnotationHistoryAction =
  | { type: 'replaceSnapshot'; snapshot: AnnotationSnapshot }
  | { type: 'create'; annotation: Annotation }
  | { type: 'update'; annotation: Annotation }
  | { type: 'delete'; annotationId: string; page: number }
  | { type: 'undo' }
  | { type: 'redo' }

export const createEmptySnapshot = (): AnnotationSnapshot => ({ pages: {} })

export const createAnnotationHistory = (
  snapshot: AnnotationSnapshot = createEmptySnapshot(),
): AnnotationHistory => ({
  past: [],
  present: snapshot,
  future: [],
})

const clonePages = (pages: AnnotationPages): AnnotationPages =>
  Object.fromEntries(Object.entries(pages).map(([page, annotations]) => [Number(page), [...annotations]]))

const withNewPresent = (history: AnnotationHistory, next: AnnotationSnapshot): AnnotationHistory => ({
  past: [...history.past, history.present],
  present: next,
  future: [],
})

export const canUndo = (history: AnnotationHistory) => history.past.length > 0
export const canRedo = (history: AnnotationHistory) => history.future.length > 0

export const annotationHistoryReducer = (
  history: AnnotationHistory,
  action: AnnotationHistoryAction,
): AnnotationHistory => {
  switch (action.type) {
    case 'replaceSnapshot':
      return createAnnotationHistory({ pages: clonePages(action.snapshot.pages) })
    case 'create': {
      const pages = clonePages(history.present.pages)
      pages[action.annotation.page] = [...(pages[action.annotation.page] ?? []), action.annotation]

      return withNewPresent(history, { pages })
    }
    case 'update': {
      const pages = clonePages(history.present.pages)
      pages[action.annotation.page] = (pages[action.annotation.page] ?? []).map((entry) =>
        entry.id === action.annotation.id ? action.annotation : entry,
      )

      return withNewPresent(history, { pages })
    }
    case 'delete': {
      const pages = clonePages(history.present.pages)
      pages[action.page] = (pages[action.page] ?? []).filter((entry) => entry.id !== action.annotationId)

      return withNewPresent(history, { pages })
    }
    case 'undo': {
      if (!canUndo(history)) {
        return history
      }

      const previous = history.past[history.past.length - 1]

      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      }
    }
    case 'redo': {
      if (!canRedo(history)) {
        return history
      }

      const next = history.future[0]

      return {
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      }
    }
  }
}