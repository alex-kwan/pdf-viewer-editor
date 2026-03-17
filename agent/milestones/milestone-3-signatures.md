# Milestone 3: Signatures

## Objective
Enable signature creation, management, placement, and transformation with reusable signature presets.

## Scope and Detailed Tasks
- Build signature creation modal:
  - Draw tab using `signature_pad`
  - Type tab with selectable font style
  - Upload tab for transparent PNG
- Signature preset storage:
  - Save preset metadata + data URL in local storage
  - List, select, rename, and delete presets
- Placement flow:
  - Insert signature onto current page
  - Drag, resize, optional rotate
  - Maintain crisp rendering when zoom changes
- Metadata options:
  - Optional timestamp stamp (date/time)
  - Optional signer name label

## Definition of Done
- User can create a signature in all supported modes.
- User can place and transform signatures on any page.
- Presets persist between sessions and can be reused.

## Copilot-Generated Test Plan (Automated)

### Prompt to Generate Tests
"Create tests for digital signature UI in a React PDF editor. Cover draw/type/upload signature creation, preset persistence, signature placement transforms, and timestamp toggles. Use Vitest, Testing Library, and localStorage mocks."

### Test Cases to Include
- Unit:
  - Preset serializer/deserializer handles expected schema.
  - Signature transform utility keeps aspect ratio when configured.
- Integration:
  - Drawn signature can be saved and later reused.
  - Typed signature renders selected font style.
  - Uploaded PNG signature appears with transparency preserved.
  - Signature placement supports drag and resize interactions.
  - Timestamp toggle updates rendered output metadata state.

### Run Commands
- `npm run test`
- `npm run test:coverage`

## Deployment Plan (Milestone Environment)
- Deploy preview build and test with sample legal forms.
- Verify local storage behavior in private/incognito and standard windows.
- Confirm no CORS issues for local image uploads.

## Manual Test Plan
- Create one signature from each method (draw/type/upload).
- Place multiple signatures across different pages.
- Resize signatures very small and very large; verify no major quality loss.
- Reload app and confirm presets still exist.
- Remove a preset and verify it disappears immediately.

## Exit Checklist
- Signature workflows are complete and stable.
- Preset lifecycle (create/use/delete) is reliable.
- Cross-browser manual checks pass for key signature scenarios.
