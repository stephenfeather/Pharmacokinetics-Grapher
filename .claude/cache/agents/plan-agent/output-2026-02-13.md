# Implementation Plan: Task 3 - Single-Dose PK Calculator

Generated: 2026-02-13

## Goal

Implement the core pharmacokinetic calculation engine as pure TypeScript functions in `src/core/calculations/pkCalculator.ts`. This module provides the foundational `calculateConcentration()` function using a one-compartment first-order absorption model, plus a `getPeakTime()` helper. These are building blocks for Task 4's multi-dose accumulation and normalization.

The calculator must be mathematically correct, handle all edge cases gracefully (no NaN, Infinity, or undefined), and produce outputs verified against analytically derived golden values.

## Existing Codebase Analysis (VERIFIED)

### Files read and verified:

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`** (lines 1-120): Contains `Prescription`, `TimeSeriesPoint`, `GraphDataset`, `ValidationResult` interfaces, `FrequencyLabel` type, `FREQUENCY_MAP`, `VALIDATION_RULES`, and `KA_KE_TOLERANCE = 0.001` constant.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts`**: Barrel exports all types and values from prescription.ts.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts`**: Six test fixtures (`SINGLE_DOSE_FIXTURE`, `BID_MULTI_DOSE_FIXTURE`, `KA_APPROX_KE_FIXTURE`, `MIN_BOUNDARY_FIXTURE`, `MAX_BOUNDARY_FIXTURE`, `IBUPROFEN_FIXTURE`).
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/index.ts`**: Empty stub (`export {}`), ready to be replaced.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/__tests__/`**: Empty directory, test file needs to be created.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/tsconfig.app.json`**: TypeScript strict mode (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`). Path alias `@/*` -> `./src/*`.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/vitest.config.ts`**: jsdom environment, excludes e2e. Test pattern: `src/**/__tests__/*.spec.ts`.
- **All 110 existing tests pass** (2 test files: prescription.spec.ts, HelloWorld.spec.ts).

### Key Integration Points from Task 2:

| Import | Source | Purpose |
|--------|--------|---------|
| `KA_KE_TOLERANCE` | `@/core/models/prescription` | Threshold for ka~ke fallback formula switch |
| `Prescription` | `@/core/models/prescription` | Type-only import for function signatures (used in tests with fixtures) |
| All 6 fixtures | `@/core/models/__tests__/fixtures` | Test reference data |

### Downstream Consumer (Task 4):

Task 4 will call `calculateConcentration()` for each dose at each time step, sum raw contributions, then normalize the total curve to peak=1.0. The function must return **raw unnormalized concentration** values.

## Mathematical Foundation

### Standard Formula (when |ka - ke| >= 0.001)

```
C(t) = Dose * [ka / (ka - ke)] * (e^(-ke*t) - e^(-ka*t))
```

Where:
- `ka = ln(2) / uptake` (absorption rate constant)
- `ke = ln(2) / halfLife` (elimination rate constant)
- `ln(2) = 0.6931471805599453` (the ABSORPTION_CONSTANT)

### Fallback Formula (when |ka - ke| < 0.001)

```
C(t) = Dose * ka * t * e^(-ke*t)
```

This is the mathematical limit of the standard formula as ka -> ke. It prevents division by near-zero.

### Peak Time Formula

```
Tmax = ln(ka/ke) / (ka - ke)    [standard, when ka > ke]
Tmax = 1 / ke                   [fallback, when ka ~ ke]
```

Returns 0 when ka <= ke in the standard formula (edge case: slow absorption, fast elimination -- concentration rises then falls immediately or peak is at t=0).

## Pre-Computed Golden Values (Analytically Verified)

These values were computed using the formulas above and verified with analytical derivations. They serve as regression baselines for tests.

### SINGLE_DOSE_FIXTURE (dose=500, halfLife=6, uptake=1.5)

| Parameter | Value | Derivation |
|-----------|-------|------------|
| ka | 0.46209812037329684 | ln(2) / 1.5 |
| ke | 0.11552453009332421 | ln(2) / 6 |
| ka/(ka-ke) | 4/3 = 1.333... | Analytical |
| Tmax | 4.0 hours (exact) | ln(4) / (ka-ke) = 2*ln(2) / (0.5*ln(2)) = 4 |

| Time (hours) | Raw Concentration | Analytical Verification |
|-------------|-------------------|------------------------|
| 0.0 | 0.0 | Both exponentials equal at t=0 |
| 0.5 | 100.115858 | Numerical |
| 1.0 | 173.958795 | Numerical |
| 4.0 (Tmax) | 314.980262 | Peak concentration |
| 6.0 | 291.666667 | 500 * 7/12 (exact: exp(-ke*6)=1/2, exp(-ka*6)=1/16) |
| 12.0 | 164.062500 | 500 * 21/64 (exact: exp(-ke*12)=1/4, exp(-ka*12)=1/256) |
| 24.0 | 41.656494 | Numerical |
| 48.0 | 2.604167 | Numerical |

### IBUPROFEN_FIXTURE (dose=400, halfLife=2, uptake=0.5)

| Parameter | Value |
|-----------|-------|
| ka | 1.3862943611198906 |
| ke | 0.34657359027997264 |
| Tmax | 4/3 hours (exact) |

| Time (hours) | Raw Concentration |
|-------------|-------------------|
| 0.0 | 0.0 |
| 0.5 | 181.811421 |
| 4/3 (Tmax) | 251.984210 |
| 2.0 | 233.333333 |
| 6.0 | 66.536458 |
| 12.0 | 8.333302 |

### KA_APPROX_KE_FIXTURE (dose=250, halfLife=4, uptake=4) -- FALLBACK FORMULA

| Parameter | Value |
|-----------|-------|
| ka | 0.17328679513998632 |
| ke | 0.17328679513998632 |
| \|ka-ke\| | 0.0 (exactly equal, triggers fallback) |
| Tmax (1/ke) | 5.7707801635558535 |
| Cmax (250/e) | 91.969860 |

| Time (hours) | Raw Concentration (fallback formula) |
|-------------|--------------------------------------|
| 0.0 | 0.0 |
| 1.0 | 36.429061 |
| 4.0 | 86.643398 |
| 5.77 (Tmax) | 91.969860 |
| 6.0 | 91.899201 |
| 12.0 | 64.982548 |
| 24.0 | 16.245637 |

### MIN_BOUNDARY_FIXTURE (dose=0.001, halfLife=0.1, uptake=0.1) -- FALLBACK FORMULA

| Parameter | Value |
|-----------|-------|
| ka = ke | 6.931471805599452 |
| Uses fallback | Yes (ka = ke exactly) |

| Time (hours) | Raw Concentration |
|-------------|-------------------|
| 0.0 | 0.0 |
| 0.05 | 0.0002450645 |
| 0.1 | 0.0003465736 |
| 1.0 | 0.0000067690 |

### MAX_BOUNDARY_FIXTURE (dose=10000, halfLife=240, uptake=24) -- STANDARD FORMULA

| Parameter | Value |
|-----------|-------|
| ka | 0.028881132523331052 |
| ke | 0.0028881132523331052 |
| Tmax | 88.584749 hours |

| Time (hours) | Raw Concentration |
|-------------|-------------------|
| 0.0 | 0.0 |
| 24.0 | 4811.477684 |
| 88.58 (Tmax) | 7742.636827 |
| 240.0 | 5544.704861 |
| 1000.0 | 618.679665 |

## Implementation Phases

The implementation follows strict TDD: write failing tests first, then implement just enough code to pass them, then refactor.

---

### Phase 1: Constants and Internal Helpers

**File to create:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/pkCalculator.ts`

**Step 1.1: Define ABSORPTION_CONSTANT**

```typescript
/**
 * Natural logarithm of 2.
 * Used to convert half-life/uptake to rate constants:
 *   ka = ABSORPTION_CONSTANT / uptake
 *   ke = ABSORPTION_CONSTANT / halfLife
 */
export const ABSORPTION_CONSTANT = Math.LN2 // 0.6931471805599453
```

Use `Math.LN2` rather than a hardcoded `0.693` -- it is the exact IEEE 754 representation of ln(2). This avoids rounding errors and makes the intent self-documenting.

**Step 1.2: Internal helper functions**

```typescript
/**
 * Compute absorption rate constant from uptake time.
 * @param uptake - Absorption time in hours (must be > 0)
 * @returns ka in hr^-1
 */
function computeKa(uptake: number): number {
  return ABSORPTION_CONSTANT / uptake
}

/**
 * Compute elimination rate constant from half-life.
 * @param halfLife - Elimination half-life in hours (must be > 0)
 * @returns ke in hr^-1
 */
function computeKe(halfLife: number): number {
  return ABSORPTION_CONSTANT / halfLife
}
```

These are internal (not exported) helpers. They exist for readability and to centralize the ka/ke derivation. Tests verify them indirectly through `calculateConcentration()` and `getPeakTime()`.

**Decision: Export or keep internal?**
Keep `computeKa` and `computeKe` as **non-exported** internal functions. The public API is `calculateConcentration`, `getPeakTime`, and `ABSORPTION_CONSTANT`. If Task 4 or beyond needs direct ka/ke access, export them then. YAGNI now.

**Tests for Phase 1:** (5 tests)

```
describe('ABSORPTION_CONSTANT', () => {
  it('equals Math.LN2')                          // exact equality
  it('is approximately 0.6931')                   // sanity check
})

describe('internal rate constant computation (tested via calculateConcentration)', () => {
  it('derives ka = ABSORPTION_CONSTANT / uptake via output verification')
  it('derives ke = ABSORPTION_CONSTANT / halfLife via output verification')
  it('ka and ke are positive for valid inputs')
})
```

**Pass criteria:** ABSORPTION_CONSTANT tests pass. Rate constant tests are deferred to Phase 2 (need calculateConcentration).

---

### Phase 2: calculateConcentration -- Standard Formula

**Step 2.1: Implement the standard path**

```typescript
import { KA_KE_TOLERANCE } from '@/core/models/prescription'

/**
 * Calculate drug concentration at a given time using one-compartment
 * first-order absorption model.
 *
 * Standard formula: C(t) = Dose * [ka/(ka-ke)] * (e^(-ke*t) - e^(-ka*t))
 * Fallback (|ka-ke| < KA_KE_TOLERANCE): C(t) = Dose * ka * t * e^(-ke*t)
 *
 * @param time - Time in hours since dose administration
 * @param dose - Dose amount in arbitrary units
 * @param halfLife - Elimination half-life in hours (> 0)
 * @param uptake - Absorption time in hours (> 0)
 * @returns Raw relative concentration (not normalized, can be > 1.0)
 */
export function calculateConcentration(
  time: number,
  dose: number,
  halfLife: number,
  uptake: number,
): number {
  // Guard: zero or negative dose
  if (dose <= 0) return 0

  // Guard: negative or zero time (before dose administered)
  if (time <= 0) return 0

  const ka = computeKa(uptake)
  const ke = computeKe(halfLife)

  let concentration: number

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    // Fallback formula: limit as ka -> ke
    concentration = dose * ka * time * Math.exp(-ke * time)
  } else {
    // Standard one-compartment first-order absorption
    concentration = dose * (ka / (ka - ke)) * (Math.exp(-ke * time) - Math.exp(-ka * time))
  }

  // Clamp numerical artifacts to zero
  return Math.max(0, concentration)
}
```

**Key Design Decisions:**

1. **`time <= 0` returns 0, not just `time < 0`.** At t=0, both exponentials equal 1, so `e^(-ke*0) - e^(-ka*0) = 0`. Returning 0 directly avoids unnecessary computation. The formula itself yields 0, so this is both an optimization and a guard.

2. **`dose <= 0` returns 0.** Negative doses are physically meaningless. Zero dose trivially gives 0 concentration.

3. **`Math.max(0, concentration)`** clamps any floating-point artifacts that might produce tiny negative values (e.g., from catastrophic cancellation in the exponential difference).

4. **Import `KA_KE_TOLERANCE` from models**, not re-defining it. Single source of truth shared between validation warnings and calculation formula switching.

5. **No validation of halfLife/uptake ranges.** The calculator is a pure math function. Input validation happens upstream via `validatePrescription()`. If called with invalid inputs (e.g., halfLife=0), division by zero will produce Infinity/NaN, which is acceptable for a pure function -- callers should validate first. We could add guards, but that conflates validation with calculation.

**Tests for Phase 2:** (15 tests)

```
describe('calculateConcentration - standard formula', () => {
  // --- Basic behavior ---
  it('returns 0 at time=0')
  it('returns positive value at small positive time (t=0.5)')
  it('returns peak value at Tmax (SINGLE_DOSE: t=4, expect ~314.98)')
  it('returns decreasing value after Tmax (t=6 < t=4 peak)')
  it('approaches 0 for very large time (t=48, SINGLE_DOSE)')

  // --- Golden value verification (SINGLE_DOSE_FIXTURE) ---
  it('matches golden value at t=0.5 (~100.116)')
  it('matches golden value at t=1.0 (~173.959)')
  it('matches analytical value at t=6.0 (500*7/12 = 291.667)')
  it('matches analytical value at t=12.0 (500*21/64 = 164.0625)')

  // --- IBUPROFEN_FIXTURE golden values ---
  it('matches IBUPROFEN golden value at Tmax=4/3 (~251.984)')
  it('matches IBUPROFEN golden value at t=2.0 (~233.333)')
  it('matches IBUPROFEN golden value at t=6.0 (~66.536)')

  // --- MAX_BOUNDARY_FIXTURE ---
  it('handles very long half-life (MAX_BOUNDARY at Tmax=88.58, expect ~7742.637)')
  it('handles very large dose (MAX_BOUNDARY at t=24, expect ~4811.478)')
  it('raw concentration can exceed 1.0 (not normalized)')
})
```

**Pass criteria:** All 15 tests pass with tolerance of 0.01 (absolute) for golden values. The tolerance accounts for floating-point arithmetic differences but is tight enough to catch formula errors.

**Tolerance strategy:**
- Use `toBeCloseTo(expected, 1)` for values > 100 (precision 0.05)
- Use `toBeCloseTo(expected, 4)` for values < 1 (precision 0.00005)
- Or use a custom helper: `expect(Math.abs(actual - expected)).toBeLessThan(0.01)` for absolute tolerance

Recommended: Use Vitest's `toBeCloseTo(expected, decimalDigits)` where decimalDigits means `|actual - expected| < 10^(-decimalDigits) / 2`. For our needs:
- `toBeCloseTo(314.98, 1)` means within 0.05 -- suitable for most values
- For exact analytical values like 500*7/12, test the exact fraction: `expect(result).toBeCloseTo(500 * 7 / 12, 6)`

---

### Phase 3: calculateConcentration -- Edge Cases

**Step 3.1: Zero dose, negative time**

Already handled by guards, but need explicit tests.

**Step 3.2: Fallback formula (ka ~ ke)**

Uses `KA_APPROX_KE_FIXTURE` and `MIN_BOUNDARY_FIXTURE` where uptake = halfLife.

**Tests for Phase 3:** (15 tests)

```
describe('calculateConcentration - edge cases', () => {
  // --- Zero/negative dose ---
  it('returns 0 when dose is 0')
  it('returns 0 when dose is negative')

  // --- Negative/zero time ---
  it('returns 0 for negative time (t=-1)')
  it('returns 0 for time=0')

  // --- Fallback formula (ka ~ ke) ---
  it('uses fallback when uptake equals halfLife (KA_APPROX_KE_FIXTURE)')
  it('fallback matches golden value at t=1.0 (~36.429)')
  it('fallback matches golden value at t=4.0 (~86.643)')
  it('fallback peak matches 250/e (~91.970) at Tmax=4/LN2')
  it('fallback curve is smooth (no discontinuity near tolerance boundary)')
  it('fallback returns 0 at t=0')

  // --- MIN_BOUNDARY_FIXTURE (very small dose, ka=ke) ---
  it('handles very small dose with ka=ke (MIN_BOUNDARY at t=0.1, expect ~0.000347)')
  it('MIN_BOUNDARY concentration approaches 0 at t=1.0')

  // --- Very large time ---
  it('returns near-zero for very large time (t=1000, SINGLE_DOSE)')

  // --- Clamp to zero ---
  it('never returns negative values')

  // --- Output is raw (not normalized) ---
  it('can return values greater than 1.0 (raw concentration)')
})
```

**Pass criteria:** All 15 tests pass. Fallback formula tests verify continuity at the tolerance boundary. No NaN, Infinity, or negative returns.

**Continuity test detail:** To verify the fallback does not create a discontinuity:
```typescript
// At the tolerance boundary, both formulas should produce similar results
const halfLife = 6
const uptakeNear = 6 + 0.0001  // |ka-ke| just barely above tolerance
const uptakeAt = 6              // |ka-ke| = 0, triggers fallback
const t = 3
const cNear = calculateConcentration(t, 500, halfLife, uptakeNear)
const cAt = calculateConcentration(t, 500, halfLife, uptakeAt)
expect(Math.abs(cNear - cAt)).toBeLessThan(1.0) // Values should be close
```

Wait -- let me verify this. When halfLife=6 and uptake=6.0001:
- ka = ln(2)/6.0001, ke = ln(2)/6
- |ka - ke| = |ln(2)/6.0001 - ln(2)/6| = ln(2) * |1/6.0001 - 1/6| = ln(2) * |6-6.0001|/(6*6.0001) = ln(2) * 0.0001/36.0006 ~ 0.00000193

That is less than 0.001, so it would ALSO use the fallback formula. We need uptake values where |ka-ke| straddles the 0.001 boundary. Let me compute:

For |ka-ke| = 0.001 when halfLife=6:
- ke = ln(2)/6 = 0.11552
- ka = ke + 0.001 = 0.11652
- uptake = ln(2) / 0.11652 = 5.9492

So uptake=5.94 would give |ka-ke| just above 0.001 (standard formula), and uptake=5.95 would give |ka-ke| just below 0.001 (fallback). Better continuity test:

```typescript
const halfLife = 6
const uptakeStandard = 5.94  // |ka-ke| ~ 0.00117, uses standard
const uptakeFallback = 5.95  // |ka-ke| ~ 0.00097, uses fallback
```

This will be specified in the test details.

---

### Phase 4: getPeakTime

**Step 4.1: Implement getPeakTime**

```typescript
/**
 * Calculate the time of peak concentration (Tmax) for a single dose.
 *
 * Standard: Tmax = ln(ka/ke) / (ka - ke)
 * Fallback (ka ~ ke): Tmax = 1/ke
 *
 * @param halfLife - Elimination half-life in hours (> 0)
 * @param uptake - Absorption time in hours (> 0)
 * @returns Time in hours when peak concentration occurs
 */
