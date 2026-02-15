# Implementation Plan: Task #14 - Add Metabolite Graphing Capability

## Executive Summary

This plan adds metabolite curve visualization to the Pharmacokinetics Grapher using a one-compartment metabolite formation model. Metabolite curves will be rendered as dashed lines alongside their parent drug curves, with optional display controlled by a UI toggle.

**Complexity**: Medium (new calculation formulas, multi-dataset rendering, optional UI features)

**Estimated Implementation Time**: 4-6 hours

---

## Design Decisions

### 1. Field Naming: Keep `metaboliteLife` (No Rename)
**Decision**: Retain `metaboliteLife` field name as-is
**Rationale**:
- Already validated and stored in user data
- Renaming requires migration logic for backward compatibility
- "Life" suffix is consistent with "halfLife" naming pattern
- Clear enough in context (documented in validation rules as "Metabolite half-life")

### 2. New Field: `metaboliteConversionFraction` (fm)
**Decision**: Add new optional field `metaboliteConversionFraction?: number` to Prescription interface
**Range**: 0.0 to 1.0 (fraction of parent drug converted to metabolite)
**Default**: undefined (metabolite curves not generated unless explicitly provided)
**Validation**:
- Min: 0.0 (no conversion)
- Max: 1.0 (100% conversion)
- Type: number
- Required: false (only needed if user wants metabolite visualization)

### 3. Metabolite Display Strategy: Opt-In with Toggle
**Decision**: Generate metabolite datasets by default when fm is provided, with UI toggle to show/hide
**Rationale**:
- Simpler than requiring explicit checkbox activation before generation
- Users who provide fm clearly want to see metabolites
- Toggle provides control without complexity
- Consistent with existing legend click-to-hide behavior

**UI Flow**:
1. User enters `metaboliteLife` and `metaboliteConversionFraction` in form
2. System generates both parent and metabolite datasets automatically
3. GraphViewer renders metabolite curves as dashed lines
4. Optional: Add "Show Metabolites" checkbox to globally toggle visibility (future enhancement)

### 4. Partial Data Handling
**Decision**: Require both `metaboliteLife` AND `metaboliteConversionFraction` to generate metabolite curves
**Behavior**:
- If only `metaboliteLife` provided → warning displayed, no metabolite curve (needs fm)
- If only `metaboliteConversionFraction` provided → warning displayed, no metabolite curve (needs half-life)
- If both provided → generate metabolite curve
- If neither provided → no warning, no metabolite curve (standard behavior)

**Validation Warning Messages**:
- "Metabolite half-life provided but conversion fraction missing. Both required for metabolite visualization."
- "Metabolite conversion fraction provided but half-life missing. Both required for metabolite visualization."

### 5. Visual Distinction: Color + Dash Pattern
**Decision**: Metabolite datasets use same color as parent drug with dashed border
**Rationale**:
- Visually links metabolite to parent drug (same color)
- Clearly distinguishes as separate entity (dashed line)
- Preserves 8-color palette for multiple drugs
- Accessible pattern distinction (not relying on color alone)

**Chart.js Implementation**:
```typescript
{
  label: `${rx.name} - Metabolite (${rx.frequency})`,
  borderColor: parentColor,        // Same as parent
  borderDash: [5, 5],               // Dashed pattern (5px dash, 5px gap)
  borderWidth: 2,
  // ... other properties
}
```

### 6. Backward Compatibility
**Decision**: Fully backward compatible - no migration required
**Rationale**:
- New field `metaboliteConversionFraction` is optional
- Existing prescriptions (with or without `metaboliteLife`) continue to work
- Metabolite curves only generated when BOTH new and existing fields are present
- No changes to existing data structures or storage format

---

## Pharmacokinetic Model: Metabolite Formation

### Mathematical Formula

**One-Compartment Sequential Metabolism Model**:

```
C_metabolite(t) = Dose × fm × ke_parent / (ke_metabolite - ke_parent) × (e^(-ke_parent × t) - e^(-ke_metabolite × t))
```

Where:
- `fm` = fraction of parent drug converted to metabolite (0-1)
- `ke_parent` = elimination rate constant of parent = 0.693 / halfLife_parent
- `ke_metabolite` = elimination rate constant of metabolite = 0.693 / metaboliteLife
- Dose = parent drug dose

