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
            text: 'Relative Concentration (0–1)',
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
              if (items.length > 0 && items[0] && items[0].parsed?.x !== undefined) {
                return `Time: ${(items[0].parsed.x as number).toFixed(1)}h`
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
