# Milestone 2: Annotation Core

## Objective
Add annotation editing capabilities: highlight, free draw, shapes, text notes, and full select/move/resize/delete interactions.

## Scope and Detailed Tasks
- Build overlay architecture:
  - Separate PDF render layer from annotation interaction layer
  - Normalize coordinate mapping between viewport and PDF space
- Implement annotation tools:
  - Highlight and underline selections
  - Free draw (pen with configurable stroke)
  - Rectangle/ellipse/line shapes
  - Text note boxes with editable content
- Implement element lifecycle:
  - Create, select, move, resize, rotate (if included), delete
  - Keyboard shortcuts (`Delete`, `Esc`, optional `Ctrl/Cmd+Z`)
- Build tool state and history:
  - Active tool state
  - Undo/redo stack for operations
- Persist annotation model in memory and local draft snapshot

## Definition of Done
- All listed annotation types can be created and manipulated.
- Overlay positions remain accurate across zoom/page changes.
- Undo/redo works for core annotation operations.

## Copilot-Generated Test Plan (Automated)

### Prompt to Generate Tests
"Generate robust tests for annotation core features in a React + TypeScript PDF editor. Use Vitest and Testing Library for state and interaction tests. Cover coordinate transforms, annotation CRUD, selection handles, move/resize behavior, and undo/redo stack correctness."

### Test Cases to Include
- Unit:
  - Coordinate conversion functions maintain stable mapping across zoom levels.
  - Annotation reducer handles create/update/delete actions correctly.
  - Undo/redo stack restores prior states accurately.
- Integration:
  - User draws shape and sees expected overlay element.
  - User selects annotation and drags to new location.
  - User resizes shape and geometry updates as expected.
  - Delete key removes selected element.

### Run Commands
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

## Deployment Plan (Milestone Environment)
- Build and deploy branch preview.
- Use fixture PDFs with multiple pages and mixed content.
- Confirm pointer interactions work on desktop and touch-enabled browsers.
- Track and fix any production-only pointer offset bugs.

## Manual Test Plan
- Highlight text across lines and verify visual accuracy.
- Draw freehand annotation and verify stroke persists while navigating pages.
- Create each shape type and verify drag/resize handles.
- Add text note, edit content, click away, reselect, and verify persistence.
- Stress test with 50+ annotations to verify interaction responsiveness.

## Exit Checklist
- Annotation features meet UX acceptance criteria.
- Undo/redo passes all defined scenarios.
- No coordinate drift after repeated zoom/page changes.
