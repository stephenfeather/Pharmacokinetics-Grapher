# Implementation Plan: Task 9 -- Prescription List and Management Component

Generated: 2026-02-14

## Goal

Create the `PrescriptionList.vue` component that provides a complete prescription management interface. Users will see all saved prescriptions in a list, perform CRUD operations (view, edit, delete with confirmation, duplicate), and enter a "compare mode" to select multiple prescriptions for multi-drug overlay on the graph. This is a medium-priority task (complexity 5) that depends on Tasks 5 (storage), 6 (form), 7 (graph), and 8 (App integration) being complete.

## Dependencies and Assumptions

**Hard dependencies (must be complete before starting):**

- **Task 5**: `src/core/storage/prescriptionStorage.ts` -- provides `getAllPrescriptions()`, `deletePrescription(id)`, `duplicatePrescription(id)`, `getPrescription(id)`, `savePrescription(rx)`, `updatePrescription(rx)`, `clearAllPrescriptions()`
- **Task 6**: `src/components/PrescriptionForm.vue` -- the form component that the "edit" flow hands off to
- **Task 7**: `src/components/GraphViewer.vue` -- the graph component that the "view" and "compare" flows render into
- **Task 8**: `src/App.vue` integration -- the parent orchestration that PrescriptionList emits events to

**Assumptions about completed dependencies:**

- The storage module exports from `@/core/storage/prescriptionStorage` (or re-exported from `@/core/storage/index.ts`)
- `Prescription` type with optional `id?: string` field is used as the data contract
- `duplicatePrescription(id)` creates a copy with " (copy)" suffix and a new ID
- `deletePrescription(id)` returns a boolean for success
- `getAllPrescriptions()` returns `Prescription[]` (empty array if none exist)

## Existing Codebase Analysis

### Relevant existing code (VERIFIED by reading files):

| File | Status | Key exports |
|------|--------|-------------|
| `src/core/models/prescription.ts` | EXISTS (354 lines) | `Prescription`, `FrequencyLabel`, `ValidationResult`, `FREQUENCY_MAP`, `validatePrescription()` |
| `src/core/models/index.ts` | EXISTS | Barrel re-export of all model types and functions |
| `src/core/storage/index.ts` | EXISTS (stub) | Currently just `export {}` -- Task 5 will populate this |
| `src/core/calculations/pkCalculator.ts` | EXISTS (114 lines) | `calculateConcentration()`, `getPeakTime()`, `ABSORPTION_CONSTANT` |
| `src/core/calculations/multiDose.ts` | EXISTS (102 lines) | `accumulateDoses()` |
| `src/core/models/__tests__/fixtures.ts` | EXISTS | `SINGLE_DOSE_FIXTURE`, `BID_MULTI_DOSE_FIXTURE`, `IBUPROFEN_FIXTURE`, etc. |
| `src/components/__tests__/HelloWorld.spec.ts` | EXISTS | Reference for Vue Test Utils test patterns in this project |

### Testing patterns established in codebase:

- Vitest with jsdom environment (configured in `vitest.config.ts`)
- Vue Test Utils `mount()` for component tests
- Fixtures in separate files under `__tests__/fixtures.ts`
- Test structure: `describe` blocks organized by phase/feature
- Import pattern: `import { describe, it, expect } from 'vitest'`

### Path aliases:

- `@/*` maps to `./src/*` (confirmed in `tsconfig.app.json`)

### Environment:

- Vue 3.5.27, TypeScript 5.9.3, Vitest 4.0.18, @vue/test-utils 2.4.6
- jsdom 27.4.0 for DOM simulation in tests
- No Pinia (simple ref + provide/inject state management)
- No Vue Router

## Implementation Phases

### Phase 1: Create List Display with Empty State and Prescription Item Rendering (Subtask 1)

**Files to create:**
- `src/components/PrescriptionList.vue` -- main component
- `src/components/__tests__/PrescriptionList.spec.ts` -- test file
- `src/components/__tests__/prescriptionListFixtures.ts` -- test fixtures

**Steps:**

1. **Create test fixtures file** at `src/components/__tests__/prescriptionListFixtures.ts`:
   ```typescript
   import type { Prescription } from '@/core/models/prescription'

   export const MOCK_PRESCRIPTIONS: Prescription[] = [
     {
       id: 'rx-test-001',
       name: 'Ibuprofen',
       frequency: 'tid',
       times: ['08:00', '14:00', '20:00'],
       dose: 400,
       halfLife: 2,
       peak: 1.5,
       uptake: 0.5,
     },
     {
       id: 'rx-test-002',
       name: 'Amoxicillin',
       frequency: 'bid',
       times: ['09:00', '21:00'],
       dose: 500,
       halfLife: 1.5,
       peak: 1,
       uptake: 0.5,
     },
     {
       id: 'rx-test-003',
       name: 'Metformin',
       frequency: 'bid',
       times: ['08:00', '20:00'],
       dose: 850,
       halfLife: 6.2,
       peak: 2.5,
       uptake: 1,
     },
   ]
   ```

