# Milestone 4: Save and Export Pipeline

## Objective
Convert in-app edit operations into PDF modifications and deliver a reliable downloaded file that opens correctly in common PDF readers.

## Scope and Detailed Tasks
- Build export mapper:
  - Translate annotation/signature model to PDF-space operations
  - Handle page index mapping and rotation-aware coordinates
- Implement PDF write flow with `pdf-lib`:
  - Load original bytes
  - Apply edits/signatures in deterministic order
  - Embed images/fonts as needed
  - Save final bytes and create download blob
- Naming and save UX:
  - Default output name: `<original>-edited.pdf`
  - Export progress and error states
- Draft safety:
  - Warn user on unsaved changes before navigation/refresh
  - Optional autosave snapshot in IndexedDB

## Definition of Done
- Exported PDF contains expected edits and signatures.
- Downloaded file opens without corruption in browser and Acrobat.
- Save/export errors are handled with actionable messages.

## Copilot-Generated Test Plan (Automated)

### Prompt to Generate Tests
"Generate tests for PDF export pipeline using pdf-lib in a TypeScript app. Cover mapping from UI annotations to PDF coordinates, deterministic operation ordering, generated file naming, and binary integrity checks. Include integration tests that open exported bytes and verify expected objects/content."

### Test Cases to Include
- Unit:
  - Coordinate mapper returns valid PDF bounds for all annotation types.
  - Export operation sorter is deterministic.
  - Filename utility generates `<name>-edited.pdf` correctly.
- Integration:
  - End-to-end export contains a placed signature and one shape annotation.
  - Exported bytes can be re-opened by `pdf-lib` without parse errors.
  - Corrupt input path shows user-facing error and no crash.

### Run Commands
- `npm run test`
- `npm run test:coverage`

## Deployment Plan (Milestone Environment)
- Deploy preview and run artifact validation checks.
- Download exported files from preview and open in:
  - Chrome PDF viewer
  - Firefox PDF viewer
  - Adobe Acrobat Reader (desktop)
- Track compatibility defects and patch coordinate/font embedding issues.

## Manual Test Plan
- Apply representative mix of edits and signatures, export, and download.
- Re-open exported PDF in app to ensure edits are visible.
- Open exported PDF in external readers and compare visual output.
- Test large document export (100+ pages) and record timing.
- Interrupt export (tab switch/refresh attempts) and confirm safe behavior.

## Exit Checklist
- Export consistency validated on supported readers.
- No critical data loss scenarios remain.
- Release notes document known limitations.