**Edge Case**: When `ke_metabolite ≈ ke_parent` (within KA_KE_TOLERANCE = 0.001):

```
C_metabolite(t) = Dose × fm × ke_parent × t × e^(-ke_parent × t)
```

### Assumptions
- Metabolite formation rate = parent elimination rate (sequential metabolism)
- All eliminated parent drug converts to metabolite (scaled by fm)
- Metabolite has its own elimination rate (ke_metabolite)
- No direct absorption of metabolite (forms only from parent)

### Key Differences from Parent Drug Calculation
- **Parent drug**: Uses absorption (ka) vs elimination (ke)
- **Metabolite**: Uses parent elimination (ke_parent) as "formation rate" vs metabolite elimination (ke_metabolite)
- **Same mathematical structure**: C(t) = A × B / (C - D) × (e^(-D×t) - e^(-C×t))
- **Reuse edge case logic**: Same ka≈ke fallback applies when ke_metabolite≈ke_parent

---

## Implementation Sequence

### Phase 1: Add Conversion Fraction Field (Core Model)

**Files Modified**:
- `src/core/models/prescription.ts`

**Changes**:
1. Add `metaboliteConversionFraction?: number` to Prescription interface
2. Add validation rules for metaboliteConversionFraction (0-1 range)
3. Add cross-field validation for partial metabolite data
4. Add validation function `validateMetaboliteConversionFraction()`
5. Update `checkCrossFieldWarnings()` to warn about partial metabolite data

**Code Additions**:
```typescript
// In Prescription interface
export interface Prescription {
  // ... existing fields
  metaboliteLife?: number
  metaboliteConversionFraction?: number  // NEW: fraction converted to metabolite (0-1)
  // ... rest of fields
}

// In VALIDATION_RULES
export const VALIDATION_RULES = {
  // ... existing rules
  metaboliteConversionFraction: {
    required: false,
    min: 0.0,
    max: 1.0,
  },
} as const

// New validation function
function validateMetaboliteConversionFraction(
  fm: number | undefined,
): string[] {
  const errors: string[] = []
  if (fm === undefined || fm === null) return errors
  
  if (typeof fm !== 'number' || isNaN(fm)) {
    errors.push('Metabolite conversion fraction must be a number when provided')
    return errors
  }
  
  if (fm < 0.0) {
    errors.push('Metabolite conversion fraction must be at least 0.0')
  } else if (fm > 1.0) {
    errors.push('Metabolite conversion fraction must be at most 1.0')
  }
  
  return errors
}

// Add to checkCrossFieldWarnings()
function checkCrossFieldWarnings(rx: Prescription): string[] {
  const warnings: string[] = []
  // ... existing uptake/halfLife warnings
  
  // Partial metabolite data check
  const hasMetaboliteLife = rx.metaboliteLife !== undefined && !isNaN(rx.metaboliteLife)
  const hasFm = rx.metaboliteConversionFraction !== undefined && !isNaN(rx.metaboliteConversionFraction)
  
  if (hasMetaboliteLife && !hasFm) {
    warnings.push(
      'Metabolite half-life provided but conversion fraction missing. Both required for metabolite visualization.'
    )
  }
  
  if (hasFm && !hasMetaboliteLife) {
    warnings.push(
      'Metabolite conversion fraction provided but half-life missing. Both required for metabolite visualization.'
    )
  }
  
  return warnings
}
```

**Testing**:
- Add test cases to `src/core/models/__tests__/prescription.spec.ts`:
  - Valid fm values (0.0, 0.5, 1.0)
  - Invalid fm values (-0.1, 1.5, NaN, string)
  - Partial data warnings (metaboliteLife only, fm only)
  - Complete metabolite data (both fields valid, no warnings)

---

### Phase 2: Implement Metabolite Calculations (Pure Functions)

**Files Modified**:
- `src/core/calculations/pkCalculator.ts`

**Changes**:
1. Add `calculateMetaboliteConcentration()` function (mirrors calculateConcentration structure)
2. Reuse KA_KE_TOLERANCE for ke_metabolite ≈ ke_parent edge case