2. **Create `PrescriptionList.vue`** with the base structure:
   - `<script setup lang="ts">` using Composition API
   - Import `ref` from vue, `Prescription` type from `@/core/models/prescription`
   - Import `getAllPrescriptions` from `@/core/storage/prescriptionStorage`
   - Create reactive state: `const prescriptions = ref<Prescription[]>(getAllPrescriptions())`
   - Implement `refresh()` function that re-reads from storage
   - Template: conditional `v-if="prescriptions.length === 0"` for empty state message
   - Template: `<ul>` with `<li v-for="rx in prescriptions" :key="rx.id">` rendering each item
   - Each item shows: `rx.name` (bold), `rx.frequency` badge, `rx.dose` + "mg", "t1/2=" + `rx.halfLife` + "h"

3. **Write Phase 1 tests** in `PrescriptionList.spec.ts`:
   - Test: empty state message renders when no prescriptions in storage
   - Test: list items render with correct count when prescriptions exist
   - Test: each item displays name, frequency, dose, halfLife correctly
   - Test: `refresh()` updates list after storage changes

**Mock strategy for storage:**
Since the storage module uses `localStorage` directly, tests need to:
1. Clear localStorage in `beforeEach`
2. Directly set localStorage with serialized mock data (or mock the storage module imports)
3. Preferred approach: use `vi.mock('@/core/storage/prescriptionStorage')` to mock the storage functions, giving precise control without touching localStorage

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PrescriptionList from '../PrescriptionList.vue'
import { MOCK_PRESCRIPTIONS } from './prescriptionListFixtures'

// Mock storage module
vi.mock('@/core/storage/prescriptionStorage', () => ({
  getAllPrescriptions: vi.fn(() => []),
  deletePrescription: vi.fn(() => true),
  duplicatePrescription: vi.fn(),
}))

import { getAllPrescriptions, deletePrescription, duplicatePrescription } from '@/core/storage/prescriptionStorage'