export function getPeakTime(halfLife: number, uptake: number): number {
  const ka = computeKa(uptake)
  const ke = computeKe(halfLife)

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    // Fallback: peak of Dose * ka * t * exp(-ke*t) is at t = 1/ke
    return 1 / ke
  }

  if (ka <= ke) {
    // Absorption slower than elimination: mathematically the formula
    // ln(ka/ke) would be negative and (ka-ke) is negative, so the ratio
    // could be positive -- but pharmacologically this means peak is very
    // early. Return the computed value rather than 0.
    // Actually: ln(ka/ke) < 0 and (ka-ke) < 0, so Tmax = positive.
    // This is valid math. Let it compute.
  }

  return Math.log(ka / ke) / (ka - ke)
}
```

**Design Decision: ka <= ke behavior**

When ka <= ke (uptake >= halfLife), the standard Tmax formula still produces a valid positive number:
- `ln(ka/ke)` is negative (ka < ke means ka/ke < 1)
- `(ka - ke)` is also negative
- negative / negative = positive

So the formula works correctly for all ka != ke. The CLAUDE.md specification says "Returns 0 if ka <= ke (edge case)" but this is pharmacologically incorrect -- even with slow absorption, there IS a peak time. The formula handles it.

**Resolution:** Follow the mathematical truth. The formula `ln(ka/ke) / (ka - ke)` produces the correct Tmax for all ka != ke. Do NOT special-case ka <= ke to return 0. The specification's suggestion was a simplification that would produce incorrect results. Document this in the code with a comment.

However, if we want to follow the spec literally, we would return 0 for ka <= ke. Since the spec says "Returns 0 if ka <= ke (edge case)", and this is a user-facing tool, I will follow the specification exactly but add a JSDoc note explaining the mathematical reality.

**Final decision:** Follow the spec: return 0 when ka <= ke (excluding the ka~ke fallback case). This is simpler and matches the stated API. The caller (CLAUDE.md says Tmax is "useful for reference but not directly used in primary formula") does not depend on correctness for ka <= ke.

```typescript
export function getPeakTime(halfLife: number, uptake: number): number {
  const ka = computeKa(uptake)
  const ke = computeKe(halfLife)

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    return 1 / ke
  }

  if (ka <= ke) {
    return 0
  }

  return Math.log(ka / ke) / (ka - ke)
}
```

**Tests for Phase 4:** (8 tests)

```
describe('getPeakTime', () => {
  // --- Standard formula ---
  it('returns exactly 4.0 for SINGLE_DOSE_FIXTURE (hl=6, uptake=1.5)')
  it('returns exactly 4/3 for IBUPROFEN_FIXTURE (hl=2, uptake=0.5)')
  it('returns ~88.585 for MAX_BOUNDARY_FIXTURE (hl=240, uptake=24)')

  // --- Fallback (ka ~ ke) ---
  it('returns 1/ke when uptake equals halfLife (4/LN2 ~ 5.771)')
  it('returns 1/ke for MIN_BOUNDARY_FIXTURE (0.1/LN2 ~ 0.144)')

  // --- Edge case: ka <= ke ---
  it('returns 0 when uptake > halfLife (ka < ke)')
  it('returns 0 when uptake is much larger than halfLife')

  // --- Consistency check ---
  it('peak time is where concentration is maximized')
})
```

The last test is a mathematical verification:
```typescript
it('peak time is where concentration is maximized', () => {
  const tmax = getPeakTime(6, 1.5)
  const cAtPeak = calculateConcentration(tmax, 500, 6, 1.5)
  const cBefore = calculateConcentration(tmax - 0.01, 500, 6, 1.5)
  const cAfter = calculateConcentration(tmax + 0.01, 500, 6, 1.5)
  expect(cAtPeak).toBeGreaterThan(cBefore)
  expect(cAtPeak).toBeGreaterThan(cAfter)
})
```

**Pass criteria:** All 8 tests pass. Peak time values match analytical expectations.

---

### Phase 5: Reference Fixture Tests

Systematic testing using all 6 fixtures from Task 2.

**Tests for Phase 5:** (10 tests)

```
describe('reference fixture tests', () => {
  // --- SINGLE_DOSE_FIXTURE ---
  it('SINGLE_DOSE: concentration is 0 at t=0')
  it('SINGLE_DOSE: peak at t=4 matches golden value (~314.98)')
  it('SINGLE_DOSE: decays after peak (t=6 < peak)')
  it('SINGLE_DOSE: approaches zero at t=48 (~2.604)')

  // --- BID_MULTI_DOSE_FIXTURE (same PK params as SINGLE_DOSE) ---
  it('BID_MULTI_DOSE: single-dose curve matches SINGLE_DOSE (same PK params)')

  // --- KA_APPROX_KE_FIXTURE (fallback) ---
  it('KA_APPROX_KE: uses fallback formula (ka=ke exactly)')
  it('KA_APPROX_KE: peak matches 250/e at Tmax=4/LN2')

  // --- IBUPROFEN_FIXTURE ---
  it('IBUPROFEN: peak matches golden value at Tmax=4/3')

  // --- MIN/MAX BOUNDARY ---
  it('MIN_BOUNDARY: produces finite non-negative values')
  it('MAX_BOUNDARY: produces expected concentration at Tmax')
})
```

**Pass criteria:** All 10 tests pass. Fixture-based tests provide regression baselines.

---

### Phase 6: Mathematical Property Tests

These tests verify mathematical invariants that must hold regardless of specific parameter values.

**Tests for Phase 6:** (5 tests)

```
describe('mathematical properties', () => {
  it('concentration is monotonically increasing before Tmax (standard formula)')
  it('concentration is monotonically decreasing after Tmax (standard formula)')
  it('concentration is always non-negative for valid inputs')
  it('concentration at Tmax > concentration at any other time (for standard formula)')
  it('doubling dose doubles concentration at any time (linearity)')
})
```

**Linearity test:**
```typescript
it('doubling dose doubles concentration at any time (linearity)', () => {
  const times = [0.5, 1, 2, 4, 6, 12]
  for (const t of times) {
    const c1 = calculateConcentration(t, 500, 6, 1.5)
    const c2 = calculateConcentration(t, 1000, 6, 1.5)
    expect(c2).toBeCloseTo(2 * c1, 6)
  }
})
```

**Monotonicity test:**
```typescript
it('concentration is monotonically increasing before Tmax', () => {
  const tmax = getPeakTime(6, 1.5) // 4.0
  const steps = Array.from({ length: 40 }, (_, i) => (i + 1) * (tmax / 40))
  for (let i = 1; i < steps.length; i++) {
    const cPrev = calculateConcentration(steps[i - 1], 500, 6, 1.5)
    const cCurr = calculateConcentration(steps[i], 500, 6, 1.5)
    expect(cCurr).toBeGreaterThanOrEqual(cPrev)
  }
})
```

**Pass criteria:** All 5 tests pass.

---

### Phase 7: Barrel Exports and Integration

**File to modify:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/index.ts`

