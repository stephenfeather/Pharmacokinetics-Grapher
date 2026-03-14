<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import a11yLegend from 'chartjs-plugin-a11y-legend'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import { accumulateScheduleDoses } from '@/core/calculations/scheduleCalculator'
import { logError } from '@/core/utils/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Chart.register(...registerables, a11yLegend as any)

// ---- Constants ----

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

// ---- Props ----

const props = withDefaults(
  defineProps<{
    schedules: DosageSchedule[]
    tailOffHours?: number
  }>(),
  {
    tailOffHours: 48,
  },
)

// ---- Canvas ref and chart instance ----

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// ---- Normalization mode ----

const normalizeMode = ref<'individual' | 'global'>('individual')

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

const maxEndHours = computed(() => {
  const maxDuration = Math.max(...props.schedules.map(s => s.totalDuration * 24))
  return maxDuration + props.tailOffHours
})

const allCurves = computed(() => {
  return props.schedules.map((schedule, index) => ({
    schedule,
    data: accumulateScheduleDoses(schedule, 0, maxEndHours.value),
    color: COLORS[index % COLORS.length]!,
  }))
})

const normalizedCurves = computed(() => {
  if (normalizeMode.value === 'individual') return allCurves.value

  // Find global max across all curves (raw concentrations before per-curve normalization)
  // Since accumulateScheduleDoses already normalizes to peak=1.0 per curve,
  // we need to re-accumulate without normalization for true global comparison.
  // However, the raw data is already normalized per-curve. For global mode,
  // we scale curves relative to their peak doses to show relative potency.
  const peakDoses = props.schedules.map(s => Math.max(...s.steps.map(step => step.dose)))
  const globalMaxDose = Math.max(...peakDoses)

  return allCurves.value.map((curve, index) => {
    const scale = peakDoses[index]! / globalMaxDose
    return {
      ...curve,
      data: curve.data.map(p => ({
        time: p.time,
        concentration: p.concentration * scale,
      })),
    }
  })
})

const chartAriaLabel = computed(() => {
  const names = props.schedules.map(s => s.name).join(', ')
  return `Schedule comparison graph showing ${names}.`
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
        datasets: normalizedCurves.value.map(curve => ({
          label: curve.schedule.name,
          data: curve.data.map(p => ({ x: p.time, y: p.concentration })),
          borderColor: curve.color,
          backgroundColor: 'transparent',
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
          fill: false,
        })),
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
            max: maxEndHours.value,
            ticks: {
              stepSize: calculateTickStep(maxEndHours.value),
              color: textColor.value,
              callback: (value: string | number) => {
                const num = typeof value === 'string' ? parseFloat(value) : value
                const day = Math.floor(num / 24)
                if (num % 24 === 0 && maxEndHours.value > 72) {
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
    logError('ScheduleComparisonViewer.renderChart', 'Failed to create chart', {
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
  [() => props.schedules, () => props.tailOffHours, prefersDark, normalizeMode],
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
  <div class="schedule-comparison-viewer">
    <div class="disclaimer">
      Educational purposes only. Not for medical decisions.
    </div>

    <!-- Normalization Toggle -->
    <div class="normalize-controls" data-testid="normalize-toggle">
      <span class="normalize-label">Normalization:</span>
      <label class="normalize-option">
        <input
          type="radio"
          name="normalize-mode"
          value="individual"
          v-model="normalizeMode"
        />
        Individual (each peaks at 1.0)
      </label>
      <label class="normalize-option">
        <input
          type="radio"
          name="normalize-mode"
          value="global"
          v-model="normalizeMode"
        />
        Global (scaled by dose)
      </label>
    </div>

    <div class="chart-container">
      <canvas ref="canvasRef" role="img" :aria-label="chartAriaLabel"></canvas>
    </div>

    <!-- Screen reader text -->
    <div class="sr-only" aria-live="polite">
      <p>
        Schedule comparison with {{ schedules.length }} schedules:
        {{ schedules.map(s => s.name).join(', ') }}.
      </p>
    </div>
  </div>
</template>

<style scoped>
.schedule-comparison-viewer {
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

.normalize-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.normalize-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}

.normalize-option {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--color-text);
  cursor: pointer;
}

.normalize-option input[type="radio"] {
  cursor: pointer;
  accent-color: #3b82f6;
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

  .normalize-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