**Code Additions**:
```typescript
/**
 * Calculate metabolite concentration at a given time using one-compartment
 * sequential metabolism model.
 *
 * Metabolite forms from parent drug elimination at rate ke_parent, then
 * eliminates at its own rate ke_metabolite. The fraction fm represents
 * the proportion of eliminated parent drug that converts to metabolite.
 *
 * Standard formula: 
 *   C_met(t) = Dose × fm × ke_p/(ke_m - ke_p) × (e^(-ke_p×t) - e^(-ke_m×t))
 * 
 * Fallback (|ke_m - ke_p| < KA_KE_TOLERANCE): 
 *   C_met(t) = Dose × fm × ke_p × t × e^(-ke_p×t)
 *
 * @param time - Time in hours since parent dose administration
 * @param dose - Parent drug dose amount in arbitrary units
 * @param parentHalfLife - Parent drug elimination half-life in hours (> 0)
 * @param metaboliteHalfLife - Metabolite elimination half-life in hours (> 0)
 * @param fm - Fraction of parent drug converted to metabolite (0-1)
 * @returns Raw relative metabolite concentration (not normalized, can be > 1.0)
 */
export function calculateMetaboliteConcentration(
  time: number,
  dose: number,
  parentHalfLife: number,
  metaboliteHalfLife: number,
  fm: number,
): number {
  // Guard: zero or negative dose
  if (dose <= 0) return 0
  
  // Guard: zero or invalid fm
  if (fm <= 0 || fm > 1.0) return 0
  
  // Guard: negative or zero time (before dose administered)
  if (time <= 0) return 0
  
  const ke_parent = computeKe(parentHalfLife)
  const ke_metabolite = computeKe(metaboliteHalfLife)
  
  let concentration: number
  
  if (Math.abs(ke_metabolite - ke_parent) < KA_KE_TOLERANCE) {
    // Fallback formula: limit as ke_metabolite -> ke_parent
    concentration = dose * fm * ke_parent * time * Math.exp(-ke_parent * time)
  } else {
    // Standard one-compartment sequential metabolism
    concentration = 
      dose * 
      fm * 
      (ke_parent / (ke_metabolite - ke_parent)) * 
      (Math.exp(-ke_parent * time) - Math.exp(-ke_metabolite * time))
  }
  
  // Clamp numerical artifacts to zero
  return Math.max(0, concentration)
}
```

**Testing**:
- Add comprehensive test suite to `src/core/calculations/__tests__/pkCalculator.spec.ts`:
  - Zero time returns 0
  - Zero dose returns 0
  - Zero fm returns 0
  - Standard formula with known values (create reference fixture)
  - Edge case: ke_metabolite ≈ ke_parent (fallback formula)
  - Metabolite slower than parent (ke_metabolite < ke_parent): typical case
  - Metabolite faster than parent (ke_metabolite > ke_parent): edge case
  - Very long metaboliteLife (accumulation over time)
  - Very short metaboliteLife (rapid elimination)

**Test Fixtures** (add to `src/core/models/__tests__/fixtures.ts`):
```typescript
export const METABOLITE_STANDARD_FIXTURE = {
  name: 'Test Metabolite Drug',
  dose: 500,
  parentHalfLife: 6,
  metaboliteHalfLife: 12,  // Slower than parent (accumulates)
  fm: 0.8,
  uptake: 1.5,
  // Expected behaviors:
  // - Peak metabolite time later than parent peak
  // - Metabolite persists longer than parent
  // - Max metabolite conc = dose × fm × ratio_factor
}

export const METABOLITE_KE_APPROX_FIXTURE = {
  name: 'Test Metabolite (ke_m ≈ ke_p)',
  dose: 500,
  parentHalfLife: 6,
  metaboliteHalfLife: 6.01,  // Very close to parent (triggers fallback)
  fm: 0.5,
  uptake: 1.5,
}

export const METABOLITE_FASTER_FIXTURE = {
  name: 'Test Metabolite (faster elimination)',
  dose: 500,
  parentHalfLife: 12,
  metaboliteHalfLife: 3,  // Faster than parent (rapid clearance)
  fm: 0.6,
  uptake: 1.5,
}
```

---

### Phase 3: Multi-Dose Metabolite Accumulation

**Files Modified**:
- `src/core/calculations/multiDose.ts`

