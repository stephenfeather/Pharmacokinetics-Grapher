<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import a11yLegend from 'chartjs-plugin-a11y-legend'
import type { GraphDataset } from '@/core/models/prescription'
import { generateFilename, downloadImage } from '@/core/export'
import { logWarn, logError } from '@/core/utils/logger'
import { hoursToClockTime, calculateClockTickStep, formatTimeWithDay } from '@/core/utils/timeFormat'

// Plugin lacks type definitions, but Chart.register accepts Plugin type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Chart.register(...registerables, a11yLegend as any)

// ---- Props ----

const props = withDefaults(
  defineProps<{
    datasets: GraphDataset[]
    startHours?: number
    endHours?: number
    xAxisMode?: 'hours' | 'clock'
    firstDoseTime?: string
  }>(),
  {
    startHours: 0,
    endHours: 48,
    xAxisMode: 'hours',
    firstDoseTime: '00:00',
  },
)

// ---- Canvas ref and chart instance ----

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

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

// ---- Dark mode detection ----

const darkModeQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

const prefersDark = ref(darkModeQuery?.matches ?? false)

function handleDarkModeChange(e: MediaQueryListEvent) {
  prefersDark.value = e.matches
}

const textColor = computed(() => (prefersDark.value ? '#e5e7eb' : '#374151'))
const dimmedColor = computed(() => (prefersDark.value ? '#6b7280' : '#9CA3AF'))

// ---- Responsive legend ----

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

function handleResize() {
  windowWidth.value = window.innerWidth
}

const isMobile = computed(() => windowWidth.value < 768)

// ---- Canvas accessibility ----

const chartAriaLabel = computed(() => {
  if (props.datasets.length === 0) {
    return 'Pharmacokinetic graph - no data loaded'
  }
  const drugList = props.datasets.map((ds) => ds.label).join(', ')
  const timeFormat =
    props.xAxisMode === 'clock'
      ? `Clock time starting from ${props.firstDoseTime}`
      : `Hours from ${props.startHours} to ${props.endHours}`
  return `Pharmacokinetic concentration graph showing: ${drugList}. ${timeFormat}. Y-axis: relative concentration 0 to 1.`
})

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

  // Compute dynamic Y-axis max from all dataset points (minimum 1.0)
  let dataMax = 1.0
  for (const ds of props.datasets) {
    for (const point of ds.data) {
      if (point.concentration > dataMax) {
        dataMax = point.concentration
      }
    }
  }
  // Round up to nearest 0.1
  const yMax = Math.ceil(dataMax * 10) / 10
  // Dynamic step size based on range
  const yStepSize = yMax <= 1 ? 0.1 : yMax <= 5 ? 0.5 : 1.0

  const chartDatasets = props.datasets.map((ds, index) => {
    const isMetabolite = ds.isMetabolite === true

    // For metabolites, use same color as previous dataset (parent drug)
    let colorIndex = index
    if (isMetabolite && index > 0) {
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
      ...(isMetabolite ? { borderDash: [5, 5] } : {}),
    }
  })

  try {
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
            text: props.xAxisMode === 'clock' ? 'Time of Day' : 'Time (hours)',
            font: { size: 14 },
            color: textColor.value,
          },
          min: props.startHours,
          max: props.endHours,
          ticks: {
            stepSize:
              props.xAxisMode === 'clock'
                ? calculateClockTickStep(props.startHours, props.endHours)
                : calculateTickStep(props.startHours, props.endHours),
            color: textColor.value,
            callback: (value: string | number) => {
              const num = typeof value === 'string' ? parseFloat(value) : value
              if (props.xAxisMode === 'clock') {
                return hoursToClockTime(num, '00:00')
              }
              return `${num}h`
            },
          },
          grid: {
            color: prefersDark.value ? 'rgba(75, 85, 99, 0.4)' : 'rgba(0, 0, 0, 0.1)',
          },
        },
        y: {
          type: 'linear',
          title: {
            display: true,
            text: 'Relative Concentration',
            font: { size: 14 },
            color: textColor.value,
          },
          min: 0,
          max: yMax,
          ticks: {
            stepSize: yStepSize,
            color: textColor.value,
            callback: (value: string | number) => {
              const num = typeof value === 'string' ? parseFloat(value) : value
              return num.toFixed(1)
            },
          },
          grid: {
            color: prefersDark.value ? 'rgba(75, 85, 99, 0.4)' : 'rgba(0, 0, 0, 0.1)',
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: (isMobile.value ? 'bottom' : 'top') as 'top' | 'bottom',
          labels: {
            usePointStyle: true,
            padding: isMobile.value ? 10 : 16,
            font: { size: isMobile.value ? 11 : 13 },
            color: textColor.value,
            generateLabels: (chart: Chart) => {
              const datasets = chart.data.datasets
              return datasets.map((ds, i) => ({
                text: ds.label || '',
                fillStyle: ds.borderColor as string,
                strokeStyle: ds.borderColor as string,
                lineWidth: 2,
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i,
                fontColor: chart.isDatasetVisible(i) ? textColor.value : dimmedColor.value,
              }))
            },
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
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              if (items.length > 0 && items[0] && items[0].parsed?.x !== undefined) {
                const hours = items[0].parsed.x as number
                if (props.xAxisMode === 'clock') {
                  return formatTimeWithDay(hours, '00:00')
                }
                return `Time: ${hours.toFixed(1)}h`
              }
              return ''
            },
            label: (ctx) => {
              const yValue = ctx.parsed?.y as number | undefined
              return yValue !== undefined ? `${ctx.dataset.label}: ${yValue.toFixed(3)}` : ''
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
  } catch (e) {
    logError('GraphViewer.renderChart', 'Failed to create Chart.js instance', {
      error: e instanceof Error ? e.message : String(e),
      datasetCount: chartDatasets.length,
    })
  }
}

// ---- Lifecycle ----

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
  darkModeQuery?.addEventListener('change', handleDarkModeChange)
})

