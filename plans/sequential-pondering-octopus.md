# Implementation Plan: Task #14 - Add Metabolite Graphing Capability

## Context

**Problem**: The Pharmacokinetics Grapher currently displays only parent drug concentration curves. Users need to visualize active metabolite concentrations alongside parent drugs to understand complete pharmacokinetic behavior.

**Current State**:
- `metaboliteLife` field exists in Prescription interface (optional, validated, UI input implemented)
- Field is "informational only" - not used in any calculations
- No metabolite curves rendered on graphs

**Goal**: Implement metabolite curve visualization using one-compartment sequential metabolism model, displaying metabolites as dashed lines alongside parent drug solid lines.

**Why Now**: Users have been entering metabolite half-life data but seeing no visual representation. This feature completes the pharmacokinetic visualization by showing the full drug → metabolite transformation.

---

## Design Approach

### Pharmacokinetic Model

**One-compartment sequential metabolism**:
```
C_metabolite(t) = Dose × fm × ke_parent / (ke_metabolite - ke_parent) ×
                  (e^(-ke_parent×t) - e^(-ke_metabolite×t))
```

**Edge case** (when ke_metabolite ≈ ke_parent):
```
C_metabolite(t) = Dose × fm × ke_parent × t × e^(-ke_parent×t)
```

Where:
- `fm` = `metaboliteConversionFraction` (new field, 0-1 range)
- `ke_parent` = 0.693 / halfLife
- `ke_metabolite` = 0.693 / metaboliteLife

**Key insight**: Same mathematical structure as parent drug (ka/ke → ke_parent/ke_metabolite), allowing code reuse and consistent edge case handling.

### Key Decisions

1. **No field rename**: Keep `metaboliteLife` as-is (backward compatible)
2. **New required field**: `metaboliteConversionFraction?: number` (0-1 range)
3. **Opt-in via data**: Metabolite curves generated when BOTH fields present
4. **Visual distinction**: Dashed lines `[5, 5]` with same color as parent
5. **Partial data handling**: Show validation warning, don't generate curve
6. **Backward compatible**: New optional field doesn't break existing prescriptions

### Implementation Strategy

**6 Phases** (estimated 5.5-6 hours total):

1. **Core Model** (45min): Add `metaboliteConversionFraction` field + validation
2. **Calculations** (90min): Implement `calculateMetaboliteConcentration()` in pkCalculator.ts
3. **Accumulation** (90min): Implement `accumulateMetaboliteDoses()` in multiDose.ts
4. **Visual Rendering** (45min): Add dashed line styling in GraphViewer.vue
5. **UI Input** (30min): Add input field in PrescriptionForm.vue
6. **Integration** (60min): Testing + documentation updates

---

## Critical Files to Modify

### Phase 1: Core Model

**File**: `src/core/models/prescription.ts`

Add to Prescription interface:
```typescript
export interface Prescription {
  // ... existing fields
  metaboliteLife?: number
  metaboliteConversionFraction?: number  // NEW: fraction converted (0-1)
  // ... rest
}
```

Add validation rules:
```typescript
metaboliteConversionFraction: {
  required: false,
  min: 0.0,
  max: 1.0,
}
```

Add validation function:
```typescript
function validateMetaboliteConversionFraction(fm: number | undefined): string[] {
  // Validate type, range 0-1
}
```

Add cross-field warning in `checkCrossFieldWarnings()`:
```typescript
// Warn if only one metabolite field provided
if (hasMetaboliteLife && !hasFm) {
  warnings.push('Metabolite half-life provided but conversion fraction missing...')
}
```

**Tests**: Add to `src/core/models/__tests__/prescription.spec.ts`
- Valid values (0.0, 0.5, 1.0)
- Invalid values (-0.1, 1.5)
- Partial data warnings

### Phase 2: Calculation Engine

**File**: `src/core/calculations/pkCalculator.ts`

Add function (follows existing pattern):
```typescript
export function calculateMetaboliteConcentration(
  time: number,
  dose: number,
  parentHalfLife: number,
  metaboliteHalfLife: number,
  fm: number,
): number {
  // Guards: dose <= 0, fm <= 0, time <= 0
  if (dose <= 0 || fm <= 0 || time <= 0) return 0

  const ke_parent = computeKe(parentHalfLife)
  const ke_metabolite = computeKe(metaboliteHalfLife)

  if (Math.abs(ke_metabolite - ke_parent) < KA_KE_TOLERANCE) {
    // Fallback formula
    return dose * fm * ke_parent * time * Math.exp(-ke_parent * time)
  } else {
    // Standard formula
    return dose * fm * (ke_parent / (ke_metabolite - ke_parent)) *
           (Math.exp(-ke_parent * time) - Math.exp(-ke_metabolite * time))
  }
}
```