Replace empty stub with:

```typescript
export {
  calculateConcentration,
  getPeakTime,
  ABSORPTION_CONSTANT,
} from './pkCalculator'
```

**Tests for Phase 7:** (3 tests)

```
describe('barrel exports from calculations/index.ts', () => {
  it('exports calculateConcentration as a function')
  it('exports getPeakTime as a function')
  it('exports ABSORPTION_CONSTANT as a number')
})
```

**Pass criteria:** All 3 tests pass. Barrel exports work correctly.

---

## Complete Test Organization

**File:** `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/__tests__/pkCalculator.spec.ts`

```
describe('PK Calculator', () => {
  describe('ABSORPTION_CONSTANT', () => {          // 2 tests
  })

  describe('calculateConcentration', () => {
    describe('standard formula', () => {            // 15 tests
    })
    describe('edge cases', () => {                  // 15 tests
    })
  })

  describe('getPeakTime', () => {                   // 8 tests
  })

  describe('reference fixture tests', () => {       // 10 tests
  })

  describe('mathematical properties', () => {       // 5 tests
  })

  describe('barrel exports', () => {                // 3 tests
  })
})
```

**Total: 58 tests** (within the ~40-60 range specified)

## File Deliverables

### 1. `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/pkCalculator.ts` (NEW)

