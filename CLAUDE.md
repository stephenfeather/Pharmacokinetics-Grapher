# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pharmacokinetics Grapher** is a Vue 3 + TypeScript web application that visualizes medication levels over time. Users input prescription details (name, dose, frequency, half-life, etc.) and the app generates line graphs showing peak and trough concentrations across a specified timeframe.

### Key Characteristics
- **Frontend-only** architecture (no backend API)
- **Quality-focused** development (testing, linting, type safety)
- **Single-page application** with local browser storage (localStorage/IndexedDB)
- **Accurate scientific visualization** with Chart.js for reliable PK curve rendering

## Tech Stack

- **Framework**: Vue 3 (Composition API recommended)
- **Language**: TypeScript
- **Build Tool**: Vite (default with `npm create vue@latest`)
- **Charting**: Chart.js (for accurate scientific visualization)
- **Testing**: Vitest + Vue Test Utils (for unit/component tests)
- **Linting**: ESLint + Prettier
- **Package Manager**: npm or pnpm

## Project Setup & Common Commands

### Initial Setup
```bash
npm install
```

### Development
```bash
npm run dev          # Start dev server (typically http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Testing & Quality
```bash
npm run test         # Run all tests (Vitest)
npm run test:watch  # Watch mode for tests
npm run lint         # Run ESLint + Prettier checks
npm run lint:fix    # Auto-fix linting issues
npm run type-check  # Type check with TypeScript compiler
```

### Running a Single Test
```bash
npm run test -- src/components/__tests__/PrescriptionForm.spec.ts
npm run test -- --grep "prescription"  # Test files matching pattern
```

## Architecture & Code Organization

### Core Domain: Pharmacokinetic Calculations

The pharmacokinetics logic is the heart of the app. Store calculations separately from UI:

**File Structure** (suggested):
```
src/
├── core/
│   ├── models/
│   │   └── prescription.ts          # Prescription interface/type
│   ├── calculations/
│   │   ├── pkCalculator.ts          # Core PK calculation logic
│   │   ├── concentrationCurve.ts    # Curve generation for a single dose
│   │   └── multiDoseProfile.ts      # Accumulation over time
│   └── storage/
│       └── prescriptionStorage.ts   # localStorage management
├── components/
│   ├── PrescriptionForm.vue         # Input form
│   ├── GraphViewer.vue              # Chart visualization
│   └── PrescriptionList.vue         # Saved prescriptions
├── App.vue
└── main.ts
```

### Prescription Model

Based on the preplanning notes, a prescription contains:
```typescript
type FrequencyLabel = 'once' | 'bid' | 'tid' | 'qid' | 'q6h' | 'q8h' | 'q12h' | 'custom';

interface Prescription {
  id?: string               // Unique identifier for storage
  name: string              // Drug name
  frequency: FrequencyLabel // Standard pharmacy abbreviations (bid=2x/day, tid=3x/day, qid=4x/day, etc.)
  times: string[]          // Dosing times as HH:MM (e.g., ['09:00', '21:00'] for bid)
  dose: number             // Amount per dose as written on prescription (mg, units, etc.)
  halfLife: number         // Half-life in hours (from pharmacy insert)
  metaboliteLife?: number  // Half-life of metabolites in hours (optional, from insert)
  peak: number             // Time to peak concentration in hours, Tmax (from insert; stored for documentation, not used in calculations)
  uptake: number           // Absorption time in hours (from insert)
}

// Supporting types for calculations
interface TimeSeriesPoint {
  time: number             // Time in hours from start
  concentration: number    // Normalized relative concentration (0–1 scale, peak = 1.0)
}

interface GraphDataset {
  label: string            // Prescription name for legend
  data: TimeSeriesPoint[]  // Array of time/concentration points
  color?: string           // Optional color for chart
}
```

### Prescription Input Validation

All prescription fields must be validated before use in calculations:

**Validation Rules**:
```typescript
const FREQUENCY_MAP = {
  'once': 1,
  'bid': 2,       // Twice daily
  'tid': 3,       // Three times daily
  'qid': 4,       // Four times daily
  'q6h': 4,       // Every 6 hours
  'q8h': 3,       // Every 8 hours
  'q12h': 2,      // Every 12 hours
  'custom': null, // User specifies times array
};

