# Milestone 2: Guided Field Editing Core

## Objective
Implement a guided, one-field-at-a-time PDF form editing workflow that:
- Limits editing to a single focused field at a time
- Supports next-field navigation via button and swipe gesture
- Uses a focus mode that lightly greys out the rest of the document
- Opens a bottom editing panel for text fields
- Supports explicit fill/unfill for checkboxes
- Supports selecting exactly one option for radio groups

## Product UX Rules
- Only one field can be active and editable at any moment.
- When a field is active:
  - The rest of the page is dimmed/lightly greyed out.
  - The active field area remains visually clear and prominent.
- Text field editing happens in a bottom panel (bottom sheet), not inline.
- Checkbox editing presents a clear decision: filled or not filled.
- Radio editing presents all options in the group and allows choosing one.
- Navigation between fields is available through:
  - `Next field` button
  - Optional swipe gesture to advance to next field

## Scope and Detailed Breakdown

### Section A: Field Discovery and Structure
#### A1. Field model and indexing
- Define canonical field model: `id`, `type`, `page`, `bounds`, `label`, `required`, `groupId` (for radio groups), `tabOrder`.
- Build deterministic field ordering across pages.
- Identify and expose key sections/subsections (for example: Personal Info, Address, Consent, Signature).

#### A2. Section/subsection focus map
- Add metadata layer that maps fields to section/subsection names.
- Allow jumping to section or subsection and then stepping through fields in that scope.
- Persist current scope and active field index in UI state.

### Section B: Single-Field Focus Mode
#### B1. Focus state machine
- Implement state machine:
  - `idle`
  - `focused(fieldId)`
  - `editing(fieldId)`
- Enforce invariant: at most one `fieldId` may be focused/edited.

#### B2. Grey-out and spotlight rendering
- Add dimming overlay for full page.
- Cut out or spotlight active field bounds.
- Keep overlay accurate through zoom, pan, and page changes.

### Section C: Field Editors by Type
#### C1. Text field editor (bottom panel)
- Build bottom sheet editor for text field value entry.
- Include actions: `Save`, `Clear`, `Cancel`, `Next`.
- Keep selected field visible while panel is open.

#### C2. Checkbox editor
- Present explicit choices:
  - `Fill checkbox`
  - `Leave unchecked`
- Persist state as boolean and annotate correctly in field bounds.

#### C3. Radio group editor
- Resolve group by `groupId`.
- Show all options for the group in panel.
- Allow only one selected option and ensure annotation is applied to the matching radio button location.

### Section D: Guided Navigation
#### D1. Next/previous controls
- Add `Next field` button in panel and top-level controls.
- Optionally add `Previous field` for correction flow.

#### D2. Swipe gesture
- Add swipe gesture support for touch devices.
- Gesture behavior:
  - Swipe left/right (or up/down, per UX decision) advances to next/previous eligible field.
- Add gesture threshold/debouncing to prevent accidental jumps.

### Section E: Persistence and Recovery
- Save per-field values and completion status to local draft storage.
- Restore active section/subsection and current field when reopening.
- Ensure non-supported legacy annotation types are ignored for this milestone flow.

## Definition of Done
- The app enforces one active editable field at a time.
- Focus mode greys out non-active document regions and highlights the target field correctly.
- Text fields are edited through a bottom panel.
- Checkboxes can be explicitly marked filled/unfilled.
- Radio groups display options and enforce exactly one selection.
- Next-field navigation works via button and (if enabled) swipe.
- Section/subsection grouping is available for targeted completion workflows.
- State persists and restores without field-order drift.

## Test Plan (Automated)

### Unit Tests (Vitest)
- Field ordering and grouping:
  - Stable sort by page + tab order.
  - Correct mapping to sections/subsections.
- Focus state machine:
  - Rejects multiple active fields.
  - Correct transitions: `idle -> focused -> editing -> focused/idle`.
- Spotlight geometry:
  - Correct dim/spotlight coordinates across zoom levels.
- Text editor reducer/actions:
  - Save/Clear/Cancel behavior.
- Checkbox behavior:
  - Explicit boolean transitions (`checked`/`unchecked`).
- Radio behavior:
  - Only one selected per group.
  - Selection updates right field target.
- Navigation logic:
  - Next/previous at boundaries.
  - Section-limited navigation.

### Integration Tests (Testing Library)
- Focus mode rendering when field is selected.
- Opening text field shows bottom panel with current value.
- Saving text updates field annotation and keeps single focus invariant.
- Checkbox panel choices correctly toggle annotation state.
- Radio panel options render and selection updates group.
- `Next field` moves focus and updates panel content.

### Visual and Longer-Running E2E Tests (Playwright)
- Screenshot baselines for:
  - Focus mode dimmed background + highlighted field
  - Bottom panel open on text field
  - Checkbox selected vs unselected states
  - Radio group with selected option
- Multi-page journey:
  - Complete fields across sections/subsections and verify persisted draft restore.