**Reuse existing patterns**:
- `computeKe()` helper
- `KA_KE_TOLERANCE` constant
- Edge case handling structure

**Tests**: Add to `src/core/calculations/__tests__/pkCalculator.spec.ts`
- Known-value reference cases
- Edge case: ke_metabolite ≈ ke_parent
- Zero guards (dose, fm, time)
- Fast vs slow metabolites

**Test Fixtures**: Add to `src/core/models/__tests__/fixtures.ts`
```typescript
export const METABOLITE_STANDARD_FIXTURE = {
  name: 'Test Metabolite Drug',
  dose: 500,
  halfLife: 6,
  metaboliteLife: 12,  // Slower (accumulates)
  metaboliteConversionFraction: 0.8,
  uptake: 1.5,
  // ... rest
}
```

### Phase 3: Multi-Dose Accumulation

**File**: `src/core/calculations/multiDose.ts`

Add function (mirrors `accumulateDoses` structure):
```typescript
export function accumulateMetaboliteDoses(
  prescription: Prescription,
  startHours: number,
  endHours: number,
  intervalMinutes: number = 15,
): TimeSeriesPoint[] {
  // Validation: require both fields
  if (!prescription.metaboliteLife || !prescription.metaboliteConversionFraction) {
    return []
  }

  // Expand dose times
  const doseTimes = expandDoseTimes(prescription.times, numDays)

  // Sum metabolite contributions from all prior doses
  for (const doseTime of doseTimes) {
    if (doseTime <= time) {
      totalConc += calculateMetaboliteConcentration(...)
    }
  }

  // Normalize to peak = 1.0
  if (maxConc > 0) {
    for (const p of points) {
      p.concentration /= maxConc
    }
  }

  return points
}
```

Update `getGraphData()`:
```typescript
export function getGraphData(...): GraphDataset[] {
  const datasets: GraphDataset[] = []

  for (const rx of prescriptions) {
    // Parent drug (always)
    datasets.push({
      label: `${rx.name} ${rx.dose}mg (${rx.frequency})`,
      data: accumulateDoses(rx, startHours, endHours),
      isMetabolite: false,  // NEW flag
    })

    // Metabolite (if data complete)
    if (rx.metaboliteLife && rx.metaboliteConversionFraction) {
      datasets.push({
        label: `${rx.name} - Metabolite (${rx.frequency})`,
        data: accumulateMetaboliteDoses(rx, startHours, endHours),
        isMetabolite: true,  // NEW flag
      })
    }
  }

  return datasets
}
```

**Tests**: Add to `src/core/calculations/__tests__/multiDose.spec.ts`
- Returns empty array if fields missing
- Generates valid normalized curve with complete data
- Multi-dose accumulation over 7 days
- Dataset generation includes metabolites

### Phase 4: Visual Rendering

**File**: `src/core/models/prescription.ts`

Update GraphDataset interface:
```typescript
export interface GraphDataset {
  label: string
  data: TimeSeriesPoint[]
  color?: string
  isMetabolite?: boolean  // NEW: flag for dashed lines
}
```

**File**: `src/components/GraphViewer.vue`

Update `renderChart()` function (around line 95):
```typescript
const chartDatasets = props.datasets.map((ds, index) => {
  const isMetabolite = ds.isMetabolite === true

  // For metabolites, use same color as previous dataset (parent)
  let colorIndex = index
  if (isMetabolite && index > 0) {
    colorIndex = index - 1  // Parent's color
  }

  return {
    label: ds.label,
    data: ds.data.map(point => ({ x: point.time, y: point.concentration })),
    borderColor: ds.color || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length],
    backgroundColor: 'transparent',
    tension: 0.1,
    pointRadius: 0,
    borderWidth: 2,
    fill: false,
    ...(isMetabolite ? { borderDash: [5, 5] } : {}),  // NEW: dashed for metabolites
  }
})
```

**Tests**: Manual verification (npm run dev)
- Metabolite renders as dashed line
- Same color as parent
- Legend shows both entries
- Independent toggle (click legend)

### Phase 5: UI Input

**File**: `src/components/PrescriptionForm.vue`

Add ref (around line 30):
```typescript
const metaboliteConversionFraction = ref<number | undefined>(
  props.initial?.metaboliteConversionFraction
)
```

