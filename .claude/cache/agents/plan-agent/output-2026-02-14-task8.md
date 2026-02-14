# Implementation Plan: Task 8 -- Integrate Form, Calculations, and Graph in App.vue

Generated: 2026-02-14

## Goal

Wire together PrescriptionForm, the calculation layer (pkCalculator + multiDoseProfile), and GraphViewer in App.vue to create the complete user flow: enter prescription data via form, run pharmacokinetic calculations, display the concentration curve graph, and persist prescriptions to localStorage. This is the central integration task that connects all previously-built modules into a working application.

## Existing Codebase Analysis

### Current State (VERIFIED)

**Completed (Tasks 1-3):**
- Task 1 (done): Vue 3 + TypeScript project scaffolded with Vite, Chart.js installed, directory structure created
- Task 2 (done): Prescription data models and validation in `src/core/models/prescription.ts` -- exports `Prescription`, `FrequencyLabel`, `TimeSeriesPoint`, `GraphDataset`, `ValidationResult`, `FREQUENCY_MAP`, `VALIDATION_RULES`, `KA_KE_TOLERANCE`, `validatePrescription()`
- Task 3 (done): Single-dose PK calculator in `src/core/calculations/pkCalculator.ts` -- exports `calculateConcentration()`, `getPeakTime()`, `ABSORPTION_CONSTANT`

**Not Yet Implemented (Tasks 4-7 -- Task 8 dependencies):**
- Task 4 (pending): Multi-dose accumulation calculator -- `accumulateDoses()`, `getGraphData()`, `timeStringToHours()`, `expandDoseTimes()` in `src/core/calculations/multiDoseProfile.ts`
- Task 5 (pending): localStorage storage layer -- `savePrescription()`, `getAllPrescriptions()`, etc. in `src/core/storage/prescriptionStorage.ts`
- Task 6 (pending): PrescriptionForm.vue component -- emits `submit` event with `Prescription` object, accepts optional `initial` prop
- Task 7 (pending): GraphViewer.vue component -- accepts `datasets: GraphDataset[]`, `startHours?: number`, `endHours?: number` props

**Current App.vue:** Default Vue 3 scaffold with HelloWorld/TheWelcome boilerplate (lines 1-48). Must be completely rewritten.

**Storage barrel export:** `src/core/storage/index.ts` currently exports nothing (`export {}`).

**Calculations barrel export:** `src/core/calculations/index.ts` currently exports only from pkCalculator (no multiDoseProfile yet).

### Key Integration Points

| Module | File | API Task 8 Needs |
|--------|------|------------------|
| Models | `src/core/models/prescription.ts` | `Prescription`, `GraphDataset` types |
| Models barrel | `src/core/models/index.ts` | Re-exports all types |
| Multi-dose calc | `src/core/calculations/multiDoseProfile.ts` (Task 4) | `getGraphData(prescriptions, startHours, endHours): GraphDataset[]` |
| Calculations barrel | `src/core/calculations/index.ts` | Must add `getGraphData` re-export after Task 4 |
| Storage | `src/core/storage/prescriptionStorage.ts` (Task 5) | `savePrescription(rx): Prescription`, `getAllPrescriptions(): Prescription[]` |
| Storage barrel | `src/core/storage/index.ts` | Must add re-exports after Task 5 |
| Form component | `src/components/PrescriptionForm.vue` (Task 6) | `emit('submit', prescription: Prescription)`, `props.initial?: Prescription` |
| Graph component | `src/components/GraphViewer.vue` (Task 7) | `props.datasets: GraphDataset[]`, `props.startHours?: number`, `props.endHours?: number` |

### CSS Architecture

`src/assets/main.css` imports `base.css` and sets up a 1280px max-width container with 2-column grid at desktop. The App.vue scoped styles will need to override the grid layout to use a single-column flow for the form-to-graph workflow.

## Prerequisites Checklist

Before implementing Task 8, these MUST be complete and verified:

- [ ] Task 4: `getGraphData()` is callable and returns `GraphDataset[]`
- [ ] Task 5: `savePrescription()` and `getAllPrescriptions()` are callable
- [ ] Task 6: `PrescriptionForm.vue` exists and emits `submit` with `Prescription`
- [ ] Task 7: `GraphViewer.vue` exists and accepts `datasets`/`startHours`/`endHours` props
- [ ] Barrel exports in `src/core/calculations/index.ts` include `getGraphData`
- [ ] Barrel exports in `src/core/storage/index.ts` include `savePrescription`, `getAllPrescriptions`

