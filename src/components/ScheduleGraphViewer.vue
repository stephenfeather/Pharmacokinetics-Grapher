<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import a11yLegend from 'chartjs-plugin-a11y-legend'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import { accumulateScheduleDoses } from '@/core/calculations/scheduleCalculator'
import { logError } from '@/core/utils/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Chart.register(...registerables, a11yLegend as any)

// ---- Props ----

const props = withDefaults(
  defineProps<{
    schedule: DosageSchedule
    tailOffHours?: number
  }>(),
  {
    tailOffHours: 48,
  },
)

// ---- Canvas ref and chart instance ----

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

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

// ---- Computed data ----

const curveColor = computed(() =>
  props.schedule.direction === 'titration' ? '#22c55e' : '#ef4444',
)

const totalHours = computed(() => props.schedule.totalDuration * 24)
const endHours = computed(() => totalHours.value + props.tailOffHours)

const curveData = computed(() =>
  accumulateScheduleDoses(props.schedule, 0, endHours.value),
)

const stepBoundaries = computed(() =>
  props.schedule.steps.map(step => ({
    x: step.startDay * 24,
    label: `${step.dose}mg`,
    day: step.startDay,
  })),
)

const chartAriaLabel = computed(() => {
  const dir = props.schedule.direction === 'titration' ? 'titration (increasing)' : 'taper (decreasing)'
  const doseRange = props.schedule.steps.map(s => `${s.dose}mg`).join(' → ')
  return `${props.schedule.name} ${dir} schedule graph. Doses: ${doseRange} over ${props.schedule.totalDuration} days.`
})

// ---- Tick step calculation ----

function calculateTickStep(hours: number): number {
  if (hours <= 72) return 6
  if (hours <= 168) return 12
  if (hours <= 720) return 24
  return 48
}

// ---- Render function ----

function renderChart(): void {
  if (!canvasRef.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  try {
    chartInstance = new Chart(canvasRef.value, {
      type: 'line',
      data: {
        datasets: [{
          label: props.schedule.name,
          data: curveData.value.map(p => ({ x: p.time, y: p.concentration })),
          borderColor: curveColor.value,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
          fill: false,
        }],
      },
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
              color: textColor.value,
            },
            min: 0,
            max: endHours.value,
            ticks: {
              stepSize: calculateTickStep(endHours.value),
              color: textColor.value,
              callback: (value: string | number) => {
                const num = typeof value === 'string' ? parseFloat(value) : value
                const day = Math.floor(num / 24)
                if (num % 24 === 0 && endHours.value > 72) {
                  return `Day ${day}`
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
            max: 1.1,
            ticks: {
              stepSize: 0.1,
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
            position: 'top',
            labels: {
              usePointStyle: true,
              color: textColor.value,
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (items) => {
                if (items.length > 0 && items[0] && items[0].parsed?.x !== undefined) {
                  const hours = items[0].parsed.x as number
                  const day = Math.floor(hours / 24) + 1
                  const hourInDay = (hours % 24).toFixed(1)
                  return `Day ${day}, ${hourInDay}h`
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
      },
    })
  } catch (e) {
    logError('ScheduleGraphViewer.renderChart', 'Failed to create chart', {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// ---- Lifecycle ----

onMounted(() => {
  renderChart()
  darkModeQuery?.addEventListener('change', handleDarkModeChange)
})

watch(
  [() => props.schedule, () => props.tailOffHours, prefersDark],
  () => renderChart(),
  { deep: true },
)

onUnmounted(() => {
  darkModeQuery?.removeEventListener('change', handleDarkModeChange)
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <div class="schedule-graph-viewer">
    <div class="disclaimer">
      Educational purposes only. Not for medical decisions.
    </div>

    <!-- Step Annotations -->
    <div class="step-annotations" aria-label="Dose step progression">
      <div
        v-for="(boundary, i) in stepBoundaries"
        :key="i"
        class="step-annotation"
        :class="schedule.direction"
      >
        <span class="step-dose">{{ boundary.label }}</span>
        <small class="step-day">Day {{ boundary.day + 1 }}+</small>
      </div>
    </div>

    <div class="chart-container">
      <canvas ref="canvasRef" role="img" :aria-label="chartAriaLabel"></canvas>
    </div>

    <!-- Screen reader text -->
    <div class="sr-only" aria-live="polite">
      <p>
        {{ schedule.direction === 'titration' ? 'Titration' : 'Taper' }} schedule
        for {{ schedule.name }}.
        {{ schedule.steps.length }} dose steps over {{ schedule.totalDuration }} days.
      </p>
    </div>
  </div>
</template>

<style scoped>
.schedule-graph-viewer {
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

.step-annotations {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.step-annotation {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
}

.step-annotation.titration {
  border-left: 3px solid #22c55e;
}

.step-annotation.taper {
  border-left: 3px solid #ef4444;
}

.step-dose {
  font-weight: 700;
  font-size: 0.95rem;
}

.step-day {
  color: var(--vt-c-text-light-2);
  font-size: 0.75rem;
}

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
}

@media (max-width: 768px) {
  .chart-container {
    height: 300px;
  }
}
</style>
