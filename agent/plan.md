# PDF Viewer/Editor Web Tool Plan

## 1) Product Goals

Build a browser-based PDF tool that supports:
- Uploading PDF files
- Rendering pages quickly and accurately
- Editing content (text annotations, highlights, shapes, images, page operations)
- Applying signatures (draw, type, upload image)
- Saving and exporting updated PDFs
- Downloading the updated file

Success criteria:
- First page renders in under 2 seconds for a typical 5-10 page PDF
- Edits are visible immediately and preserved in exported PDF
- Signature placement is precise and export-safe
- Downloaded file opens correctly in common readers (Acrobat, browser viewers)

## 2) Recommended Technical Approach

### Frontend
- Framework: React + TypeScript (Vite or Next.js app shell)
- PDF rendering: PDF.js for page rasterization and text layer
- Editing layer: Canvas/SVG overlay for annotations and interaction handles
- State management: Zustand or Redux Toolkit
- UI: Component library plus custom toolbar and page panel

### PDF Write/Save Strategy
- Use a PDF manipulation library (for example pdf-lib) to:
	- Apply annotation objects or flattened edits
	- Embed signature images/text
	- Save modified binary
- Store original file plus a normalized edit model in app state
- On save/export, replay edit model onto original PDF and generate final bytes

### Optional Backend (if needed)
- Keep v1 fully client-side for privacy and speed
- Add backend later for:
	- User accounts and cloud storage
	- Audit trail and version history
	- Team collaboration

## 2.1) Specific Tools for PDF Editing (0 License Cost Only)

Approved stack (all free/open-source):
- Rendering and text layer: PDF.js (Apache 2.0)
- Editing/export engine: pdf-lib (MIT)
- Signature capture UI: signature_pad (MIT)
- Optional overlay interaction helpers: fabric.js (MIT) or konva (MIT)

Why this fits the $0 licensing requirement:
- No commercial per-seat or per-document fees
- No mandatory paid server components
- Full client-side deployment is possible
- Flexible enough for upload, edit, signature, save, and download workflows

Constraint:
- Do not use commercial SDKs (PDF.js Express, PSPDFKit/Nutrient, PDFTron/Apryse) in v1

Decision guidance:
- Use only PDF.js + pdf-lib + signature_pad (and optionally fabric.js/konva) to maintain zero licensing cost

## 2.2) Licensing Budget Guardrail

- Target licensing budget: $0
- Allowed dependencies: OSI-approved open-source licenses only (MIT, Apache-2.0, BSD)
- Excluded: proprietary/commercial PDF SDKs requiring subscription or enterprise contracts
- Note: infrastructure/cloud hosting can still incur operational cost, but software licensing remains $0

## 3) Functional Requirements

### A. Upload and File Intake
- Drag-and-drop area and file picker
- Validate MIME type and extension
- File size limit messaging
- Handle password-protected/encrypted PDFs with clear errors

### B. PDF Rendering and Navigation
- Multipage rendering with virtualized page list for performance
- Zoom in/out, fit to width, fit to page
- Page thumbnail sidebar
- Page rotation (view-only and persisted rotation option)
- Search text (if text layer available)

### C. Editing Features (v1)
- Text annotation (sticky notes/comments)
- Highlight and underline
- Free draw (pen tool)
- Shapes (rectangle/ellipse/line)
- Add image stamp
- Move/resize/delete any added element

### D. Signature Features
- Create signature by:
	- Drawing with pointer/mouse
	- Typing styled signature text
	- Uploading transparent PNG
- Save signature presets locally (browser storage)
- Place signature on page with drag, scale, rotate
- Optional date/time stamp toggle

### E. Save and Download
- Save draft editing state locally (session-based)
- Export updated PDF
- Download file with default name pattern:
	- original-name-edited.pdf
- Optional auto-save snapshot in IndexedDB

## 4) Non-Functional Requirements

- Performance:
	- Lazy render pages outside viewport
	- Debounce heavy operations (zoom/rerender)
- Reliability:
	- Prevent data loss with unsaved-change warnings
	- Recover draft from local storage after refresh crash
- Security and privacy:
	- Client-side processing by default
	- No file upload to server in v1 unless user explicitly enables cloud features
- Accessibility:
	- Keyboard shortcuts for main actions
	- ARIA labels and focus-visible interactions

## 5) UX Flow

1. User opens app and uploads PDF.
2. App parses PDF metadata and renders page 1 immediately.
3. User navigates pages, zooms, and applies edits/signature.
4. User clicks Save/Export.
5. App builds updated PDF from original + edit model.
6. User downloads updated file.

## 6) Data Model (Conceptual)

- Document
	- id
	- originalFileName
	- pageCount
	- pdfBytes
- EditOperation
	- id
	- pageIndex
	- type (highlight, draw, shape, text, image, signature)
	- geometry (x, y, width, height, rotation)
	- style (color, stroke, font, opacity)
	- payload (text, path points, image bytes ref)
- SignaturePreset
	- id
	- kind (drawn, typed, image)
	- data

## 7) Implementation Milestones

Detailed milestone specs:
- Milestone 1: `agent/milestones/milestone-1-viewer-foundation.md`
- Milestone 2: `agent/milestones/milestone-2-annotation-core.md`
- Milestone 3: `agent/milestones/milestone-3-signatures.md`
- Milestone 4: `agent/milestones/milestone-4-save-export.md`
- Milestone 5: `agent/milestones/milestone-5-hardening.md`

### Milestone 1: Viewer Foundation
- Upload + render pages
- Zoom + page navigation + thumbnail sidebar
- Basic document metadata panel

### Milestone 2: Annotation Core
- Overlay interaction system
- Highlight, free draw, shapes, text note
- Element select/move/resize/delete

### Milestone 3: Signatures
- Signature creation modal (draw/type/upload)
- Signature placement and transform controls
- Preset persistence in local storage

### Milestone 4: Save/Export Pipeline
- Convert edit model to PDF modifications
- Export and download updated PDF
- Regression checks on common PDF readers

### Milestone 5: Hardening
- Performance tuning for large files
- Accessibility pass
- Error handling and recovery paths

## 8) Testing Strategy

- Unit tests:
	- Edit operation reducers/state transitions
	- Geometry transforms for move/resize/rotate
	- Export mapping logic
- Integration tests:
	- Upload -> edit -> export -> download flow
	- Signature creation and placement
- Manual QA matrix:
	- Chrome, Edge, Firefox, Safari
	- Small/large PDFs, scanned vs text PDFs
	- Multiple signatures and overlapping edits

## 9) Risks and Mitigations

- Risk: PDF rendering and editing mismatch (visual vs exported)
	- Mitigation: Shared coordinate conversion utilities with snapshot tests
- Risk: Large files slow down browser
	- Mitigation: Virtualized rendering, worker offloading, chunked processing
- Risk: Font compatibility issues for typed signatures/text
	- Mitigation: Embed fallback fonts during export and test across readers

## 10) Deliverables

- Web app supporting upload, render, edit, signature, save, and download
- Developer documentation for architecture and edit/export pipeline
- Test suite and QA checklist
- Known limitations list and v2 roadmap

## 11) V2 Roadmap (Optional)

- Form field editing (AcroForm)
- OCR assist for scanned PDFs
- Collaborative comments
- Cloud storage integrations (Drive, OneDrive, S3)
- Version history and compare