## Implementation Phases

### Phase 1: Set Up App.vue State Management and Computed Graph Datasets (Subtask 8.1)

**Files to modify:**
- `src/App.vue` -- complete rewrite of `<script setup>` section

**Steps:**

1. **Remove boilerplate imports and content.** Delete `HelloWorld` and `TheWelcome` imports and all existing template/style content.

2. **Add all required imports:**
   ```typescript
   import { ref, computed } from 'vue'
   import type { Prescription, GraphDataset } from '@/core/models'
   import { getGraphData } from '@/core/calculations'
   import { savePrescription, getAllPrescriptions } from '@/core/storage/prescriptionStorage'
   import PrescriptionForm from '@/components/PrescriptionForm.vue'
   import GraphViewer from '@/components/GraphViewer.vue'
   ```
   Note: Import from barrel `@/core/models` and `@/core/calculations` where available. Import storage from direct path since barrel may not be updated.

3. **Define reactive state refs:**
   ```typescript
   const currentPrescription = ref<Prescription | null>(null)
   const savedPrescriptions = ref<Prescription[]>(getAllPrescriptions())
   const showForm = ref(true)
   const showGraph = ref(false)
   ```

4. **Define timeframe settings refs:**
   ```typescript
   const startHours = ref(0)
   const endHours = ref(48)
   ```
   - `startHours` defaults to 0 (simulation begins at first dose)
   - `endHours` defaults to 48 (2 days -- enough to show accumulation for typical bid dosing)

5. **Implement computed `graphDatasets`:**
   ```typescript
   const graphDatasets = computed<GraphDataset[]>(() => {
     if (!currentPrescription.value) return []
     return getGraphData([currentPrescription.value], startHours.value, endHours.value)
   })
   ```
   This recomputes reactively whenever `currentPrescription`, `startHours`, or `endHours` change.

**Acceptance criteria:**
- [ ] All imports resolve without TypeScript errors
- [ ] `currentPrescription` starts as `null`
- [ ] `showForm` starts as `true`, `showGraph` as `false`
- [ ] `graphDatasets` returns `[]` when `currentPrescription` is `null`
- [ ] `graphDatasets` calls `getGraphData` with correct arguments when prescription exists
- [ ] `savedPrescriptions` initializes from `getAllPrescriptions()` on mount

**Test verification (unit test):**
- Create `src/__tests__/App.spec.ts`
- Test that graphDatasets computed returns empty array when currentPrescription is null
- Test that graphDatasets computes correctly when a Prescription ref is set (requires mocking `getGraphData`)
- Test that timeframe defaults are correct (startHours=0, endHours=48)

**Edge cases:**
- `getAllPrescriptions()` may throw if localStorage is corrupted -- Task 5 handles this with try/catch returning `[]`
- If Task 5 is not complete when testing, mock the storage imports

---

### Phase 2: Implement Form Submission Handler and View Switching Logic (Subtask 8.2)

**Files to modify:**
- `src/App.vue` -- add handler functions and template

**Depends on:** Phase 1 (needs refs to exist)

**Steps:**

1. **Implement `handleFormSubmit`:**
   ```typescript
   function handleFormSubmit(rx: Prescription) {
     currentPrescription.value = rx
     showForm.value = false
     showGraph.value = true
   }
   ```
   This receives the validated Prescription from PrescriptionForm's `submit` event and switches the view.

2. **Implement `newPrescription`:**
   ```typescript
   function newPrescription() {
     currentPrescription.value = null
     showForm.value = true
     showGraph.value = false
   }
   ```
   Resets state and returns to form view.

3. **Write the complete template:**
   ```html
   <template>
     <main class="app">
       <header class="app-header">
         <h1>Pharmacokinetics Grapher</h1>
         <p class="subtitle">Educational visualization of medication concentration over time</p>
       </header>

       <div class="disclaimer-banner" role="alert">
         <strong>Important:</strong> This app is for educational and visualization purposes only.
         Not for medical dosing decisions. Actual drug levels vary by individual
         (weight, metabolism, food interactions, etc.). Always follow prescriptions
         written by licensed healthcare providers.
       </div>

       <PrescriptionForm
         v-if="showForm"
         @submit="handleFormSubmit"
       />

       <div v-if="showGraph" class="graph-section">
         <GraphViewer
           :datasets="graphDatasets"
           :start-hours="startHours"
           :end-hours="endHours"
         />

         <!-- Controls and actions added in Phase 3 -->
       </div>
     </main>
   </template>
   ```

