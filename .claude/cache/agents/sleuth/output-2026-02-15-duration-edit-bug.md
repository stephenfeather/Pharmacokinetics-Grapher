# Debug Report: Duration Field Reverts to Old Value on Edit Submission

Generated: 2026-02-15

## Symptom

When editing a saved medication, the duration field reverts to the existing (original) value on form submission instead of saving the new user-entered value.

## Hypotheses Tested

1. **The `initial` prop is never passed to PrescriptionForm in edit mode** - CONFIRMED - The form is never re-created with edited data
2. **A watcher or computed resets duration during submission** - RULED OUT - No watchers affect duration
3. **Storage merge logic overwrites edited duration** - RULED OUT - Storage update logic does a full object replacement

## Root Cause

**Confidence: HIGH**

The root cause is that **`PrescriptionForm` is never passed the `initial` prop in edit mode**. The form component is always mounted without any initial data, so editing a prescription is impossible -- the form always shows defaults, not the saved prescription's values.

### Evidence Chain

**Finding 1: App.vue line 281 -- Form is mounted without `:initial` binding**

```vue
<!-- App.vue line 280-282 -->
<div v-if="showForm" ref="formRef" role="region" aria-label="Prescription form">
  <PrescriptionForm @submit="handleFormSubmit" @imported="handleImportSuccess" />
</div>
```

The `PrescriptionForm` component accepts an `initial` prop (defined at `PrescriptionForm.vue` line 8-10):
```typescript
const props = defineProps<{
  initial?: Prescription
}>()
```

But in `App.vue`, the component is rendered **without ever binding `:initial`**. The prop is always `undefined`.

**Finding 2: App.vue lines 185-189 -- Edit handler sets state but form never receives it**

```typescript
function handleEditPrescription(rx: Prescription) {
  currentPrescription.value = rx         // sets internal state
  statusMessage.value = `Editing prescription: ${rx.name}`
  switchView('form')                     // shows the form
}
```

The handler correctly stores the prescription in `currentPrescription`, but this ref is **never connected** to the form's `initial` prop. The form renders with its hardcoded defaults every time.

**Finding 3: PrescriptionForm.vue lines 21-33 -- Defaults used when `initial` is undefined**

```typescript
const name = ref(props.initial?.name ?? 'Test Drug')
const frequency = ref<FrequencyLabel>(props.initial?.frequency ?? 'bid')
const dose = ref(props.initial?.dose ?? 500)
const halfLife = ref(props.initial?.halfLife ?? 6)
const duration = ref<number | undefined>(props.initial?.duration ?? 7)
const durationUnit = ref<DurationUnit>(props.initial?.durationUnit ?? 'days')
```

Since `props.initial` is always `undefined`, every field (not just duration) always gets the default values. This means **all fields revert to defaults in edit mode**, not just duration. The user may not notice for other fields if they happen to match.

**Finding 4: Vue reactivity limitation -- props.initial is only read at mount time**

Even if `initial` were bound to `currentPrescription`, there is a secondary issue. The form reads `props.initial` only during initial `ref()` creation (lines 21-33). These are **not reactive to prop changes**. If the form component is not destroyed and re-created when switching to edit mode (which it is, because `v-if="showForm"` toggles), the refs would not update.

However, in this case, `v-if` does destroy/recreate the component on each view switch, so passing the prop would work correctly -- the component is freshly mounted each time `switchView('form')` is called.

**Finding 5: handleFormSubmit never calls updatePrescription**

```typescript
// App.vue lines 152-156
function handleFormSubmit(rx: Prescription) {
  currentPrescription.value = rx
  comparePrescriptions.value = [rx]
  switchView('graph')
}
```

Even if the form were correctly populated in edit mode and the user changed values and submitted, the handler only sets the prescription for graph display. It never calls `updatePrescription()` from the storage module. The edited prescription is never persisted back to localStorage. The "Save Prescription" button on the graph view (line 362) calls `saveCurrentPrescription()` which calls `savePrescription()` -- this **always creates a new prescription** (see `prescriptionStorage.ts` line 65: `const newRx = { ...rx, id: generateId() }`).