Update prescription object (around line 69, use conditional spread pattern):
```typescript
const prescription = computed<Prescription>(() => ({
  // ... existing fields
  ...(metaboliteLife.value !== undefined && !isNaN(metaboliteLife.value)
    ? { metaboliteLife: metaboliteLife.value }
    : {}),
  ...(metaboliteConversionFraction.value !== undefined &&
      !isNaN(metaboliteConversionFraction.value)
    ? { metaboliteConversionFraction: metaboliteConversionFraction.value }
    : {}),
  // ... rest
}))
```

Add input field in template (after metaboliteLife input, around line 210):
```vue
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
```

**Tests**: Update `src/components/__tests__/PrescriptionForm.spec.ts`
- Input field renders
- Valid values accepted
- Conditional spread works

### Phase 6: Integration & Documentation

**Testing Checklist**:
- [ ] Unit tests pass (`npm run test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing: metaboliteLife only → warning shown
- [ ] Manual testing: fm only → warning shown
- [ ] Manual testing: both fields → dashed metabolite curve renders
- [ ] Manual testing: save → reload → data persists
- [ ] Manual testing: compare 2 drugs with metabolites → 4 curves total
- [ ] Manual testing: PNG export includes dashed lines

**Documentation**: Update `CLAUDE.md`

Add to "Pharmacokinetic Model & Equations" section:
```markdown
### Metabolite Model (Optional)

For drugs with active metabolites, use one-compartment sequential metabolism:

**Formula**:
C_metabolite(t) = Dose × fm × ke_parent / (ke_metabolite - ke_parent) ×
                  (e^(-ke_parent×t) - e^(-ke_metabolite×t))

**Parameters**:
- `metaboliteConversionFraction` (fm): Fraction of parent converted (0-1)
- `metaboliteLife`: Metabolite half-life in hours

**Visualization**:
- Metabolite curves: dashed lines, same color as parent
- Independent legend control
- Both fields required for visualization
```

---

## Existing Functions to Reuse

- `computeKe()` from pkCalculator.ts:28 - Calculate elimination rate constant
- `KA_KE_TOLERANCE` from prescription.ts:115 - Edge case tolerance (0.001)
- `expandDoseTimes()` from multiDose.ts:32 - Expand daily doses across days
- Conditional spread pattern from PrescriptionForm.vue:69-71 - Optional fields
- Color cycling logic from GraphViewer.vue:38-47, 101 - Multi-dataset colors

---

## Verification

### Automated Tests
```bash
npm run test          # All unit tests pass
npm run type-check    # TypeScript compilation clean
npm run lint          # No linting errors
npm run build         # Production build succeeds
```

### Manual Verification
```bash
npm run dev
```

1. **Partial Data Warning**:
   - Enter drug name, dose, halfLife, uptake, times, peak
   - Enter metaboliteLife = 12, leave fm empty → see warning

2. **Complete Metabolite Visualization**:
   - Enter all fields above + metaboliteConversionFraction = 0.8
   - Submit form → graph shows 2 curves (solid parent + dashed metabolite)
   - Verify metabolite uses same color as parent
   - Verify metabolite line is dashed

3. **Legend Interaction**:
   - Click parent drug in legend → parent hides, metabolite stays
   - Click metabolite in legend → metabolite hides, parent stays

4. **Multi-Drug Comparison**:
   - Create 2 drugs with metabolite data
   - Compare → 4 curves total (2 solid, 2 dashed)
   - Verify color pairing correct

5. **Persistence**:
   - Save prescription with metabolite data
   - Reload page → verify metabolite curve still renders

6. **Export**:
   - Download PNG → verify dashed lines visible in image

### Edge Cases to Test

- Very slow metabolite (metaboliteLife = 100h) → accumulation pattern
- Very fast metabolite (metaboliteLife = 0.5h) → rapid clearance
- ke_metabolite ≈ ke_parent → fallback formula (no NaN/Infinity)
- fm = 0 → no curve generated
- fm = 1 → high metabolite concentration
- BID over 7 days → steady-state accumulation

---

## Implementation Notes

- Mathematical structure identical to parent drug (ka/ke → ke_parent/ke_metabolite)
- Edge case handling reuses existing tolerance constant (DRY)
- Optional field pattern consistent with duration/durationUnit
- Visual distinction (dashed lines) accessible and clear
- Fully backward compatible (no breaking changes)
- Estimated time: 5.5-6 hours with testing

---

## Risk Mitigation

**Low Risk**:
- Validation (proven pattern)
- Calculations (reuses existing edge case logic)
- Optional fields (backward compatible)

**Medium Risk**:
- Color assignment for metabolites (needs correct parent-child pairing)
- Use explicit `isMetabolite` flag (not label detection) for robustness

**Mitigation**:
- Test with 3+ drugs to verify color cycling
- Integration test for mixed metabolite data
