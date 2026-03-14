<script setup lang="ts">
import { computed } from 'vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'

const props = defineProps<{
  schedule: DosageSchedule
}>()

interface StepSummary {
  stepNumber: number
  dose: number
  durationDays: number
  dayRange: string
  estimatedSteadyState: number
  timeToSteadyState: number
  durationTooShort: boolean
}

const summaryRows = computed<StepSummary[]>(() => {
  const { halfLife } = props.schedule.basePrescription
  const timeToSS = halfLife * 5
  const maxDose = Math.max(...props.schedule.steps.map(s => s.dose))

  return props.schedule.steps.map(step => {
    const dayEnd = step.startDay + step.durationDays
    const ssLevel = maxDose > 0 ? Math.round((step.dose / maxDose) * 100) / 100 : 0
    const durationHours = step.durationDays * 24

    return {
      stepNumber: step.stepNumber,
      dose: step.dose,
      durationDays: step.durationDays,
      dayRange: `Day ${step.startDay + 1}-${dayEnd}`,
      estimatedSteadyState: ssLevel,
      timeToSteadyState: Math.round(timeToSS * 10) / 10,
      durationTooShort: durationHours < timeToSS,
    }
  })
})
</script>

<template>
  <div class="schedule-summary-table" role="region" aria-label="Schedule step summary">
    <table>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Dose</th>
          <th scope="col">Duration</th>
          <th scope="col">Days</th>
          <th scope="col">Est. SS Level</th>
          <th scope="col">Time to SS</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in summaryRows" :key="row.stepNumber">
          <td>{{ row.stepNumber }}</td>
          <td>{{ row.dose }} mg</td>
          <td>{{ row.durationDays }} days</td>
          <td>{{ row.dayRange }}</td>
          <td>{{ row.estimatedSteadyState }}</td>
          <td>
            {{ row.timeToSteadyState }} hrs
            <span
              v-if="row.durationTooShort"
              class="ss-warning"
              title="Step duration is shorter than time to reach steady state"
            >
              *
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <p
      v-if="summaryRows.some(r => r.durationTooShort)"
      class="warning-note"
    >
      * Step duration shorter than estimated time to steady state (~5 half-lives).
      Steady state may not be reached before the next dose change.
    </p>
  </div>
</template>

<style scoped>
.schedule-summary-table {
  margin-top: 1.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

thead {
  background: #f3f4f6;
}

th {
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
}

tr:last-child td {
  border-bottom: none;
}

.ss-warning {
  color: #f59e0b;
  font-weight: 700;
  font-size: 1rem;
}

.warning-note {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #92400e;
  font-style: italic;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  table {
    border-color: #374151;
  }

  thead {
    background: #1f2937;
  }

  th {
    color: #e5e7eb;
    border-bottom-color: #374151;
  }

  td {
    color: #e5e7eb;
    border-bottom-color: #374151;
  }

  .warning-note {
    color: #fcd34d;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  table {
    font-size: 0.8rem;
  }

  th,
  td {
    padding: 0.375rem 0.5rem;
  }
}
</style>
