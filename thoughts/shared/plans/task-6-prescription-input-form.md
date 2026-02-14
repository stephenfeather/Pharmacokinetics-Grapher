# Implementation Plan: Task 6 - Prescription Input Form Component

Generated: 2026-02-13T22:00:00Z
Task Master ID: 6
Status: pending
Dependencies: Task 2 (done - Prescription Data Models and Validation)
Complexity: 6/10 (medium)

---

## Goal

Create `src/components/PrescriptionForm.vue`, a Vue 3 Composition API component that allows users to enter prescription data (drug name, dosing frequency, times, dose, half-life, peak, uptake, and optional metabolite half-life). The form dynamically adjusts the number of time inputs based on the selected frequency, validates all fields in real time using the existing `validatePrescription()` function from Task 2, and displays errors and warnings inline. An educational disclaimer must be prominently displayed. The component emits a validated `Prescription` object on submission.

---

## Research Summary

### Vue 3 Form Best Practices (Relevant Findings)

1. **`<script setup lang="ts">` with `ref` per field** is the recommended pattern for typed reactive forms. Each field gets its own `ref` rather than a single reactive object, because it allows direct `v-model` binding without nested property access and avoids reactivity pitfalls with arrays (the `times` field).

2. **Computed validation** is the correct Vue 3 approach for real-time validation. A computed property that assembles the `Prescription` from individual refs and passes it through `validatePrescription()` will automatically re-run whenever any bound ref changes. No manual debouncing or watchers needed for validation feedback.

3. **`watch()` for derived side effects** (like resizing the `times` array when `frequency` changes) is the correct pattern. `watchEffect` could also work but `watch` with explicit source is clearer and easier to test.

4. **HTML5 `<input type="time">`** provides native HH:MM pickers on most browsers and returns values in HH:MM format (e.g., "09:30"), which matches the project's validation regex. No third-party date/time picker library is needed.

5. **HTML5 `<input type="number">`** with `min`, `max`, and `step` attributes provides browser-native constraint hints but does NOT prevent invalid values from being typed. The app must still validate via `validatePrescription()`. The `step` attribute controls increment/decrement behavior of the spinner arrows.

6. **Accessibility**: Every `<input>` must have a matching `<label for="...">`. Error messages should use `aria-live="polite"` or `role="alert"` so screen readers announce them. The submit button should convey disabled state via both visual styling and `aria-disabled`.

7. **`defineProps` with `initial?: Prescription`** enables edit mode where an existing prescription pre-populates the form. The form can be used for both creating new prescriptions and editing existing ones.

### Codebase-Specific Findings

- The `FREQUENCY_MAP` constant (not `FREQUENCY_COUNTS` as the task description says) is exported from `src/core/models/prescription.ts`. It maps each `FrequencyLabel` to a number (or null for custom). This is used to determine how many time inputs to render.
- The `validatePrescription()` function returns `{ valid: boolean, errors: string[], warnings: string[] }` (the `ValidationResult` type). Errors are blocking; warnings are informational. The `valid` field is `true` only when `errors.length === 0`.
- The `@/*` path alias is configured in `tsconfig.app.json` (`"@/*": ["./src/*"]`), so imports should use `@/core/models/prescription` form.
- The existing Vue Test Utils pattern (from `HelloWorld.spec.ts`) uses `import { mount } from '@vue/test-utils'` and basic prop passing.
- The project uses `jsdom` as the test environment (vitest.config.ts), which supports DOM rendering for component tests.
- CSS uses Vue's scoped styles and the project has CSS custom properties defined in `base.css` for colors, borders, and backgrounds (supports dark mode via `prefers-color-scheme`).

---

## Existing Codebase Analysis

### Files That Exist (VERIFIED by reading)