- Touch/gesture journey:
  - Swipe advances fields with expected threshold behavior.
- Stability checks:
  - No spotlight drift after repeated zoom and page navigation.

### Suggested Commands
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run test:e2e`
- `npm run test:e2e:update` (for snapshot baseline updates)

## Manual Test Plan
- Start in section 1 and verify only one field is editable at any time.
- Select text field and verify bottom panel appears with correct value.
- Move to next field by button; verify focus ring and panel content update.
- Swipe to next field on touch device and verify no accidental skips.
- Toggle checkbox on/off and verify annotation state changes clearly.
- Select a radio option and verify only one is active in that group.
- Switch sections/subsections and verify scoped navigation order.
- Reload app and verify draft values and active position restore correctly.

## Exit Checklist
- Single-field editing rule enforced globally.
- Focus-mode dimming and spotlight accuracy pass all scenarios.
- Text/checkbox/radio editing flows pass unit, integration, and e2e visual tests.
- Section/subsection focus model is validated for real fixture PDFs.
- No critical navigation or persistence regressions remain.

## Step-by-Step Implementation Guide (Built on Milestone 1)

This guide assumes Milestone 1 viewer foundations are already in place: PDF loading, page navigation, zoom/fit, rendering stability, and baseline test harnesses.

### Step 0: Confirm Baseline from Milestone 1
#### Goal
Start from a known-good baseline before introducing guided field editing complexity.

#### Implementation Tasks
- Confirm Milestone 1 page rendering, thumbnails, and zoom/fit controls are stable.
- Verify current annotation data loading does not regress viewer behavior.
- Capture baseline screenshots for current viewer state before Milestone 2 changes.

#### Validation
- Automated:
  - Run `npm run test`
  - Run `npm run test:e2e`
- Review Gate:
  - No existing tests fail.
  - Baseline screenshots are updated and committed for comparison.

---

### Step 1: Introduce Canonical Form Field Model
#### Goal
Create a single source of truth for field metadata and ordering.

#### Implementation Tasks
- Add `FormField` domain type with:
  - `id`, `type`, `page`, `bounds`, `label`, `required`, `groupId`, `tabOrder`, `section`, `subsection`.
- Add a field normalizer that creates deterministic ordering: page ascending, then tab order ascending, then stable tiebreaker by `id`.
- Add a selector/helper for:
  - All fields
  - Fields by section/subsection
  - Radio fields grouped by `groupId`

#### Validation
- Unit Tests:
  - Stable ordering from mixed input.
  - Correct section/subsection filtering.
  - Correct radio grouping.
- Review Gate:
  - Sample fixture PDF produces expected ordered field list.
  - No duplicate IDs or invalid `groupId` behavior.

---

### Step 2: Build Single-Field Focus State Machine
#### Goal
Guarantee exactly one active field at a time.

#### Implementation Tasks
- Add UI state machine with transitions:
  - `idle`
  - `focused(fieldId)`
  - `editing(fieldId)`
- Implement events:
  - `FOCUS_FIELD`
  - `START_EDIT`
  - `SAVE_EDIT`
  - `CANCEL_EDIT`
  - `NEXT_FIELD`
  - `PREV_FIELD`
- Enforce invariant in reducer: reject any transition that introduces multiple active fields.

#### Validation
- Unit Tests:
  - Valid transition paths.
  - Invalid transitions are ignored or error-safe.
  - Invariant holds after every action.
- Review Gate:
  - Log or devtools trace shows deterministic transitions.
  - No UI state where two fields appear active.

---

### Step 3: Render Focus Mode (Grey-out + Spotlight)
#### Goal
Visually guide users to one field by dimming everything else.

#### Implementation Tasks
- Add focus overlay layer above PDF canvas.
- Implement spotlight cutout aligned to active field bounds.
- Keep spotlight geometry synced with zoom/page/viewport transforms.
- Add a subtle animation for focus changes (fast, non-distracting).

#### Validation
- Unit Tests:
  - Geometry conversion accuracy across scale values.
- Integration Tests:
  - Focusing a field activates overlay and spotlight at correct location.
- Visual E2E:
  - Screenshot baseline for dimmed page + highlighted target field.
- Review Gate:
  - No noticeable spotlight drift after repeated zoom in/out and page changes.

---

### Step 4: Add Bottom Panel Editor Shell
#### Goal
Create a shared bottom sheet container for field-specific editing UI.

#### Implementation Tasks
- Build bottom panel component with:
  - Header (field label, required status, section/subsection)
  - Body (field-type-specific controls)
  - Footer actions (`Save`, `Clear`, `Cancel`, `Next`)
- Panel opens only when state is `editing(fieldId)`.
- Ensure keyboard and screen-reader focus moves into panel when opened.

#### Validation
- Integration Tests:
  - Opening text field transitions to editing and shows panel.
  - Cancel returns to focused state.
- Accessibility Checks:
  - Focus trap in panel.
  - Escape behavior matches spec.
- Review Gate:
  - Panel behavior is consistent on desktop and mobile viewport sizes.

---

### Step 5: Implement Text Field Editing Flow
#### Goal
Support text field value entry in the bottom panel only.

#### Implementation Tasks
- Add text input control in panel with current field value pre-filled.
- Wire actions:
  - `Save`: persist value and keep focused state.
  - `Clear`: remove value.
  - `Next`: save and advance to next eligible field.
- Keep PDF overlay annotation synced to saved text value.

#### Validation
- Unit Tests:
  - Save/Clear reducer behavior.
- Integration Tests:
  - Edit value, save, refocus same field and confirm persisted value.
  - Next action advances field and updates panel content.
- Visual E2E:
  - Baseline with panel open on text field and updated value.
- Review Gate:
  - No inline text editing path remains outside panel.

---

### Step 6: Implement Checkbox Decision Flow
#### Goal
Make checkbox behavior explicit and unambiguous.

#### Implementation Tasks
- Add checkbox panel body with two clear choices:
  - `Fill checkbox`
  - `Leave unchecked`
- Map selected choice to boolean field value.
- Render checkbox annotation state clearly in overlay.

#### Validation
- Unit Tests:
  - Boolean state transitions.
- Integration Tests:
  - Toggle both states and verify persisted value.
- Visual E2E:
  - Screenshot for checked and unchecked states.
- Review Gate:
  - User can always tell current checkbox state without ambiguity.

---

### Step 7: Implement Radio Group Selection Flow
#### Goal
Allow selecting exactly one option in each radio group.

#### Implementation Tasks
- Build radio option list from `groupId`.
- Display all options in bottom panel.
- On selection:
  - Unselect previous option in group.
  - Select new option.
  - Update annotation location for the chosen radio field.

#### Validation
- Unit Tests:
  - Single-selection invariant in each group.
- Integration Tests:
  - Switching options updates group state correctly.
- Visual E2E:
  - Baseline with one selected option visible.
- Review Gate:
  - No scenario permits two selected radios in same group.

---

### Step 8: Implement Guided Navigation (Button + Swipe)
#### Goal
Provide efficient sequential completion workflow.

#### Implementation Tasks
- Add `Next field` and optional `Previous field` controls.
- Add swipe support for touch:
  - Define direction and thresholds.
  - Debounce to prevent accidental multi-step jumps.
- Respect current section/subsection scope while navigating.

#### Validation
- Unit Tests:
  - Navigation boundaries and scoped traversal.
  - Swipe threshold logic.
- Integration Tests:
  - Next button updates focus and panel.
- Visual/Device E2E:
  - Touch simulation confirms swipe changes one field at a time.
- Review Gate:
  - No skipped fields unless intentionally filtered by scope rules.

---

### Step 9: Add Section/Subsection Navigator
#### Goal
Let users focus on meaningful document chunks.

#### Implementation Tasks
- Add section/subsection jump UI.
- Display progress indicators:
  - Completed/remaining fields per section.
- On section change, focus first incomplete field in that scope.

#### Validation
- Unit Tests:
  - Correct first-incomplete selection logic.
- Integration Tests:
  - Section switch updates field scope and active field.
- Review Gate:
  - Navigation order is predictable and matches configured metadata.

---

### Step 10: Persist Draft + Restore Session
#### Goal
Resume work exactly where user left off.

#### Implementation Tasks
- Persist:
  - Field values
  - Field completion map
  - Active section/subsection
  - Current focused field
- Restore this state on reload.
- Ignore unsupported legacy annotation types in restore path.

#### Validation
- Unit Tests:
  - Serialization/deserialization integrity.
- Integration Tests:
  - Reload restores scope and focused field.
- E2E:
  - Multi-page completion then reload preserves journey state.
- Review Gate:
  - No data loss after refresh.

---

### Step 11: Hardening and Regression Protection
#### Goal
Stabilize UX and prevent regressions before release.

#### Implementation Tasks
- Remove debug logging and dead code paths.
- Add error boundaries/guards for malformed field metadata.
- Optimize rendering hotspots in overlay and panel.
- Refresh visual baselines intentionally and document why diffs changed.

#### Validation
- Automated:
  - `npm run test`
  - `npm run test:coverage`
  - `npm run test:e2e`
- Review Gate:
  - CI passes with no flaky tests.
  - Visual diffs are reviewed and approved.

## Suggested Delivery Sequence (PR Slices)
1. PR 1: Field model, ordering, and section metadata
2. PR 2: Focus state machine + spotlight rendering
3. PR 3: Bottom panel shell + text field editing
4. PR 4: Checkbox and radio editors
5. PR 5: Next/previous and swipe navigation
6. PR 6: Section/subsection navigator + progress
7. PR 7: Persistence/restore + hardening

Each PR should include:
- Implementation changes
- Unit/integration coverage for new behavior
- Visual snapshots when UI changes are introduced
- Short reviewer checklist mapping to the step validation gates
