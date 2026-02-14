# Implementation Plan: Task 5 - localStorage Prescription Storage

Generated: 2026-02-13T23:25:00Z
Task Master ID: 5
Status: pending
Dependencies: Task 2 (done - Prescription Data Models and Validation)
Complexity: 3 (low-medium)

---

## Goal

Create a storage layer at `src/core/storage/prescriptionStorage.ts` that persists `Prescription` objects to browser `localStorage` with full CRUD operations (Create, Read, Update, Delete), plus duplicate and utility functions. This module serves as the persistence backbone that downstream tasks (Task 6: PrescriptionForm, Task 8: App Integration, Task 9: PrescriptionList) all depend on.

---

## Research Summary

### localStorage Best Practices (Relevant to This Task)

1. **JSON serialization is the standard approach** for storing structured objects in localStorage. `JSON.stringify()` on write, `JSON.parse()` on read, with try-catch for corrupted data.

2. **Storage limits**: localStorage provides ~5-10MB per origin. Prescription data (small JSON objects) will never approach this limit, but a utility to check usage is a reasonable safety feature.

3. **Unique ID generation**: `Date.now()` combined with `Math.random().toString(36).substr(2, 9)` produces sufficiently unique IDs for a client-side-only application. No UUID library is needed.

4. **Error handling**: Always wrap `JSON.parse()` in try-catch. `localStorage.getItem()` returns `null` for missing keys (not undefined), so check for `null` before parsing.

5. **No need for reactive wrappers at this layer**: The storage module should be pure functions. Vue reactivity (ref/computed/watch) belongs in the consuming components or composables, not in the storage layer itself. This keeps the module testable without Vue dependencies.

6. **Testing with jsdom**: The vitest environment is configured as `jsdom` (verified in `vitest.config.ts`), which provides a `localStorage` global. Tests should call `localStorage.clear()` in `beforeEach` for isolation -- no need for manual mocking.

### Memory Recall: Relevant Past Learnings