| File | Status | Relevance |
|------|--------|-----------|
| `src/core/models/prescription.ts` (lines 1-354) | Complete (Task 2) | Provides `Prescription`, `FrequencyLabel`, `ValidationResult` types; `FREQUENCY_MAP`, `VALIDATION_RULES`, `validatePrescription()` exports |
| `src/core/models/index.ts` | Complete | Barrel exports all types and functions |
| `src/core/models/__tests__/fixtures.ts` | Complete | Test fixtures (SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE, etc.) usable in form tests |
| `src/components/__tests__/HelloWorld.spec.ts` | Complete | Establishes Vue Test Utils pattern: `mount()` with `props` |
| `src/assets/base.css` | Complete | CSS custom properties for theming (--color-background, --color-text, etc.) |
| `src/assets/main.css` | Complete | App-level styles, grid layout |
| `src/App.vue` | Default scaffold | Currently renders HelloWorld; will be modified in Task 8 |
| `tsconfig.app.json` | Complete | `@/*` path alias, strict mode enabled |
| `vitest.config.ts` | Complete | jsdom environment for component tests |

### Files That Do NOT Exist Yet (to be created)

| File | Action |
|------|--------|
| `src/components/PrescriptionForm.vue` | CREATE -- the main deliverable |
| `src/components/__tests__/PrescriptionForm.spec.ts` | CREATE -- component test suite |

### Key Import Paths

```typescript
// In PrescriptionForm.vue
import type { Prescription, FrequencyLabel, ValidationResult } from '@/core/models/prescription'
import { FREQUENCY_MAP, VALIDATION_RULES, validatePrescription } from '@/core/models/prescription'

// In PrescriptionForm.spec.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import PrescriptionForm from '../PrescriptionForm.vue'
import type { Prescription, FrequencyLabel } from '@/core/models/prescription'
import { FREQUENCY_MAP } from '@/core/models/prescription'
```

### Downstream Consumers (VERIFIED from taskmaster)

- **Task 8** (App.vue integration): Mounts `<PrescriptionForm>`, listens for `@submit` event, passes optional `:initial` prop for edit mode.

---

## Implementation Phases

### Phase 1: Create Form Structure with All Input Fields

**Files to create:**
- `src/components/PrescriptionForm.vue`

**Steps:**

1. Create the component file with `<script setup lang="ts">`, importing types and constants from `@/core/models/prescription`.

2. Define the component's API:
   ```typescript
   const props = defineProps<{
     initial?: Prescription
   }>()

   const emit = defineEmits<{
     submit: [prescription: Prescription]
   }>()
   ```

3. Create reactive refs for each form field, initializing from `props.initial` when provided:
   ```typescript
   const name = ref(props.initial?.name ?? '')
   const frequency = ref<FrequencyLabel>(props.initial?.frequency ?? 'bid')
   const times = ref<string[]>(props.initial?.times ?? ['09:00', '21:00'])
   const dose = ref(props.initial?.dose ?? 500)
   const halfLife = ref(props.initial?.halfLife ?? 6)
   const peak = ref(props.initial?.peak ?? 2)
   const uptake = ref(props.initial?.uptake ?? 1.5)
   const metaboliteLife = ref<number | undefined>(props.initial?.metaboliteLife)
   ```
   Note: Default values are sensible starting points from the BID_MULTI_DOSE_FIXTURE. The `metaboliteLife` ref is typed `number | undefined` because it is optional.

4. Build the template with semantic HTML form elements:
   - `<form @submit.prevent="handleSubmit">` wrapper
   - Drug name: `<input id="rx-name" type="text" v-model="name" maxlength="100">`
   - Frequency: `<select id="rx-frequency" v-model="frequency">` with all 8 options, each showing both the abbreviation and plain-English label (e.g., "BID (twice daily)")
   - Dose: `<input id="rx-dose" type="number" v-model.number="dose" min="0.001" max="10000" step="0.001">`
   - Half-life: `<input id="rx-halflife" type="number" v-model.number="halfLife" min="0.1" max="240" step="0.1">`
   - Peak (Tmax): `<input id="rx-peak" type="number" v-model.number="peak" min="0.1" max="48" step="0.1">`
   - Uptake: `<input id="rx-uptake" type="number" v-model.number="uptake" min="0.1" max="24" step="0.1">`
   - Metabolite half-life (optional): `<input id="rx-metabolite" type="number" v-model.number="metaboliteLife" min="0.1" max="1000" step="0.1">` with a checkbox or visual indicator that it is optional
   - Time inputs: rendered via `v-for` (details in Phase 2)
   - Submit button: `<button type="submit">Generate Graph</button>`

5. Every input must have a `<label>` with a `for` attribute matching the input's `id`. Add helper text below numeric inputs showing the valid range (e.g., "0.1 - 240 hours").

