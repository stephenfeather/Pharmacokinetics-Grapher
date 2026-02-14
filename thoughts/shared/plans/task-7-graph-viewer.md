# Implementation Plan: Task 7 -- Implement Graph Visualization Component (GraphViewer.vue)

Generated: 2026-02-14

## Goal

Create `src/components/GraphViewer.vue`, a Vue 3 component that renders pharmacokinetic concentration curves using Chart.js. The component accepts `GraphDataset[]` data and time range props, renders a responsive line chart with properly labeled axes (X: Time in hours, Y: Relative Concentration 0-1), supports multi-drug overlay with distinct colors and legend, and includes an educational disclaimer. The component must manage the Chart.js instance lifecycle to prevent memory leaks and react to prop changes by re-rendering the chart.

## Existing Codebase Analysis (VERIFIED)

### Files read and verified:

- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/prescription.ts`** (lines 1-42): Contains type definitions used by this component:
  - `TimeSeriesPoint { time: number; concentration: number }` (line 25-30)
  - `GraphDataset { label: string; data: TimeSeriesPoint[]; color?: string }` (line 32-36)
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/index.ts`**: Barrel re-exports `GraphDataset` and `TimeSeriesPoint` types.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/calculations/multiDose.ts`**: `accumulateDoses()` returns `TimeSeriesPoint[]` with normalized concentrations (peak = 1.0). This is the data that will be wrapped in `GraphDataset` objects and passed to GraphViewer.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/package.json`** (line 19): `chart.js: "^4.5.1"` is installed as a dependency. No `@types/chart.js` needed -- Chart.js 4.x bundles its own TypeScript definitions.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/App.vue`**: Currently default Vue 3 scaffold. Task 8 will rewrite this to consume GraphViewer with props `:datasets="graphDatasets" :start-hours="startHours" :end-hours="endHours"`.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/vitest.config.ts`**: Uses jsdom environment. Chart.js relies on `<canvas>` which jsdom does not fully support -- tests will need to mock Chart.js.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/HelloWorld.vue`**: Existing component uses `<script setup lang="ts">` with `defineProps<{}>()` pattern -- follow this convention.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/__tests__/HelloWorld.spec.ts`**: Test pattern: `import { describe, it, expect } from 'vitest'`, `import { mount } from '@vue/test-utils'`, test component rendering with props.
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/core/models/__tests__/fixtures.ts`**: Six test fixtures available for generating test data (e.g., `SINGLE_DOSE_FIXTURE`, `BID_MULTI_DOSE_FIXTURE`).
- **`/Users/stephenfeather/Development/Pharmacokinetics-Grapher/tsconfig.app.json`**: strict: true, noImplicitAny: true, strictNullChecks: true. Path alias `@/*` -> `./src/*`.

### Downstream Consumer (Task 8):

Task 8's plan (verified at `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/thoughts/shared/plans/task8-integrate-form-calc-graph.md`) imports GraphViewer and passes:
```html
<GraphViewer
  :datasets="graphDatasets"
  :start-hours="startHours"
  :end-hours="endHours"
/>
```
Where `graphDatasets` is a `computed<GraphDataset[]>` that calls `getGraphData()`. The Task 8 plan expects:
- Props: `datasets: GraphDataset[]`, `startHours?: number`, `endHours?: number`
- The component handles its own Chart.js lifecycle
- The disclaimer is rendered inside GraphViewer (not in App.vue -- App.vue has its own separate disclaimer banner)

### Key Dependency Notes:

- `getGraphData()` does not exist yet in the codebase (confirmed: grep returned no matches). It is planned for Task 4's multi-dose module. However, GraphViewer does not call `getGraphData()` -- it receives pre-computed `GraphDataset[]` via props. GraphViewer is a pure presentation component.
- Chart.js 4.x uses tree-shakeable module registration. Calling `Chart.register(...registerables)` registers all standard components (LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Title, Filler). This is the simplest approach and appropriate for a single-chart application.

## Chart.js 4.x API Notes

Chart.js 4.x (the installed version `^4.5.1`) has these relevant characteristics:

- **Module registration**: Must call `Chart.register()` before creating chart instances. Using `registerables` registers everything.
- **TypeScript support**: Built-in types. `Chart` constructor accepts `Chart<'line'>` generic for type safety.
- **Canvas requirement**: Requires a `<canvas>` element. The constructor takes the canvas element directly.
- **Destroy pattern**: Call `chartInstance.destroy()` before creating a new instance on the same canvas, or before component unmount.
- **Data format for line charts**: Each dataset needs `data` as an array of `{x, y}` objects when using a linear x-axis (not categorical).
- **Linear scale**: Set `scales.x.type: 'linear'` for numerical x-axis. This requires the data format `{x: number, y: number}`.
- **Responsive sizing**: `responsive: true` + `maintainAspectRatio: false` makes the chart fill its container. The container must have a defined height.

## Implementation Phases

### Phase 1: Set Up Chart.js Canvas with Vue Ref and Module Registration (Subtask 7.1)

**Files to create:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/GraphViewer.vue`

**Steps:**

1. **Create the component file** with Vue 3 `<script setup lang="ts">` structure.

2. **Import Chart.js and register modules:**
   ```typescript
   import {
     Chart,
     registerables,
   } from 'chart.js'
   import type { ChartConfiguration } from 'chart.js'

   Chart.register(...registerables)
   ```
   The `Chart.register(...registerables)` call is at module scope (outside `<script setup>` is not possible in SFC, so it runs once when the module is first imported). This is idempotent -- calling it multiple times is safe.

3. **Import the GraphDataset type:**
   ```typescript
   import type { GraphDataset } from '@/core/models/prescription'
   ```
   Import directly from the source file rather than the barrel to avoid potential circular dependency issues. The barrel re-export also works.

4. **Define props with TypeScript using `defineProps<>()`:**
   ```typescript
   const props = defineProps<{
     datasets: GraphDataset[]
     startHours?: number
     endHours?: number
   }>()
   ```
   - `datasets` is required -- the component always expects an array (may be empty).
   - `startHours` defaults to 0 (handled in renderChart logic, not with `withDefaults`).
   - `endHours` defaults to 48 (handled in renderChart logic).

   Use `withDefaults` for clean default handling:
   ```typescript
   const props = withDefaults(defineProps<{
     datasets: GraphDataset[]
     startHours?: number
     endHours?: number
   }>(), {
     startHours: 0,
     endHours: 48,
   })
   ```

5. **Create the canvas ref and chart instance variable:**
   ```typescript
   import { ref, onMounted, onUnmounted, watch } from 'vue'

   const canvasRef = ref<HTMLCanvasElement | null>(null)
   let chartInstance: Chart | null = null
   ```
   - `canvasRef` is a template ref bound to the `<canvas>` element.
   - `chartInstance` is a plain `let` variable (not reactive) because Chart.js instances should not be made reactive -- Vue's reactivity proxy would interfere with Chart.js's internal state management. This is intentional.

6. **Write the template skeleton:**
   ```html
   <template>
     <div class="graph-viewer">
       <div class="disclaimer">
         Educational purposes only. Not for medical decisions.
       </div>
       <div class="chart-container">
         <canvas ref="canvasRef"></canvas>
       </div>
     </div>
   </template>
   ```
   - The outer `div.graph-viewer` provides a semantic wrapper.
   - The `div.disclaimer` displays the mandatory educational warning.
   - The `div.chart-container` provides a fixed-height container for Chart.js responsive sizing.
   - The `<canvas ref="canvasRef">` binds to the `canvasRef` template ref.

7. **Write the initial scoped CSS:**
   ```css
   <style scoped>
   .graph-viewer {
     width: 100%;
   }

   .chart-container {
     position: relative;
     height: 400px;
     width: 100%;
   }

   .disclaimer {
     background: #FEF3C7;
     border: 1px solid #F59E0B;
     border-radius: 4px;
     padding: 8px 12px;
     margin-bottom: 12px;
     font-size: 0.85rem;
     color: #92400E;
     text-align: center;
   }
   </style>
   ```
   The `chart-container` uses `position: relative` and a fixed `height: 400px` because Chart.js with `responsive: true` and `maintainAspectRatio: false` needs a positioned parent with a defined height to size correctly.

**Acceptance criteria:**
- [ ] Component file exists at `src/components/GraphViewer.vue`
- [ ] Chart.js modules registered without errors at import time
- [ ] `canvasRef` binds to the canvas element after mount
- [ ] Props are typed: `datasets: GraphDataset[]`, `startHours?: number` (default 0), `endHours?: number` (default 48)
- [ ] Disclaimer text is visible in the rendered template
- [ ] Chart container has 400px height and relative positioning
- [ ] TypeScript strict mode passes (`npm run type-check`)

---

### Phase 2: Implement renderChart Function with Chart.js Line Configuration (Subtask 7.2)

**Files to modify:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/GraphViewer.vue` -- add `renderChart()` function inside `<script setup>`

**Depends on:** Phase 1 (needs canvasRef, props, chartInstance variable)

**Steps:**

1. **Define a color palette for multi-drug overlay:**
   ```typescript
   const DEFAULT_COLORS = [
     '#3B82F6', // blue
     '#EF4444', // red
     '#10B981', // emerald
     '#F59E0B', // amber
     '#8B5CF6', // violet
     '#EC4899', // pink
     '#06B6D4', // cyan
     '#84CC16', // lime
   ]
   ```
   When `GraphDataset.color` is not provided, assign colors from this palette by index (wrapping with modulo). This ensures distinct colors when overlaying multiple drugs.

2. **Implement the `renderChart()` function:**
   ```typescript
   function renderChart(): void {
     // Guard: canvas must be mounted
     if (!canvasRef.value) return

     // Destroy existing chart instance before creating a new one
     if (chartInstance) {
       chartInstance.destroy()
       chartInstance = null
     }

     // Guard: no data to render -- leave canvas blank
     if (props.datasets.length === 0) return

     // Transform GraphDataset[] to Chart.js dataset format
     const chartDatasets = props.datasets.map((ds, index) => ({
       label: ds.label,
       data: ds.data.map(point => ({
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

     // Create Chart.js instance
     chartInstance = new Chart(canvasRef.value, {
       type: 'line',
       data: {
         datasets: chartDatasets,
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         animation: {
           duration: 300,
         },
         scales: {
           x: {
             type: 'linear',
             title: {
               display: true,
               text: 'Time (hours)',
               font: { size: 14 },
             },
             min: props.startHours,
             max: props.endHours,
             ticks: {
               stepSize: calculateTickStep(props.startHours, props.endHours),
             },
           },
           y: {
             type: 'linear',
             title: {
               display: true,
               text: 'Relative Concentration (0\u20131)',
               font: { size: 14 },
             },
             min: 0,
             max: 1,
             ticks: {
               stepSize: 0.1,
               callback: (value: string | number) => {
                 const num = typeof value === 'string' ? parseFloat(value) : value
                 return num.toFixed(1)
               },
             },
           },
         },
         plugins: {
           legend: {
             display: true,
             position: 'top',
             labels: {
               usePointStyle: true,
               padding: 16,
             },
           },
           tooltip: {
             mode: 'index',
             intersect: false,
             callbacks: {
               title: (items) => {
                 if (items.length > 0 && items[0]) {
                   return `Time: ${items[0].parsed.x.toFixed(1)}h`
                 }
                 return ''
               },
               label: (ctx) => {
                 return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`
               },
             },
           },
         },
         interaction: {
           mode: 'nearest',
           axis: 'x',
           intersect: false,
         },
       },
     })
   }
   ```

3. **Implement the tick step helper:**
   ```typescript
   function calculateTickStep(startHours: number, endHours: number): number {
     const range = endHours - startHours
     if (range <= 24) return 2      // Every 2 hours for short ranges
     if (range <= 72) return 6      // Every 6 hours for medium ranges
     if (range <= 168) return 12    // Every 12 hours for weekly view
     return 24                      // Every 24 hours for long ranges
   }
   ```
   This provides readable tick spacing that adapts to the timeframe. For a 48-hour default, ticks appear every 6 hours (0, 6, 12, 18, 24, 30, 36, 42, 48).

**Detailed design decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `tension: 0.1` | Slight curve smoothing | Minimal interpolation -- CLAUDE.md says "avoid spline interpolation for medical data (can create false peaks)". A tension of 0.1 provides barely perceptible smoothing without creating artificial peaks. Setting to 0 (linear) is also acceptable. |
| `pointRadius: 0` | No data point markers | At 15-minute intervals, 48 hours = 192 points per dataset. Showing markers would clutter the chart. |
| `animation.duration: 300` | Short animation | Quick transitions when props change. Not so long that slider dragging feels laggy. |
| `interaction.mode: 'nearest'` | Cross-hair on nearest x | Shows tooltip for all datasets at the hovered x position, useful for comparing drugs. |
| Y-axis `max: 1` | Fixed at 1.0 | Concentrations are normalized to peak=1.0 by `accumulateDoses()`. Y-axis should always show the full 0-1 range. |
| `fill: false` | No area fill | Clean line chart. Area fill can obscure overlapping curves in multi-drug view. |
| Tooltip `y.toFixed(3)` | 3 decimal places | Normalized concentrations (0-1) benefit from higher precision than absolute values. |

**Acceptance criteria:**
- [ ] `renderChart()` creates a Chart.js line chart on the canvas
- [ ] X-axis labeled "Time (hours)" with linear scale from `startHours` to `endHours`
- [ ] Y-axis labeled "Relative Concentration (0-1)" with fixed range 0 to 1
- [ ] Single dataset renders one line with correct color
- [ ] Multiple datasets render multiple lines with distinct colors from palette
- [ ] Legend displays dataset labels at the top of the chart
- [ ] Tooltip shows time and concentration values on hover
- [ ] Empty datasets array results in no chart (canvas left blank, no error thrown)
- [ ] Existing chart instance is destroyed before creating a new one

---

### Phase 3: Handle Chart Lifecycle with Instance Cleanup and Prop Reactivity (Subtask 7.3)

**Files to modify:**
- `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/GraphViewer.vue` -- add lifecycle hooks and watchers inside `<script setup>`

**Depends on:** Phase 2 (needs `renderChart()` function)

**Steps:**

1. **Mount hook -- create initial chart:**
   ```typescript
   onMounted(() => {
     renderChart()
   })
   ```
   Chart.js requires the canvas to be in the DOM. `onMounted` guarantees the canvas element is available via `canvasRef.value`.

2. **Watch datasets for deep changes:**
   ```typescript
   watch(
     () => props.datasets,
     () => {
       renderChart()
     },
     { deep: true },
   )
   ```
   `deep: true` is necessary because `datasets` is an array of objects. Shallow watching would not detect changes to individual dataset data points, only array replacement. When a new prescription is added or data is recalculated, the datasets array (or its contents) changes and the chart re-renders.

3. **Watch timeframe props:**
   ```typescript
   watch(
     () => [props.startHours, props.endHours],
     () => {
       renderChart()
     },
   )
   ```
   When the user adjusts the timeframe slider in App.vue (Task 8), `endHours` changes and the chart must re-render with the new x-axis range. This watcher handles both `startHours` and `endHours` changes.

   **Alternative approach -- combined watcher:** Instead of two separate watchers, combine them:
   ```typescript
   watch(
     [() => props.datasets, () => props.startHours, () => props.endHours],
     () => {
       renderChart()
     },
     { deep: true },
   )
   ```
   This is cleaner -- a single watcher triggers `renderChart()` when any prop changes. The `deep: true` applies to the `datasets` array; primitive values (`startHours`, `endHours`) do not need deep watching but it does not hurt. **Use this combined approach.**

4. **Unmount hook -- cleanup:**
   ```typescript
   onUnmounted(() => {
     if (chartInstance) {
       chartInstance.destroy()
       chartInstance = null
     }
   })
   ```
   This prevents memory leaks. Chart.js attaches event listeners and resize observers to the canvas and window. `destroy()` removes all of these. Setting `chartInstance = null` ensures no dangling reference.

5. **Verify the destroy-before-create pattern in `renderChart()`** (already implemented in Phase 2):
   ```typescript
   // At the top of renderChart():
   if (chartInstance) {
     chartInstance.destroy()
     chartInstance = null
   }
   ```
   This is critical. Without it, each call to `renderChart()` would create a new Chart.js instance on the same canvas, causing visual artifacts (multiple charts stacked) and memory leaks. The destroy-then-create pattern is the standard Chart.js approach for reactive frameworks.

**Lifecycle flow diagram:**

```
Component mounted
  --> onMounted() --> renderChart() --> Chart created on canvas

Props change (datasets, startHours, endHours)
  --> watch() fires --> renderChart()
      --> destroys old Chart
      --> creates new Chart with updated data/config

Component unmounted (navigation, v-if toggled off)
  --> onUnmounted() --> chartInstance.destroy()
      --> cleanup complete, no leaks
```

**Acceptance criteria:**
- [ ] Chart renders on initial mount when datasets are provided
- [ ] Chart re-renders when `datasets` prop changes (new data, added/removed prescriptions)
- [ ] Chart re-renders when `startHours` or `endHours` changes (timeframe adjustment)
- [ ] Old chart instance is destroyed before new one is created (no stacking)
- [ ] Chart instance is destroyed on component unmount (no memory leak)
- [ ] Component handles being mounted with empty datasets (no error, blank canvas)
- [ ] Component handles datasets changing from non-empty to empty (chart destroyed, canvas blank)
- [ ] No Vue warnings about reactive proxies wrapping Chart.js objects (`chartInstance` is a plain `let`)

---

## Complete Component Reference

The final `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/GraphViewer.vue` after all three phases:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import type { GraphDataset } from '@/core/models/prescription'

Chart.register(...registerables)

// ---- Props ----

const props = withDefaults(
  defineProps<{
    datasets: GraphDataset[]
    startHours?: number
    endHours?: number
  }>(),
  {
    startHours: 0,
    endHours: 48,
  },
)

// ---- Color palette for multi-drug overlay ----

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
]

// ---- Chart instance (non-reactive) ----

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// ---- Helpers ----

function calculateTickStep(startHours: number, endHours: number): number {
  const range = endHours - startHours
  if (range <= 24) return 2
  if (range <= 72) return 6
  if (range <= 168) return 12
  return 24
}

// ---- Render function ----

function renderChart(): void {
  if (!canvasRef.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (props.datasets.length === 0) return

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

  chartInstance = new Chart(canvasRef.value, {
    type: 'line',
    data: { datasets: chartDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Time (hours)',
            font: { size: 14 },
          },
          min: props.startHours,
          max: props.endHours,
          ticks: {
            stepSize: calculateTickStep(props.startHours, props.endHours),
          },
        },
        y: {
          type: 'linear',
          title: {
            display: true,
            text: 'Relative Concentration (0\u20131)',
            font: { size: 14 },
          },
          min: 0,
          max: 1,
          ticks: {
            stepSize: 0.1,
            callback: (value: string | number) => {
              const num = typeof value === 'string' ? parseFloat(value) : value
              return num.toFixed(1)
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              if (items.length > 0 && items[0]) {
                return `Time: ${items[0].parsed.x.toFixed(1)}h`
              }
              return ''
            },
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)}`,
          },
        },
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
    },
  })
}

// ---- Lifecycle ----

onMounted(() => {
  renderChart()
})

watch(
  [() => props.datasets, () => props.startHours, () => props.endHours],
  () => {
    renderChart()
  },
  { deep: true },
)

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <div class="graph-viewer">
    <div class="disclaimer">
      Educational purposes only. Not for medical decisions.
    </div>
    <div class="chart-container">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<style scoped>
.graph-viewer {
  width: 100%;
}

.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
}

.disclaimer {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  color: #92400e;
  text-align: center;
}
</style>
```

---

## Testing Strategy

### Test File: `/Users/stephenfeather/Development/Pharmacokinetics-Grapher/src/components/__tests__/GraphViewer.spec.ts`

Chart.js requires a real `<canvas>` element with a 2D rendering context. jsdom (the test environment configured in `vitest.config.ts`) provides a DOM but does not implement the Canvas API. There are two approaches:

**Approach A (Recommended): Mock Chart.js entirely**

Mock the `chart.js` module so that `Chart` is a mock constructor. This tests the component's logic (prop handling, lifecycle, data transformation) without needing a real canvas.

```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import GraphViewer from '../GraphViewer.vue'

// Mock Chart.js
const mockDestroy = vi.fn()
const mockChartInstance = { destroy: mockDestroy }
const MockChart = vi.fn(() => mockChartInstance) as unknown as Mock & {
  register: Mock
}
MockChart.register = vi.fn()

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}))
```

**Approach B: Install `canvas` npm package**

Install `canvas` (node-canvas) as a dev dependency, which provides a Canvas API for Node.js. This allows Chart.js to actually create chart instances in tests. However, this adds a native dependency (requires system libraries) and is heavier than mocking.

**Recommendation:** Use Approach A (mocking) for unit tests. Integration testing with real Chart.js rendering should be done manually in the browser.

### Test Cases

```typescript
describe('GraphViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Phase 1: Structure and Setup ----

  describe('component structure', () => {
    it('renders a canvas element', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('renders the educational disclaimer', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      const disclaimer = wrapper.find('.disclaimer')
      expect(disclaimer.exists()).toBe(true)
      expect(disclaimer.text()).toContain('Educational purposes only')
      expect(disclaimer.text()).toContain('Not for medical decisions')
    })

    it('renders chart container with correct class', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      expect(wrapper.find('.chart-container').exists()).toBe(true)
    })
  })

  // ---- Phase 2: Chart Creation ----

  describe('chart creation', () => {
    it('registers Chart.js modules on import', () => {
      mount(GraphViewer, { props: { datasets: [] } })
      expect(MockChart.register).toHaveBeenCalled()
    })

    it('does not create Chart instance when datasets is empty', () => {
      mount(GraphViewer, { props: { datasets: [] } })
      expect(MockChart).not.toHaveBeenCalled()
    })

    it('creates Chart instance when datasets are provided', () => {
      const datasets = [{
        label: 'Test Drug',
        data: [
          { time: 0, concentration: 0 },
          { time: 1, concentration: 0.5 },
          { time: 2, concentration: 1.0 },
          { time: 4, concentration: 0.5 },
        ],
      }]
      mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)
    })

    it('passes canvas element to Chart constructor', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      mount(GraphViewer, { props: { datasets } })
      const firstArg = MockChart.mock.calls[0]?.[0]
      expect(firstArg).toBeInstanceOf(HTMLCanvasElement)
    })

    it('configures line chart type', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.type).toBe('line')
    })

    it('uses default startHours=0 and endHours=48 when not provided', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.options.scales.x.min).toBe(0)
      expect(config.options.scales.x.max).toBe(48)
    })

    it('uses provided startHours and endHours props', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      mount(GraphViewer, {
        props: { datasets, startHours: 6, endHours: 72 },
      })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.options.scales.x.min).toBe(6)
      expect(config.options.scales.x.max).toBe(72)
    })

    it('fixes y-axis range to 0-1', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.options.scales.y.min).toBe(0)
      expect(config.options.scales.y.max).toBe(1)
    })

    it('maps TimeSeriesPoint data to Chart.js {x, y} format', () => {
      const datasets = [{
        label: 'Drug A',
        data: [
          { time: 0, concentration: 0 },
          { time: 2, concentration: 0.8 },
        ],
      }]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      const chartData = config.data.datasets[0].data
      expect(chartData).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0.8 },
      ])
    })

    it('uses dataset color when provided', () => {
      const datasets = [{
        label: 'Drug A',
        data: [{ time: 0, concentration: 0 }],
        color: '#FF0000',
      }]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.data.datasets[0].borderColor).toBe('#FF0000')
    })

    it('assigns default palette colors when color not provided', () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
        { label: 'Drug B', data: [{ time: 0, concentration: 0 }] },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.data.datasets[0].borderColor).toBe('#3B82F6')
      expect(config.data.datasets[1].borderColor).toBe('#EF4444')
    })

    it('renders multiple datasets for multi-drug overlay', () => {
      const datasets = [
        {
          label: 'Drug A',
          data: [{ time: 0, concentration: 0 }, { time: 1, concentration: 1 }],
        },
        {
          label: 'Drug B',
          data: [{ time: 0, concentration: 0 }, { time: 2, concentration: 0.7 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      expect(config.data.datasets).toHaveLength(2)
      expect(config.data.datasets[0].label).toBe('Drug A')
      expect(config.data.datasets[1].label).toBe('Drug B')
    })
  })

  // ---- Phase 3: Lifecycle and Reactivity ----

  describe('lifecycle management', () => {
    it('destroys chart instance on unmount', () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      wrapper.unmount()
      expect(mockDestroy).toHaveBeenCalledTimes(1)
    })

    it('destroys and recreates chart when datasets change', async () => {
      const initialDatasets = [{
        label: 'Drug A',
        data: [{ time: 0, concentration: 0 }],
      }]
      const wrapper = mount(GraphViewer, {
        props: { datasets: initialDatasets },
      })

      const updatedDatasets = [{
        label: 'Drug B',
        data: [{ time: 0, concentration: 0 }, { time: 3, concentration: 0.9 }],
      }]
      await wrapper.setProps({ datasets: updatedDatasets })

      // Old instance destroyed, then new one created
      expect(mockDestroy).toHaveBeenCalled()
      expect(MockChart).toHaveBeenCalledTimes(2)
    })

    it('re-renders chart when endHours changes', async () => {
      const datasets = [{
        label: 'Test',
        data: [{ time: 0, concentration: 0 }],
      }]
      const wrapper = mount(GraphViewer, {
        props: { datasets, endHours: 48 },
      })

      await wrapper.setProps({ endHours: 72 })

      expect(MockChart).toHaveBeenCalledTimes(2)
      const secondConfig = MockChart.mock.calls[1]?.[1]
      expect(secondConfig.options.scales.x.max).toBe(72)
    })

    it('does not create chart instance with empty datasets after unmount', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      wrapper.unmount()
      // destroy is not called because no chart was ever created
      expect(mockDestroy).not.toHaveBeenCalled()
    })
  })

  // ---- Edge Cases ----

  describe('edge cases', () => {
    it('handles transition from datasets to empty datasets', async () => {
      const datasets = [{
        label: 'Drug A',
        data: [{ time: 0, concentration: 0 }],
      }]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)

      await wrapper.setProps({ datasets: [] })
      // Old chart destroyed, no new chart created
      expect(mockDestroy).toHaveBeenCalled()
    })

    it('handles single data point in dataset', () => {
      const datasets = [{
        label: 'Single Point',
        data: [{ time: 5, concentration: 0.5 }],
      }]
      mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)
    })

    it('wraps color palette for more than 8 datasets', () => {
      const datasets = Array.from({ length: 10 }, (_, i) => ({
        label: `Drug ${i}`,
        data: [{ time: 0, concentration: 0 }],
      }))
      mount(GraphViewer, { props: { datasets } })
      const config = MockChart.mock.calls[0]?.[1]
      // 9th dataset (index 8) wraps to first color
      expect(config.data.datasets[8].borderColor).toBe('#3B82F6')
      // 10th dataset (index 9) wraps to second color
      expect(config.data.datasets[9].borderColor).toBe('#EF4444')
    })
  })
})
```

### Test Execution

```bash
npm run test:unit -- src/components/__tests__/GraphViewer.spec.ts
```

### Test Fixture Data

For tests that need realistic GraphDataset data, create test fixtures using the existing prescription fixtures and `accumulateDoses()`. However, since `accumulateDoses()` is a separate module (Task 4), the GraphViewer tests should use simple inline data arrays rather than depending on the calculation module. The inline data in the test cases above is sufficient.

For future integration testing, a helper could generate realistic data:
```typescript
// Not needed for unit tests, but useful for manual/integration testing
import { accumulateDoses } from '@/core/calculations/multiDose'
import { BID_MULTI_DOSE_FIXTURE } from '@/core/models/__tests__/fixtures'

const testData = accumulateDoses(BID_MULTI_DOSE_FIXTURE, 0, 48)
const testDataset: GraphDataset = {
  label: 'Ibuprofen (bid)',
  data: testData,
  color: '#3B82F6',
}
```

---

## Risks and Considerations

### 1. Canvas API in jsdom (MEDIUM)

jsdom does not implement the Canvas 2D rendering context. Chart.js will throw if it tries to get a context from a jsdom canvas. **Mitigation:** Mock `chart.js` entirely in tests (Approach A above). The mock replaces the `Chart` constructor so Chart.js never touches the canvas.

If the mock approach proves insufficient (e.g., for verifying visual rendering), install the `canvas` npm package:
```bash
npm install -D canvas
```
This is a native module requiring Python and a C compiler on some systems.

### 2. Chart.js Reactive Proxy Interference (LOW)

If `chartInstance` were stored in a `ref()`, Vue would wrap the Chart.js object in a reactive proxy. Chart.js accesses internal properties and attaches listeners that can break when proxied. **Mitigation:** `chartInstance` is a plain `let` variable, not a `ref`. This is intentional and critical.

### 3. Rapid Prop Changes / Slider Dragging (LOW)

When the user drags the timeframe slider (Task 8), `endHours` changes frequently. Each change triggers `renderChart()`, which destroys and recreates the chart. Chart.js `destroy()` + `new Chart()` is fast (< 5ms typically), so this should not cause visible lag. However, if performance issues arise:
- **Debounce option:** Add a debounce wrapper around `renderChart()`:
  ```typescript
  import { useDebounceFn } from '@vueuse/core' // or manual implementation
  const debouncedRender = useDebounceFn(renderChart, 100)
  ```
- **Update instead of recreate:** Use `chartInstance.update()` to modify data in place rather than destroying and recreating. This requires updating `chartInstance.data.datasets` and `chartInstance.options.scales.x.max` directly, then calling `chartInstance.update()`. More complex but more performant.

For MVP, the destroy-and-recreate approach is simpler and sufficient. Optimize only if needed.

### 4. Color Palette Exhaustion (LOW)

The palette has 8 colors. If more than 8 drugs are overlaid, colors wrap around (modulo). Overlapping colors would make curves hard to distinguish. **Mitigation:** The modulo wrapping prevents errors. For a medical visualization tool, overlaying more than 4-5 drugs at once is unusual. If needed later, generate distinct colors programmatically using HSL rotation.

### 5. Tension Value and Medical Data (LOW)

CLAUDE.md states: "Avoid spline interpolation for medical data (can create false peaks)." A `tension: 0.1` value applies very slight Bezier smoothing. At 15-minute data intervals, this is effectively linear and will not create false peaks. If strict adherence is preferred, set `tension: 0` for perfectly linear interpolation between points.

### 6. Accessibility (LOW - future improvement)

The chart canvas is not accessible to screen readers. Chart.js does not natively generate ARIA labels. For MVP, the chart is visual-only. Future improvement: add an `aria-label` to the canvas describing the chart content, or provide a data table alternative.

---

## Estimated Complexity

**Task master assessment:** Complexity 5 (moderate)

**Breakdown by subtask:**
- Subtask 7.1 (Canvas + registration + template): Complexity 2 -- straightforward Vue component setup
- Subtask 7.2 (renderChart + Chart.js config): Complexity 3 -- requires correct Chart.js configuration, data transformation, axis setup
- Subtask 7.3 (Lifecycle + reactivity): Complexity 2 -- standard Vue lifecycle patterns, destroy/recreate pattern

**Estimated implementation time:** 1-1.5 hours for the component, plus 1 hour for tests

**Lines of code:**
- Component: ~150 lines (script ~100, template ~15, styles ~20)
- Tests: ~200-250 lines

---

## Implementation Order Summary

```
1. Phase 1: Create GraphViewer.vue with canvas, ref, imports, props, template, CSS
   - Verify: npm run type-check passes
   - Verify: component renders canvas and disclaimer in isolation

2. Phase 2: Implement renderChart() with Chart.js line configuration
   - Verify: npm run type-check passes
   - Verify: Chart.js config matches specification

3. Phase 3: Add onMounted, watch, onUnmounted lifecycle hooks
   - Verify: npm run type-check passes

4. Write test file: src/components/__tests__/GraphViewer.spec.ts
   - Mock chart.js module
   - Test all cases from testing strategy

5. Run full test suite: npm run test:unit
6. Run type check: npm run type-check
7. Run linter: npm run lint
8. Manual browser verification (requires Task 8 or a test harness in App.vue)
```