const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  dose: {
    required: true,
    min: 0.001,        // Minimum dose from prescription
    max: 10000,        // Reasonable upper limit (varies by drug)
  },
  frequency: {
    required: true,
    allowedValues: ['once', 'bid', 'tid', 'qid', 'q6h', 'q8h', 'q12h', 'custom'],
  },
  times: {
    required: true,
    format: 'HH:MM',   // 24-hour format, e.g., "09:30"
    minLength: 1,
    mustMatchFrequency: true,  // e.g., bid must have exactly 2 times
  },
  halfLife: {
    required: true,
    min: 0.1,          // 6 minutes (very short-acting)
    max: 240,          // 10 days (very long-acting)
    source: 'from pharmacy insert range; user picks representative value',
  },
  peak: {
    required: true,
    min: 0.1,          // 6 minutes (Tmax)
    max: 48,           // 2 days
    source: 'from pharmacy insert range; user picks representative value',
  },
  uptake: {
    required: true,
    min: 0.1,          // 6 minutes
    max: 24,           // 1 day
    source: 'derived/estimated from pharmacy insert (inserts give ranges, not exact values)',
  },
  metaboliteLife: {
    required: false,
    min: 0.1,
    max: 1000,
    source: 'from pharmacy insert if relevant',
  },
};
```

**Logical Constraints**:
- Number of dosing times must match frequency label (e.g., 'bid' requires exactly 2 times)
- All times must be valid HH:MM in 24-hour format (00:00 to 23:59)
- **Warn if `uptake ≥ halfLife`** (ka ≤ ke): This may indicate atypical absorption kinetics (slow absorption, fast elimination). Allow it for visualization, but flag to user that the parameters are unusual.
- **Soft validation**: If `uptake ≈ halfLife` (ka ≈ ke) within numerical tolerance, use ka≈ke fallback formula instead of standard equation (do not reject input). This handles edge case gracefully.
- **Important**: All values are user-selected from pharmacy insert ranges. Inserts provide ranges (e.g., "half-life 4–6 hours"), not exact values. User picks a representative value within the range to visualize typical behavior.

**Validation Location**: `src/core/models/prescription.ts` should export a validation function:
```typescript
export function validatePrescription(rx: Prescription): { valid: boolean; errors: string[] }
```

### Output Format: Normalized Relative Concentrations (Rough Ranges)

**Important**: This app displays **normalized relative concentration curves** showing rough ranges of behavior. This means:
- Inputs (half-life, peak, uptake) are user-selected from pharmacy insert ranges, not absolute values
- Outputs show the **shape and timing** of peak/trough patterns using representative values
- Outputs do **not** show absolute mg/L values (would require patient-specific Vd and exact pharmacokinetic parameters)
- The curves are **scaled to 0–1 to show relative concentration** across time
- Useful for visualizing general dosing patterns ("when is peak?", "how does concentration decay?")
- **For educational and visualization purposes only, not for medical dosing decisions**

### Pharmacokinetic Model & Equations

This app uses a **one-compartment first-order absorption model**. The key equations are:

**Single Dose Concentration (relative units)**:
```
C(t) = Dose × [ka/(ka - ke)] × (e^(-ke×t) - e^(-ka×t))
```

This uses a simplified relative form (Vd normalized out). Where:
- `ka` = absorption rate constant = 0.693 / uptake
- `ke` = elimination rate constant = 0.693 / halfLife
- `t` = time since dose

**Multiple Doses (accumulation)**:
For a drug dosed at regular intervals, accumulation occurs. For each dose:
1. Calculate its contribution using the equation above (shifted by the dosing interval)
2. Sum all dose contributions to get total relative concentration over time
3. Normalize the final **total curve** to peak = 1.0 (so the highest concentration point = 1.0)

This ensures steady-state relationships and accumulation patterns are mathematically correct.

**Steady-State**:
For practical purposes, drug concentration patterns stabilize after ~5 half-lives (peak-to-trough ratio converges to within ~5% of the steady-state asymptote). At this point, each dose produces the same peak and trough pattern.

**Key References**:
- One-compartment kinetics assumes uniform drug distribution
- Assumes first-order elimination (proportional to concentration)
- Peak concentration time: `t_max = ln(ka/ke) / (ka - ke)` (defined when ka ≠ ke)
- Formula requires `ka ≠ ke` for mathematical stability (see ka≈ke fallback); `ka > ke` is typical but not required

**Important Assumptions**:
- No drug-drug interactions
- Linear kinetics (no saturation at high doses)
- Complete absorption (F = 1.0)
- Negligible active metabolites (metaboliteLife is informational only)

### Calculation Engine

The calculation layer should be **pure functions** (no UI dependencies):
- `calculateConcentration(time, dose, halfLife, uptake): number` — Single dose kinetics. Uses `uptake` to derive `ka`, and `halfLife` to derive `ke`. Returns **raw relative concentration** (not normalized; can be > 1.0). Used as building block for accumulation.
- `accumulateDoses(prescription, startDateTime, endDateTime): TimeSeriesPoint[]` — Multi-dose accumulation: sum raw contributions from each dose (shifted by interval), then normalize total curve to peak = 1.0. Returns normalized TimeSeriesPoint[] (0–1 scale).
- `getGraphData(prescriptions, timeRange): GraphDataset[]` — Format time-series data for charting

**Note on `peak` (Tmax)**: Pharmacy inserts provide both peak (Tmax) range and uptake range as separate parameters. User selects representative values from each range. The calculation uses `uptake` to derive `ka`; `peak` is stored for reference/documentation but not directly used in the equation (it could be computed from ka and ke if needed for validation).

This separation makes testing straightforward and allows reuse across visualizations.

### UI Layer

Vue components consume calculated data:

- **PrescriptionForm**:
  - User enters drug name, dose, half-life, peak, uptake (all from pharmacy insert)
  - Frequency picker: dropdown for bid/tid/qid/q6h/q8h/q12h/once (or "custom" to specify times)
  - Time picker: user enters dosing times (HH:MM format) based on frequency
  - Form validates that number of times matches frequency label
  - Stores `Prescription` object to localStorage

- **GraphViewer**:
  - Renders Chart.js line chart with multiple drugs (if multi-select)
  - X-axis: Time in hours, labeled clearly
  - Y-axis: Relative concentration (0–1 scale)
  - Uses time-series data from `getGraphData()`
  - Optional: allow user to set custom simulation timeframe (begin/end times)

- **PrescriptionList**:
  - Lists saved prescriptions (from localStorage)
  - CRUD operations: edit, delete, duplicate
  - Quick preview: show last generated graph
  - Compare mode: overlay multiple drugs on same graph

### State Management

For a quality-focused app, consider:
- **Simple approach**: Use Vue's `ref` + `provide/inject` for prescriptions
- **Scalable approach**: Pinia store if complexity grows

Start simple; refactor to Pinia if needed.

## Development Workflow

### Adding a New Feature

1. **Tests first** (TDD): Write tests for calculation or component behavior
2. **Implementation**: Write the feature code
3. **Integration**: Wire into UI if needed
4. **Manual testing**: Run the app and verify visually

### Example: Adding a New Dosing Frequency

1. Write tests in `src/core/calculations/__tests__/pkCalculator.spec.ts`
2. Update `Prescription` type if needed
3. Implement calculation logic in `pkCalculator.ts`
4. Update `PrescriptionForm.vue` to accept new frequency input
5. Test the form works end-to-end

### Code Quality Checklist

Before committing:
- [ ] Tests pass (`npm run test`)
- [ ] Types pass (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Manual testing in dev server works
- [ ] No console errors or warnings

## Key Files & Responsibilities

| File | Purpose |
|------|---------|
| `src/core/calculations/pkCalculator.ts` | Pure functions for pharmacokinetics math |
| `src/core/models/prescription.ts` | Type definitions for prescriptions |
| `src/core/storage/prescriptionStorage.ts` | localStorage wrapper for persistence |
| `src/components/PrescriptionForm.vue` | Input UI for new prescriptions |
| `src/components/GraphViewer.vue` | Chart rendering and visualization |
| `src/App.vue` | Main component, orchestrates state |

## Testing Strategy

**Unit tests** for calculations (most critical):
- Test PK equations with **known-value reference cases**:
  - Simple example: 500mg dose, 6hr half-life, 2hr uptake → verify peak time and decay
  - Multi-dose: Same drug dosed bid → verify accumulation at steady-state
  - Edge cases: zero dose, very short/long half-lives, ka ≈ ke
  - Known published examples: Find a real drug PK curve from pharmacology textbooks and replicate numerically

**Reference Test Fixtures**:
```typescript
// Example: Simple reference case for testing accumulation
const referenceCase = {
  prescription: {
    name: "Test Drug",
    frequency: "bid" as const,
    times: ["09:00", "21:00"],
    dose: 500,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
  },
  // Test approach: compute expected curve numerically using the model,
  // then use those precomputed golden values as baseline for regression testing.
  // This ensures tests validate the correct behavior of the model
  // without being sensitive to hand-calculated expectations.
};
```

**Component tests** for UI:
- Test form validation (correct frequency labels, valid times)
- Test chart renders with sample data
- Test localStorage persistence and retrieval
- Test frequency → times mapping (bid → 2 times, etc.)

**No E2E tests needed** for MVP (manual browser testing sufficient).

**Regression Test Strategy**:
- Store reference curves as JSON snapshots
- On calculation changes, regenerate and diff against baseline
- Ensures formula updates don't silently change outputs

## Important Notes

### Educational Disclaimer

**This app is for visualization and educational purposes only.**

⚠️ **Not for medical dosing decisions.** Outputs show approximate relative concentration curves based on simplified pharmacokinetic models. Actual drug levels vary by individual (weight, metabolism, food, drug interactions, etc.). Always follow prescriptions written by licensed healthcare providers.

### Time Handling

- **No timezone handling needed**: The app uses a simple begin time, medication times, and end time (all local/relative)
- **Day boundaries are conceptual**: If a dose is scheduled at 21:00 and you simulate until 08:00 next day, treat this as continuous time
- **Time step resolution**: Use 15-minute intervals for curve generation (fine enough for visual accuracy, efficient for calculation)

### Calculations Must Be Accurate

The PK calculations drive the app's educational value. Prioritize:
1. **Correctness**: Verify math against pharmacology references
2. **Edge cases**: Handle very short/long half-lives, near-equal ka/ke, zero doses
3. **Precision**: Use sufficient decimal places internally (display can be rounded)
4. **Test coverage**: High test coverage for calculation code with known-value reference cases

### Edge Case Handling

**Zero Dose**: If dose = 0, concentration should be 0 at all times.

**Extreme Half-Lives** (within validation range [0.1, 240]):
- Very short (near 0.1 hours / ~6 min): Drug appears and disappears almost instantly; consider log scale or extended timeframe for visibility
- Very long (near 240 hours / ~10 days): Steady-state takes months; show accumulation over weeks for useful visualization
- If validation limits change in future, extend edge-case handling accordingly

**Near-Equal ka ≈ ke** (uptake ≈ halfLife):
- When ka and ke are very close, the denominator `(ka - ke)` becomes unstable
- **Fallback method** (use if `|ka - ke| < 0.001`): Switch to the series expansion form:
  ```
  C(t) ≈ Dose × ka × t × e^(-ke×t)   [when ka ≈ ke]
  ```
  This is the limit of the standard formula as ka → ke.
- Add validation to warn user if `uptake` is too close to `halfLife` (uptake should be noticeably < halfLife)

**Active Metabolites**:
- For MVP, treat metaboliteLife as informational only (not drawn)
- Document future expansion: if metabolites become relevant, would need a two-compartment model

**Validation Philosophy**:
The validation approach is permissive-with-warnings. The only true edge case that needs special handling is `uptake ≈ halfLife` (ka ≈ ke), which triggers the fallback formula. All other atypical parameter combinations (e.g., `uptake > halfLife`, extreme half-lives) are allowed with warnings, not rejected, because users may have valid reasons for such inputs based on their source data.

### Numerical Strategy

**Time-Step Resolution**:
- Default: 15-minute intervals for curve generation (600 steps over 10 days = fine detail, efficient)
- Can adjust for shorter/longer timeframes

**Rounding & Display**:
- Internal calculations: use full floating-point precision
- Chart display: round to 2-3 significant figures
- Clamp negatives to zero (numerical artifact from rounding)

**Interpolation**:
- For chart rendering: use linear interpolation between calculated points
- Avoid spline interpolation for medical data (can create false peaks)

### Chart Axis Clarity

**X-Axis (Time)**:
- Label: "Time (hours)" or "Time (hours since first dose)"
- Scale: Linear (typical case)
- Consider log scale if timeframe spans weeks/months

**Y-Axis (Concentration)**:
- Label: "Relative Concentration (normalized to peak = 1.0)"
- Scale: Linear (0 to 1.0, since all curves are normalized to peak=1.0)
- Do not use absolute units (mg/L) — normalized relative curves only

**Multiple Prescriptions**:
- Each curve plotted separately with distinct colors
- Legend shows drug name and dosing frequency
- No automatic normalization across drugs (each drug peaks at 1.0)

### Browser Storage Limits

`localStorage` has ~5-10MB limit per domain. For typical prescription data (JSON), this is more than enough. If storage becomes an issue, consider IndexedDB.

### Chart Library Selection

**Recommendation: Chart.js** (proven for accurate scientific visualization)

- **Chart.js**: Lightweight (~30KB), excellent for precise line charts, well-tested for medical/scientific data, simple API
- **Recharts**: Heavier (~100KB), React-focused, better for interactive dashboards with animations

For this project's focus on **accuracy and simplicity**, Chart.js is the better choice. It has:
- Minimal dependencies
- Precise axis rendering for numerical accuracy
- Good browser support
- Mature library with pharmacology/medical data use cases

Only consider Recharts if you need heavy interactivity (zoom, pan, real-time updates) in a later phase.

## Debugging Tips

- Use Vue DevTools browser extension to inspect component state
- Log intermediate values in `pkCalculator.ts` to verify calculations
- Check localStorage in browser dev tools (Application tab)
- Use `npm run test:watch` to iterate quickly on failing tests