const mockGetAll = vi.mocked(getAllPrescriptions)
const mockDelete = vi.mocked(deletePrescription)
const mockDuplicate = vi.mocked(duplicatePrescription)
```

**Acceptance criteria:**
- [ ] Component renders without errors
- [ ] Empty state message shows when no prescriptions
- [ ] Prescription items display name, frequency, dose, halfLife
- [ ] `:key` binding uses `rx.id` for proper Vue reactivity
- [ ] All Phase 1 tests pass

---

### Phase 2: Implement CRUD Action Handlers with Event Emissions (Subtask 2)

**Files to modify:**
- `src/components/PrescriptionList.vue` -- add action buttons and handlers
- `src/components/__tests__/PrescriptionList.spec.ts` -- add CRUD tests

**Steps:**

1. **Define typed emits** in the component:
   ```typescript
   const emit = defineEmits<{
     edit: [prescription: Prescription]
     compare: [prescriptions: Prescription[]]
     view: [prescription: Prescription]
   }>()
   ```

2. **Import additional storage functions**:
   ```typescript
   import {
     getAllPrescriptions,
     deletePrescription,
     duplicatePrescription,
   } from '@/core/storage/prescriptionStorage'
   ```

3. **Implement handler functions:**
   - `handleDelete(id: string)`: calls `confirm('Delete this prescription?')`, if confirmed calls `deletePrescription(id)` then `refresh()`
   - `handleDuplicate(id: string)`: calls `duplicatePrescription(id)` then `refresh()`
   - `handleEdit(rx: Prescription)`: emits `'edit'` event with the prescription
   - View button: `emit('view', rx)` inline in template

4. **Add action buttons** to each list item:
   ```html
   <div class="rx-actions">
     <button @click="emit('view', rx)">View</button>
     <button @click="handleEdit(rx)">Edit</button>
     <button @click="rx.id && handleDuplicate(rx.id)">Duplicate</button>
     <button @click="rx.id && handleDelete(rx.id)" class="danger">Delete</button>
   </div>
   ```
   Note: Guard all id-based operations with `rx.id &&` since `id` is optional in the type.

5. **Write Phase 2 tests:**
   - Test: clicking View button emits `'view'` event with correct prescription payload
   - Test: clicking Edit button emits `'edit'` event with correct prescription payload
   - Test: clicking Delete when `window.confirm` returns true -> calls `deletePrescription`, list refreshes
   - Test: clicking Delete when `window.confirm` returns false -> item NOT removed
   - Test: clicking Duplicate -> calls `duplicatePrescription` with correct id, list refreshes
   - Test: buttons are present for each prescription item

   **`window.confirm` mock pattern:**
   ```typescript
   const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
   // ... trigger delete
   expect(confirmSpy).toHaveBeenCalledWith('Delete this prescription?')
   expect(mockDelete).toHaveBeenCalledWith('rx-test-001')
   confirmSpy.mockRestore()
   ```

**Acceptance criteria:**
- [ ] View, Edit, Duplicate, Delete buttons render for each item
- [ ] View emits correct event with prescription data
- [ ] Edit emits correct event with prescription data
- [ ] Delete shows confirmation dialog before proceeding
- [ ] Delete only removes when user confirms
- [ ] Duplicate creates copy and refreshes list
- [ ] All id-based operations are guarded against undefined id
- [ ] All Phase 2 tests pass

---

### Phase 3: Implement Compare Mode with Multi-Select Checkbox UI (Subtask 3)

**Files to modify:**
- `src/components/PrescriptionList.vue` -- add compare mode state and UI
- `src/components/__tests__/PrescriptionList.spec.ts` -- add compare mode tests

**Steps:**

1. **Add reactive state for compare mode:**
   ```typescript
   const compareMode = ref(false)
   const selectedIds = ref<Set<string>>(new Set())
   ```

2. **Add computed for selected count:**
   ```typescript
   const selectedCount = computed(() => selectedIds.value.size)
   ```

3. **Implement toggle functions:**
   ```typescript
   function toggleSelect(id: string) {
     // Must create a new Set for Vue reactivity on Set objects
     const newSet = new Set(selectedIds.value)
     if (newSet.has(id)) {
       newSet.delete(id)
     } else {
       newSet.add(id)
     }
     selectedIds.value = newSet
   }

   function handleCompare() {
     const selected = prescriptions.value.filter(
       rx => rx.id && selectedIds.value.has(rx.id)
     )
     if (selected.length > 0) {
       emit('compare', selected)
     }
   }

   function exitCompareMode() {
     compareMode.value = false
     selectedIds.value = new Set()
   }
   ```

   **IMPORTANT Vue reactivity note:** Vue 3 reactive `ref()` tracks Set mutations only if you replace the entire Set (not in-place `.add()` / `.delete()`). Two approaches:
   - **Option A (recommended):** Replace the Set on every mutation as shown above
   - **Option B:** Use `reactive(new Set())` with `triggerRef()` -- more complex

4. **Add header toggle button:**
   ```html
   <div class="list-header">
     <h2>Saved Prescriptions</h2>
     <button @click="compareMode ? exitCompareMode() : (compareMode = true)">
       {{ compareMode ? 'Exit Compare' : 'Compare Mode' }}
     </button>
   </div>
   ```

5. **Add checkboxes to items (conditional on compareMode):**
   ```html
   <input
     v-if="compareMode"
     type="checkbox"
     :checked="rx.id ? selectedIds.has(rx.id) : false"
     @change="rx.id && toggleSelect(rx.id)"
   />
   ```

6. **Add floating compare bar:**
   ```html
   <div v-if="compareMode && selectedCount > 0" class="compare-bar">
     <span>{{ selectedCount }} selected</span>
     <button @click="handleCompare">Compare Selected</button>
   </div>
   ```

7. **Write Phase 3 tests:**
   - Test: compare mode toggle button exists and toggles `compareMode`
   - Test: checkboxes appear only when `compareMode` is true
   - Test: clicking checkbox adds id to `selectedIds` Set
   - Test: clicking checkbox again (deselect) removes id from Set
   - Test: `selectedCount` computed reflects correct count
   - Test: clicking "Compare Selected" with 2 items emits `'compare'` event with array of 2 prescriptions
   - Test: exiting compare mode clears `selectedIds`
   - Test: compare bar only visible when `compareMode === true` AND `selectedCount > 0`
   - Test: compare bar hidden when no items selected even in compare mode

**Acceptance criteria:**
- [ ] Compare Mode button toggles mode on/off
- [ ] Checkboxes appear only in compare mode
- [ ] Selection state correctly tracks checked/unchecked items
- [ ] Compare bar shows count and "Compare Selected" button
- [ ] Compare bar only visible when items are selected
- [ ] Emits `'compare'` event with correct array of selected prescriptions
- [ ] Exiting compare mode clears all selections
- [ ] Vue reactivity works correctly with Set-based state
- [ ] All Phase 3 tests pass

---

## Complete Component Code Structure

The final `src/components/PrescriptionList.vue` will have this structure:

```
<script setup lang="ts">
  Imports:
    - ref, computed from 'vue'
    - Prescription type from '@/core/models/prescription'
    - getAllPrescriptions, deletePrescription, duplicatePrescription from storage

  Emits:
    - edit: [prescription: Prescription]
    - compare: [prescriptions: Prescription[]]
    - view: [prescription: Prescription]

  Reactive State:
    - prescriptions: ref<Prescription[]>
    - compareMode: ref<boolean>
    - selectedIds: ref<Set<string>>

  Computed:
    - selectedCount: number

  Functions:
    - refresh(): void
    - handleDelete(id: string): void
    - handleDuplicate(id: string): void
    - handleEdit(rx: Prescription): void
    - toggleSelect(id: string): void
    - handleCompare(): void
    - exitCompareMode(): void
