# Milestone 1: Viewer Foundation

## Objective
Deliver a stable PDF viewer foundation with file upload, first-page render, page navigation, zoom controls, and a thumbnail sidebar.

## Scope and Detailed Tasks
- Build upload entry points:
  - Drag-and-drop target
  - File picker button
  - MIME and extension validation (`application/pdf`, `.pdf`)
  - Error UI for unsupported files and encrypted/password PDFs
- Integrate PDF rendering pipeline with `pdfjs-dist`:
  - Load document with worker
  - Render page 1 immediately
  - Render additional pages on demand
- Implement core navigation:
  - Previous/next page controls
  - Jump-to-page input
  - Current page + total pages indicator
- Implement zoom controls:
  - Zoom in/out with bounded scale
  - Fit-width and fit-page presets
- Implement thumbnail sidebar:
  - Lazy-generate thumbnails
  - Click thumbnail to navigate
- Add baseline app state model:
  - Document metadata (`name`, `pageCount`, `size`)
  - Viewer state (`pageIndex`, `zoom`, `fitMode`)

## Definition of Done
- User can upload a valid PDF and see page 1 quickly.
- User can navigate between pages and use zoom controls reliably.
- Thumbnail sidebar is functional and keeps selection in sync.
- Basic errors are shown for invalid or encrypted documents.

## Copilot-Generated Test Plan (Automated)
Use Copilot Chat to scaffold and maintain tests.

### Prompt to Generate Tests
"Create unit and integration tests for milestone 1 PDF viewer features using Vitest and React Testing Library. Cover upload validation, first-page render trigger, page navigation, zoom controls, and thumbnail click navigation. Include mocks for `pdfjs-dist` worker interactions."

### Test Cases to Include
- Unit:
  - File validator accepts `.pdf` and rejects non-PDF input.
  - Viewer reducer updates page index and zoom within limits.
- Integration:
  - Uploading a PDF triggers document load and first render call.
  - Clicking next/previous updates page display state.
  - Thumbnail click changes active page.
  - Fit-width and fit-page update calculated viewport scale.

### Run Commands
- Install test deps:
  - `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- Run tests once:
  - `npm run test`
- Run in watch mode:
  - `npm run test:watch`
- Generate coverage:
  - `npm run test:coverage`

## Deployment Plan (Milestone Environment)
- Build app artifact:
  - `npm run build`
- Deploy preview:
  - Vercel/Netlify preview deployment for branch
- Validate runtime config:
  - Confirm PDF worker path resolves in production build
- Smoke check:
  - Open deployed URL and upload sample PDFs (small and medium size)

## Manual Test Plan
- Upload:
  - Upload a valid PDF and confirm page 1 appears.
  - Upload non-PDF and verify readable error message.
- Navigation:
  - Go next/previous repeatedly and confirm correct page number.
  - Jump directly to last page and back to first.
- Zoom:
  - Verify zoom in/out limits.
  - Verify fit-width and fit-page behavior on different viewport sizes.
- Thumbnails:
  - Verify active thumbnail tracks current page.
  - Click multiple thumbnails out of order and confirm accurate navigation.

## Exit Checklist
- All automated tests pass in CI.
- No console errors in local and preview deployment.
- Manual checklist completed on at least Chrome and Firefox.