4. **Verify prop naming:** GraphViewer uses camelCase props (`startHours`, `endHours`). In templates, Vue auto-converts between kebab-case (`:start-hours`) and camelCase. Use kebab-case in template for consistency with Vue conventions.

**Acceptance criteria:**
- [ ] Clicking "Generate Graph" on PrescriptionForm triggers `handleFormSubmit`
- [ ] After submission, form hides (`showForm = false`) and graph section shows (`showGraph = true`)
- [ ] GraphViewer receives computed datasets reactively
- [ ] "New Prescription" button resets to form view
- [ ] Educational disclaimer is visible at all times (not inside conditional blocks)

**Test verification (component test):**
- Mount App component
- Verify PrescriptionForm renders initially
- Simulate form submission with a valid Prescription object
- Verify GraphViewer renders after submission
- Verify PrescriptionForm is hidden after submission
- Click "New Prescription" button, verify form returns

**Potential issues:**
- PrescriptionForm's `@submit` event signature must match `handleFormSubmit(rx: Prescription)`. If PrescriptionForm emits the event differently (e.g., wrapping in an object), the handler must adapt.
- GraphViewer may not render correctly in jsdom test environment (Chart.js needs canvas). Tests may need to mock Chart.js or use `canvas` npm package for jsdom.

---

### Phase 3: Add Save Functionality, Timeframe Slider, and UI Controls (Subtask 8.3)

**Files to modify:**
- `src/App.vue` -- add save handler, slider, styles

**Depends on:** Phase 1 + Phase 2 (needs refs and template structure)

**Steps:**

1. **Implement `saveCurrentPrescription`:**
   ```typescript
   function saveCurrentPrescription() {
     if (currentPrescription.value) {
       const saved = savePrescription(currentPrescription.value)
       savedPrescriptions.value = getAllPrescriptions()
       currentPrescription.value = saved
     }
   }
   ```
   - Calls `savePrescription()` which assigns an ID and persists to localStorage
   - Refreshes `savedPrescriptions` list from storage (for future PrescriptionList component)
   - Updates `currentPrescription` to the saved version (now has an `id` field)

2. **Add timeframe slider to template (inside `.graph-section`):**
   ```html
   <div class="graph-controls">
     <label for="timeframe-slider">
       Timeframe: {{ startHours }}h to {{ endHours }}h
     </label>
     <input
       id="timeframe-slider"
       type="range"
       v-model.number="endHours"
       min="12"
       max="168"
       step="12"
     />
     <span class="timeframe-hint">Drag to adjust simulation duration (12h to 7 days)</span>
   </div>
   ```
   - Range: 12h (half day) to 168h (7 days)
   - Step: 12h increments for clean intervals
   - `v-model.number` ensures the value stays as a number, not string
   - Changing the slider reactively updates `endHours`, which triggers `graphDatasets` recomputation, which triggers GraphViewer re-render

3. **Add action buttons:**
   ```html
   <div class="actions">
     <button class="btn btn-primary" @click="saveCurrentPrescription">
       Save Prescription
     </button>
     <button class="btn btn-secondary" @click="newPrescription">
       New Prescription
     </button>
   </div>
   ```

4. **Add scoped CSS styles:**
   ```css
   <style scoped>
   .app {
     max-width: 800px;
     margin: 0 auto;
     padding: 1rem;
   }

   .app-header {
     text-align: center;
     margin-bottom: 1.5rem;
   }

   .app-header h1 {
     margin: 0;
     font-size: 1.8rem;
     color: #1a1a2e;
   }

   .subtitle {
     color: #666;
     margin-top: 0.25rem;
   }

   .disclaimer-banner {
     background: #FEF3C7;
     border: 1px solid #F59E0B;
     border-radius: 6px;
     padding: 12px 16px;
     margin-bottom: 1.5rem;
     font-size: 0.9rem;
     line-height: 1.5;
     color: #92400E;
   }

   .graph-section {
     display: flex;
     flex-direction: column;
     gap: 1rem;
   }

   .graph-controls {
     display: flex;
     flex-direction: column;
     gap: 0.5rem;
     padding: 1rem;
     background: #f8f9fa;
     border-radius: 6px;
   }

   .graph-controls label {
     font-weight: 600;
     font-size: 0.95rem;
   }

   .graph-controls input[type="range"] {
     width: 100%;
     cursor: pointer;
   }

   .timeframe-hint {
     font-size: 0.8rem;
     color: #666;
   }

   .actions {
     display: flex;
     gap: 0.75rem;
     justify-content: center;
     margin-top: 0.5rem;
   }

   .btn {
     padding: 0.6rem 1.5rem;
     border: none;
     border-radius: 6px;
     font-size: 1rem;
     cursor: pointer;
     transition: background-color 0.2s;
   }

   .btn-primary {
     background: #3B82F6;
     color: white;
   }

   .btn-primary:hover {
     background: #2563EB;
   }

   .btn-secondary {
     background: #E5E7EB;
     color: #374151;
   }

   .btn-secondary:hover {
     background: #D1D5DB;
   }
   </style>
   ```

