# Implementation Report: Task 3 - Single-Dose PK Calculator
Generated: 2026-02-14T04:35:00Z

## Task
Implement the core pharmacokinetic calculation engine as pure TypeScript functions using strict TDD. The module provides `calculateConcentration()` for single-dose concentration curves using a one-compartment first-order absorption model, plus `getPeakTime()` for peak time calculation, and the `ABSORPTION_CONSTANT` (Math.LN2).

## TDD Summary

### Tests Written (58 total in 7 describe blocks)

**ABSORPTION_CONSTANT (2 tests)**
- `equals Math.LN2 exactly` - Strict equality check
- `is approximately 0.6931` - Sanity check with toBeCloseTo

**calculateConcentration - standard formula (15 tests)**
- `returns 0 at time=0` - Guard clause test
- `returns positive value at small positive time` - Basic positivity
- `returns peak value at Tmax` - SINGLE_DOSE at t=4, ~314.98
- `returns decreasing value after Tmax` - Decay verification
- `approaches 0 for very large time` - t=48 ~2.604
- `matches golden value at t=0.5` - ~100.116
- `matches golden value at t=1.0` - ~173.959
- `matches analytical value at t=6.0` - 500*7/12 (exact)
- `matches analytical value at t=12.0` - 500*21/64 (exact)
- `matches IBUPROFEN golden value at Tmax=4/3` - ~251.984
- `matches IBUPROFEN golden value at t=2.0` - ~233.333
- `matches IBUPROFEN golden value at t=6.0` - ~66.536
- `handles very long half-life (MAX_BOUNDARY)` - ~7742.637
- `handles very large dose (MAX_BOUNDARY)` - ~4811.478
- `raw concentration can exceed 1.0` - Not normalized

**calculateConcentration - edge cases (15 tests)**
- `returns 0 when dose is 0` - Zero dose guard
- `returns 0 when dose is negative` - Negative dose guard
- `returns 0 for negative time` - Pre-dose guard
- `returns 0 for time=0` - At-dose guard
- `uses fallback when uptake equals halfLife` - ka=ke detection
- `fallback matches golden value at t=1.0` - ~36.429
- `fallback matches golden value at t=4.0` - ~86.643
- `fallback peak matches 250/e` - ~91.970
- `fallback curve is smooth` - Continuity at tolerance boundary
- `fallback returns 0 at t=0` - Guard with fallback path
- `handles very small dose with ka=ke (MIN_BOUNDARY)` - ~0.000347
- `MIN_BOUNDARY concentration approaches 0 at t=1.0` - Near-zero
- `returns near-zero for very large time` - t=1000
- `never returns negative values` - Multi-parameter sweep
- `can return values greater than 1.0` - Raw concentration

**getPeakTime (8 tests)**
- `returns exactly 4.0 for SINGLE_DOSE_FIXTURE` - Analytical verification
- `returns exactly 4/3 for IBUPROFEN_FIXTURE` - Analytical verification
- `returns ~88.585 for MAX_BOUNDARY_FIXTURE` - Long half-life
- `returns 1/ke when uptake equals halfLife` - Fallback formula
- `returns 1/ke for MIN_BOUNDARY_FIXTURE` - Fallback with tiny values
- `returns 0 when uptake > halfLife` - ka < ke edge case
- `returns 0 when uptake is much larger than halfLife` - Extreme edge case
- `peak time is where concentration is maximized` - Consistency check

**Reference fixture tests (10 tests)**
- Regression tests against all 6 fixtures at key timepoints
- Cross-validates BID_MULTI_DOSE with SINGLE_DOSE (same PK params)
- Verifies fallback formula for KA_APPROX_KE fixture
- Boundary fixture finite/non-negative checks

**Mathematical properties (5 tests)**
- `monotonically increasing before Tmax` - 40-step ascending check
- `monotonically decreasing after Tmax` - 40-step descending check
- `always non-negative for valid inputs` - 5 fixtures x 9 timepoints
- `Tmax has highest concentration` - 15 comparison points
- `doubling dose doubles concentration (linearity)` - 6 timepoints

**Barrel exports (3 tests)**
- `exports calculateConcentration as a function`
- `exports getPeakTime as a function`
- `exports ABSORPTION_CONSTANT as a number`

### Implementation

- `src/core/calculations/pkCalculator.ts` - Created (107 lines)
  - `ABSORPTION_CONSTANT = Math.LN2` (exported)
  - `computeKa(uptake)` (internal helper)
  - `computeKe(halfLife)` (internal helper)
  - `calculateConcentration(time, dose, halfLife, uptake)` (exported)
  - `getPeakTime(halfLife, uptake)` (exported)
  - Imports `KA_KE_TOLERANCE` from `@/core/models/prescription`

- `src/core/calculations/index.ts` - Modified (barrel exports)
  - Exports: `calculateConcentration`, `getPeakTime`, `ABSORPTION_CONSTANT`

- `src/core/calculations/__tests__/pkCalculator.spec.ts` - Created (~450 lines, 58 tests)

## Test Results
- Total: 168 tests (58 new + 110 existing)
- Passed: 168
- Failed: 0
- Type check: Clean
- Lint: Clean (0 warnings, 0 errors)
- Build: Successful

## Golden Values Verified

| Fixture | Timepoint | Expected | Formula |
|---------|-----------|----------|---------|
| SINGLE_DOSE (500mg, hl=6, up=1.5) | t=4.0 (Tmax) | 314.980262 | Standard |
| SINGLE_DOSE | t=6.0 | 291.666667 (500*7/12) | Exact analytical |
| SINGLE_DOSE | t=12.0 | 164.062500 (500*21/64) | Exact analytical |
| IBUPROFEN (400mg, hl=2, up=0.5) | t=4/3 (Tmax) | 251.984210 | Standard |
| IBUPROFEN | t=2.0 | 233.333333 | Standard |
| KA_APPROX_KE (250mg, hl=4, up=4) | t=5.771 (1/ke) | 91.969860 (250/e) | Fallback |
| MAX_BOUNDARY (10000mg, hl=240, up=24) | t=88.585 (Tmax) | 7742.636827 | Standard |
| MIN_BOUNDARY (0.001mg, hl=0.1, up=0.1) | t=0.1 | 0.0003465736 | Fallback |

## Changes Made
1. Created `src/core/calculations/pkCalculator.ts` with standard and fallback PK formulas
2. Created `src/core/calculations/__tests__/pkCalculator.spec.ts` with 58 test cases
3. Updated `src/core/calculations/index.ts` with barrel exports

## Notes
- The `calculateConcentration` function returns raw (unnormalized) concentration values. Task 4 will sum these across multiple doses and normalize to peak=1.0.
- The `getPeakTime` function returns 0 when ka <= ke per spec, even though the mathematical formula would produce a valid positive value.
- `KA_KE_TOLERANCE` (0.001) is imported from models/prescription.ts as single source of truth.
- Fixed TypeScript strict mode issue with `noUncheckedIndexedAccess: true` by avoiding array indexing in loop bodies.
- All mathematical property tests pass: monotonicity, non-negativity, linearity, peak maximality.
