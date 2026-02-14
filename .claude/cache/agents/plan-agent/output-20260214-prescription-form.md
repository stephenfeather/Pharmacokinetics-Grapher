# Implementation Plan: PrescriptionForm Component (Task 6)

Generated: 2026-02-14

## Goal

Build `PrescriptionForm.vue`, a Vue 3 Composition API component that captures all Prescription fields (name, dose, frequency, times, halfLife, peak, uptake, optional metaboliteLife), validates input in real-time using the existing `validatePrescription()` function, dynamically adjusts the times array based on frequency selection, supports both new and edit modes, and emits a validated Prescription object on submit.

## Existing Codebase Analysis

### What already exists (VERIFIED by reading files):

1. **Prescription model and types** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`):
   - `FrequencyLabel` union type: `'once' | 'bid' | 'tid' | 'qid' | 'q6h' | 'q8h' | 'q12h' | 'custom'`
   - `Prescription` interface with fields: `id?`, `name`, `frequency`, `times`, `dose`, `halfLife`, `metaboliteLife?`, `peak`, `uptake`
   - `ValidationResult` interface: `{ valid: boolean; errors: string[]; warnings: string[] }`
   - `FREQUENCY_MAP`: Maps frequency labels to expected time counts (`once:1, bid:2, tid:3, qid:4, q6h:4, q8h:3, q12h:2, custom:null`)
   - `VALIDATION_RULES`: Complete rules object with min/max for all numeric fields
   - `validatePrescription(rx: Prescription): ValidationResult` -- fully implemented with per-field validators and cross-field warnings
   - `KA_KE_TOLERANCE = 0.001`

2. **Barrel exports** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts`):
   - Exports all types and constants from `prescription.ts`

3. **PK Calculator** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/pkCalculator.ts`):
   - `calculateConcentration()` and `getPeakTime()` -- pure functions, no UI dependencies

4. **Storage layer** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/storage/index.ts`):
   - Currently **empty** (`export {}`) -- storage is NOT yet implemented (Task 5 is pending)
   - The form should NOT directly depend on storage; it emits events and the parent handles persistence