</script>

<template>
  - list-header (h2 + compare mode toggle button)
  - empty state (v-if no prescriptions)
  - prescription list (v-else, ul > li v-for)
    - each item: [checkbox if compareMode] name, frequency, dose, halfLife
    - action buttons: View, Edit, Duplicate, Delete
  - compare bar (v-if compareMode && selectedCount > 0)
</template>

<style scoped>
  - .prescription-list layout
  - .prescription-item flex row with hover states
  - .rx-info and .rx-actions flex children
  - .compare-bar sticky/floating footer
  - .danger button red styling
  - .frequency badge styling
  - .empty state centered message
</style>
```

## Integration with App.vue (Task 8/10)

The PrescriptionList component communicates with its parent exclusively via events:

| Event | Payload | Parent handler |
|-------|---------|---------------|
| `view` | Single `Prescription` | Show graph for this prescription |
| `edit` | Single `Prescription` | Show PrescriptionForm pre-populated with this data |
| `compare` | `Prescription[]` | Show graph with multiple drug overlays |

The parent (App.vue) will mount PrescriptionList and wire up these events:

```html
<PrescriptionList
  @view="handleViewPrescription"
  @edit="handleEditPrescription"
  @compare="handleCompare"
/>
```

**Note:** The PrescriptionList does NOT need props from the parent. It reads directly from storage and manages its own refresh cycle. This keeps the component self-contained and testable.

## Testing Strategy

### Test file: `src/components/__tests__/PrescriptionList.spec.ts`

**Total expected tests: ~20**

**Test organization:**
```
describe('PrescriptionList', () => {
  describe('empty state', () => { ... })           // 2 tests
  describe('list rendering', () => { ... })         // 3 tests
  describe('view action', () => { ... })            // 1 test
  describe('edit action', () => { ... })            // 1 test
  describe('delete action', () => { ... })          // 3 tests
  describe('duplicate action', () => { ... })       // 2 tests
  describe('compare mode toggle', () => { ... })    // 2 tests
  describe('compare selection', () => { ... })      // 4 tests
  describe('compare submission', () => { ... })     // 2 tests
})
```

**Mock strategy:**
- Mock `@/core/storage/prescriptionStorage` at module level with `vi.mock()`
- Mock `window.confirm` per-test with `vi.spyOn()`
- Use `vi.mocked()` for typed mock access
- Reset all mocks in `beforeEach`
- Mount component fresh for each test to avoid state leakage

**Key test patterns:**
```typescript
// Emitted event verification
const wrapper = mount(PrescriptionList)
await wrapper.find('[data-testid="view-btn-rx-test-001"]').trigger('click')
expect(wrapper.emitted('view')).toBeTruthy()
expect(wrapper.emitted('view')![0]).toEqual([MOCK_PRESCRIPTIONS[0]])
```

**Data-testid strategy:**
Add `data-testid` attributes to key elements for reliable test selectors:
- `data-testid="empty-message"` on the empty state div
- `data-testid="prescription-item-{id}"` on each list item
- `data-testid="view-btn-{id}"` on view buttons
- `data-testid="edit-btn-{id}"` on edit buttons
- `data-testid="duplicate-btn-{id}"` on duplicate buttons
- `data-testid="delete-btn-{id}"` on delete buttons
- `data-testid="compare-toggle"` on the compare mode button
- `data-testid="compare-checkbox-{id}"` on checkboxes
- `data-testid="compare-bar"` on the compare bar
- `data-testid="compare-submit"` on the compare submit button
- `data-testid="selected-count"` on the count display

## Styling Approach

Use scoped CSS within the component. Key design decisions:

- **List layout**: Flexbox column for items, each item is a flex row
- **Item hover**: Light background highlight on hover
- **Action buttons**: Inline row, subtle borders, "Delete" in red
- **Compare mode**: Checkbox left-aligned, compare bar fixed to bottom of component
- **Frequency badge**: Small colored label (e.g., `bid` in a rounded pill)
- **Empty state**: Centered text with muted color
- **Responsive**: Stack action buttons vertically on narrow viewports

No external CSS framework is used in this project. All styling is custom scoped CSS.

## Edge Cases and Special Considerations

### 1. Vue Reactivity with Set

Vue 3's `ref()` does NOT deeply track `Set` mutations. Calling `selectedIds.value.add(id)` will NOT trigger reactivity. The solution is to always replace the Set:
```typescript
selectedIds.value = new Set([...selectedIds.value, id])
```
This is a common pitfall. The implementation must use this pattern consistently.

### 2. Optional `id` field on Prescription

The `Prescription` interface has `id?: string`. All id-dependent operations must guard:
```typescript
rx.id && handleDelete(rx.id)
```
In practice, prescriptions loaded from storage will always have IDs (assigned by `savePrescription()`), but the TypeScript type requires the guard.

### 3. Confirm dialog in tests

`window.confirm` returns a boolean synchronously. In Vitest with jsdom, it can be mocked:
```typescript
vi.spyOn(window, 'confirm').mockReturnValue(true)
```
Remember to restore after each test.

### 4. Storage sync

The component reads from storage on mount. If another part of the app (e.g., App.vue after saving a new prescription) modifies storage, the list won't automatically update. Two options:
- **Option A (simple)**: Expose `refresh()` via template ref for parent to call
- **Option B (reactive)**: Use `provide/inject` or an event bus to signal storage changes
- **Recommendation for MVP**: Option A. The parent can call `prescriptionListRef.value?.refresh()` after save operations. Alternatively, use a `key` prop trick to force re-mount.

### 5. Duplicate naming edge case

If a prescription named "Drug A" is duplicated, it becomes "Drug A (copy)". Duplicating the copy creates "Drug A (copy) (copy)". This is acceptable for MVP. A future improvement could strip existing "(copy)" suffixes before appending.

### 6. Empty compare submission

The `handleCompare()` function filters prescriptions by `selectedIds`. If `selectedIds` contains an id that was deleted (stale reference), the filter will simply skip it. The `selected.length > 0` guard prevents emitting an empty array.

### 7. Delete of selected item in compare mode

If a user is in compare mode with item X selected, then deletes item X via the delete button, the `selectedIds` Set will still contain X's id. This is harmless because:
- The deleted item disappears from the rendered list
- When "Compare Selected" is clicked, the filter won't find the deleted id
- However, for cleanliness, `handleDelete()` should also remove the id from `selectedIds`:
  ```typescript
  function handleDelete(id: string) {
    if (confirm('Delete this prescription?')) {
      deletePrescription(id)
      const newSet = new Set(selectedIds.value)
      newSet.delete(id)
      selectedIds.value = newSet
      refresh()
    }
  }
  ```

## Estimated Complexity

Task complexity is rated 5 (moderate) per task definition. Breakdown:

| Aspect | Effort |
|--------|--------|
| Component structure & template | Low -- straightforward Vue 3 SFC |
| CRUD handlers | Low -- thin wrappers around storage functions |
| Compare mode state management | Medium -- Set reactivity requires care |
| Tests (mocking storage, confirm, events) | Medium -- 20 tests with module mocks |
| Styling | Low -- basic flexbox layout |
| Edge cases | Low-Medium -- id guards, Set reactivity, delete-while-selected |

**Estimated implementation time:** 2-3 hours (including tests)

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/PrescriptionList.vue` | CREATE | Main component |
| `src/components/__tests__/PrescriptionList.spec.ts` | CREATE | Component tests (~20 tests) |
| `src/components/__tests__/prescriptionListFixtures.ts` | CREATE | Mock prescription data for tests |

No existing files need modification. This component is additive.

## Run Verification

After implementation, verify with:

```bash
# Run component tests
npm run test:unit -- src/components/__tests__/PrescriptionList.spec.ts

# Run all tests to check no regressions
npm run test:unit

# Type check
npm run type-check

# Lint
npm run lint
```