Complete module with:
- `ABSORPTION_CONSTANT` (exported)
- `computeKa()` (internal)
- `computeKe()` (internal)
- `calculateConcentration()` (exported)
- `getPeakTime()` (exported)

Estimated size: ~80-100 lines including JSDoc comments.

### 2. `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/__tests__/pkCalculator.spec.ts` (NEW)

Complete test suite with 58 tests organized in 6 describe blocks.

Estimated size: ~350-450 lines.

### 3. `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/index.ts` (MODIFY)

Replace empty stub with barrel exports.

## TDD Execution Order

The implementation should proceed in this exact order:

1. **Write Phase 1 tests** (ABSORPTION_CONSTANT). Create pkCalculator.ts with just the constant. Run tests -- 2 pass.

2. **Write Phase 2 tests** (standard formula). Implement `calculateConcentration()` with standard formula only (no fallback yet). Run tests -- some Phase 2 tests pass, Phase 3 fallback tests would fail (but aren't written yet).

3. **Write Phase 3 tests** (edge cases including fallback). Add fallback formula branch to `calculateConcentration()`. Run all tests -- Phases 1-3 pass (32 tests).

4. **Write Phase 4 tests** (getPeakTime). Implement `getPeakTime()`. Run all tests -- Phases 1-4 pass (40 tests).

5. **Write Phase 5 tests** (reference fixtures). These should pass immediately with existing code. Run all tests -- 50 tests pass.

6. **Write Phase 6 tests** (mathematical properties). These should pass immediately. Run all tests -- 55 tests pass.

7. **Write Phase 7 tests** (barrel exports). Update `index.ts`. Run all tests -- 58 tests pass.

8. **Run full quality suite:**
   ```bash
   npm run test:unit -- --run     # All tests pass
   npm run type-check             # No TypeScript errors
   npm run lint                   # ESLint + oxlint clean
   npm run build                  # Builds successfully
   ```

## Testing Strategy

### Tolerance Approach

For floating-point comparison, use a consistent tolerance strategy:

```typescript
/**
 * Helper: assert that actual is within relative tolerance of expected.
 * Uses relative tolerance for large values, absolute for near-zero.
 */
function expectClose(actual: number, expected: number, relTol = 1e-6, absTol = 1e-10): void {
  const tolerance = Math.max(absTol, Math.abs(expected) * relTol)
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance)
}
```

Or simply use Vitest's `toBeCloseTo(expected, numDigits)`:
- For values > 100: `toBeCloseTo(expected, 2)` (within 0.005)
- For values 1-100: `toBeCloseTo(expected, 4)` (within 0.00005)
- For values < 1: `toBeCloseTo(expected, 6)` (within 0.0000005)
- For exact analytical values: `toBeCloseTo(expected, 10)` (maximum precision)

### Regression Baseline

The golden values computed above serve as regression baselines. If the formula implementation changes, these tests will catch unintended changes in output. The values are:
- Computed using the exact formulas specified in CLAUDE.md
- Verified analytically for several key points (e.g., 500*7/12, 500*21/64, 250/e)
- Cross-checked between Node.js computation and analytical derivation

## Risks and Considerations

### Risk 1: Floating-Point Precision at Tolerance Boundary

**Risk:** When |ka-ke| is very close to KA_KE_TOLERANCE (0.001), switching between standard and fallback formulas could create a discontinuity.

**Mitigation:** The fallback formula is the mathematical limit of the standard formula as ka->ke. At the boundary (|ka-ke|=0.001), both formulas should produce nearly identical results. Test this explicitly with the continuity test in Phase 3.

### Risk 2: Very Large Time Values

**Risk:** For very large `time` values, `Math.exp(-ke*time)` underflows to 0, which is correct (concentration approaches 0). But intermediate computations like `ka/(ka-ke) * exp(-ke*t)` might have precision issues.

**Mitigation:** The `Math.max(0, ...)` clamp handles any negative artifacts. JavaScript's `Math.exp()` handles underflow gracefully (returns 0, not an error).

### Risk 3: KA_KE_TOLERANCE Import Coupling

**Risk:** If Task 2's `KA_KE_TOLERANCE` value changes, the calculation behavior changes silently.

**Mitigation:** This is by design -- the tolerance is a shared constant that governs both the validation warning and the formula switch. Tests explicitly verify behavior at the tolerance boundary, so any change would be caught.

### Risk 4: Spec vs Math Disagreement on getPeakTime

**Risk:** The CLAUDE.md spec says "Returns 0 if ka <= ke" but mathematically, Tmax is always positive for ka != ke.

**Mitigation:** Follow the spec. Document the mathematical reality in a code comment. The getPeakTime function is informational only (not used in concentration calculations), so this edge case has no downstream impact.

## Estimated Complexity

- **Implementation:** ~80-100 lines of TypeScript (straightforward pure functions)
- **Tests:** ~350-450 lines (58 test cases)
- **Difficulty:** Low-medium. The math is well-defined. The main complexity is in edge case handling and test thoroughness.
- **Time estimate:** 1-2 hours for a developer familiar with the codebase
- **Dependencies:** Only Task 2 (types + KA_KE_TOLERANCE constant)
- **Blockers:** None. Task 2 is complete and all tests pass.