5. **Test fixtures** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts`):
   - `SINGLE_DOSE_FIXTURE`, `BID_MULTI_DOSE_FIXTURE`, `IBUPROFEN_FIXTURE`, etc. -- useful for form test data

6. **Existing test pattern** (`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/__tests__/HelloWorld.spec.ts`):
   - Uses `describe/it/expect` from vitest with `mount` from `@vue/test-utils`

7. **App.vue**: Still scaffolded default (HelloWorld + TheWelcome), not yet wired to any PK components

8. **CSS system**: Vue default theme with CSS custom properties (`base.css`), scoped component styles

9. **TypeScript config**: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, path alias `@/*` -> `./src/*`

10. **Dependencies**: Vue 3.5.27, Vitest 4.0.18, @vue/test-utils 2.4.6 -- all installed

### What does NOT exist yet:

- `PrescriptionForm.vue` -- the component we are building
- `prescriptionStorage.ts` implementation (Task 5, pending) -- form should NOT call storage directly
- `GraphViewer.vue` (Task 7 in taskmaster, pending)
- Any Pinia store -- not needed; form uses local refs and emits events

### Key dependency note:

Task 6 depends only on Task 2 (models/validation), which is **done**. The storage layer (Task 5) is NOT a dependency of the form -- the form emits a `submit` event and App.vue (Task 8) handles persistence. This means we can build the form independently right now.

---

## Implementation Phases

### Phase 1: Create the Form Component Structure with All Input Fields

**Files to create:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/PrescriptionForm.vue`

**Steps:**

1. Create the SFC file with `<script setup lang="ts">`, `<template>`, and `<style scoped>` sections.

2. In the `<script setup>` block:
   - Import `ref`, `computed`, `watch` from `vue`
   - Import types: `Prescription`, `FrequencyLabel`, `ValidationResult` from `@/core/models`
   - Import values: `validatePrescription`, `FREQUENCY_MAP`, `VALIDATION_RULES` from `@/core/models`
   - Define props using `defineProps<{ initial?: Prescription }>()` for edit mode support
   - Define emits using `defineEmits<{ submit: [prescription: Prescription]; cancel: [] }>()` (include cancel for edit mode)

3. Create reactive form state refs, initialized from `props.initial` when present:
   ```typescript
   const name = ref(props.initial?.name ?? '')
   const frequency = ref<FrequencyLabel>(props.initial?.frequency ?? 'bid')
   const times = ref<string[]>(props.initial?.times ? [...props.initial.times] : ['09:00', '21:00'])
   const dose = ref(props.initial?.dose ?? 500)
   const halfLife = ref(props.initial?.halfLife ?? 6)
   const peak = ref(props.initial?.peak ?? 2)
   const uptake = ref(props.initial?.uptake ?? 1)
   const metaboliteLife = ref<number | undefined>(props.initial?.metaboliteLife)
   const includeMetaboliteLife = ref(props.initial?.metaboliteLife !== undefined)
   ```

4. Build the template with these input fields:
   - **Drug Name**: `<input type="text" id="name" v-model="name" maxlength="100" required />`
   - **Frequency**: `<select id="frequency" v-model="frequency">` with 8 options showing human-readable labels:
     - `once` -> "Once daily"
     - `bid` -> "BID (twice daily)"
     - `tid` -> "TID (three times daily)"
     - `qid` -> "QID (four times daily)"
     - `q6h` -> "Every 6 hours"
     - `q8h` -> "Every 8 hours"
     - `q12h` -> "Every 12 hours"
     - `custom` -> "Custom schedule"
   - **Dosing Times**: Dynamic array rendered with `v-for="(_, index) in times"` using `<input type="time" v-model="times[index]" />` (native HTML5 time picker produces HH:MM format)
   - **Dose**: `<input type="number" id="dose" v-model.number="dose" :min="0.001" :max="10000" step="any" />`
   - **Half-Life**: `<input type="number" id="halfLife" v-model.number="halfLife" :min="0.1" :max="240" step="0.1" />` with hint "hours"
   - **Peak Time (Tmax)**: `<input type="number" id="peak" v-model.number="peak" :min="0.1" :max="48" step="0.1" />` with hint "hours"
   - **Uptake Time**: `<input type="number" id="uptake" v-model.number="uptake" :min="0.1" :max="24" step="0.1" />` with hint "hours"
   - **Metabolite Half-Life** (optional): Checkbox toggle + `<input type="number" v-model.number="metaboliteLife" :min="0.1" :max="1000" step="0.1" />` shown conditionally

5. Each field group wrapped in a `<div class="field">` with `<label :for="id">` and optional hint text showing valid range.

6. Use `<form @submit.prevent="handleSubmit">` wrapper to prevent page reload.

**Acceptance criteria:**
- [ ] Component renders all 7 required input fields plus optional metaboliteLife
- [ ] Frequency dropdown shows all 8 options with human-readable labels
- [ ] Number inputs have correct min/max/step attributes matching VALIDATION_RULES
- [ ] Time inputs use native HTML5 time picker (type="time")
- [ ] All labels have matching `for` attributes for accessibility
- [ ] `initial` prop populates form fields when provided (edit mode)
- [ ] Component compiles with zero TypeScript errors

---

### Phase 2: Implement Reactive Times Array with Frequency Watch

**Files to modify:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/PrescriptionForm.vue`

**Steps:**

1. Add a `watch` on the `frequency` ref that adjusts the `times` array length:
   ```typescript
   watch(frequency, (newFreq) => {
     const expectedCount = FREQUENCY_MAP[newFreq]
     if (expectedCount === null) return // custom: user manages manually

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

2. For "custom" frequency, add add/remove buttons:
   ```html
   <div v-if="frequency === 'custom'" class="custom-times-controls">
     <button type="button" @click="addTime">+ Add Time</button>
     <button type="button" @click="removeTime" :disabled="times.length <= 1">- Remove Time</button>
   </div>
   ```
   With helper functions:
   ```typescript
   function addTime() {
     times.value.push('12:00')
   }
   function removeTime() {
     if (times.value.length > 1) {
       times.value.pop()
     }
   }
   ```

3. Each time input should show its index label (e.g., "Dose 1", "Dose 2") and include a way to identify it. Use `v-for="(time, index) in times" :key="index"` with the label showing `Dose ${index + 1}`.

4. Ensure the initial times array is cloned from props to avoid mutating parent data.

**Acceptance criteria:**
- [ ] Changing frequency from 'bid' to 'tid' grows times array from 2 to 3 entries
- [ ] Changing frequency from 'qid' to 'once' shrinks times array to 1 entry
- [ ] Selecting 'custom' preserves current times and shows add/remove buttons
- [ ] Add button creates a new time slot with default '12:00'
- [ ] Remove button removes the last time slot (disabled when only 1 remains)
- [ ] Each frequency label maps to correct count per FREQUENCY_MAP

---

### Phase 3: Wire Validation, Display Errors/Warnings, and Handle Submit

**Files to modify:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/PrescriptionForm.vue`

**Steps:**

1. Create a computed `prescription` that assembles the full object from refs:
   ```typescript
   const prescription = computed<Prescription>(() => ({
     ...(props.initial?.id ? { id: props.initial.id } : {}),
     name: name.value.trim(),
     frequency: frequency.value,
     times: [...times.value],
     dose: dose.value,
     halfLife: halfLife.value,
     peak: peak.value,
     uptake: uptake.value,
     ...(includeMetaboliteLife.value && metaboliteLife.value !== undefined
       ? { metaboliteLife: metaboliteLife.value }
       : {}),
   }))
   ```

2. Create a computed validation result:
   ```typescript
   const validation = computed<ValidationResult>(() =>
     validatePrescription(prescription.value)
   )
   const canSubmit = computed(() => validation.value.valid)
   ```

3. Add a `submitted` ref to track whether the user has attempted submission. Only show validation errors after first submission attempt OR after a field has been touched (better UX than showing errors immediately on load):
   ```typescript
   const submitted = ref(false)
   const showErrors = computed(() => submitted.value && validation.value.errors.length > 0)
   const showWarnings = computed(() => validation.value.warnings.length > 0) // Always show warnings
   ```

4. Implement handleSubmit:
   ```typescript
   function handleSubmit() {
     submitted.value = true
     if (canSubmit.value) {
       emit('submit', prescription.value)
     }
   }
   ```

5. Implement handleCancel (for edit mode):
   ```typescript
   function handleCancel() {
     emit('cancel')
   }
   ```

6. Add error and warning display to template:
   ```html
   <!-- Validation Errors -->
   <ul v-if="showErrors" class="validation-errors" role="alert" aria-live="polite">
     <li v-for="error in validation.errors" :key="error">{{ error }}</li>
   </ul>

   <!-- Validation Warnings (always visible when present) -->
   <ul v-if="showWarnings" class="validation-warnings" role="status" aria-live="polite">
     <li v-for="warning in validation.warnings" :key="warning">{{ warning }}</li>
   </ul>
   ```

7. Add submit button with disabled state:
   ```html
   <div class="form-actions">
     <button type="submit" :disabled="submitted && !canSubmit" class="btn-primary">
       {{ props.initial ? 'Update Prescription' : 'Generate Graph' }}
     </button>
     <button v-if="props.initial" type="button" @click="handleCancel" class="btn-secondary">
       Cancel
     </button>
   </div>
   ```

**Acceptance criteria:**
- [ ] Validation runs reactively on every field change via computed
- [ ] Errors are NOT shown before first submit attempt (clean UX on load)
- [ ] After first submit, errors appear and update in real-time
- [ ] Warnings (e.g., uptake >= halfLife) are always visible when applicable
- [ ] Submit button is disabled after failed submission attempt until form becomes valid
- [ ] Successful submit emits `submit` event with complete Prescription object
- [ ] Invalid submit does NOT emit event
- [ ] Cancel button appears in edit mode and emits `cancel` event
- [ ] Edit mode populates form from `initial` prop and preserves `id`
- [ ] Button text changes based on new vs edit mode

---

### Phase 4: Add Form Styling, Accessibility, and Educational Disclaimer

**Files to modify:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/PrescriptionForm.vue` (scoped styles)

**Steps:**

1. Add educational disclaimer at the top of the form template:
   ```html
   <div class="disclaimer" role="note">
     This tool is for visualization and educational purposes only.
     Not for medical dosing decisions. Actual drug levels vary by individual
     (weight, metabolism, food, drug interactions, etc.).
   </div>
   ```

2. Style the form layout using CSS Grid or Flexbox:
   ```css
   .prescription-form {
     max-width: 600px;
     margin: 0 auto;
   }

   .field {
     display: flex;
     flex-direction: column;
     gap: 4px;
     margin-bottom: 16px;
   }

   .field label {
     font-weight: 600;
     color: var(--color-heading);
   }

   .field .hint {
     font-size: 0.85em;
     color: var(--vt-c-text-light-2);
   }

   .field input,
   .field select {
     padding: 8px 12px;
     border: 1px solid var(--color-border);
     border-radius: 4px;
     font-size: 1rem;
     background: var(--color-background);
     color: var(--color-text);
   }

   .field input:focus,
   .field select:focus {
     outline: 2px solid hsla(160, 100%, 37%, 0.5);
     border-color: hsla(160, 100%, 37%, 1);
   }
   ```

3. Style errors (red) and warnings (amber):
   ```css
   .validation-errors {
     background: #FEE2E2;
     border: 1px solid #EF4444;
     border-radius: 4px;
     padding: 12px 12px 12px 32px;
     margin-bottom: 16px;
     color: #991B1B;
   }

   .validation-warnings {
     background: #FEF3C7;
     border: 1px solid #F59E0B;
     border-radius: 4px;
     padding: 12px 12px 12px 32px;
     margin-bottom: 16px;
     color: #92400E;
   }
   ```

4. Style disclaimer:
   ```css
   .disclaimer {
     background: #FEF3C7;
     border: 1px solid #F59E0B;
     border-radius: 4px;
     padding: 12px;
     margin-bottom: 24px;
     font-size: 0.9em;
     color: #92400E;
     line-height: 1.5;
   }
   ```

5. Style buttons:
   ```css
   .btn-primary {
     background: hsla(160, 100%, 37%, 1);
     color: white;
     border: none;
     padding: 10px 24px;
     border-radius: 4px;
     font-size: 1rem;
     cursor: pointer;
   }

   .btn-primary:disabled {
     opacity: 0.5;
     cursor: not-allowed;
   }

   .btn-secondary {
     background: transparent;
     border: 1px solid var(--color-border);
     padding: 10px 24px;
     border-radius: 4px;
     font-size: 1rem;
     cursor: pointer;
     color: var(--color-text);
   }
   ```

6. Add proper accessibility attributes:
   - `aria-required="true"` on required fields
   - `aria-describedby` linking inputs to their hint text and error messages
   - `role="alert"` on error list, `role="status"` on warning list
   - `aria-live="polite"` for dynamic error/warning updates
   - `aria-disabled` on disabled submit button

7. Add range hint text below each numeric input:
   - Dose: "0.001 - 10,000 (from prescription)"
   - Half-life: "0.1 - 240 hours (from pharmacy insert)"
   - Peak time: "0.1 - 48 hours (Tmax from insert)"
   - Uptake: "0.1 - 24 hours (from pharmacy insert)"
   - Metabolite half-life: "0.1 - 1,000 hours (if relevant)"

8. Support dark mode via existing CSS custom properties (the base.css already defines dark-mode variables via `prefers-color-scheme: dark`).

**Acceptance criteria:**
- [ ] Disclaimer text renders above the form
- [ ] All inputs have associated labels for accessibility
- [ ] Error messages use role="alert" for screen readers
- [ ] Range hints appear below each numeric input
- [ ] Form is visually readable in both light and dark mode
- [ ] Disabled submit button appears greyed out
- [ ] WCAG AA color contrast met for all text

---

## Phase 5: Comprehensive Component Tests

**Files to create:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/__tests__/PrescriptionForm.spec.ts`

**Steps:**

1. Set up test file following existing pattern from `HelloWorld.spec.ts` and `prescription.spec.ts`:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest'
   import { mount, VueWrapper } from '@vue/test-utils'
   import PrescriptionForm from '../PrescriptionForm.vue'
   import type { Prescription, FrequencyLabel } from '@/core/models'
   import { FREQUENCY_MAP } from '@/core/models'
   import {
     SINGLE_DOSE_FIXTURE,
     BID_MULTI_DOSE_FIXTURE,
     IBUPROFEN_FIXTURE,
   } from '@/core/models/__tests__/fixtures'
   ```

2. Test categories and specific tests:

   **Rendering tests:**
   - Mount component, verify all input fields render (name, frequency, dose, halfLife, peak, uptake, at least one time input)
   - Verify frequency select has all 8 options
   - Verify number inputs have proper min/max attributes
   - Verify disclaimer text renders
   - Verify submit button renders with correct text ("Generate Graph" for new)
   - Verify no cancel button when `initial` prop is absent

   **Edit mode tests:**
   - Mount with `initial` prop set to BID_MULTI_DOSE_FIXTURE
   - Verify form fields populated from initial prop
   - Verify submit button text shows "Update Prescription"
   - Verify cancel button appears
   - Verify clicking cancel emits `cancel` event

   **Frequency/times reactivity tests:**
   - Set frequency to 'tid', verify times array grows to 3
   - Set frequency to 'once', verify times array shrinks to 1
   - Set frequency to 'qid', verify 4 time inputs render
   - Set frequency to 'custom', verify add/remove buttons appear
   - Click add button, verify new time input added
   - Click remove button, verify time input removed
   - Verify remove button disabled when only 1 time remains

   **Validation display tests:**
   - Submit empty form, verify errors displayed
   - Fill all fields validly, verify no errors
   - Set uptake >= halfLife, verify warning displayed (not error)
   - Verify errors only appear after first submit attempt
   - Verify warnings appear even before submit

   **Submit behavior tests:**
   - Fill valid form, click submit, verify `submit` event emitted
   - Verify emitted prescription matches form values
   - Submit with invalid form, verify NO `submit` event emitted
   - Verify submit button disabled state after failed submit

   **Edge case tests:**
   - Enter 101-character name, submit, verify name validation error
   - Enter dose of 0, submit, verify dose validation error
   - Set frequency to 'bid' with 1 time, submit, verify times mismatch error
   - Enter time in invalid format (if possible via programmatic setValue)

3. Use the `makeValid` helper pattern from prescription.spec.ts to create test data.

4. Use `wrapper.find('input#name')`, `wrapper.find('select#frequency')`, etc. for field selection.

5. Use `await wrapper.find('form').trigger('submit')` and `await nextTick()` for reactivity.

**Acceptance criteria:**
- [ ] All rendering tests pass
- [ ] All edit mode tests pass
- [ ] All frequency/times reactivity tests pass
- [ ] All validation display tests pass
- [ ] All submit behavior tests pass
- [ ] All edge case tests pass
- [ ] Tests run with `npm run test:unit -- src/components/__tests__/PrescriptionForm.spec.ts`
- [ ] Zero TypeScript errors in test file

---

## Complete Template Reference

For clarity, here is the full recommended template structure (showing field ordering and layout):

```html
<form @submit.prevent="handleSubmit" class="prescription-form">
  <!-- Educational Disclaimer -->
  <div class="disclaimer" role="note">...</div>

  <!-- Section: Drug Information -->
  <fieldset>
    <legend>Drug Information</legend>

    <!-- Drug Name -->
    <div class="field">
      <label for="rx-name">Drug Name</label>
      <input id="rx-name" v-model="name" type="text" ... />
    </div>

    <!-- Dose -->
    <div class="field">
      <label for="rx-dose">Dose</label>
      <input id="rx-dose" v-model.number="dose" type="number" ... />
      <span class="hint">0.001 - 10,000 (as written on prescription)</span>
    </div>
  </fieldset>

  <!-- Section: Dosing Schedule -->
  <fieldset>
    <legend>Dosing Schedule</legend>

    <!-- Frequency -->
    <div class="field">
      <label for="rx-frequency">Dosing Frequency</label>
      <select id="rx-frequency" v-model="frequency">...</select>
    </div>

    <!-- Times -->
    <div class="field">
      <label>Dosing Times</label>
      <div v-for="(_, index) in times" :key="index" class="time-entry">
        <label :for="`rx-time-${index}`">Dose {{ index + 1 }}</label>
        <input :id="`rx-time-${index}`" v-model="times[index]" type="time" />
      </div>
      <!-- Custom add/remove buttons -->
    </div>
  </fieldset>

  <!-- Section: Pharmacokinetic Parameters -->
  <fieldset>
    <legend>Pharmacokinetic Parameters (from pharmacy insert)</legend>

    <!-- Half-Life -->
    <div class="field">
      <label for="rx-halflife">Half-Life</label>
      <input id="rx-halflife" v-model.number="halfLife" type="number" ... />
      <span class="hint">0.1 - 240 hours</span>
    </div>

    <!-- Peak Time -->
    <div class="field">
      <label for="rx-peak">Peak Time (Tmax)</label>
      <input id="rx-peak" v-model.number="peak" type="number" ... />
      <span class="hint">0.1 - 48 hours</span>
    </div>

    <!-- Uptake Time -->
    <div class="field">
      <label for="rx-uptake">Uptake (Absorption Time)</label>
      <input id="rx-uptake" v-model.number="uptake" type="number" ... />
      <span class="hint">0.1 - 24 hours</span>
    </div>

    <!-- Metabolite Half-Life (optional) -->
    <div class="field">
      <label>
        <input type="checkbox" v-model="includeMetaboliteLife" />
        Include Metabolite Half-Life
      </label>
      <div v-if="includeMetaboliteLife">
        <input id="rx-metabolite" v-model.number="metaboliteLife" type="number" ... />
        <span class="hint">0.1 - 1,000 hours (informational only for MVP)</span>
      </div>
    </div>
  </fieldset>

  <!-- Validation Messages -->
  <ul v-if="showErrors" class="validation-errors" role="alert">...</ul>
  <ul v-if="showWarnings" class="validation-warnings" role="status">...</ul>

  <!-- Actions -->
  <div class="form-actions">
    <button type="submit" :disabled="submitted && !canSubmit">...</button>
    <button v-if="props.initial" type="button" @click="handleCancel">Cancel</button>
  </div>
</form>
```

---

## Testing Strategy

### Unit/component test structure:
```
src/components/__tests__/PrescriptionForm.spec.ts
  - Rendering (7 tests)
  - Edit mode (5 tests)
  - Frequency/times reactivity (7 tests)
  - Validation display (5 tests)
  - Submit behavior (4 tests)
  - Edge cases (4 tests)
  Total: ~32 tests
```

### Test commands:
```bash
# Run form component tests only
npm run test:unit -- src/components/__tests__/PrescriptionForm.spec.ts

# Run all tests to verify no regressions
npm run test:unit

# Type check
npm run type-check

# Lint
npm run lint
```

### Manual verification:
- Start dev server with `npm run dev`
- Load the form in browser
- Test each frequency option and observe times array changes
- Enter invalid data, attempt submit, observe error messages
- Enter valid data, observe warnings for atypical parameters
- Submit valid form, confirm event emission via Vue DevTools

---

## Risks and Considerations

1. **Native `<input type="time">` behavior varies by browser.** Safari on desktop historically had poor time picker support. Fallback: accept plain text input with the existing HH:MM regex validation as a safety net. The validation layer already enforces `^([01]\d|2[0-3]):([0-5]\d)$` format, so any browser that returns a different format will be caught. Mitigated by the fact that this is an educational tool, not production medical software.

2. **`v-model.number` on empty/cleared number inputs.** When a user clears a number field, `v-model.number` may produce `NaN` or `0`. The existing `validateDose`, `validateHalfLife`, etc. all check for `NaN` and return appropriate error messages, so this is handled. However, for UX, consider setting `inputmode="decimal"` on mobile for better keyboard support.

3. **Performance of reactive validation.** Computed `validation` re-runs on every keystroke since it depends on all form refs. With only ~8 fields and one `validatePrescription()` call (which is pure string/number checks), this is trivially fast. No debouncing needed.

4. **Storage layer not yet built.** The form does NOT directly depend on storage -- it emits events. The parent component (App.vue in Task 8) will handle persistence. This is the correct architectural boundary.

5. **The `peak` field is stored but not used in calculations.** Per CLAUDE.md: "peak is stored for reference/documentation but not directly used in the equation." The form should still collect it (pharmacy inserts provide it), but consider adding a subtle hint noting it's for reference.

6. **Dark mode support.** The form should use existing CSS custom properties (`--color-text`, `--color-background`, `--color-border`, etc.) rather than hardcoded colors. The disclaimer and error/warning boxes will need dark mode variants. Use `@media (prefers-color-scheme: dark)` overrides for the colored boxes that use hardcoded hex values.

---

## Estimated Complexity

**Taskmaster rating: 6/10** (medium-high)

- The core form is straightforward Vue 3 reactive state
- The frequency-to-times reactivity adds moderate complexity
- The validation integration is simple (just call existing function)
- The main effort is in the test suite (~32 tests) and accessibility details
- No external dependencies needed beyond what's already installed

**Estimated implementation time:** 2-3 focused sessions

### Suggested implementation order:
1. Phase 1 + Phase 2 together (form structure + times reactivity) -- they're tightly coupled
2. Phase 3 (validation wiring + submit)
3. Phase 4 (styling + accessibility)
4. Phase 5 (tests) -- can be done partially in parallel with phases 1-3 via TDD

---

## Dependencies Summary

| Dependency | Status | Impact |
|---|---|---|
| Task 2: Prescription models + validation | DONE | Required -- exports types, FREQUENCY_MAP, validatePrescription |
| Task 5: Storage layer | PENDING | NOT required -- form emits events, doesn't call storage |
| Task 7/taskmaster: GraphViewer | PENDING | NOT required -- independent component |
| Task 8/taskmaster: App.vue integration | PENDING | Downstream consumer of PrescriptionForm |
| vue 3.5.27 | INSTALLED | Core framework |
| @vue/test-utils 2.4.6 | INSTALLED | Component testing |
| vitest 4.0.18 | INSTALLED | Test runner |

---

## Files Summary

| File | Action | Purpose |
|---|---|---|
| `src/components/PrescriptionForm.vue` | CREATE | The form component |
| `src/components/__tests__/PrescriptionForm.spec.ts` | CREATE | Component tests (~32 tests) |
| `src/core/models/prescription.ts` | READ ONLY | Consume types, FREQUENCY_MAP, validatePrescription |
| `src/core/models/__tests__/fixtures.ts` | READ ONLY | Reuse test fixtures |