**Changes**:
1. Add `accumulateMetaboliteDoses()` function (parallel to accumulateDoses)
2. Update `getGraphData()` to optionally generate metabolite datasets
3. Metabolite datasets inherit parent color, use dashed border

**Code Additions**:
```typescript
/**
 * Calculate accumulated metabolite concentration over time from repeated parent doses
 *
 * Strategy (identical to accumulateDoses, but for metabolites):
 * 1. Expand prescription times across simulation window
 * 2. For each timepoint, sum raw metabolite contributions from all prior doses
 * 3. Normalize final curve so peak = 1.0
 *
 * @param prescription - Prescription with metaboliteLife and metaboliteConversionFraction
 * @param startHours - Simulation start time in hours from midnight
 * @param endHours - Simulation end time in hours from midnight
 * @param intervalMinutes - Time step resolution (default 15 min)
 * @returns Array of TimeSeriesPoint with normalized metabolite concentrations (peak = 1.0)
 */
export function accumulateMetaboliteDoses(
  prescription: Prescription,
  startHours: number,
  endHours: number,
  intervalMinutes: number = 15,
): TimeSeriesPoint[] {
  // Validation: require both metaboliteLife and metaboliteConversionFraction
  if (
    prescription.metaboliteLife === undefined ||
    prescription.metaboliteConversionFraction === undefined ||
    isNaN(prescription.metaboliteLife) ||
    isNaN(prescription.metaboliteConversionFraction)
  ) {
    return []
  }
  
  // Use prescription duration if available
  let effectiveEndHours = endHours
  if (prescription.duration !== undefined && prescription.durationUnit !== undefined) {
    const durationInHours =
      prescription.durationUnit === 'days'
        ? prescription.duration * 24
        : prescription.duration
    effectiveEndHours = startHours + durationInHours
  }
  
  // Expand prescription times across simulation window
  const numDays = Math.ceil(effectiveEndHours / 24) + 1
  const doseTimes = expandDoseTimes(prescription.times, numDays)
  
  // Generate timepoints for simulation
  const points: TimeSeriesPoint[] = []
  const steps = Math.ceil((effectiveEndHours - startHours) * 60 / intervalMinutes)
  let maxConc = 0
  
  // For each timepoint, sum metabolite contributions from all prior doses
  for (let i = 0; i <= steps; i++) {
    const time = startHours + i * intervalMinutes / 60
    let totalConc = 0
    
    // Sum raw (unnormalized) metabolite contributions from each dose
    for (const doseTime of doseTimes) {
      if (doseTime <= time) {
        const elapsed = time - doseTime
        totalConc += calculateMetaboliteConcentration(
          elapsed,
          prescription.dose,
          prescription.halfLife,
          prescription.metaboliteLife,
          prescription.metaboliteConversionFraction,
        )
      }
    }
    
    // Store point and track maximum
    points.push({ time, concentration: Math.max(0, totalConc) })
    maxConc = Math.max(maxConc, totalConc)
  }
  
  // Normalize to peak = 1.0
  if (maxConc > 0) {
    for (const p of points) {
      p.concentration /= maxConc
    }
  }
  
  return points
}

/**
 * Check if prescription has complete metabolite data for visualization
 * @param rx - Prescription to check
 * @returns true if both metaboliteLife and metaboliteConversionFraction are valid
 */
function hasCompleteMetaboliteData(rx: Prescription): boolean {
  return (
    rx.metaboliteLife !== undefined &&
    !isNaN(rx.metaboliteLife) &&
    rx.metaboliteConversionFraction !== undefined &&
    !isNaN(rx.metaboliteConversionFraction) &&
    rx.metaboliteConversionFraction > 0
  )
}

/**
 * Format multiple prescriptions into graph-ready datasets (UPDATED)
 *
 * Generates datasets for both parent drugs and metabolites (when data available).
 * Parent drugs use solid lines, metabolites use dashed lines with same color.
 *
 * @param prescriptions - Array of prescriptions to visualize
 * @param startHours - Simulation start time in hours
 * @param endHours - Simulation end time in hours
 * @returns Array of GraphDataset (parents + metabolites) ready for Chart.js rendering
 */
export function getGraphData(
  prescriptions: Prescription[],
  startHours: number,
  endHours: number,
): GraphDataset[] {
  // Calculate effective end time based on longest prescription duration
  let effectiveEndHours = endHours
  for (const rx of prescriptions) {
    if (rx.duration !== undefined && rx.durationUnit !== undefined) {
      const durationInHours =
        rx.durationUnit === 'days'
          ? rx.duration * 24
          : rx.duration
      const rxEndTime = startHours + durationInHours
      effectiveEndHours = Math.max(effectiveEndHours, rxEndTime)
    }
  }
  
  const datasets: GraphDataset[] = []
  
  for (const rx of prescriptions) {
    // Parent drug dataset (always generated)
    datasets.push({
      label: `${rx.name} ${rx.dose}mg (${rx.frequency})`,
      data: accumulateDoses(rx, startHours, effectiveEndHours),
      // color assigned by GraphViewer based on index
    })
    
    // Metabolite dataset (only if complete data available)
    if (hasCompleteMetaboliteData(rx)) {
      datasets.push({
        label: `${rx.name} - Metabolite (${rx.frequency})`,
        data: accumulateMetaboliteDoses(rx, startHours, effectiveEndHours),
        // color will be assigned same as parent (handled by GraphViewer)
        // borderDash will be set by GraphViewer to [5, 5]
      })
    }
  }
  
  return datasets
}
```