- Task 2 (Prescription Models) is complete and validated. The `Prescription` interface at `src/core/models/prescription.ts:13-23` has `id?: string` (optional), which aligns with the storage module assigning IDs on save.
- The project uses strict TypeScript (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true` in `tsconfig.app.json`).
- Test fixtures exist at `src/core/models/__tests__/fixtures.ts` with several valid `Prescription` objects (SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE, IBUPROFEN_FIXTURE, etc.) that can be reused in storage tests.
- Barrel export pattern is established: `src/core/models/index.ts` re-exports types and functions. The storage module should follow the same pattern in `src/core/storage/index.ts`.

---

## Existing Codebase Analysis

### Files That Exist (VERIFIED)

| File | Status | Relevance |
|------|--------|-----------|
| `src/core/models/prescription.ts` | Complete (Task 2) | Provides `Prescription` type to import |
| `src/core/models/index.ts` | Complete | Barrel export pattern to follow |
| `src/core/storage/index.ts` | Placeholder (`export {}`) | Must be updated with re-exports |
| `src/core/storage/__tests__/` | Empty directory | Test file goes here |
| `src/core/models/__tests__/fixtures.ts` | Complete | Reusable test fixtures |

### Import Paths

The storage module will import from the models module. Based on the directory structure:
```typescript
import type { Prescription } from '../models/prescription'
```

The `@/*` path alias is configured in `tsconfig.app.json` (`"@/*": ["./src/*"]`), so alternatively:
```typescript
import type { Prescription } from '@/core/models/prescription'
```

**Recommendation**: Use relative import (`../models/prescription`) since it is the simpler convention and the storage module is within the same `core/` directory tree.

### Downstream Consumers (VERIFIED from task dependencies)

- **Task 6** (PrescriptionForm): Will call `savePrescription()` and `updatePrescription()`
- **Task 8** (App.vue integration): Will call `getAllPrescriptions()` on mount
- **Task 9** (PrescriptionList): Will call `getAllPrescriptions()`, `deletePrescription()`, `duplicatePrescription()`

---

## Implementation Phases

### Phase 1: Core Module - ID Generation and Read Operations

**Files to create:**
- `src/core/storage/prescriptionStorage.ts`

**Steps:**

1. Create the file with the storage key constant and ID generator:
   ```typescript
   import type { Prescription } from '../models/prescription'

   const STORAGE_KEY = 'pk-grapher-prescriptions'

   function generateId(): string {
     return `rx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
   }
   ```

2. Implement `getAllPrescriptions()`:
   ```typescript
   export function getAllPrescriptions(): Prescription[] {
     const data = localStorage.getItem(STORAGE_KEY)
     if (!data) return []
     try {
       return JSON.parse(data) as Prescription[]
     } catch {
       console.error('Failed to parse prescriptions from localStorage')
       return []
     }
   }
   ```

3. Implement `getPrescription()`:
   ```typescript
   export function getPrescription(id: string): Prescription | undefined {
     return getAllPrescriptions().find(rx => rx.id === id)
   }
   ```

**Acceptance criteria:**
- [ ] `getAllPrescriptions()` returns `[]` when localStorage is empty
- [ ] `getAllPrescriptions()` returns `[]` on corrupted JSON (does not throw)
- [ ] `getPrescription()` returns `undefined` for non-existent ID
- [ ] Both functions have correct TypeScript return types
- [ ] `generateId()` is not exported (internal helper)

---

### Phase 2: Write Operations - Save and Update

**Files to modify:**
- `src/core/storage/prescriptionStorage.ts` (append)

**Steps:**

1. Implement `savePrescription()`:
   ```typescript
   export function savePrescription(rx: Prescription): Prescription {
     const prescriptions = getAllPrescriptions()
     const newRx = { ...rx, id: generateId() }
     prescriptions.push(newRx)
     localStorage.setItem(STORAGE_KEY, JSON.stringify(prescriptions))
     return newRx
   }
   ```
   Note: This always assigns a new ID regardless of whether `rx.id` was already set. This is correct behavior -- `savePrescription` means "create new entry."

2. Implement `updatePrescription()`:
   ```typescript
   export function updatePrescription(rx: Prescription): boolean {
     if (!rx.id) return false
     const prescriptions = getAllPrescriptions()
     const index = prescriptions.findIndex(p => p.id === rx.id)
     if (index === -1) return false
     prescriptions[index] = rx
     localStorage.setItem(STORAGE_KEY, JSON.stringify(prescriptions))
     return true
   }
   ```

**Acceptance criteria:**
- [ ] `savePrescription()` returns a new object with a generated `id` field
- [ ] `savePrescription()` persists to localStorage (retrievable via `getAllPrescriptions()`)
- [ ] `savePrescription()` does not mutate the input object
- [ ] `updatePrescription()` returns `true` and updates data for existing ID
- [ ] `updatePrescription()` returns `false` if `rx.id` is falsy
- [ ] `updatePrescription()` returns `false` if ID not found in storage

---

### Phase 3: Delete and Duplicate Operations

**Files to modify:**
- `src/core/storage/prescriptionStorage.ts` (append)

**Steps:**

1. Implement `deletePrescription()`:
   ```typescript
   export function deletePrescription(id: string): boolean {
     const prescriptions = getAllPrescriptions()
     const filtered = prescriptions.filter(rx => rx.id !== id)
     if (filtered.length === prescriptions.length) return false
     localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
     return true
   }
   ```

2. Implement `duplicatePrescription()`:
   ```typescript
   export function duplicatePrescription(id: string): Prescription | undefined {
     const original = getPrescription(id)
     if (!original) return undefined
     const { id: _, ...data } = original
     return savePrescription({ ...data, name: `${data.name} (copy)` } as Prescription)
   }
   ```
   Note: The destructured `_` removes the `id` field. The spread `...data` has type `Omit<Prescription, 'id'>`, which satisfies `Prescription` since `id` is optional. The `as Prescription` cast may be needed depending on strictness.

**Acceptance criteria:**
- [ ] `deletePrescription()` removes the item and returns `true`
- [ ] `deletePrescription()` returns `false` for non-existent ID
- [ ] `deletePrescription()` does not affect other prescriptions
- [ ] `duplicatePrescription()` creates a new prescription with different ID
- [ ] `duplicatePrescription()` appends " (copy)" to the name
- [ ] `duplicatePrescription()` returns `undefined` for non-existent ID
- [ ] Original prescription is unchanged after duplication

---

### Phase 4: Utility Functions and Barrel Export

**Files to modify:**
- `src/core/storage/prescriptionStorage.ts` (append)
- `src/core/storage/index.ts` (replace placeholder)

**Steps:**

1. Add utility functions to `prescriptionStorage.ts`:
   ```typescript
   export function clearAllPrescriptions(): void {
     localStorage.removeItem(STORAGE_KEY)
   }

   export function getStorageUsage(): { used: number; available: number } {
     const data = localStorage.getItem(STORAGE_KEY) || ''
     return {
       used: data.length * 2,       // JS strings are UTF-16 (2 bytes per char)
       available: 5 * 1024 * 1024,  // ~5MB estimate
     }
   }
   ```

2. Update `src/core/storage/index.ts` to re-export all public functions:
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

**Acceptance criteria:**
- [ ] `clearAllPrescriptions()` removes all data from the storage key
- [ ] `getStorageUsage()` returns `{ used: 0, available: 5242880 }` when empty
- [ ] `getStorageUsage()` returns accurate `used` byte count for stored data
- [ ] All 8 public functions are re-exported from `index.ts`
- [ ] `import { savePrescription } from '@/core/storage'` works

---

### Phase 5: Comprehensive Test Suite

**Files to create:**
- `src/core/storage/__tests__/prescriptionStorage.spec.ts`

**Steps:**

1. Create the test file following the established test patterns from `prescription.spec.ts`:
   - Use `describe`/`it` blocks organized by function
   - Use `beforeEach(() => localStorage.clear())` for isolation
   - Reuse fixtures from `../models/__tests__/fixtures.ts` where appropriate
   - Name test descriptions clearly to indicate expected behavior

2. Test structure (organized by function):

   ```
   describe('prescriptionStorage')
     beforeEach: localStorage.clear()

     describe('generateId behavior (via savePrescription)')
       it('assigns an id matching rx-{timestamp}-{random} pattern')
       it('assigns unique ids for consecutive saves')

     describe('getAllPrescriptions')
       it('returns empty array when localStorage has no data')
       it('returns empty array when localStorage has corrupted JSON')
       it('returns parsed prescriptions when valid data exists')
       it('preserves all prescription fields through serialization')

     describe('getPrescription')
       it('returns undefined when no prescriptions exist')
       it('returns undefined for non-existent id')
       it('returns matching prescription by id')

     describe('savePrescription')
       it('returns prescription with generated id')
       it('does not mutate the input object')
       it('persists prescription to localStorage')
       it('handles multiple saves without overwriting')
       it('overwrites any existing id on the input')

     describe('updatePrescription')
       it('returns false when rx.id is undefined')
       it('returns false when rx.id is empty string')
       it('returns false when id is not found')
       it('returns true and updates data for existing id')
       it('does not affect other prescriptions')

     describe('deletePrescription')
       it('returns false for non-existent id')
       it('returns true and removes prescription')
       it('does not affect other prescriptions')
       it('handles deleting the only prescription')

     describe('duplicatePrescription')
       it('returns undefined for non-existent id')
       it('creates copy with new id')
       it('appends (copy) to name')
       it('does not modify original prescription')
       it('preserves all other fields')

     describe('clearAllPrescriptions')
       it('removes all prescriptions')
       it('does nothing when already empty')

     describe('getStorageUsage')
       it('returns 0 used when empty')
       it('returns correct byte count for stored data')
       it('returns 5MB as available')

     describe('integration: full CRUD lifecycle')
       it('save -> read -> update -> duplicate -> delete -> clear')

     describe('barrel exports')
       it('exports all functions from index.ts')
   ```

3. Run tests:
   ```bash
   npm run test:unit -- --run src/core/storage/__tests__/prescriptionStorage.spec.ts
   ```

**Acceptance criteria:**
- [ ] All tests pass
- [ ] Tests cover happy paths, error paths, and edge cases
- [ ] No test depends on execution order (each test uses `beforeEach` cleanup)
- [ ] Test file follows established patterns from `prescription.spec.ts`
- [ ] Integration test verifies full lifecycle

---

## Testing Strategy

### Unit Test Design Principles

1. **Isolation via `beforeEach`**: Every test starts with `localStorage.clear()`. The jsdom environment provides a working localStorage implementation -- no mocking needed.

2. **Fixture reuse**: Import `SINGLE_DOSE_FIXTURE` and `IBUPROFEN_FIXTURE` from `../models/__tests__/fixtures.ts` for realistic test data. These are valid prescriptions without `id` fields, perfect for testing `savePrescription()`.

3. **Serialization round-trip**: Verify that all `Prescription` fields survive `JSON.stringify()`/`JSON.parse()`. This is especially important for ensuring the `FrequencyLabel` union type values are preserved.

4. **Edge cases to cover**:
   - Corrupted localStorage data (invalid JSON string)
   - Empty string id in `updatePrescription()`
   - `undefined` id in `updatePrescription()`
   - Saving a prescription that already has an `id` (should get a new one)
   - Duplicating a prescription whose name already ends in "(copy)"
   - Deleting the last remaining prescription
   - Multiple rapid `savePrescription` calls (ID uniqueness)

5. **No validation in storage**: The storage layer does not validate prescriptions. Validation happens at the form/UI layer before calling `savePrescription()`. Tests should confirm that storage accepts any `Prescription`-shaped object.

### Test Commands

```bash
# Run only storage tests
npm run test:unit -- --run src/core/storage/__tests__/prescriptionStorage.spec.ts

# Run all tests (verify no regressions)
npm run test:unit -- --run

# Watch mode for development
npm run test:unit -- src/core/storage/__tests__/prescriptionStorage.spec.ts
```

---

## Integration Points

### Upstream Dependencies (must be complete before this task)

| Dependency | Status | What It Provides |
|-----------|--------|-----------------|
| Task 2: Prescription Models | DONE | `Prescription` type, test fixtures |

### Downstream Dependents (blocked by this task)

| Task | What It Needs |
|------|--------------|
| Task 6: PrescriptionForm | `savePrescription()`, `updatePrescription()` |
| Task 8: App.vue Integration | `getAllPrescriptions()` on mount |
| Task 9: PrescriptionList | Full CRUD: `getAllPrescriptions()`, `deletePrescription()`, `duplicatePrescription()` |

### No Runtime Dependencies

This module has zero runtime dependencies beyond the browser `localStorage` API and the `Prescription` type. No npm packages needed.

---

## Risks and Considerations

### Low Risk

1. **localStorage unavailability**: In rare cases (private browsing on some older browsers, storage quota exceeded), `localStorage.setItem()` can throw. The current spec does not handle this. For MVP, this is acceptable. A future enhancement could wrap write operations in try-catch and surface errors.

2. **Data migration**: If the `Prescription` interface changes in the future (new fields, renamed fields), existing localStorage data may not match the new shape. This is not an issue now but should be documented as a future concern for a potential migration/versioning system.

3. **String encoding in `getStorageUsage()`**: The `data.length * 2` approximation assumes all characters are BMP (2 bytes in UTF-16). This is accurate for JSON-serialized prescription data (ASCII-range characters). Non-BMP characters would make this an underestimate, but drug names should not contain such characters.

### No Risk

4. **Thread safety / race conditions**: This is a single-threaded browser environment. No concurrent access concerns.

5. **Type safety**: With `strict: true` and `strictNullChecks: true`, TypeScript will enforce correct handling of `undefined` returns from `getPrescription()` and `duplicatePrescription()`.

---

## Estimated Complexity

**Overall: 3/10 (Low)**

- Pure functions with no external dependencies
- Straightforward CRUD over localStorage
- Well-defined input/output types from Task 2
- Test environment (jsdom) provides localStorage natively
- No async operations, no side effects beyond localStorage

**Estimated implementation time**: 30-45 minutes for code + tests

---

## Implementation Checklist

- [ ] Create `src/core/storage/prescriptionStorage.ts` with all 8 functions
- [ ] Update `src/core/storage/index.ts` barrel exports
- [ ] Create `src/core/storage/__tests__/prescriptionStorage.spec.ts`
- [ ] All storage tests pass
- [ ] All existing tests still pass (no regressions)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `src/core/storage/prescriptionStorage.ts` | CREATE | Storage module with 8 exported functions + 1 internal helper |
| `src/core/storage/index.ts` | MODIFY | Update from `export {}` to re-export all storage functions |
| `src/core/storage/__tests__/prescriptionStorage.spec.ts` | CREATE | Comprehensive test suite (~30 tests) |