5. **Update `src/assets/main.css`** to remove the 2-column grid that interferes with single-column app flow:
   - The existing `@media (min-width: 1024px)` block sets `grid-template-columns: 1fr 1fr` which would split the layout. This should be removed or overridden since the app is a single-column flow (form then graph), not a two-panel layout.

**Acceptance criteria:**
- [ ] "Save Prescription" button persists current prescription to localStorage
- [ ] After saving, `currentPrescription` has an `id` field
- [ ] Timeframe slider adjusts `endHours` between 12 and 168 in steps of 12
- [ ] Moving the slider causes the graph to re-render with new time range
- [ ] Label above slider shows current timeframe range
- [ ] Layout uses flexbox for clean vertical stacking
- [ ] Disclaimer banner is visually prominent with warning colors
- [ ] Buttons have clear visual hierarchy (primary=blue save, secondary=gray new)

**Test verification:**
- Integration test: submit prescription, click "Save", verify localStorage contains the prescription via `getAllPrescriptions()`
- Reactivity test: change `endHours` ref value, verify `graphDatasets` recomputes with new `endHours`
- Manual browser test: verify slider interaction updates graph in real time

**Edge cases:**
- Saving the same prescription twice should create two entries with different IDs (since `savePrescription` always generates a new ID)
- If `currentPrescription` is null when save is clicked, the guard (`if (currentPrescription.value)`) prevents errors
- Slider step of 12 means possible values are: 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168

---

## Complete App.vue Reference

The final `src/App.vue` file after all three phases:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Prescription, GraphDataset } from '@/core/models'
import { getGraphData } from '@/core/calculations'
import {
  savePrescription,
  getAllPrescriptions,
} from '@/core/storage/prescriptionStorage'
import PrescriptionForm from '@/components/PrescriptionForm.vue'
import GraphViewer from '@/components/GraphViewer.vue'

// ---- State ----
const currentPrescription = ref<Prescription | null>(null)
const savedPrescriptions = ref<Prescription[]>(getAllPrescriptions())
const showForm = ref(true)
const showGraph = ref(false)

// ---- Timeframe settings ----
const startHours = ref(0)
const endHours = ref(48)

// ---- Computed graph data ----
const graphDatasets = computed<GraphDataset[]>(() => {
  if (!currentPrescription.value) return []
  return getGraphData(
    [currentPrescription.value],
    startHours.value,
    endHours.value,
  )
})

// ---- Handlers ----
function handleFormSubmit(rx: Prescription) {
  currentPrescription.value = rx
  showForm.value = false
  showGraph.value = true
}

function saveCurrentPrescription() {
  if (currentPrescription.value) {
    const saved = savePrescription(currentPrescription.value)
    savedPrescriptions.value = getAllPrescriptions()
    currentPrescription.value = saved
  }
}

function newPrescription() {
  currentPrescription.value = null
  showForm.value = true
  showGraph.value = false
}
</script>

<template>
  <main class="app">
    <header class="app-header">
      <h1>Pharmacokinetics Grapher</h1>
      <p class="subtitle">
        Educational visualization of medication concentration over time
      </p>
    </header>

    <div class="disclaimer-banner" role="alert">
      <strong>Important:</strong> This app is for educational and visualization
      purposes only. Not for medical dosing decisions. Actual drug levels vary
      by individual (weight, metabolism, food interactions, etc.). Always follow
      prescriptions written by licensed healthcare providers.
    </div>

    <PrescriptionForm v-if="showForm" @submit="handleFormSubmit" />

    <div v-if="showGraph" class="graph-section">
      <GraphViewer
        :datasets="graphDatasets"
        :start-hours="startHours"
        :end-hours="endHours"
      />

      <div class="graph-controls">
        <label for="timeframe-slider">
          Timeframe: {{ startHours }}h to {{ endHours }}h
        </label>
        <input
          id="timeframe-slider"
          type="range"
          v-model.number="endHours"
          min="12"
          max="168"
          step="12"
        />
        <span class="timeframe-hint">
          Drag to adjust simulation duration (12h to 7 days)
        </span>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="saveCurrentPrescription">
          Save Prescription
        </button>
        <button class="btn btn-secondary" @click="newPrescription">
          New Prescription
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.app-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.app-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #1a1a2e;
}