**Key design decisions:**

- **Individual refs vs. reactive object**: Individual refs are chosen because `v-model.number` works cleanly with them and avoids nested property issues. A computed property will assemble them into a `Prescription` object for validation.
- **`v-model.number`**: Used on all numeric inputs to ensure the bound ref receives a `number`, not a string. This is critical because `validatePrescription()` checks `typeof dose !== 'number'`.
- **Default values**: Pre-populating with reasonable defaults (rather than empty/zero) means the form starts in a valid state, giving users a working example to modify. This is better UX for an educational tool.
- **Metabolite half-life handling**: Since this field is optional, a checkbox toggle or empty-state handling is needed. When the field is left empty/unchecked, `metaboliteLife` should be `undefined` in the assembled Prescription. Note: `v-model.number` on an empty input yields `NaN` in some browsers, so this needs special handling (see Phase 3 edge case notes).

**Acceptance criteria:**
- [ ] Component renders without errors
- [ ] All 8 form fields are visible (name, frequency, dose, halfLife, peak, uptake, metaboliteLife, times)
- [ ] Frequency dropdown contains all 8 options
- [ ] Number inputs have correct min/max/step attributes from VALIDATION_RULES
- [ ] All inputs have associated `<label>` elements with `for` attributes
- [ ] `initial` prop pre-populates all fields when provided
- [ ] Form uses `@submit.prevent` to prevent page reload

---

### Phase 2: Implement Reactive Times Array with Frequency Watch

**Files to modify:**
- `src/components/PrescriptionForm.vue` (extend script and template)

**Steps:**

1. Add a `watch` on the `frequency` ref to adjust the `times` array:
   ```typescript
   watch(frequency, (newFreq) => {
     const expectedCount = FREQUENCY_MAP[newFreq]
     if (expectedCount === null) return // 'custom' -- leave times alone

     // Grow: add default times
     while (times.value.length < expectedCount) {
       times.value.push('12:00')
     }
     // Shrink: remove from end
     while (times.value.length > expectedCount) {
       times.value.pop()
     }
   })
   ```

2. Render time inputs dynamically in the template:
   ```html
   <fieldset>
     <legend>Dosing Times</legend>
     <div v-for="(_, index) in times" :key="index" class="time-input-row">
       <label :for="`rx-time-${index}`">Time {{ index + 1 }}</label>
       <input
         :id="`rx-time-${index}`"
         type="time"
         v-model="times[index]"
         required
       />
     </div>
     <!-- Custom frequency: add/remove buttons -->
     <div v-if="frequency === 'custom'" class="custom-time-controls">
       <button type="button" @click="addTime">+ Add Time</button>
       <button type="button" @click="removeLastTime" :disabled="times.length <= 1">
         - Remove Last
       </button>
     </div>
   </fieldset>
   ```

3. Add helper methods for custom frequency time management:
   ```typescript
   function addTime() {
     times.value.push('12:00')
   }

   function removeLastTime() {
     if (times.value.length > 1) {
       times.value.pop()
     }
   }
   ```

**Key design decisions:**

- **`<fieldset>` + `<legend>`** for the times group provides semantic grouping for accessibility (screen readers will announce "Dosing Times" when entering the group).
- **Using array index as key**: Since times are ordered and never reordered (only added/removed from the end), `:key="index"` is acceptable here. If reordering were supported, a unique ID per slot would be needed.
- **Default time '12:00'**: When adding new time slots, '12:00' (noon) is a neutral default. Users will change it.
- **Custom frequency**: The add/remove buttons only appear when frequency is 'custom'. The remove button is disabled when only 1 time remains (validation requires at least 1 time).
- **Watch behavior**: The watch only fires when frequency changes, not on initial render. The initial times array is set from `props.initial` or defaults in Phase 1, which must already match the initial frequency.

**Edge case: Frequency change preserving existing times:**
When shrinking (e.g., qid->bid), the watch removes times from the end, preserving the first N times the user already entered. When growing (e.g., once->tid), it appends new '12:00' slots while keeping existing entries.