**Testing**:
- Add test suite to `src/core/calculations/__tests__/multiDose.spec.ts`:
  - `accumulateMetaboliteDoses()` returns empty array if metaboliteLife missing
  - `accumulateMetaboliteDoses()` returns empty array if fm missing
  - `accumulateMetaboliteDoses()` generates valid curve with complete data
  - Peak metabolite concentration normalized to 1.0
  - Multi-dose metabolite accumulation over 7 days
  - Metabolite slower than parent → accumulation pattern
  - Metabolite faster than parent → rapid clearance pattern
  - `hasCompleteMetaboliteData()` returns correct boolean
  - `getGraphData()` generates parent-only dataset when no metabolite data
  - `getGraphData()` generates parent+metabolite when complete data present
  - `getGraphData()` generates correct labels for metabolite datasets

---

### Phase 4: GraphViewer Visual Distinction (Dashed Lines)

**Files Modified**:
- `src/components/GraphViewer.vue`

**Changes**:
1. Detect metabolite datasets by label pattern (" - Metabolite")
2. Assign same color as preceding parent dataset
3. Add `borderDash: [5, 5]` for metabolite datasets

**Code Changes** (in `renderChart()` function, line ~95):
```typescript
// BEFORE:
const chartDatasets = props.datasets.map((ds, index) => ({
  label: ds.label,
  data: ds.data.map((point) => ({
    x: point.time,
    y: point.concentration,
  })),
  borderColor: ds.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  backgroundColor: 'transparent',
  tension: 0.1,
  pointRadius: 0,
  borderWidth: 2,
  fill: false,
}))

// AFTER:
const chartDatasets = props.datasets.map((ds, index) => {
  // Detect if this is a metabolite dataset (label contains " - Metabolite")
  const isMetabolite = ds.label.includes(' - Metabolite')
  
  // For metabolites, use the same color as the previous dataset (parent)
  // For parents, cycle through color palette as before
  let colorIndex = index
  if (isMetabolite && index > 0) {
    // Use previous dataset's color (which should be the parent)
    colorIndex = index - 1
  }
  
  return {
    label: ds.label,
    data: ds.data.map((point) => ({
      x: point.time,
      y: point.concentration,
    })),
    borderColor: ds.color || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length],
    backgroundColor: 'transparent',
    tension: 0.1,
    pointRadius: 0,
    borderWidth: 2,
    fill: false,
    // Add dashed line for metabolites
    ...(isMetabolite ? { borderDash: [5, 5] } : {}),
  }
})
```

**Alternative Robust Approach** (if label-based detection is fragile):

Add `isMetabolite?: boolean` flag to GraphDataset interface:

```typescript
// In prescription.ts
export interface GraphDataset {
  label: string
  data: TimeSeriesPoint[]
  color?: string
  isMetabolite?: boolean  // NEW: flag to identify metabolite datasets
}

// In multiDose.ts getGraphData()
datasets.push({
  label: `${rx.name} - Metabolite (${rx.frequency})`,
  data: accumulateMetaboliteDoses(rx, startHours, effectiveEndHours),
  isMetabolite: true,  // NEW: explicit flag
})

// In GraphViewer.vue
const isMetabolite = ds.isMetabolite === true
```

