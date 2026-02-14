# Implementation Plan: Task 11 -- Add Legend to Graphs Showing Medication Names

Generated: 2026-02-14

## Goal

Enhance the graph legend in the Pharmacokinetics Grapher to clearly display medication names with dose and frequency information, ensure interactive click-to-toggle curve visibility works reliably, apply professional styling with color coordination, ensure responsive behavior on mobile devices, and add accessibility support (ARIA attributes, keyboard navigation). The legend is the primary way users identify which curve represents which medication, especially in multi-drug comparison mode.

## Research Summary

### Chart.js v4 Legend Plugin (Built-in)

The current codebase already uses Chart.js v4.5.1's built-in legend plugin at `options.plugins.legend`. Key capabilities (VERIFIED from [Chart.js Legend docs](https://www.chartjs.org/docs/latest/configuration/legend.html)):

- **`generateLabels` callback**: Receives the chart instance, returns an array of legend item objects with `text`, `fillStyle`, `datasetIndex`, etc. This is the primary customization point for label formatting.
- **`onClick` handler**: Default behavior toggles dataset visibility. When `generateLabels` is customized, the default `onClick` may break ([known issue #10792](https://github.com/chartjs/Chart.js/issues/10792)). Must define `onClick` explicitly when using custom `generateLabels`.
- **Click-to-toggle**: Chart.js v4 supports `chart.isDatasetVisible(index)`, `chart.hide(index)`, and `chart.show(index)` for programmatic dataset visibility control.
- **`usePointStyle: true`**: Already configured in the current code (line 120 of GraphViewer.vue). Shows a point marker instead of a colored rectangle.

### Accessibility: `chartjs-plugin-a11y-legend`

The [`chartjs-plugin-a11y-legend`](https://github.com/julianna-langston/chartjs-plugin-a11y-legend) plugin provides keyboard navigation for Chart.js legends:
- TAB to focus the legend area, arrow keys to navigate between items, ENTER/SPACE to toggle
- Adds ARIA attributes for screen readers (selection state, label text)
- Registers globally via `Chart.register(plugin)` or per-chart via `plugins: [plugin]`
- Currently in beta; supports bar, line, pie, doughnut, and radar charts
- Lightweight addition -- no other dependencies

**Decision**: Install `chartjs-plugin-a11y-legend` for keyboard/screen-reader accessibility rather than building custom a11y from scratch. This is the community-standard solution and follows the project's quality-focused philosophy.

### HTML Legend Alternative

Chart.js supports an [external HTML Legend](https://www.chartjs.org/docs/latest/samples/legend/html.html) plugin that renders legend items as DOM elements (not canvas-drawn). This approach gives full CSS control and native DOM accessibility. However, it adds significant complexity (custom plugin, DOM management, style synchronization) and is overkill for this task. The built-in canvas legend with the a11y plugin is sufficient.

**Decision**: Keep the built-in canvas legend. Use `chartjs-plugin-a11y-legend` for accessibility. Only consider HTML Legend if a future task requires complex legend interactions beyond toggle.

## Existing Codebase Analysis (VERIFIED)

### Files read and verified:

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/GraphViewer.vue`** (298 lines): The chart rendering component. Key findings:
  - Legend is configured at lines 116-121: `display: true`, `position: 'top'`, `labels: { usePointStyle: true, padding: 16 }`
  - No `generateLabels` callback -- uses default label generation from dataset `label` property
  - No explicit `onClick` handler -- relies on Chart.js default toggle behavior
  - `DEFAULT_COLORS` palette: 8 colors defined at lines 30-39 (blue, red, emerald, amber, violet, pink, cyan, lime)
  - Dataset label is passed through directly from `ds.label` at line 64
  - Chart.js `responsive: true` and `maintainAspectRatio: false` are set (lines 81-82)
  - Chart container is `height: 400px` (line 254)
  - Mobile responsive: no legend-specific mobile styles exist currently
  - Tooltip callback at line 134 already shows `ctx.dataset.label` -- this will need updating if label format changes

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/multiDose.ts`** (136 lines): The data generation layer. Key findings:
  - `getGraphData()` at line 117 generates labels as `${rx.name} (${rx.frequency})` (line 131)
  - Has its own 5-color palette at lines 122-128 (blue, red, emerald, amber, violet) -- **MISMATCH with GraphViewer's 8-color palette**
  - Colors are assigned via `colors[index % colors.length]` (line 133)
  - Returns `GraphDataset[]` with `label`, `data`, and `color` properties

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`** (lines 1-120): Type definitions. Key findings:
  - `GraphDataset` interface at lines 32-36: `{ label: string; data: TimeSeriesPoint[]; color?: string }`
  - `Prescription` interface at lines 13-23: includes `name`, `dose`, `frequency`, `halfLife`, etc.
  - `FrequencyLabel` type at lines 3-11: 'once' | 'bid' | 'tid' | 'qid' | 'q6h' | 'q8h' | 'q12h' | 'custom'

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/App.vue`** (389 lines): Main orchestration component. Key findings:
  - `graphDatasets` computed at line 34 calls `getGraphData(comparePrescriptions.value, ...)`
  - GraphViewer receives `:datasets="graphDatasets"` at line 198
  - Compare mode passes multiple prescriptions from PrescriptionList
  - Mobile breakpoint at 768px (line 367)

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/__tests__/GraphViewer.spec.ts`** (462 lines): Existing test file with 6 describe blocks. Key patterns:
  - Uses `vi.hoisted()` + `vi.mock()` for Chart.js and export module mocking
  - `MockChart` constructor captures all config via `vi.fn()` -- config accessible at `MockChart.mock.calls[N][1]`
  - Tests verify legend config at the Chart constructor config level (not via visual rendering)
  - No existing tests for legend interactivity or label format

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/__tests__/multiDose.spec.ts`** (127 lines): Tests for `accumulateDoses`. Does NOT test `getGraphData()` -- **no label format tests exist**.

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts`** (67 lines): 6 test fixtures with varying properties. All have `dose` values (500, 250, 0.001, 10000, 400) and `frequency` labels.

### Critical Finding: Color Palette Mismatch

**`multiDose.ts` has 5 colors** (lines 122-128):
```
#3B82F6 (blue), #EF4444 (red), #10B981 (emerald), #F59E0B (amber), #8B5CF6 (violet)
```

**`GraphViewer.vue` has 8 colors** (lines 30-39):
```
#3B82F6 (blue), #EF4444 (red), #10B981 (emerald), #F59E0B (amber),
#8B5CF6 (violet), #EC4899 (pink), #06B6D4 (cyan), #84CC16 (lime)
```

Both `multiDose.ts` and `GraphViewer.vue` assign colors, creating a **double-assignment** situation:
1. `getGraphData()` assigns a color from its 5-color palette to `GraphDataset.color`
2. `GraphViewer.vue` at line 69 uses `ds.color || DEFAULT_COLORS[index % ...]` -- since `getGraphData()` always sets `color`, the GraphViewer fallback palette is never used

This means the effective palette is the 5-color one from `multiDose.ts`, and the 8-color palette in GraphViewer is dead code for the current data flow. This needs to be resolved as part of this task.

### Critical Finding: Label-Tooltip Coupling

The tooltip callback at line 134 in GraphViewer.vue displays `ctx.dataset.label`. If the label format changes from `"Drug (frequency)"` to `"Drug 500mg bid"`, the tooltip text changes automatically. This is acceptable -- the tooltip should show the same identifying information as the legend.

## Technical Approach

### Label Format Enhancement

The current label format `"DrugName (frequency)"` (e.g., `"Ibuprofen (tid)"`) omits the dose, which is critical for distinguishing prescriptions of the same drug at different doses. The enhanced format will be:

```
"DrugName dose_mg (frequency)"
```

Examples:
- `"Ibuprofen 400mg (tid)"`
- `"Amoxicillin 500mg (bid)"`
- `"Metformin 850mg (bid)"`

This keeps labels concise while including all three identifying properties. The dose unit is always "mg" per CLAUDE.md specification (dose field described as "Amount per dose as written on prescription (mg, units, etc.)").

**Implementation location**: `getGraphData()` in `multiDose.ts` -- single point of change, affects all consumers (graph legend, tooltips, export filenames).

### Color Palette Unification

The dual-palette situation must be resolved. The approach:

1. **Remove the color palette from `multiDose.ts`** -- the calculation layer should not own presentation concerns
2. **Keep the 8-color palette in `GraphViewer.vue`** -- the presentation component owns styling
3. **`getGraphData()` stops setting `color`** on `GraphDataset` -- lets GraphViewer's fallback logic assign colors
4. This naturally uses the 8-color palette and properly separates concerns

### Click-to-Toggle

Chart.js v4 provides click-to-toggle by default. However, when we add `generateLabels` for custom formatting, the default `onClick` may break per [issue #10792](https://github.com/chartjs/Chart.js/issues/10792). We must explicitly define both `generateLabels` and `onClick` together.

The `onClick` handler pattern:
```typescript
onClick: (e, legendItem, legend) => {
  const index = legendItem.datasetIndex
  const ci = legend.chart
  if (ci.isDatasetVisible(index)) {
    ci.hide(index)
    legendItem.hidden = true
  } else {
    ci.show(index)
    legendItem.hidden = false
  }
}
```

### Accessibility Strategy

1. **Install `chartjs-plugin-a11y-legend`** for keyboard navigation (TAB, arrow keys, ENTER/SPACE)
2. **Add `role="img"` and `aria-label` to the canvas element** for screen reader identification
3. **Add a visually-hidden text summary** of plotted medications for screen readers who cannot interact with the canvas

### Responsive Legend

For mobile (< 768px):
- Position legend at `'bottom'` instead of `'top'` to maximize chart width
- Reduce legend font size
- Use Chart.js's built-in legend wrapping for long labels

This will be implemented by checking a reactive `isMobile` ref and adjusting the legend config dynamically.

## Implementation Phases

### Phase 1: Unify Color Palette and Enhance Label Format

**Priority**: 1 (Foundation -- all other phases depend on correct labels and colors)

**Files to modify:**
- `src/core/calculations/multiDose.ts` -- Update `getGraphData()` label format, remove color palette
- `src/core/calculations/__tests__/multiDose.spec.ts` -- Add tests for `getGraphData()` label generation

**Step 1.1: Update `getGraphData()` in `multiDose.ts`**

Change the function at lines 117-135 to:

```typescript
export function getGraphData(
  prescriptions: Prescription[],
  startHours: number,
  endHours: number,
): GraphDataset[] {
  return prescriptions.map((rx) => ({
    label: `${rx.name} ${rx.dose}mg (${rx.frequency})`,
    data: accumulateDoses(rx, startHours, endHours),
  }))
}
```

Key changes:
- Label format updated from `${rx.name} (${rx.frequency})` to `${rx.name} ${rx.dose}mg (${rx.frequency})`
- Color palette removed -- `GraphDataset.color` property is no longer set
- GraphViewer's `DEFAULT_COLORS` fallback at line 69 (`ds.color || DEFAULT_COLORS[...]`) will now activate, using the full 8-color palette

**Step 1.2: Add `getGraphData()` tests in `multiDose.spec.ts`**

Add a new describe block after the existing tests:

```typescript
import { getGraphData } from '../multiDose'

describe('getGraphData - Graph Dataset Generation', () => {
  it('generates label with name, dose, and frequency', () => {
    const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
    expect(result).toHaveLength(1)
    expect(result[0]!.label).toBe('Test Drug A 500mg (once)')
  })

  it('generates labels for multiple prescriptions', () => {
    const result = getGraphData(
      [SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE],
      0, 24,
    )
    expect(result).toHaveLength(2)
    expect(result[0]!.label).toBe('Test Drug A 500mg (once)')
    expect(result[1]!.label).toBe('Test Drug B 500mg (bid)')
  })

  it('includes dose value in label for differentiation', () => {
    const lowDose = { ...IBUPROFEN_FIXTURE, dose: 200 }
    const highDose = { ...IBUPROFEN_FIXTURE, dose: 800 }
    const result = getGraphData([lowDose, highDose], 0, 24)
    expect(result[0]!.label).toBe('Ibuprofen 200mg (tid)')
    expect(result[1]!.label).toBe('Ibuprofen 800mg (tid)')
  })

  it('does not assign color property (defers to GraphViewer)', () => {
    const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
    expect(result[0]!.color).toBeUndefined()
  })

  it('handles decimal dose values', () => {
    const rx = { ...SINGLE_DOSE_FIXTURE, dose: 0.5 }
    const result = getGraphData([rx], 0, 24)
    expect(result[0]!.label).toBe('Test Drug A 0.5mg (once)')
  })

  it('returns empty array for no prescriptions', () => {
    const result = getGraphData([], 0, 24)
    expect(result).toEqual([])
  })

  it('generates concentration data via accumulateDoses', () => {
    const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
    expect(result[0]!.data.length).toBeGreaterThan(0)
    expect(result[0]!.data[0]).toHaveProperty('time')
    expect(result[0]!.data[0]).toHaveProperty('concentration')
  })
})
```

**Step 1.3: Update existing GraphViewer tests that reference label format**

In `GraphViewer.spec.ts`, the test at line 225-226 checks `label: 'Drug A'` and `label: 'Drug B'`. These tests pass labels directly as props (not through `getGraphData`), so they do NOT need to change. The label format change is in the data layer, not the presentation layer.

**Acceptance criteria:**
- [ ] `getGraphData()` produces labels in format `"Name Dosemg (frequency)"`
- [ ] `getGraphData()` does not set `color` property on returned datasets
- [ ] All new `getGraphData` tests pass
- [ ] All existing `accumulateDoses` tests continue to pass
- [ ] TypeScript compiles without errors

---

### Phase 2: Add Explicit Legend onClick and generateLabels to GraphViewer

**Priority**: 1 (Ensures click-to-toggle reliability when we customize labels)

**Files to modify:**
- `src/components/GraphViewer.vue` -- Add explicit legend config with `onClick` and `generateLabels`

**Step 2.1: Add explicit `onClick` handler to legend config**

Update the legend configuration in `renderChart()` (lines 116-121) to:

```typescript
plugins: {
  legend: {
    display: true,
    position: 'top',
    labels: {
      usePointStyle: true,
      padding: 16,
      font: {
        size: 13,
      },
      // Ensure label text is readable by adding a text color
      color: '#374151',
    },
    onClick: (_e: unknown, legendItem: { datasetIndex?: number }, legend: { chart: Chart }) => {
      const index = legendItem.datasetIndex
      if (index === undefined) return
      const ci = legend.chart
      if (ci.isDatasetVisible(index)) {
        ci.hide(index)
      } else {
        ci.show(index)
      }
    },
  },
  // ... tooltip config unchanged
},
```

**Rationale**: By explicitly defining `onClick`, we ensure toggle behavior works even if `generateLabels` is added in the future. The `ci.hide(index)` / `ci.show(index)` pattern is the Chart.js v4 recommended approach. Unlike the default handler, this is explicit and immune to the `generateLabels` interaction bug.

**Step 2.2: Optional -- Add `generateLabels` for strikethrough on hidden datasets**

This optional enhancement visually indicates which datasets are toggled off:

```typescript
labels: {
  usePointStyle: true,
  padding: 16,
  font: { size: 13 },
  color: '#374151',
  generateLabels: (chart: Chart) => {
    const datasets = chart.data.datasets
    return datasets.map((ds, i) => ({
      text: ds.label || '',
      fillStyle: ds.borderColor as string,
      strokeStyle: ds.borderColor as string,
      lineWidth: 2,
      hidden: !chart.isDatasetVisible(i),
      datasetIndex: i,
      fontColor: chart.isDatasetVisible(i) ? '#374151' : '#9CA3AF',
    }))
  },
},
```

When a dataset is hidden (toggled off), its legend item text becomes gray (`#9CA3AF`), providing clear visual feedback.

**Acceptance criteria:**
- [ ] Click-to-toggle works: clicking a legend item hides/shows the corresponding dataset curve
- [ ] Clicking a hidden legend item restores the curve
- [ ] Legend items show correct colors matching their dataset curves
- [ ] Hidden datasets show dimmed legend text (if `generateLabels` is implemented)
- [ ] No visual regression -- legend still renders at top with point styles

---

### Phase 3: Install and Configure `chartjs-plugin-a11y-legend`

**Priority**: 2 (Accessibility -- important but not blocking core functionality)

**Files to modify:**
- `package.json` -- Add dependency
- `src/components/GraphViewer.vue` -- Import and register plugin

**Step 3.1: Install the plugin**

```bash
npm install chartjs-plugin-a11y-legend
```

**Step 3.2: Register the plugin in `GraphViewer.vue`**

At the top of the `<script setup>` block, after the Chart.js import:

```typescript
import { Chart, registerables } from 'chart.js'
import a11yLegend from 'chartjs-plugin-a11y-legend'

Chart.register(...registerables, a11yLegend)
```

If the plugin does not have TypeScript types, add a declaration:

```typescript
// In src/chartjs-plugin-a11y-legend.d.ts (new file if needed)
declare module 'chartjs-plugin-a11y-legend' {
  import type { Plugin } from 'chart.js'
  const plugin: Plugin
  export default plugin
}
```

**Step 3.3: Verify keyboard navigation works**

After registration, the plugin automatically adds:
- TAB focuses the legend area
- Left/Right arrow keys navigate between legend items
- ENTER/SPACE toggles the focused legend item
- ARIA attributes for screen readers

No additional configuration needed beyond registration.

**Step 3.4: Update GraphViewer tests**

The a11y plugin should be mocked in tests to avoid DOM side effects:

```typescript
vi.mock('chartjs-plugin-a11y-legend', () => ({
  default: { id: 'a11y-legend' },
}))
```

**Fallback plan**: If `chartjs-plugin-a11y-legend` has compatibility issues with Chart.js v4.5.1, skip this phase and add manual ARIA attributes to the canvas element instead:

```html
<canvas
  ref="canvasRef"
  role="img"
  :aria-label="legendAriaLabel"
></canvas>
```

Where `legendAriaLabel` is a computed string like `"Pharmacokinetic graph showing concentration curves for Ibuprofen 400mg tid, Amoxicillin 500mg bid"`.

**Acceptance criteria:**
- [ ] Plugin installed and registered without build errors
- [ ] TAB key focuses the legend area
- [ ] Arrow keys navigate between legend items
- [ ] ENTER/SPACE toggles dataset visibility
- [ ] Screen reader announces legend item labels and toggle state
- [ ] Existing tests pass with plugin mocked

---

### Phase 4: Responsive Legend and Styling

**Priority**: 2 (UX polish)

**Files to modify:**
- `src/components/GraphViewer.vue` -- Add responsive legend positioning and styling

**Step 4.1: Add reactive mobile detection**

In the `<script setup>` block:

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function handleResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const isMobile = computed(() => windowWidth.value < 768)
```

**Step 4.2: Update legend config to be responsive**

In `renderChart()`, use the reactive `isMobile` value:

```typescript
legend: {
  display: true,
  position: isMobile.value ? 'bottom' : 'top',
  labels: {
    usePointStyle: true,
    padding: isMobile.value ? 10 : 16,
    font: {
      size: isMobile.value ? 11 : 13,
    },
    color: '#374151',
    // ... generateLabels if using custom labels
  },
  // ... onClick handler
},
```

**Step 4.3: Add chart re-render on resize**

The existing `watch` at line 154 watches datasets and time props. Add `isMobile` to the watch list so the chart re-renders with the correct legend position on resize:

```typescript
watch(
  [() => props.datasets, () => props.startHours, () => props.endHours, isMobile],
  () => {
    renderChart()
  },
  { deep: true },
)
```

Note: This destroys and recreates the chart on mobile/desktop transitions. This is acceptable because:
- Chart.js `responsive: true` already handles canvas resizing
- Legend position change requires chart re-creation (Chart.js limitation)
- The transition only fires at the 768px breakpoint, not on every resize

**Step 4.4: Add mobile-friendly chart container height**

In the `<style scoped>` section, add:

```css
@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
```

**Acceptance criteria:**
- [ ] Legend moves to bottom position on screens < 768px
- [ ] Legend font size reduces on mobile
- [ ] Legend padding adjusts on mobile
- [ ] Chart re-renders correctly on window resize across breakpoint
- [ ] No performance issues from resize handler (renders only on breakpoint change, not every pixel)

---

### Phase 5: Canvas Accessibility and Screen Reader Support

**Priority**: 2 (Accessibility complement to Phase 3)

**Files to modify:**
- `src/components/GraphViewer.vue` -- Add ARIA attributes to canvas and a screen-reader summary

**Step 5.1: Add ARIA attributes to the canvas element**

Update the template:

```html
<canvas
  ref="canvasRef"
  role="img"
  :aria-label="chartAriaLabel"
></canvas>
```

Add a computed property:

```typescript
const chartAriaLabel = computed(() => {
  if (props.datasets.length === 0) {
    return 'Pharmacokinetic graph - no data loaded'
  }
  const drugList = props.datasets.map((ds) => ds.label).join(', ')
  return `Pharmacokinetic concentration graph showing: ${drugList}. Time range: ${props.startHours} to ${props.endHours} hours. Y-axis: relative concentration 0 to 1.`
})
```

**Step 5.2: Add visually-hidden text summary**

Below the chart container, add a screen-reader-only description:

```html
<div class="sr-only" aria-live="polite">
  <p v-if="datasets.length > 0">
    Graph displaying relative drug concentration over time for:
    <span v-for="(ds, i) in datasets" :key="i">
      {{ ds.label }}{{ i < datasets.length - 1 ? ', ' : '' }}
    </span>.
    Click legend items to toggle individual curves.
  </p>
</div>
```

Add the `.sr-only` utility class (if not already global):

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

Note: App.vue already uses `.sr-only` at line 145 but it is scoped. Check if a global `.sr-only` class exists in `base.css`. If not, add it to GraphViewer's scoped styles.

**Acceptance criteria:**
- [ ] Canvas element has `role="img"` and descriptive `aria-label`
- [ ] `aria-label` dynamically lists all displayed medications
- [ ] Screen-reader-only text summary is present and updates with data changes
- [ ] `.sr-only` class properly hides content visually while keeping it accessible

---

### Phase 6: Comprehensive Test Coverage

**Priority**: 1 (Tests validate all behavior)

**Files to modify:**
- `src/components/__tests__/GraphViewer.spec.ts` -- Add legend-specific test sections
- `src/core/calculations/__tests__/multiDose.spec.ts` -- Add `getGraphData` tests (from Phase 1)

**Step 6.1: Add legend configuration tests to GraphViewer.spec.ts**

Add a new describe block:

```typescript
describe('legend configuration', () => {
  const singleDataset = [
    { label: 'Ibuprofen 400mg (tid)', data: [{ time: 0, concentration: 0 }] },
  ]

  const multiDataset = [
    { label: 'Ibuprofen 400mg (tid)', data: [{ time: 0, concentration: 0 }] },
    { label: 'Amoxicillin 500mg (bid)', data: [{ time: 0, concentration: 0 }] },
  ]

  it('enables legend display', () => {
    mount(GraphViewer, { props: { datasets: singleDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    expect(config?.options?.plugins?.legend?.display).toBe(true)
  })

  it('positions legend at top by default', () => {
    mount(GraphViewer, { props: { datasets: singleDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    expect(config?.options?.plugins?.legend?.position).toBe('top')
  })

  it('configures usePointStyle for legend labels', () => {
    mount(GraphViewer, { props: { datasets: singleDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    expect(config?.options?.plugins?.legend?.labels?.usePointStyle).toBe(true)
  })

  it('defines explicit onClick handler for legend', () => {
    mount(GraphViewer, { props: { datasets: singleDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    expect(typeof config?.options?.plugins?.legend?.onClick).toBe('function')
  })

  it('passes all dataset labels to Chart.js', () => {
    mount(GraphViewer, { props: { datasets: multiDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    expect(config?.data?.datasets?.[0]?.label).toBe('Ibuprofen 400mg (tid)')
    expect(config?.data?.datasets?.[1]?.label).toBe('Amoxicillin 500mg (bid)')
  })

  it('assigns distinct colors from 8-color palette to datasets without explicit color', () => {
    mount(GraphViewer, { props: { datasets: multiDataset } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    const color0 = config?.data?.datasets?.[0]?.borderColor
    const color1 = config?.data?.datasets?.[1]?.borderColor
    expect(color0).toBe('#3B82F6') // blue
    expect(color1).toBe('#EF4444') // red
    expect(color0).not.toBe(color1) // distinct
  })
})
```

**Step 6.2: Add canvas accessibility tests**

```typescript
describe('canvas accessibility', () => {
  it('canvas has role="img"', () => {
    const datasets = [
      { label: 'Test', data: [{ time: 0, concentration: 0 }] },
    ]
    const wrapper = mount(GraphViewer, { props: { datasets } })
    const canvas = wrapper.find('canvas')
    expect(canvas.attributes('role')).toBe('img')
  })

  it('canvas has descriptive aria-label with dataset names', () => {
    const datasets = [
      { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
      { label: 'Drug B', data: [{ time: 0, concentration: 0 }] },
    ]
    const wrapper = mount(GraphViewer, { props: { datasets } })
    const ariaLabel = wrapper.find('canvas').attributes('aria-label')
    expect(ariaLabel).toContain('Drug A')
    expect(ariaLabel).toContain('Drug B')
  })

  it('canvas aria-label indicates no data when datasets empty', () => {
    const wrapper = mount(GraphViewer, { props: { datasets: [] } })
    const ariaLabel = wrapper.find('canvas').attributes('aria-label')
    expect(ariaLabel).toContain('no data')
  })

  it('renders screen-reader summary text', () => {
    const datasets = [
      { label: 'Test Drug', data: [{ time: 0, concentration: 0 }] },
    ]
    const wrapper = mount(GraphViewer, { props: { datasets } })
    const srOnly = wrapper.find('.sr-only')
    expect(srOnly.exists()).toBe(true)
    expect(srOnly.text()).toContain('Test Drug')
  })
})
```

**Step 6.3: Add legend onClick behavior test**

```typescript
describe('legend onClick handler', () => {
  it('onClick handler calls chart.hide for visible dataset', () => {
    const datasets = [
      { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
    ]
    mount(GraphViewer, { props: { datasets } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    const onClick = config?.options?.plugins?.legend?.onClick

    // Create mock chart and legend item
    const mockHide = vi.fn()
    const mockShow = vi.fn()
    const mockChart = {
      isDatasetVisible: vi.fn().mockReturnValue(true),
      hide: mockHide,
      show: mockShow,
    }
    const legendItem = { datasetIndex: 0 }
    const legend = { chart: mockChart }

    onClick(null, legendItem, legend)

    expect(mockChart.isDatasetVisible).toHaveBeenCalledWith(0)
    expect(mockHide).toHaveBeenCalledWith(0)
    expect(mockShow).not.toHaveBeenCalled()
  })

  it('onClick handler calls chart.show for hidden dataset', () => {
    const datasets = [
      { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
    ]
    mount(GraphViewer, { props: { datasets } })
    const config = (MockChart as any).mock.calls[0]?.[1]
    const onClick = config?.options?.plugins?.legend?.onClick

    const mockHide = vi.fn()
    const mockShow = vi.fn()
    const mockChart = {
      isDatasetVisible: vi.fn().mockReturnValue(false),
      hide: mockHide,
      show: mockShow,
    }
    const legendItem = { datasetIndex: 0 }
    const legend = { chart: mockChart }

    onClick(null, legendItem, legend)

    expect(mockShow).toHaveBeenCalledWith(0)
    expect(mockHide).not.toHaveBeenCalled()
  })
})
```

**Acceptance criteria:**
- [ ] All new legend configuration tests pass
- [ ] All new canvas accessibility tests pass
- [ ] All new onClick handler tests pass
- [ ] All existing GraphViewer tests continue to pass
- [ ] All existing multiDose tests continue to pass
- [ ] `npm run test` passes with zero failures

---

## File Summary

### Files to CREATE:

| File | Purpose | Phase |
|------|---------|-------|
| `src/chartjs-plugin-a11y-legend.d.ts` | TypeScript declaration for a11y plugin (if needed) | 3 |

### Files to MODIFY:

| File | Changes | Phase |
|------|---------|-------|
| `src/core/calculations/multiDose.ts` | Update label format in `getGraphData()`, remove color palette | 1 |
| `src/core/calculations/__tests__/multiDose.spec.ts` | Add `getGraphData()` test section (7 tests) | 1 |
| `src/components/GraphViewer.vue` | Add explicit `onClick`, `generateLabels`, responsive legend, canvas ARIA, sr-only summary | 2, 4, 5 |
| `src/components/__tests__/GraphViewer.spec.ts` | Add legend config tests, accessibility tests, onClick tests (~15 new tests) | 6 |
| `package.json` | Add `chartjs-plugin-a11y-legend` dependency | 3 |

### Files NOT modified (verified no change needed):

| File | Reason |
|------|--------|
| `src/core/models/prescription.ts` | `GraphDataset` interface already supports the changes (label is `string`, color is `optional`) |
| `src/App.vue` | Consumes `getGraphData()` output transparently -- label format change flows through automatically |
| `src/components/PrescriptionList.vue` | Displays prescription details independently of graph labels |

## Implementation Order (Dependency Chain)

```
Phase 1: Label format + color palette fix in multiDose.ts + tests
    |
    v
Phase 2: Explicit onClick + generateLabels in GraphViewer (depends on Phase 1 for correct labels)
    |
    +---> Phase 3: Install chartjs-plugin-a11y-legend (independent of Phase 2 internals)
    |
    +---> Phase 4: Responsive legend config (depends on Phase 2 for legend config structure)
    |
    v
Phase 5: Canvas ARIA + sr-only summary (depends on Phase 2 template changes)
    |
    v
Phase 6: Comprehensive tests (depends on all previous phases)
```

Phases 3, 4, and 5 can be developed in parallel after Phase 2 is complete.

## Testing Strategy

### Unit Tests (Phase 1)
- **`multiDose.spec.ts`**: 7 new tests for `getGraphData()` label generation
  - Label format with name, dose, frequency
  - Multiple prescriptions
  - Dose differentiation for same drug
  - No color assignment
  - Decimal doses
  - Empty input
  - Data structure validation

### Component Tests (Phase 6)
- **`GraphViewer.spec.ts`**: ~15 new tests across 3 describe blocks
  - Legend configuration: display, position, usePointStyle, onClick handler presence, label passthrough, color assignment
  - Canvas accessibility: role, aria-label with dataset names, aria-label for empty state, sr-only text
  - Legend onClick: hide visible dataset, show hidden dataset

### Integration Testing (Manual Checklist)

| Test | Steps | Expected |
|------|-------|----------|
| Single drug legend | Create prescription, view graph | Legend shows "DrugName Dosemg (frequency)" with colored point |
| Multi-drug legend | Compare 2+ prescriptions | Each drug has distinct color and label in legend |
| Click-to-toggle | Click a legend item | Corresponding curve disappears; click again to restore |
| Hidden indicator | Toggle a dataset off | Legend item text dims or shows strikethrough effect |
| Keyboard navigation | TAB to legend, arrow keys, ENTER | Navigate and toggle via keyboard (requires Phase 3) |
| Screen reader | Navigate with VoiceOver/NVDA | Legend items announced with label and toggle state |
| Mobile layout | Resize to < 768px | Legend moves to bottom, smaller font |
| Color consistency | Compare 3+ drugs | Legend color matches curve color for each dataset |
| Export with legend | Download as PNG | Downloaded image includes the legend |

### What Does NOT Need Testing
- Chart.js legend rendering internals (third-party)
- CSS visual appearance (manual verification)
- `chartjs-plugin-a11y-legend` internal behavior (tested by the plugin)

## Critical Decision Points

### Decision 1: Label Format

**Options:**
1. `"DrugName (frequency)"` -- current
2. `"DrugName Dosemg (frequency)"` -- recommended
3. `"DrugName Dosemg frequency"` -- no parentheses
4. `"DrugName - Dose mg - frequency"` -- verbose

**Recommendation:** Option 2. Adds dose (critical for differentiation) while keeping the existing parenthesized frequency convention. Compact enough to not overflow on mobile.

### Decision 2: Color Palette Ownership

**Options:**
1. Keep both palettes (multiDose.ts + GraphViewer.vue) with synchronization
2. Move all colors to multiDose.ts (data layer owns colors)
3. Remove colors from multiDose.ts, keep in GraphViewer.vue (presentation layer owns colors)

**Recommendation:** Option 3. Color is a presentation concern. The data layer (`multiDose.ts`) should produce data, not styling. GraphViewer already has a larger, better palette.

### Decision 3: Accessibility Approach

**Options:**
1. `chartjs-plugin-a11y-legend` (community plugin, keyboard + ARIA)
2. Custom HTML legend with full DOM control
3. Canvas ARIA attributes only (minimal)

**Recommendation:** Option 1, supplemented by canvas ARIA attributes (Option 3). The plugin handles the complex keyboard navigation. Canvas ARIA provides basic screen reader context. HTML legend is overkill.

### Decision 4: Responsive Legend Position

**Options:**
1. Always `'top'` (current)
2. Always `'bottom'`
3. Dynamic: `'top'` on desktop, `'bottom'` on mobile

**Recommendation:** Option 3. On mobile, horizontal space is precious. Moving the legend below the chart maximizes the chart's usable width. On desktop, top position is conventional and there is ample width.

## Risks and Mitigations

### Risk 1: `chartjs-plugin-a11y-legend` Compatibility with Chart.js 4.5.1

**Impact:** Medium -- accessibility phase blocked
**Likelihood:** Low-Medium -- plugin is in beta

**Mitigation:** Phase 3 is isolated. If the plugin fails:
1. Skip plugin installation
2. Use canvas ARIA attributes (Phase 5) as primary a11y mechanism
3. Add manual `tabindex` and keyboard event listeners to the canvas as a future enhancement

### Risk 2: `generateLabels` Breaks Default Toggle Behavior

**Impact:** Medium -- click-to-toggle stops working
**Likelihood:** Medium -- [documented issue #10792](https://github.com/chartjs/Chart.js/issues/10792)

**Mitigation:** Phase 2 explicitly defines `onClick` handler alongside `generateLabels`. Both are set together in the legend config. Tests verify the onClick handler calls `chart.hide()`/`chart.show()` correctly.

### Risk 3: Label Truncation on Mobile

**Impact:** Low -- labels may wrap or be cut off
**Likelihood:** Low-Medium -- depends on drug name length

**Mitigation:** Phase 4 reduces font size on mobile. Chart.js legend automatically wraps labels. Very long names (e.g., "Methylprednisolone 1000mg (q12h)") will wrap to two lines, which is acceptable. If truncation becomes an issue, `generateLabels` can be extended to abbreviate names on mobile.

### Risk 4: Performance from Resize Handler

**Impact:** Low -- unnecessary re-renders
**Likelihood:** Low -- resize events only trigger re-render at the 768px breakpoint

**Mitigation:** The `isMobile` computed property only changes when `windowWidth` crosses 768px. Chart re-render is triggered by the `watch` on `isMobile`, not on every pixel of resize. Adding a debounce to `handleResize` is a further optimization if needed.

### Risk 5: Tooltip Label Mismatch After Format Change

**Impact:** Low -- tooltip shows updated label format
**Likelihood:** Certain -- tooltip uses `ctx.dataset.label`

**Mitigation:** This is actually desired behavior. The tooltip at line 134 (`${ctx.dataset.label}: ${yValue.toFixed(3)}`) will now show `"Ibuprofen 400mg (tid): 0.823"` instead of `"Ibuprofen (tid): 0.823"`. The additional dose information in tooltips is beneficial.

## Estimated Complexity

| Phase | Effort | Lines of Code | Risk |
|-------|--------|---------------|------|
| Phase 1: Label format + colors | Small | ~10 (modify) + ~50 (tests) | Low |
| Phase 2: onClick + generateLabels | Small | ~30 (modify) | Medium |
| Phase 3: a11y-legend plugin | Small | ~10 (modify) + npm install | Low-Medium |
| Phase 4: Responsive legend | Medium | ~30 (script) + ~10 (style) | Low |
| Phase 5: Canvas ARIA + sr-only | Small | ~20 (template) + ~15 (script) | Low |
| Phase 6: Tests | Medium | ~120 (new tests) | Low |
| **Total** | **Medium** | **~300 lines** | **Low-Medium** |

Overall task complexity: **Low-Medium**. The core changes (Phases 1-2) are straightforward. The accessibility work (Phases 3, 5) introduces a new dependency but is well-scoped. The responsive work (Phase 4) is standard. All phases are independently testable.

**Estimated implementation time:** 2-3 hours for all 6 phases. Phases 1-2 alone (MVP) can be completed in under 1 hour.

## Recommended Commit Strategy

| Commit | Phases | Description |
|--------|--------|-------------|
| 1 | Phase 1 | Update legend label format with dose, unify color palette |
| 2 | Phase 2 | Add explicit legend onClick and generateLabels |
| 3 | Phase 3 | Install and register chartjs-plugin-a11y-legend |
| 4 | Phases 4-5 | Add responsive legend positioning and canvas accessibility |
| 5 | Phase 6 | Add comprehensive legend and accessibility tests |