**Acceptance criteria:**
- [ ] Changing frequency from 'bid' (2) to 'tid' (3) adds one time input
- [ ] Changing frequency from 'qid' (4) to 'once' (1) removes 3 time inputs
- [ ] Changing to 'custom' does not change the times array
- [ ] 'custom' frequency shows add/remove buttons
- [ ] Add button appends a new time input with default '12:00'
- [ ] Remove button removes the last time input
- [ ] Remove button is disabled when only 1 time remains
- [ ] Time inputs use HTML5 `type="time"` for native picker support
- [ ] Each time input has a unique id and matching label

---

### Phase 3: Wire Validation and Display Errors/Warnings

**Files to modify:**
- `src/components/PrescriptionForm.vue` (extend script and template)

**Steps:**

1. Create a computed property that assembles the current form state into a `Prescription` object:
   ```typescript
   const prescription = computed<Prescription>(() => ({
     ...(props.initial?.id ? { id: props.initial.id } : {}),
     name: name.value,
     frequency: frequency.value,
     times: [...times.value],
     dose: dose.value,
     halfLife: halfLife.value,
     peak: peak.value,
     uptake: uptake.value,
     ...(metaboliteLife.value !== undefined && !isNaN(metaboliteLife.value)
       ? { metaboliteLife: metaboliteLife.value }
       : {}),
   }))
   ```
   Note: The spread for `id` preserves it during edit mode. The `metaboliteLife` conditional avoids passing `NaN` or `undefined` to validation (since `v-model.number` yields `NaN` for empty numeric inputs in some browsers).

2. Create a computed validation result:
   ```typescript
   const validation = computed<ValidationResult>(() =>
     validatePrescription(prescription.value)
   )

   const canSubmit = computed(() => validation.value.valid)
   ```

3. Implement the submit handler:
   ```typescript
   function handleSubmit() {
     if (!canSubmit.value) return
     emit('submit', prescription.value)
   }
   ```

4. Add a reactive flag to control when validation messages are shown (to avoid showing errors before the user has interacted with the form):
   ```typescript
   const showValidation = ref(false)

   function handleSubmit() {
     showValidation.value = true
     if (!canSubmit.value) return
     emit('submit', prescription.value)
   }
   ```
   Alternative approach: Show validation immediately (since defaults start valid) and let errors appear as the user makes changes. Given that the form starts with valid defaults, immediate validation display is reasonable. The user will only see errors/warnings if they actively change a field to an invalid value.

   **Decision**: Show validation immediately (no `showValidation` flag needed). The defaults are valid, so no errors appear initially. Errors appear reactively as the user modifies fields. This is simpler and the behavior is intuitive because the form never starts in an error state.

5. Add error and warning display in the template:
   ```html
   <!-- Validation Errors -->
   <div
     v-if="validation.errors.length > 0"
     class="validation-errors"
     role="alert"
     aria-live="polite"
   >
     <h3>Validation Errors</h3>
     <ul>
       <li v-for="error in validation.errors" :key="error">{{ error }}</li>
     </ul>
   </div>

   <!-- Validation Warnings -->
   <div
     v-if="validation.warnings.length > 0"
     class="validation-warnings"
     aria-live="polite"
   >
     <h3>Warnings</h3>
     <ul>
       <li v-for="warning in validation.warnings" :key="warning">{{ warning }}</li>
     </ul>
   </div>

   <!-- Submit button -->
   <button
     type="submit"
     :disabled="!canSubmit"
     :aria-disabled="!canSubmit"
   >
     Generate Graph
   </button>
   ```

**Key design decisions:**

- **No per-field error display for MVP**: Errors are shown in a single list at the bottom of the form. This is simpler to implement and the error messages from `validatePrescription()` are already descriptive enough to identify which field is affected. Per-field inline errors could be a future enhancement.
- **`role="alert"` on errors, not warnings**: Errors use `role="alert"` because they block submission. Warnings use only `aria-live="polite"` because they are informational.
- **`aria-disabled` on submit button**: In addition to the HTML `disabled` attribute, `aria-disabled` explicitly communicates the state to assistive technology.
- **No debouncing**: Validation via computed property runs synchronously and is fast (string checks, number comparisons). No debouncing is needed.

**Edge case: `v-model.number` and `NaN`:**
When a user clears a number input, `v-model.number` binds `NaN` to the ref. The `validatePrescription()` function already handles this (checks `isNaN()` and returns an appropriate error). However, for `metaboliteLife` (optional), an empty field should result in `undefined`, not `NaN`. The computed `prescription` property handles this with the conditional spread.