.subtitle {
  color: #666;
  margin-top: 0.25rem;
}

.disclaimer-banner {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #92400e;
}

.graph-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.graph-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.graph-controls label {
  font-weight: 600;
  font-size: 0.95rem;
}

.graph-controls input[type='range'] {
  width: 100%;
  cursor: pointer;
}

.timeframe-hint {
  font-size: 0.8rem;
  color: #666;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}
</style>
```

---

## Testing Strategy

### Test File: `src/__tests__/App.spec.ts`

This file should cover the integration between App.vue and its child components.

**Mocking strategy:** Since Tasks 4-7 create the modules App.vue depends on, tests should either:
1. Import real modules (integration test) -- preferred if all dependencies are built
2. Mock the imports (unit test) -- use `vi.mock()` for isolation

**Recommended approach: Mock child components and imports for unit-level testing, with a separate integration test that uses real modules.**

```typescript
// src/__tests__/App.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

// Mock the storage module
vi.mock('@/core/storage/prescriptionStorage', () => ({
  getAllPrescriptions: vi.fn(() => []),
  savePrescription: vi.fn((rx) => ({ ...rx, id: 'rx-mock-123' })),
}))

// Mock getGraphData
vi.mock('@/core/calculations', () => ({
  getGraphData: vi.fn(() => [{
    label: 'Test Drug (bid)',
    data: [{ time: 0, concentration: 0 }, { time: 1, concentration: 0.5 }],
    color: '#3B82F6',
  }]),
}))
```

**Test cases:**

| Test | What it verifies |
|------|------------------|
| Renders disclaimer banner | Educational disclaimer always visible |
| Shows form initially | `showForm` defaults to true |
| Hides graph initially | `showGraph` defaults to false |
| Form submit shows graph | handleFormSubmit switches views |
| New Prescription returns to form | newPrescription resets state |
| Save persists to storage | saveCurrentPrescription calls savePrescription |
| Slider updates endHours | Range input v-model binding |
| graphDatasets empty when no rx | Computed returns [] |
| graphDatasets computes when rx set | Computed calls getGraphData |

### Manual Browser Testing Checklist

After implementation, verify in the browser:

1. Open `npm run dev`
2. Verify disclaimer banner is visible
3. Fill form with: name="Test", frequency=bid, dose=500, halfLife=6, peak=2, uptake=1
4. Click "Generate Graph" -- graph should appear with concentration curve
5. Verify curve shape: two peaks per 24h cycle with accumulation
6. Drag timeframe slider to 168h -- graph should update to show 7 days
7. Click "Save Prescription" -- check DevTools > Application > localStorage
8. Click "New Prescription" -- form reappears, graph disappears
9. Verify no console errors

---

## Barrel Export Updates Required

After Tasks 4 and 5 are complete, the barrel exports need updating. This may be done as part of those tasks, but must be verified before Task 8 implementation.

### `src/core/calculations/index.ts` (after Task 4)
```typescript
// Pharmacokinetic calculation functions
export {
  calculateConcentration,
  getPeakTime,
  ABSORPTION_CONSTANT,
} from './pkCalculator'

export {
  accumulateDoses,
  getGraphData,
  timeStringToHours,
  expandDoseTimes,
} from './multiDoseProfile'
```

### `src/core/storage/index.ts` (after Task 5)
```typescript
// Prescription storage and persistence
export {
  getAllPrescriptions,
  getPrescription,
  savePrescription,
  updatePrescription,
  deletePrescription,
  duplicatePrescription,
  clearAllPrescriptions,
  getStorageUsage,
} from './prescriptionStorage'
```

If these barrels are not updated by Tasks 4/5, Task 8 implementation should import directly from the module files (e.g., `from '@/core/calculations/multiDoseProfile'` and `from '@/core/storage/prescriptionStorage'`) rather than from barrels.

---

## CSS Architecture Note

The existing `src/assets/main.css` has a `@media (min-width: 1024px)` block that sets `#app` to a two-column grid. This will cause App.vue's single-column layout to split incorrectly on desktop. Two approaches:

**Option A (recommended):** Override in App.vue scoped styles:
```css
/* No override needed -- scoped .app class on <main> avoids the #app grid */
```
Since the `<main class="app">` is a child of `#app`, the grid applies to `#app`'s direct children, which is just `<main>`. The `<main>` itself would become one grid cell. This works fine since there is only one direct child of `#app`. The internal layout of `.app` is controlled by its own styles.

**Option B:** If visual issues occur, modify `main.css` to remove the grid:
```css
@media (min-width: 1024px) {
  body {
    display: flex;
    place-items: center;
  }
  #app {
    /* Remove: grid-template-columns: 1fr 1fr; */
    padding: 0 2rem;
  }
}
```

Start with Option A. Only modify `main.css` if layout testing reveals issues.

---

## Risks and Considerations

### 1. Dependency Chain Risk (HIGH)
Task 8 depends on Tasks 4, 5, 6, and 7 -- all currently pending. If any dependency is incomplete or has API differences from the task specification, App.vue integration will break. **Mitigation:** Code to the interfaces defined in the task specifications. Use TypeScript to catch API mismatches at compile time.

### 2. Import Path Resolution
The task spec shows `import { getGraphData } from '@/core/calculations/pkCalculator'` but per Task 4's specification, `getGraphData` will be in `multiDoseProfile.ts`, not `pkCalculator.ts`. **Resolution:** Import from the barrel (`@/core/calculations`) which will re-export from both modules, or import directly from `multiDoseProfile.ts`.

### 3. `FREQUENCY_COUNTS` vs `FREQUENCY_MAP`
The Task 6 spec references `FREQUENCY_COUNTS` but the actual model exports `FREQUENCY_MAP`. If PrescriptionForm uses `FREQUENCY_COUNTS`, it must either be added to the models or the form must use `FREQUENCY_MAP` instead. This is a Task 6 concern, but Task 8 integration should verify the form component works with the actual model exports.

### 4. Chart.js in Test Environment
Chart.js requires a canvas element. In Vitest with jsdom, canvas may not be fully supported. **Mitigation:** For App.spec.ts, mock the GraphViewer component entirely or use `vi.mock('chart.js')`. Only test the data flow (prescription -> graphDatasets), not the actual chart rendering.

### 5. Reactive Graph Updates Performance
When the slider is dragged, `endHours` changes on every mouse move (or at step intervals). Each change triggers `graphDatasets` recomputation, which calls `getGraphData` -> `accumulateDoses`. For a 168h timeframe at 15-minute intervals, that is 672 data points per prescription -- should be fast enough. If performance issues arise, consider debouncing the slider input.

### 6. `savedPrescriptions` Initialization Timing
`getAllPrescriptions()` is called at ref initialization time (module scope in `<script setup>`). If localStorage is unavailable during SSR or testing, this could throw. Task 5's implementation wraps this in try/catch, so it should return `[]` gracefully.

---

## Estimated Complexity

**Task master assessment:** Complexity 5 (moderate)

**Breakdown by subtask:**
- Subtask 8.1 (state + computed): Complexity 2 -- straightforward reactive state setup
- Subtask 8.2 (handlers + template): Complexity 2 -- simple functions and conditional rendering
- Subtask 8.3 (save + slider + styles): Complexity 3 -- involves storage integration, UI controls, and CSS

**Estimated implementation time:** 1-2 hours for the code, plus 30 minutes for tests

**Lines of code:** Approximately 170-200 lines total (script ~50, template ~50, styles ~80, tests ~100)

---

## Implementation Order Summary

```
1. Verify all dependencies (Tasks 4-7) are complete
2. Phase 1: State management + computed (Subtask 8.1)
   - Strip boilerplate from App.vue
   - Add imports, refs, computed
   - Write initial unit tests
3. Phase 2: Handlers + template (Subtask 8.2)
   - Add handleFormSubmit, newPrescription
   - Write complete template with conditional rendering
   - Write component tests for view switching
4. Phase 3: Save + slider + styles (Subtask 8.3)
   - Add saveCurrentPrescription
   - Add timeframe slider
   - Add scoped CSS
   - Write integration tests for save flow
5. Update main.css if layout issues detected
6. Run full test suite: npm run test:unit
7. Run type check: npm run type-check
8. Manual browser verification with npm run dev
```