**Recommendation**: Use explicit `isMetabolite` flag for robustness (Option 2).

**Testing**:
- Add visual regression test (manual or screenshot comparison):
  - Render graph with 1 parent + 1 metabolite → verify dashed line
  - Render graph with 2 parents + 2 metabolites → verify color pairing
  - Legend shows both parent and metabolite entries
  - Click legend to hide parent → metabolite remains visible (independent toggle)
  - Click legend to hide metabolite → parent remains visible

---

### Phase 5: Add UI Input for Conversion Fraction

**Files Modified**:
- `src/components/PrescriptionForm.vue`

**Changes**:
1. Add `metaboliteConversionFraction` ref with optional number type
2. Add input field after metaboliteLife field
3. Include in prescription object construction (conditional spread pattern)
4. Display validation warnings from checkCrossFieldWarnings()

**Code Additions**:

```vue
<script setup lang="ts">
// ... existing imports and refs

const metaboliteLife = ref<number | undefined>(props.initial?.metaboliteLife)
const metaboliteConversionFraction = ref<number | undefined>(
  props.initial?.metaboliteConversionFraction
)

// ... rest of script

// In buildPrescription():
const prescription = computed<Prescription>(() => ({
  name: name.value.trim(),
  frequency: frequency.value,
  times: [...times.value],
  dose: dose.value,
  halfLife: halfLife.value,
  peak: peak.value,
  uptake: uptake.value,
  ...(metaboliteLife.value !== undefined && !isNaN(metaboliteLife.value)
    ? { metaboliteLife: metaboliteLife.value }
    : {}),
  ...(metaboliteConversionFraction.value !== undefined && 
      !isNaN(metaboliteConversionFraction.value)
    ? { metaboliteConversionFraction: metaboliteConversionFraction.value }
    : {}),
  ...(duration.value !== undefined && !isNaN(duration.value)
    ? { duration: duration.value, durationUnit: durationUnit.value }
    : {}),
}))
</script>

<template>
  <!-- ... existing form fields ... -->

  <!-- Metabolite half-life (optional) -->
  <div class="form-field">
    <label for="rx-metabolite">Metabolite Half-life (hours, optional)</label>
    <input
      id="rx-metabolite"
      v-model.number="metaboliteLife"
      type="number"
      min="0.1"
      max="1000"
      step="0.1"
      aria-describedby="hint-metabolite"
    />
    <small id="hint-metabolite" class="field-hint">
      Optional. Range: 0.1 - 1,000 hours
    </small>
  </div>

  <!-- NEW: Metabolite conversion fraction (optional) -->
  <div class="form-field">
    <label for="rx-metabolite-fm">
      Metabolite Conversion Fraction (optional)
    </label>
    <input
      id="rx-metabolite-fm"
      v-model.number="metaboliteConversionFraction"
      type="number"
      min="0.0"
      max="1.0"
      step="0.01"
      aria-describedby="hint-metabolite-fm"
    />
    <small id="hint-metabolite-fm" class="field-hint">
      Optional. Fraction of parent drug converted to metabolite (0.0 - 1.0). 
      Both half-life and fraction required for metabolite visualization.
    </small>
  </div>

  <!-- ... rest of form ... -->
</template>
```

**Testing**:
- Update `src/components/__tests__/PrescriptionForm.spec.ts`:
  - Input field renders correctly
  - v-model binds to metaboliteConversionFraction ref
  - Valid values (0.0, 0.5, 1.0) accepted
  - Invalid values (negative, > 1.0) rejected by HTML5 validation
  - Partial data (only fm, no metaboliteLife) shows warning
  - Complete data (both fields) builds prescription correctly
  - Conditional spread works (undefined values not included in prescription object)

---

### Phase 6: Integration Testing & Documentation

**Testing Strategy**:

1. **Unit Tests** (already covered in Phases 1-5):
   - Validation rules for metaboliteConversionFraction
   - calculateMetaboliteConcentration() with fixtures
   - accumulateMetaboliteDoses() edge cases
   - getGraphData() dataset generation logic

