# Implementation Plan: Task 2 - Prescription Data Models and Validation Logic

Generated: 2026-02-13

## Goal

Implement the core data model layer for the Pharmacokinetics Grapher application. This includes TypeScript interfaces for prescriptions, time-series data, and graph datasets, plus a comprehensive validation function that enforces all constraints from the project specification. This layer is foundational: every subsequent task (calculations, storage, UI) depends on these types and validation being correct.

## Existing Codebase Analysis

### Current State (VERIFIED)

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts`**: Empty stub (`export {}`) -- ready to be replaced with re-exports.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/`**: Empty directory -- test file needs to be created.
- **No existing prescription types anywhere in the codebase** -- this is a greenfield implementation within the existing directory scaffold.
- **TypeScript strict mode is ON** (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true` in `tsconfig.app.json`).
- **Path alias**: `@/*` maps to `./src/*` (available for imports).
- **Test framework**: Vitest with jsdom environment. Test pattern: `src/**/__tests__/*.spec.ts`. Tests use `import { describe, it, expect } from 'vitest'`.
- **Linting**: ESLint + oxlint (correctness category) + Prettier. All must pass.
- **Build**: `vue-tsc --build` for type-checking. Currently passes clean.

### Downstream Consumers (Future Tasks)

- **Task 3 (Calculations)**: Will import `Prescription`, `TimeSeriesPoint`, `GraphDataset` types and the `FREQUENCY_MAP` constant from this module. The validation function will be called before running calculations.
- **Task 4+ (Storage)**: Will import `Prescription` interface for localStorage serialization.
- **Task 5+ (UI Components)**: Will import `FrequencyLabel`, `Prescription`, validation function, and `FREQUENCY_MAP` for form rendering and validation feedback.

## Implementation Phases

### Phase 1: Type Definitions

**File to create:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`

**Step 1.1: Define FrequencyLabel type**

```typescript
export type FrequencyLabel = 'once' | 'bid' | 'tid' | 'qid' | 'q6h' | 'q8h' | 'q12h' | 'custom';
```

Rationale: String union type (not enum) aligns with CLAUDE.md specification and is more idiomatic for TypeScript. Provides autocomplete and compile-time checking without runtime overhead.

**Step 1.2: Define FREQUENCY_MAP constant**

```typescript
export const FREQUENCY_MAP: Record<FrequencyLabel, number | null> = {
  once: 1,
  bid: 2,
  tid: 3,
  qid: 4,
  q6h: 4,
  q8h: 3,
  q12h: 2,
  custom: null,
};
```

Design decision: Export this constant because it is needed by:
1. Validation logic (frequency-to-times count matching)
2. Future UI components (PrescriptionForm frequency picker)
3. Future calculation engine (dose interval derivation)

Using `Record<FrequencyLabel, number | null>` ensures the map stays in sync with the type -- if a new frequency is added to `FrequencyLabel`, TypeScript will require adding it to the map.

**Step 1.3: Define Prescription interface**

```typescript
export interface Prescription {
  id?: string;
  name: string;
  frequency: FrequencyLabel;
  times: string[];
  dose: number;
  halfLife: number;
  metaboliteLife?: number;
  peak: number;
  uptake: number;
}
```

Design decisions:
- `id` is optional (not assigned until storage persists it)
- `metaboliteLife` is optional (informational only per CLAUDE.md)
- All numeric fields are in consistent units (hours for time, dose units for dose)
- No default values on the interface -- defaults belong in UI/factory functions
- Field order matches CLAUDE.md specification for consistency

**Step 1.4: Define TimeSeriesPoint interface**

```typescript
export interface TimeSeriesPoint {
  time: number;          // Hours from start
  concentration: number; // Normalized 0-1 scale (peak = 1.0)
}
```

**Step 1.5: Define GraphDataset interface**

```typescript
export interface GraphDataset {
  label: string;
  data: TimeSeriesPoint[];
  color?: string;
}
```

### Phase 2: Validation Rules Constant

**Same file:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`

**Step 2.1: Define ValidationRule types**

```typescript
interface NumericValidationRule {
  required: boolean;
  min: number;
  max: number;
}

interface StringValidationRule {
  required: boolean;
  minLength: number;
  maxLength: number;
}

interface FrequencyValidationRule {
  required: boolean;
  allowedValues: readonly FrequencyLabel[];
}

interface TimesValidationRule {
  required: boolean;
  format: string;
  minLength: number;
  mustMatchFrequency: boolean;
}
```

Design decision: These types are internal to the module (not exported). They exist to give `VALIDATION_RULES` a precise type so that the constant is self-documenting and type-safe.

**Step 2.2: Define VALIDATION_RULES constant**

```typescript
export const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  dose: {
    required: true,
    min: 0.001,
    max: 10000,
  },
  frequency: {
    required: true,
    allowedValues: ['once', 'bid', 'tid', 'qid', 'q6h', 'q8h', 'q12h', 'custom'] as const,
  },
  times: {
    required: true,
    format: 'HH:MM',
    minLength: 1,
    mustMatchFrequency: true,
  },
  halfLife: {
    required: true,
    min: 0.1,
    max: 240,
  },
  peak: {
    required: true,
    min: 0.1,
    max: 48,
  },
  uptake: {
    required: true,
    min: 0.1,
    max: 24,
  },
  metaboliteLife: {
    required: false,
    min: 0.1,
    max: 1000,
  },
} as const;
```

Design decision: Use `as const` to get literal types for the ranges. This makes the constant both runtime-accessible (for UI display of min/max values) and type-safe.

### Phase 3: Validation Result Type

**Step 3.1: Define ValidationResult interface**

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

Design decision: Add `warnings` array alongside `errors`. The CLAUDE.md specification explicitly requires warnings for atypical-but-allowed conditions (uptake >= halfLife). Separating errors from warnings lets the UI display them differently (red vs yellow) and lets the calculation engine proceed when only warnings exist. The `valid` field is `true` when `errors` is empty, regardless of warnings.

### Phase 4: Validation Function

**Same file:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`

**Step 4.1: Define the main validation function signature**

```typescript
export function validatePrescription(rx: Prescription): ValidationResult
```

Note: The CLAUDE.md signature returns `{ valid: boolean; errors: string[] }`. We extend this with `warnings` as described in Phase 3. The caller can ignore `warnings` if desired, so this is backward-compatible with the specification.

**Step 4.2: Implement field-level validators as private helper functions**

Each helper returns an array of error strings (empty if valid). This keeps the main function clean and each validation rule testable in isolation.

```typescript
function validateName(name: string): string[]
function validateDose(dose: number): string[]
function validateFrequency(frequency: string): string[]
function validateTimes(times: string[], frequency: FrequencyLabel): string[]
function validateHalfLife(halfLife: number): string[]
function validatePeak(peak: number): string[]
function validateUptake(uptake: number): string[]
function validateMetaboliteLife(metaboliteLife: number | undefined): string[]
```

**Step 4.3: Implement cross-field validation (warnings)**

```typescript
function checkCrossFieldWarnings(rx: Prescription): string[]
```

This function produces warnings (not errors) for:
- `uptake >= halfLife`: "Uptake time ({uptake}h) is greater than or equal to half-life ({halfLife}h). This indicates atypical absorption kinetics."
- `uptake` approximately equal to `halfLife` (within tolerance of 0.001 on ka vs ke): "Uptake time and half-life produce nearly equal rate constants (ka ~ ke). The fallback formula will be used for calculations."

**Step 4.4: Implement the main validatePrescription function**

```typescript
export function validatePrescription(rx: Prescription): ValidationResult {
  const errors: string[] = [
    ...validateName(rx.name),
    ...validateDose(rx.dose),
    ...validateFrequency(rx.frequency),
    ...validateTimes(rx.times, rx.frequency),
    ...validateHalfLife(rx.halfLife),
    ...validatePeak(rx.peak),
    ...validateUptake(rx.uptake),
    ...validateMetaboliteLife(rx.metaboliteLife),
  ];

  const warnings = checkCrossFieldWarnings(rx);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Phase 4 Detail: Validation Logic Breakdown

Each validator function's logic:

#### validateName(name)
1. Check `typeof name === 'string'` -- error: "Name is required and must be a string"
2. Trim whitespace, check `length >= 1` -- error: "Name must not be empty"
3. Check `length <= 100` -- error: "Name must be 100 characters or fewer"

#### validateDose(dose)
1. Check `typeof dose === 'number' && !isNaN(dose)` -- error: "Dose is required and must be a number"
2. Check `dose >= 0.001` -- error: "Dose must be at least 0.001"
3. Check `dose <= 10000` -- error: "Dose must be at most 10,000"

#### validateFrequency(frequency)
1. Check value is one of the allowed values in `VALIDATION_RULES.frequency.allowedValues` -- error: "Frequency must be one of: once, bid, tid, qid, q6h, q8h, q12h, custom"

#### validateTimes(times, frequency)
1. Check `Array.isArray(times)` -- error: "Times must be an array"
2. Check `times.length >= 1` -- error: "At least one dosing time is required"
3. For each time entry, validate format with regex `/^([01]\d|2[0-3]):([0-5]\d)$/` -- error: "Time '{value}' is not valid HH:MM 24-hour format"
4. If frequency is not 'custom', look up expected count from `FREQUENCY_MAP[frequency]` and check `times.length === expectedCount` -- error: "Frequency '{frequency}' requires exactly {expectedCount} dosing time(s), but {times.length} provided"

Important detail on HH:MM regex: The pattern `^([01]\d|2[0-3]):([0-5]\d)$` correctly validates:
- Hours 00-19 via `[01]\d`
- Hours 20-23 via `2[0-3]`
- Minutes 00-59 via `[0-5]\d`
- Rejects `24:00`, `25:00`, `9:00` (must be `09:00`), `12:5` (must be `12:05`)

#### validateHalfLife(halfLife)
1. Check `typeof halfLife === 'number' && !isNaN(halfLife)` -- error: "Half-life is required and must be a number"
2. Check `halfLife >= 0.1` -- error: "Half-life must be at least 0.1 hours"
3. Check `halfLife <= 240` -- error: "Half-life must be at most 240 hours"

#### validatePeak(peak)
1. Check `typeof peak === 'number' && !isNaN(peak)` -- error: "Peak time (Tmax) is required and must be a number"
2. Check `peak >= 0.1` -- error: "Peak time must be at least 0.1 hours"
3. Check `peak <= 48` -- error: "Peak time must be at most 48 hours"

#### validateUptake(uptake)
1. Check `typeof uptake === 'number' && !isNaN(uptake)` -- error: "Uptake time is required and must be a number"
2. Check `uptake >= 0.1` -- error: "Uptake time must be at least 0.1 hours"
3. Check `uptake <= 24` -- error: "Uptake time must be at most 24 hours"

#### validateMetaboliteLife(metaboliteLife)
1. If `metaboliteLife === undefined` or `metaboliteLife === null`, return [] (it is optional)
2. Check `typeof metaboliteLife === 'number' && !isNaN(metaboliteLife)` -- error: "Metabolite half-life must be a number when provided"
3. Check `metaboliteLife >= 0.1` -- error: "Metabolite half-life must be at least 0.1 hours"
4. Check `metaboliteLife <= 1000` -- error: "Metabolite half-life must be at most 1,000 hours"

#### checkCrossFieldWarnings(rx)
1. Compute `ka = 0.693 / rx.uptake` and `ke = 0.693 / rx.halfLife`
2. If `rx.uptake >= rx.halfLife`: warning about atypical absorption kinetics
3. If `Math.abs(ka - ke) < 0.001`: warning about ka approximately equal to ke (fallback formula trigger)

Note: Only compute warnings if both uptake and halfLife passed their individual validations (are valid numbers in range). Otherwise skip cross-field checks since the values are meaningless.

### Phase 5: Barrel Export

**File to modify:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts`

Replace the empty stub with:

```typescript
export type { Prescription, TimeSeriesPoint, GraphDataset, ValidationResult } from './prescription';
export type { FrequencyLabel } from './prescription';
export { FREQUENCY_MAP, VALIDATION_RULES, validatePrescription } from './prescription';
```

Design decision: Use `export type` for pure type exports (interfaces and type aliases) to enable TypeScript's `isolatedModules` compatibility and to make it clear which exports are erased at runtime. Use regular `export` for runtime values (constants and functions).

### Phase 6: Test Suite

**File to create:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/prescription.spec.ts`

#### Test Structure

```
describe('Prescription Models', () => {
  describe('FrequencyLabel type', () => { ... })
  describe('FREQUENCY_MAP', () => { ... })
  describe('VALIDATION_RULES', () => { ... })
  describe('validatePrescription', () => {
    describe('valid prescriptions', () => { ... })
    describe('name validation', () => { ... })
    describe('dose validation', () => { ... })
    describe('frequency validation', () => { ... })
    describe('times validation', () => { ... })
    describe('halfLife validation', () => { ... })
    describe('peak validation', () => { ... })
    describe('uptake validation', () => { ... })
    describe('metaboliteLife validation', () => { ... })
    describe('cross-field warnings', () => { ... })
    describe('edge cases', () => { ... })
    describe('reference test fixtures', () => { ... })
  })
})
```

#### Test Specifications

**6.1: FREQUENCY_MAP tests**
- PASS: `FREQUENCY_MAP.once === 1`
- PASS: `FREQUENCY_MAP.bid === 2`
- PASS: `FREQUENCY_MAP.tid === 3`
- PASS: `FREQUENCY_MAP.qid === 4`
- PASS: `FREQUENCY_MAP.q6h === 4`
- PASS: `FREQUENCY_MAP.q8h === 3`
- PASS: `FREQUENCY_MAP.q12h === 2`
- PASS: `FREQUENCY_MAP.custom === null`
- PASS: Has exactly 8 keys (all FrequencyLabel values accounted for)

**6.2: VALIDATION_RULES tests**
- PASS: Each field key exists and has the expected min/max/required values
- PASS: `VALIDATION_RULES.frequency.allowedValues` contains all 8 frequency labels
- These are structural/smoke tests to catch accidental modifications

**6.3: Valid prescription tests (should return `{ valid: true, errors: [], warnings: [] }`)**

Baseline valid prescription fixture used across tests:

```typescript
const validPrescription: Prescription = {
  name: 'Ibuprofen',
  frequency: 'tid',
  times: ['08:00', '14:00', '20:00'],
  dose: 400,
  halfLife: 2,
  peak: 1.5,
  uptake: 0.5,
};
```

Tests:
- PASS: Baseline valid prescription passes validation
- PASS: Valid prescription with optional `id` field passes
- PASS: Valid prescription with optional `metaboliteLife` passes
- PASS: Valid prescription with `frequency: 'once'` and 1 time passes
- PASS: Valid prescription with `frequency: 'custom'` and any number of times (1, 5, 10) passes
- PASS: Valid prescription at boundary minimums (dose=0.001, halfLife=0.1, peak=0.1, uptake=0.1)
- PASS: Valid prescription at boundary maximums (dose=10000, halfLife=240, peak=48, uptake=24)
- PASS: Valid prescription with all frequency types (bid/2 times, qid/4 times, q6h/4 times, q8h/3 times, q12h/2 times)

**6.4: Name validation tests**
- FAIL: Empty string name -> error about name being empty
- FAIL: Name with only whitespace -> error about name being empty (after trim)
- FAIL: Name exceeding 100 characters -> error about max length
- PASS: Single character name -> valid
- PASS: Exactly 100 character name -> valid

**6.5: Dose validation tests**
- FAIL: dose = 0 -> error (below minimum 0.001)
- FAIL: dose = -1 -> error (below minimum)
- FAIL: dose = 10001 -> error (above maximum)
- FAIL: dose = NaN -> error
- PASS: dose = 0.001 -> valid (boundary minimum)
- PASS: dose = 10000 -> valid (boundary maximum)
- PASS: dose = 500 -> valid (typical value)

**6.6: Frequency validation tests**
- FAIL: frequency = 'invalid' as any -> error listing allowed values
- FAIL: frequency = '' as any -> error
- PASS: Each of the 8 valid frequency labels passes individually

**6.7: Times validation tests**
- FAIL: Empty times array -> error about minimum 1 time
- FAIL: times = ['25:00'] -> error about invalid format
- FAIL: times = ['9:00'] -> error (single digit hour not valid HH:MM)
- FAIL: times = ['12:60'] -> error (minutes out of range)
- FAIL: times = ['24:00'] -> error (hour 24 not valid)
- FAIL: times = [''] -> error (empty string not valid)
- FAIL: times = ['abc'] -> error about invalid format
- FAIL: frequency = 'bid', times has 1 entry -> error about count mismatch
- FAIL: frequency = 'bid', times has 3 entries -> error about count mismatch
- FAIL: frequency = 'tid', times has 2 entries -> error about count mismatch
- PASS: times = ['00:00'] -> valid (midnight)
- PASS: times = ['23:59'] -> valid (end of day)
- PASS: times = ['09:00', '21:00'] with frequency 'bid' -> valid (count matches)
- PASS: frequency = 'custom', times has 5 entries -> valid (custom allows any count >= 1)
- PASS: frequency = 'custom', times has 1 entry -> valid

**6.8: halfLife validation tests**
- FAIL: halfLife = 0 -> error (below minimum)
- FAIL: halfLife = 0.09 -> error (below 0.1)
- FAIL: halfLife = 241 -> error (above 240)
- FAIL: halfLife = NaN -> error
- PASS: halfLife = 0.1 -> valid (boundary minimum)
- PASS: halfLife = 240 -> valid (boundary maximum)
- PASS: halfLife = 6 -> valid (typical drug)

**6.9: peak validation tests**
- FAIL: peak = 0 -> error
- FAIL: peak = 0.09 -> error
- FAIL: peak = 49 -> error
- PASS: peak = 0.1 -> valid (boundary)
- PASS: peak = 48 -> valid (boundary)
- PASS: peak = 2 -> valid (typical)

**6.10: uptake validation tests**
- FAIL: uptake = 0 -> error
- FAIL: uptake = 0.09 -> error
- FAIL: uptake = 25 -> error
- PASS: uptake = 0.1 -> valid (boundary)
- PASS: uptake = 24 -> valid (boundary)
- PASS: uptake = 1.5 -> valid (typical)

**6.11: metaboliteLife validation tests**
- PASS: metaboliteLife = undefined -> valid (optional)
- PASS: metaboliteLife not present on object -> valid
- FAIL: metaboliteLife = 0 -> error
- FAIL: metaboliteLife = 0.09 -> error
- FAIL: metaboliteLife = 1001 -> error
- PASS: metaboliteLife = 0.1 -> valid
- PASS: metaboliteLife = 1000 -> valid
- PASS: metaboliteLife = 50 -> valid

**6.12: Cross-field warning tests**
- WARNING: uptake = 6, halfLife = 6 (equal) -> warning about atypical kinetics
- WARNING: uptake = 8, halfLife = 6 (uptake > halfLife) -> warning about atypical kinetics
- WARNING: uptake and halfLife produce |ka - ke| < 0.001 -> warning about ka ~ ke fallback
- NO WARNING: uptake = 1.5, halfLife = 6 (normal case) -> no warnings
- CRITICAL: Warnings should NOT cause valid to be false. The prescription is still valid.

**6.13: Multiple errors test**
- A prescription with multiple invalid fields should collect ALL errors (not short-circuit)
- Example: empty name + dose=0 + invalid time format should return 3+ errors

**6.14: Edge case tests**
- Prescription with dose = 0.001 (minimum boundary exact) -> valid
- Prescription where all fields are at their exact minimum -> valid
- Prescription where all fields are at their exact maximum -> valid
- Prescription with very long name (exactly 100 chars) -> valid
- Prescription with 100-char name + 1 -> error

**6.15: Reference test fixtures (exported for Task 3)**

These fixtures should be defined as exported constants in the test file so that Task 3 (calculation tests) can import them, OR defined in a separate shared fixtures file. Decision: define them as named exports in the test file and also export from a dedicated fixtures file.

Create `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts`:

```typescript
import type { Prescription } from '../prescription';

/** Simple single-dose reference case */
export const SINGLE_DOSE_FIXTURE: Prescription = {
  name: 'Test Drug A',
  frequency: 'once',
  times: ['09:00'],
  dose: 500,
  halfLife: 6,
  peak: 2,
  uptake: 1.5,
};

/** Multi-dose bid reference case for accumulation/steady-state testing */
export const BID_MULTI_DOSE_FIXTURE: Prescription = {
  name: 'Test Drug B',
  frequency: 'bid',
  times: ['09:00', '21:00'],
  dose: 500,
  halfLife: 6,
  peak: 2,
  uptake: 1.5,
};

/** Edge case: ka approximately equal to ke (uptake ~ halfLife) */
export const KA_APPROX_KE_FIXTURE: Prescription = {
  name: 'Test Drug C',
  frequency: 'bid',
  times: ['08:00', '20:00'],
  dose: 250,
  halfLife: 4,
  peak: 3.5,
  uptake: 4,
};

/** Edge case: minimum boundary values */
export const MIN_BOUNDARY_FIXTURE: Prescription = {
  name: 'X',
  frequency: 'once',
  times: ['00:00'],
  dose: 0.001,
  halfLife: 0.1,
  peak: 0.1,
  uptake: 0.1,
};

/** Edge case: maximum boundary values */
export const MAX_BOUNDARY_FIXTURE: Prescription = {
  name: 'A'.repeat(100),
  frequency: 'once',
  times: ['23:59'],
  dose: 10000,
  halfLife: 240,
  peak: 48,
  uptake: 24,
};

/** Typical ibuprofen-like drug for general testing */
export const IBUPROFEN_FIXTURE: Prescription = {
  name: 'Ibuprofen',
  frequency: 'tid',
  times: ['08:00', '14:00', '20:00'],
  dose: 400,
  halfLife: 2,
  peak: 1.5,
  uptake: 0.5,
};
```

The spec file should import these fixtures and validate that each passes `validatePrescription` (except `KA_APPROX_KE_FIXTURE` which should pass with warnings).

## Testing Strategy

### Test Execution

```bash
# Run only model tests
npx vitest run src/core/models/__tests__/prescription.spec.ts

# Run in watch mode during development
npx vitest watch src/core/models/__tests__/prescription.spec.ts
```

### Coverage Goals

- **100% branch coverage** for `validatePrescription` and all helper validators
- Every boundary value (min, max, min-1, max+1) tested
- Every error message string verified in at least one test
- Every warning condition tested both for presence and absence

### Test Independence

Each test should construct its own prescription object (or spread from a valid baseline and override one field). Tests must not depend on execution order.

Pattern:
```typescript
function makeValid(overrides: Partial<Prescription> = {}): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 500,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
    ...overrides,
  };
}
```

This helper should be defined at the top of the test file and used throughout.

## Integration Points

### With Task 3 (Calculations)

The calculation engine will:
1. Import `Prescription`, `TimeSeriesPoint`, `GraphDataset` types
2. Import `FREQUENCY_MAP` to derive dosing intervals from frequency labels
3. Call `validatePrescription()` before running calculations (or trust the caller to validate)
4. Use `rx.uptake` to compute `ka = 0.693 / uptake` and `rx.halfLife` to compute `ke = 0.693 / halfLife`
5. Use the ka ~ ke threshold (0.001) to decide between standard and fallback formulas

The threshold constant `0.001` is used in both validation (to warn) and calculation (to switch formulas). Consider exporting it:

```typescript
export const KA_KE_TOLERANCE = 0.001;
```

This ensures validation warnings and calculation fallback use the same threshold.

### With Task 4 (Storage)

Storage will serialize `Prescription` objects to JSON for localStorage. The interface uses only JSON-compatible types (string, number, string[], optional fields) so no special serialization is needed.

### With Task 5+ (UI)

The `PrescriptionForm` component will:
1. Import `FrequencyLabel` for the frequency dropdown type
2. Import `FREQUENCY_MAP` to know how many time inputs to render
3. Import `VALIDATION_RULES` to display min/max hints on inputs
4. Call `validatePrescription()` on form submit and display `errors`/`warnings` to the user

## Architectural Decisions

### Decision 1: ValidationResult includes warnings

**Choice**: Extend the return type from `{ valid: boolean; errors: string[] }` to include `warnings: string[]`.

**Rationale**: CLAUDE.md specifies "warn if uptake >= halfLife" and "soft validation" for ka ~ ke. These are not errors (prescription is valid) but the user should be informed. A separate warnings array lets the UI render them differently from errors.

**Alternative considered**: Using a severity field on each error. Rejected as over-engineered for the current requirements.

### Decision 2: String union type vs enum for FrequencyLabel

**Choice**: `type FrequencyLabel = 'once' | 'bid' | ...`

**Rationale**: String unions are idiomatic TypeScript, tree-shake better, and match the CLAUDE.md specification verbatim. Enums add runtime code and can cause issues with `isolatedModules`.

### Decision 3: Export KA_KE_TOLERANCE constant

**Choice**: Export the tolerance threshold as a named constant.

**Rationale**: This value is used in both validation (warning) and calculations (formula switching). Keeping it in one place prevents divergence.

### Decision 4: Separate fixtures file

**Choice**: Create `src/core/models/__tests__/fixtures.ts` alongside the spec file.

**Rationale**: Task 3 (calculation tests) needs these same prescriptions as test inputs. A separate fixtures file avoids importing from a spec file (which some test runners handle poorly) and makes the fixtures clearly reusable.

### Decision 5: Validation collects all errors (no short-circuit)

**Choice**: Run all validators and return accumulated errors.

**Rationale**: Better UX -- the user sees all problems at once instead of fixing one, resubmitting, and finding the next. Also simpler implementation (no early returns).

### Decision 6: Whitespace-only names treated as empty

**Choice**: Trim name before checking length.

**Rationale**: A name of "   " (all spaces) has no meaningful content. Treating it as empty prevents invisible entries in the prescription list.

## Risks and Considerations

### Risk 1: FREQUENCY_MAP divergence from FrequencyLabel

**Mitigation**: The type `Record<FrequencyLabel, number | null>` ensures TypeScript will error if a new frequency label is added to the union but not to the map (and vice versa).

### Risk 2: Overly strict time validation rejecting valid inputs

**Mitigation**: The regex `/^([01]\d|2[0-3]):([0-5]\d)$/` is well-tested for 24-hour format. Test cases cover `00:00`, `23:59`, and common invalid formats.

### Risk 3: Cross-field validation on invalid individual fields

**Mitigation**: Only run cross-field checks (ka ~ ke comparison) when both `uptake` and `halfLife` are valid numbers in range. If either failed individual validation, skip cross-field checks to avoid NaN/Infinity in the ka/ke computation.

### Risk 4: Floating-point comparison for ka ~ ke

**Mitigation**: Use absolute difference `Math.abs(ka - ke) < 0.001` rather than relative difference. Since ka and ke are both derived from `0.693 / value` where value is in the range [0.1, 240], the absolute values of ka and ke are bounded (ka in [0.029, 6.93], ke in [0.003, 6.93]). An absolute tolerance of 0.001 is appropriate for these magnitudes.

### Risk 5: Future requirement changes to validation ranges

**Mitigation**: All ranges are centralized in `VALIDATION_RULES`. Changing a range requires updating one constant and its corresponding tests. No validation logic hardcodes ranges.

## Estimated Complexity

**Size**: ~150-200 lines of production code, ~400-500 lines of test code.

**Time estimate**: 1-2 hours for an experienced developer familiar with the codebase.

**Risk level**: Low. This is pure TypeScript with no external dependencies, no async operations, and no framework coupling. The types and validation logic are straightforward.

## File Checklist

Files to create:
- [ ] `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts` -- Types, constants, validation function
- [ ] `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/prescription.spec.ts` -- Test suite
- [ ] `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts` -- Reusable test fixtures

Files to modify:
- [ ] `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts` -- Replace empty stub with re-exports

## Verification Steps (Post-Implementation)

Run these commands to verify everything works:

```bash
# 1. Type-check passes
npm run type-check

# 2. All tests pass
npx vitest run src/core/models/__tests__/prescription.spec.ts

# 3. Linting passes
npm run lint

# 4. Full build succeeds
npm run build

# 5. Full test suite still passes (including existing HelloWorld test)
npx vitest run
```

All five must pass before this task is considered complete.