So the full edit flow is broken at two levels:
1. The form is never populated with the existing prescription data
2. Even after editing, the save path creates a duplicate instead of updating

## Investigation Trail

| Step | Action | Finding |
|------|--------|---------|
| 1 | Read PrescriptionForm.vue | Form accepts `initial` prop, uses it for ref initialization |
| 2 | Read App.vue template (line 281) | `<PrescriptionForm>` is rendered WITHOUT `:initial` binding |
| 3 | Read App.vue `handleEditPrescription` (line 185) | Sets `currentPrescription` but never passes to form |
| 4 | Read App.vue `handleFormSubmit` (line 152) | Never calls `updatePrescription()` |
| 5 | Read App.vue `saveCurrentPrescription` (line 164) | Calls `savePrescription()` which always creates new |
| 6 | Read prescriptionStorage.ts | `savePrescription` generates new ID; `updatePrescription` exists but is never called |
| 7 | Read PrescriptionForm.spec.ts | Tests for `initial` prop exist but only test mount-time behavior, not edit-then-submit flow |
| 8 | Checked git history | Duration fields added in commit 7baad9f; the `initial` prop binding was already missing before that |

## Evidence

### File References

- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/App.vue`
  - Line 12: `currentPrescription` ref declared
  - Line 152-156: `handleFormSubmit` -- does not call update
  - Line 164-169: `saveCurrentPrescription` -- always creates new
  - Line 185-189: `handleEditPrescription` -- sets state, never passes to form
  - Line 281: `<PrescriptionForm>` -- missing `:initial` binding

- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/PrescriptionForm.vue`
  - Lines 8-10: `initial` prop definition
  - Lines 21-33: ref initialization from `props.initial` (all default when undefined)
  - Lines 61-79: computed `prescription` object (correctly assembles from refs)
  - Lines 85-88: `handleSubmit` (correctly emits assembled prescription)

- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/storage/prescriptionStorage.ts`
  - Lines 63-69: `savePrescription` -- always generates new ID
  - Lines 76-84: `updatePrescription` -- exists but is never called from App.vue

## Recommended Fix

**Files to modify:**

### 1. `src/App.vue` (line 281) -- Pass initial prop to form

Change:
```vue
<PrescriptionForm @submit="handleFormSubmit" @imported="handleImportSuccess" />
```
To:
```vue
<PrescriptionForm
  :initial="currentPrescription ?? undefined"
  @submit="handleFormSubmit"
  @imported="handleImportSuccess"
/>
```

### 2. `src/App.vue` (lines 152-156) -- Differentiate save vs update in submit handler

Change `handleFormSubmit` to detect whether this is an edit (has id) or new prescription:
```typescript
function handleFormSubmit(rx: Prescription) {
  if (rx.id) {
    // Edit mode: update existing prescription in storage
    updatePrescription(rx)
    savedPrescriptions.value = getAllPrescriptions()
  }
  currentPrescription.value = rx
  comparePrescriptions.value = [rx]
  switchView('graph')
}
```

Also add `updatePrescription` to the imports from `prescriptionStorage`.

### 3. `src/App.vue` (lines 164-169) -- Fix saveCurrentPrescription to handle edit mode

```typescript
function saveCurrentPrescription() {
  if (currentPrescription.value) {
    if (currentPrescription.value.id) {
      // Already saved -- update in place
      updatePrescription(currentPrescription.value)
    } else {
      // New prescription -- create
      const saved = savePrescription(currentPrescription.value)
      currentPrescription.value = saved
    }
    savedPrescriptions.value = getAllPrescriptions()
  }
}
```

## Prevention

1. **Add integration tests** for the full edit flow: load saved prescription -> edit form -> submit -> verify stored values changed
2. **Add a test** that verifies `PrescriptionForm` receives `initial` prop when in edit mode
3. **Consider a `key` attribute** on `PrescriptionForm` bound to `currentPrescription?.id` to force re-mount when switching between new/edit modes:
   ```vue
   <PrescriptionForm
     :key="currentPrescription?.id ?? 'new'"
     :initial="currentPrescription ?? undefined"
     ...
   />
   ```
   This ensures Vue destroys and recreates the component when switching prescriptions, guaranteeing fresh ref initialization.