**Edge case: Empty string for name:**
The user can clear the name field entirely, resulting in `name.value === ''`. The validation catches this with "Name must not be empty".

**Acceptance criteria:**
- [ ] Computed `validation` updates reactively when any field changes
- [ ] Validation errors appear in a list when present
- [ ] Validation warnings appear in a separate list when present
- [ ] Submit button is disabled when form is invalid
- [ ] Submit button is enabled when form is valid
- [ ] Clicking submit when valid emits 'submit' event with Prescription data
- [ ] Clicking submit when invalid does not emit event
- [ ] Setting uptake >= halfLife shows a warning (not an error)
- [ ] Error list has `role="alert"` for accessibility
- [ ] Empty metaboliteLife does not cause validation errors
- [ ] `NaN` in numeric fields triggers appropriate validation error

---

### Phase 4: Add Styling and Educational Disclaimer

**Files to modify:**
- `src/components/PrescriptionForm.vue` (add `<style scoped>` section and disclaimer markup)

**Steps:**

1. Add the educational disclaimer at the top of the form template:
   ```html
   <div class="educational-disclaimer" role="note" aria-label="Educational disclaimer">
     <strong>Educational Use Only</strong>
     <p>
       This tool is for visualization and educational purposes only. It is not
       intended for medical dosing decisions. Outputs show approximate relative
       concentration curves based on simplified pharmacokinetic models. Actual
       drug levels vary by individual (weight, metabolism, food, drug
       interactions, etc.). Always follow prescriptions written by licensed
       healthcare providers.
     </p>
   </div>
   ```

2. Add hint text below each numeric input showing the valid range:
   ```html
   <small class="field-hint">Range: 0.001 - 10,000</small>    <!-- dose -->
   <small class="field-hint">Range: 0.1 - 240 hours</small>   <!-- halfLife -->
   <small class="field-hint">Range: 0.1 - 48 hours</small>    <!-- peak -->
   <small class="field-hint">Range: 0.1 - 24 hours</small>    <!-- uptake -->
   <small class="field-hint">Optional. Range: 0.1 - 1,000 hours</small>  <!-- metaboliteLife -->
   ```
   These hints should be linked to their inputs via `aria-describedby` for screen reader support.

3. Add scoped CSS. The styling should:
   - Use the existing CSS custom properties from `base.css` (e.g., `--color-background-soft`, `--color-border`, `--color-text`)
   - Support both light and dark mode (via the custom properties which already handle this)
   - Use a clean, readable form layout

4. Key CSS classes and their styles:

   ```css
   .prescription-form {
     max-width: 600px;
     margin: 0 auto;
   }

   .educational-disclaimer {
     background-color: var(--color-background-soft);
     border: 1px solid var(--color-border);
     border-left: 4px solid #f59e0b; /* amber accent */
     padding: 1rem;
     margin-bottom: 1.5rem;
     border-radius: 4px;
     font-size: 0.875rem;
     line-height: 1.5;
   }

   .form-field {
     margin-bottom: 1rem;
   }

   .form-field label {
     display: block;
     margin-bottom: 0.25rem;
     font-weight: 600;
   }

   .form-field input,
   .form-field select {
     width: 100%;
     padding: 0.5rem;
     border: 1px solid var(--color-border);
     border-radius: 4px;
     background: var(--color-background);
     color: var(--color-text);
     font-size: 1rem;
   }

   .form-field input:focus,
   .form-field select:focus {
     outline: 2px solid #3b82f6;
     outline-offset: 1px;
     border-color: #3b82f6;
   }

   .field-hint {
     display: block;
     color: var(--vt-c-text-light-2);
     font-size: 0.75rem;
     margin-top: 0.25rem;
   }

   .validation-errors {
     background-color: #fef2f2;
     border: 1px solid #fca5a5;
     border-left: 4px solid #ef4444;
     padding: 0.75rem 1rem;
     margin-top: 1rem;
     border-radius: 4px;
   }

   .validation-errors h3 { color: #dc2626; }

   .validation-warnings {
     background-color: #fffbeb;
     border: 1px solid #fcd34d;
     border-left: 4px solid #f59e0b;
     padding: 0.75rem 1rem;
     margin-top: 0.75rem;
     border-radius: 4px;
   }

   .validation-warnings h3 { color: #d97706; }

   button[type="submit"] {
     margin-top: 1.5rem;
     padding: 0.75rem 2rem;
     background-color: #3b82f6;
     color: white;
     border: none;
     border-radius: 4px;
     font-size: 1rem;
     cursor: pointer;
   }

   button[type="submit"]:disabled {
     background-color: var(--color-border);
     cursor: not-allowed;
     opacity: 0.6;
   }

   /* Dark mode adjustments for error/warning containers */
   @media (prefers-color-scheme: dark) {
     .validation-errors {
       background-color: #450a0a;
       border-color: #991b1b;
     }
     .validation-warnings {
       background-color: #451a03;
       border-color: #92400e;
     }
   }
   ```