2. **Integration Tests**:
   - End-to-end flow: Form → Storage → Graph
   - Save prescription with metabolite data → reload → verify graph renders
   - Compare mode: 2 drugs with metabolites → 4 curves total (2 solid, 2 dashed)
   - Export graph with metabolites → verify PNG includes dashed lines

3. **Manual Testing Checklist**:
   - [ ] Enter drug with metaboliteLife only → see warning
   - [ ] Enter drug with fm only → see warning
   - [ ] Enter drug with both → see parent + metabolite curves
   - [ ] Metabolite curve is dashed and same color as parent
   - [ ] Legend shows both entries
   - [ ] Click legend to hide parent → metabolite stays visible
   - [ ] Click legend to hide metabolite → parent stays visible
   - [ ] Save → reload → metabolite data persists and renders
   - [ ] Compare 2 drugs with metabolites → 4 curves with correct pairing
   - [ ] Download PNG → dashed lines visible in image

4. **Edge Case Testing**:
   - [ ] Very slow metabolite (metaboliteLife = 100h) → accumulation
   - [ ] Very fast metabolite (metaboliteLife = 0.5h) → rapid clearance
   - [ ] ke_metabolite ≈ ke_parent → fallback formula, no NaN/Infinity
   - [ ] fm = 0 → no metabolite curve generated
   - [ ] fm = 1 → metabolite concentration high
   - [ ] Multi-dose bid over 7 days → metabolite steady-state

**Documentation Updates**:

1. **CLAUDE.md** - Update pharmacokinetic model section:
```markdown
### Metabolite Model (Optional)

For drugs with active metabolites, the app can visualize metabolite concentrations 
using a one-compartment sequential metabolism model:

**Metabolite Formation**:
```
C_metabolite(t) = Dose × fm × ke_parent / (ke_metabolite - ke_parent) × 
                  (e^(-ke_parent × t) - e^(-ke_metabolite × t))
```

Where:
- `fm` = fraction of parent drug converted to metabolite (0-1)
- `ke_parent` = parent elimination rate = 0.693 / halfLife
- `ke_metabolite` = metabolite elimination rate = 0.693 / metaboliteLife

**Assumptions**:
- Sequential metabolism (metabolite forms from parent elimination)
- First-order kinetics for both parent and metabolite
- No direct absorption of metabolite

**Visualization**:
- Metabolite curves rendered as dashed lines
- Same color as parent drug for visual association
- Independent legend control (can hide parent or metabolite separately)
```

2. **Add example fixture to documentation**:
```typescript
const exampleWithMetabolite: Prescription = {
  name: "Example Drug with Active Metabolite",
  frequency: "bid",
  times: ["09:00", "21:00"],
  dose: 500,
  halfLife: 6,          // Parent half-life
  metaboliteLife: 12,   // Metabolite half-life (slower, accumulates)
  metaboliteConversionFraction: 0.8,  // 80% conversion
  peak: 2,
  uptake: 1.5,
}
```

---

## Implementation Checklist

### Phase 1: Core Model ✓
- [ ] Add `metaboliteConversionFraction` field to Prescription interface
- [ ] Add validation rules (min: 0, max: 1)
- [ ] Add `validateMetaboliteConversionFraction()` function
- [ ] Add cross-field warnings for partial metabolite data
- [ ] Write unit tests for validation
- [ ] Run `npm run type-check` to verify types
- [ ] Run `npm run test` to verify validation tests pass

### Phase 2: Calculation Engine ✓
- [ ] Add `calculateMetaboliteConcentration()` to pkCalculator.ts
- [ ] Handle edge case: ke_metabolite ≈ ke_parent
- [ ] Create test fixtures (standard, ke_approx, faster_metabolite)
- [ ] Write comprehensive unit tests
- [ ] Run `npm run test -- pkCalculator.spec.ts` to verify

### Phase 3: Multi-Dose Accumulation ✓
- [ ] Add `accumulateMetaboliteDoses()` to multiDose.ts
- [ ] Add `hasCompleteMetaboliteData()` helper
- [ ] Update `getGraphData()` to generate metabolite datasets
- [ ] Write unit tests for metabolite accumulation
- [ ] Write integration tests for dataset generation
- [ ] Run `npm run test -- multiDose.spec.ts` to verify