watch(
  [
    () => props.datasets,
    () => props.startHours,
    () => props.endHours,
    () => props.xAxisMode,
    () => props.firstDoseTime,
    isMobile,
    prefersDark,
  ],
  () => {
    renderChart()
  },
  { deep: true },
)

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  darkModeQuery?.removeEventListener('change', handleDarkModeChange)
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})

// ---- Export API ----

const isExporting = ref(false)
const hasDatasets = computed(() => props.datasets.length > 0)

/**
 * Get the current Chart.js instance (or null if no chart is rendered).
 */
function getChartInstance(): Chart | null {
  return chartInstance
}

/**
 * Export the current chart as a PNG image and trigger browser download.
 * Returns true if download was triggered, false if no chart exists.
 */
function exportAsImage(): boolean {
  if (!chartInstance) {
    return false
  }

  const dataUrl = chartInstance.toBase64Image('image/png', 1.0) as string
  const drugNames = props.datasets.map((ds) => ds.label)
  const filename = generateFilename(drugNames)
  return downloadImage(dataUrl, filename)
}

/**
 * Handle download button click with visual feedback.
 */
function handleDownload(): void {
  if (isExporting.value || !chartInstance) return
  isExporting.value = true

  const success = exportAsImage()

  if (!success) {
    logWarn('GraphViewer.handleDownload', 'Export failed — chart may be missing or data URL invalid')
    isExporting.value = false
    return
  }

  // Reset button state after a brief visual feedback period
  setTimeout(() => {
    isExporting.value = false
  }, 1000)
}

defineExpose({
  getChartInstance,
  exportAsImage,
})
</script>

<template>
  <div class="graph-viewer">
    <div class="disclaimer">
      Educational purposes only. Not for medical decisions.
    </div>
    <div class="chart-container">
      <canvas ref="canvasRef" role="img" :aria-label="chartAriaLabel"></canvas>
    </div>
    <div v-if="hasDatasets" class="sr-only" aria-live="polite">
      <p>
        Graph displaying relative drug concentration over time for:
        <span v-for="(ds, i) in props.datasets" :key="i">
          {{ ds.label }}{{ i < props.datasets.length - 1 ? ', ' : '' }}
        </span>.
        Click legend items to toggle individual curves.
      </p>
    </div>
    <div v-if="hasDatasets" class="graph-actions">
      <button
        type="button"
        class="download-btn"
        :disabled="isExporting"
        :aria-busy="isExporting"
        aria-label="Download graph as PNG image"
        data-testid="download-graph-btn"
        @click="handleDownload"
      >
        {{ isExporting ? 'Downloading...' : 'Download as PNG' }}
      </button>
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

.graph-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.download-btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background: white;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s ease;
}

.download-btn:hover:not(:disabled) {
  background: #3b82f6;
  color: white;
}

.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Screen reader only utility */
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

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .disclaimer {
    background: #451a03;
    border-color: #92400e;
    color: #fef3c7;
  }

  .graph-actions {
    border-top-color: #374151;
  }

  .download-btn {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #3b82f6;
  }

  .download-btn:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
</style>