5. Ensure WCAG AA color contrast compliance:
   - Error text (#dc2626 on #fef2f2) passes AA for normal text (contrast ratio ~7.5:1)
   - Warning text (#d97706 on #fffbeb) passes AA for large text (contrast ratio ~4.2:1); may need adjustment for small text
   - Focus indicators (#3b82f6 outline, 2px) are clearly visible

**Acceptance criteria:**
- [ ] Educational disclaimer renders above the form
- [ ] Disclaimer has `role="note"` for accessibility
- [ ] Hint text appears below each numeric input showing valid range
- [ ] Hint text is linked to inputs via `aria-describedby`
- [ ] Error messages display with red/danger styling
- [ ] Warning messages display with yellow/amber styling
- [ ] Disabled submit button appears visually greyed out
- [ ] Form respects dark mode via CSS custom properties
- [ ] Focus states are clearly visible (2px outline)
- [ ] Form has a max-width and is centered

---

## Testing Strategy

### Test File

`src/components/__tests__/PrescriptionForm.spec.ts`

### Test Organization

Tests follow the TDD approach established in `prescription.spec.ts` -- organized by feature area with descriptive `describe`/`it` blocks.

### Test Plan

```
describe('PrescriptionForm')

  describe('rendering')
    it('renders all required form fields')
    it('renders frequency select with all 8 options')
    it('renders number inputs with correct min/max/step attributes')
    it('renders educational disclaimer text')
    it('renders submit button')
    it('all inputs have associated labels')
    it('renders hint text for numeric fields')

  describe('initial prop')
    it('populates form fields from initial prop')
    it('renders correct number of time inputs matching initial frequency')
    it('defaults to sensible values when no initial prop provided')
    it('preserves initial id for edit mode')

  describe('frequency-times reactivity')
    it('adjusts times to 1 when frequency changes to once')
    it('adjusts times to 2 when frequency changes to bid')
    it('adjusts times to 3 when frequency changes to tid')
    it('adjusts times to 4 when frequency changes to qid')
    it('adjusts times to 4 when frequency changes to q6h')
    it('adjusts times to 3 when frequency changes to q8h')
    it('adjusts times to 2 when frequency changes to q12h')
    it('does not change times when frequency changes to custom')
    it('preserves existing time values when shrinking')
    it('adds default 12:00 when growing')
    it('shows add/remove buttons only for custom frequency')
    it('add button appends a time input')
    it('remove button removes last time input')
    it('remove button is disabled when 1 time remains')

  describe('validation display')
    it('shows no errors when form has valid defaults')
    it('shows error when name is cleared')
    it('shows error when dose is set to 0')
    it('shows error when halfLife is set below minimum')
    it('shows warning when uptake >= halfLife')
    it('shows multiple errors for multiple invalid fields')
    it('error container has role=alert')
    it('warning container has aria-live=polite')

  describe('submit behavior')
    it('submit button is enabled when form is valid')
    it('submit button is disabled when form has errors')
    it('emits submit event with prescription data on valid submit')
    it('does not emit submit event when form is invalid')
    it('emitted prescription matches form field values')
    it('emitted prescription excludes metaboliteLife when undefined')
    it('emitted prescription includes metaboliteLife when provided')

  describe('accessibility')
    it('all inputs have matching label elements')
    it('submit button has aria-disabled when invalid')
    it('times fieldset has a legend')
    it('numeric inputs have aria-describedby pointing to hint text')
```

### Test Utilities

```typescript
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import PrescriptionForm from '../PrescriptionForm.vue'
import type { Prescription } from '@/core/models/prescription'
import {
  SINGLE_DOSE_FIXTURE,
  BID_MULTI_DOSE_FIXTURE,
  IBUPROFEN_FIXTURE,
} from '@/core/models/__tests__/fixtures'

// Helper to mount with defaults
function mountForm(props: { initial?: Prescription } = {}) {
  return mount(PrescriptionForm, { props })
}

// Helper to fill and submit
async function fillAndSubmit(wrapper: VueWrapper, overrides: Partial<Record<string, string>>) {
  for (const [selector, value] of Object.entries(overrides)) {
    await wrapper.find(selector).setValue(value)
  }
  await wrapper.find('form').trigger('submit')
}
```

### Key Testing Patterns

1. **`await nextTick()`** after changing select values to allow Vue's watch to execute and the DOM to update.

2. **`wrapper.find('select#rx-frequency').setValue('tid')`** to trigger the frequency change. Must `await nextTick()` afterward before checking the number of time inputs.

3. **`wrapper.emitted('submit')`** to verify the submit event was emitted and check its payload.

4. **`wrapper.find('button[type="submit"]').attributes('disabled')`** to check submit button state.

5. **Fixture reuse**: Use `BID_MULTI_DOSE_FIXTURE` as the `initial` prop for edit mode tests, and `IBUPROFEN_FIXTURE` (tid) for frequency/times count verification.

### Test Commands

```bash
# Run only PrescriptionForm tests
npm run test:unit -- --run src/components/__tests__/PrescriptionForm.spec.ts

# Run all tests (verify no regressions)
npm run test:unit -- --run

# Watch mode during development
npm run test:unit -- src/components/__tests__/PrescriptionForm.spec.ts
```

---

## Risks and Considerations

### Medium Risk

1. **`v-model.number` and `NaN` behavior**: When a user clears a numeric input, different browsers may bind `NaN`, `''`, or `0` to the ref. The computed `prescription` property must handle this gracefully. Mitigation: The validation function already checks `isNaN()`, so errors will be shown. For `metaboliteLife` (optional), the computed property explicitly filters out `NaN`.

2. **HTML5 `<input type="time">` cross-browser support**: While widely supported, the native time picker UI varies significantly between browsers (Chrome has a nice dropdown, Firefox has a simpler spinner, Safari has limited support). The input still accepts and returns HH:MM strings in all browsers. Mitigation: The `pattern` attribute could be added as a fallback (`pattern="[0-2][0-9]:[0-5][0-9]"`), but the server-side validation already handles format checking.

3. **Frequency select defaulting**: If `initial` prop is not provided, the form defaults to 'bid' with `['09:00', '21:00']`. If the user changes to 'once' then back to 'bid', the second time slot will be '12:00' (not '21:00'). This is expected behavior but could be slightly surprising. Mitigation: Document this in a comment; acceptable for MVP.

### Low Risk

4. **Dark mode error/warning styling**: The hardcoded background colors for error (#fef2f2) and warning (#fffbeb) containers are light-mode colors. The dark mode media query overrides them, but the colors need visual testing. Mitigation: Include dark mode colors in the CSS (already planned in Phase 4).

5. **Form width on mobile**: The `max-width: 600px` constraint is fine for desktop but should be reviewed on mobile. Mitigation: The form uses percentage-based widths and will naturally shrink on smaller screens.

### No Risk

6. **Validation performance**: The `validatePrescription()` function does simple string/number checks. Even with computed property re-evaluation on every keystroke, this is negligible overhead.

7. **Type safety**: With `strict: true` and `strictNullChecks: true`, TypeScript will catch type mismatches at compile time.

---

## Estimated Complexity

**Overall: 6/10 (Medium)**

- Vue 3 Composition API form is straightforward but requires attention to reactivity details
- Dynamic times array with watch requires careful edge case handling
- Validation integration is a pure computed property (simple)
- Accessibility compliance adds implementation overhead
- Styling with dark mode support adds CSS complexity
- Comprehensive test suite is the largest time investment

**Estimated implementation time**: 2-3 hours for code + tests + styling

**Breakdown:**
- Phase 1 (form structure): 30-45 minutes
- Phase 2 (times reactivity): 20-30 minutes
- Phase 3 (validation wiring): 20-30 minutes
- Phase 4 (styling + disclaimer): 30-45 minutes
- Test suite: 45-60 minutes

---

## Implementation Order and Dependencies

```
Phase 1: Form Structure
   |
   +---> Phase 2: Times Reactivity (depends on Phase 1)
   |         |
   +---> Phase 3: Validation Wiring (depends on Phase 1, can parallel with Phase 2)
              |
              +---> Phase 4: Styling + Disclaimer (depends on Phases 1-3)
```

Phase 2 and Phase 3 can be developed in parallel since they modify different parts of the component (Phase 2 adds the watch + template; Phase 3 adds the computed + error display). Phase 4 is purely additive CSS and markup.

However, the **recommended approach is sequential** (Phase 1 -> 2 -> 3 -> 4) because:
- Tests should be written alongside each phase
- Phase 3's validation display depends on having the times array from Phase 2 to fully test cross-field validation
- Phase 4's styling needs the complete template from Phases 1-3

---

## Verification Steps Before Marking Complete

1. **Unit tests pass**: `npm run test:unit -- --run src/components/__tests__/PrescriptionForm.spec.ts`
2. **All tests pass**: `npm run test:unit -- --run` (no regressions)
3. **Type check passes**: `npm run type-check`
4. **Lint passes**: `npm run lint`
5. **Manual verification**: Run `npm run dev`, temporarily mount PrescriptionForm in App.vue, verify:
   - Form renders with all fields
   - Changing frequency adjusts time count
   - Clearing name shows validation error
   - Setting uptake = halfLife shows warning
   - Submit with valid form logs the emitted event (via Vue DevTools or console)
   - Disclaimer is visible
   - Dark mode looks correct
   - Tab navigation works through all fields
6. **Accessibility check**: Use browser DevTools accessibility inspector to verify label associations and ARIA attributes

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `src/components/PrescriptionForm.vue` | CREATE | Main form component with all 4 phases implemented |
| `src/components/__tests__/PrescriptionForm.spec.ts` | CREATE | Comprehensive component test suite (~35-40 tests) |

No existing files are modified. The form component is self-contained and will be consumed by Task 8 (App.vue integration).

---

## Complete Component Skeleton

For reference, here is the high-level structure of the final component:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Prescription, FrequencyLabel, ValidationResult } from '@/core/models/prescription'
import { FREQUENCY_MAP, VALIDATION_RULES, validatePrescription } from '@/core/models/prescription'

// Props & Emits
const props = defineProps<{ initial?: Prescription }>()
const emit = defineEmits<{ submit: [prescription: Prescription] }>()

// Form state (individual refs)
const name = ref(props.initial?.name ?? '')
const frequency = ref<FrequencyLabel>(props.initial?.frequency ?? 'bid')
const times = ref<string[]>(props.initial?.times ? [...props.initial.times] : ['09:00', '21:00'])
const dose = ref(props.initial?.dose ?? 500)
const halfLife = ref(props.initial?.halfLife ?? 6)
const peak = ref(props.initial?.peak ?? 2)
const uptake = ref(props.initial?.uptake ?? 1.5)
const metaboliteLife = ref<number | undefined>(props.initial?.metaboliteLife)

// Phase 2: Watch frequency -> adjust times array
watch(frequency, (newFreq) => { /* ... */ })
function addTime() { /* ... */ }
function removeLastTime() { /* ... */ }

// Phase 3: Validation
const prescription = computed<Prescription>(() => ({ /* assemble from refs */ }))
const validation = computed<ValidationResult>(() => validatePrescription(prescription.value))
const canSubmit = computed(() => validation.value.valid)
function handleSubmit() { /* ... */ }
</script>

<template>
  <div class="prescription-form-container">
    <!-- Phase 4: Educational Disclaimer -->
    <div class="educational-disclaimer" role="note">...</div>

    <form @submit.prevent="handleSubmit" class="prescription-form">
      <!-- Phase 1: All input fields -->
      <!-- Phase 2: Dynamic time inputs with fieldset -->
      <!-- Phase 3: Error/warning display -->
      <!-- Submit button -->
    </form>
  </div>
</template>

<style scoped>
/* Phase 4: All CSS */
</style>
```