### Phase 4: Visual Rendering ✓
- [ ] Add `isMetabolite` flag to GraphDataset interface
- [ ] Update GraphViewer to detect metabolite datasets
- [ ] Apply dashed border pattern `[5, 5]` to metabolites
- [ ] Assign same color as parent drug
- [ ] Test legend behavior (independent toggles)
- [ ] Run `npm run dev` and manually verify dashed lines

### Phase 5: UI Input ✓
- [ ] Add `metaboliteConversionFraction` ref to PrescriptionForm
- [ ] Add input field with 0-1 range, 0.01 step
- [ ] Update prescription object construction (conditional spread)
- [ ] Add hint text about requiring both fields
- [ ] Update component tests
- [ ] Run `npm run test -- PrescriptionForm.spec.ts` to verify

### Phase 6: Integration & Documentation ✓
- [ ] Manual testing checklist (all scenarios)
- [ ] Edge case testing (slow/fast metabolites, ke_approx)
- [ ] Update CLAUDE.md with metabolite model documentation
- [ ] Add example fixture to documentation
- [ ] Run full test suite: `npm run test`
- [ ] Run linting: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Visual verification in dev server

---

## Rollback Plan

If issues arise during implementation:

1. **Phase 1-2 Issues** (Model/Calculations):
   - Revert changes to prescription.ts and pkCalculator.ts
   - No UI impact (field not yet exposed)

2. **Phase 3 Issues** (Multi-dose):
   - Revert multiDose.ts changes
   - getGraphData() falls back to parent-only datasets

3. **Phase 4-5 Issues** (UI/Rendering):
   - Keep calculation code (useful for future)
   - Revert GraphViewer and PrescriptionForm changes
   - Metabolite data stored but not visualized (safe degradation)

---

## Future Enhancements (Out of Scope)

1. **Global Metabolite Toggle**: Add checkbox to App.vue to show/hide all metabolite curves at once
2. **Metabolite Color Customization**: Allow users to pick different color for metabolites vs parents
3. **Two-Compartment Model**: More accurate for drugs with complex distribution
4. **Active Metabolite Dosing**: Handle drugs where metabolite is the primary active form
5. **Metabolite-to-Parent Ratio**: Display ratio curve to show relative concentrations
6. **Peak Time Calculations**: Add getPeakTimeMetabolite() for informational display

---

## Risk Assessment

**Low Risk Areas**:
- Validation logic (well-tested pattern)
- Calculation formulas (reuses existing edge case handling)
- Optional fields (backward compatible)

**Medium Risk Areas**:
- Color assignment for metabolites (needs careful index mapping)
- Dataset ordering (parent must come before metabolite for color pairing)

**Mitigation**:
- Use explicit `isMetabolite` flag instead of label detection
- Test with multiple drugs to verify color cycling
- Add integration test for 3+ drugs with mixed metabolite data

**High Risk Areas**:
- None identified (straightforward feature extension)

---

## Success Criteria

Implementation is complete when:

1. ✓ All unit tests pass (`npm run test`)
2. ✓ Type checking passes (`npm run type-check`)
3. ✓ Linting passes (`npm run lint`)
4. ✓ Manual testing checklist completed
5. ✓ Documentation updated (CLAUDE.md)
6. ✓ Metabolite curves render as dashed lines with correct colors
7. ✓ Partial metabolite data shows appropriate warnings
8. ✓ Saved prescriptions with metabolite data persist and reload correctly
9. ✓ Graph export includes dashed metabolite curves

---

## Time Estimates

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Core Model | 45 minutes |
| Phase 2: Calculation Engine | 90 minutes |
| Phase 3: Multi-Dose Accumulation | 90 minutes |
| Phase 4: Visual Rendering | 45 minutes |
| Phase 5: UI Input | 30 minutes |
| Phase 6: Integration & Docs | 60 minutes |
| **Total** | **5.5 hours** |

Add 30-60 minutes buffer for debugging and edge cases → **6 hours total**

---

## Notes

- Formula structure identical to parent drug (ka/ke → ke_parent/ke_metabolite)
- Edge case handling reuses KA_KE_TOLERANCE constant (DRY principle)
- Optional field pattern consistent with existing duration/durationUnit
- Visual distinction (dashed lines) accessible and clear
- No breaking changes to existing functionality

