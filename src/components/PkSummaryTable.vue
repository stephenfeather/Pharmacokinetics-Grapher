<script setup lang="ts">
import { ref } from 'vue'
import type { PkSummaryData, PkEventType } from '@/core/models/pkSummary'

defineProps<{
  summaryData: PkSummaryData[]
}>()

const collapsedSections = ref<Set<string>>(new Set())

function toggleSection(name: string) {
  if (collapsedSections.value.has(name)) {
    collapsedSections.value.delete(name)
  } else {
    collapsedSections.value.add(name)
  }
  // Trigger reactivity
  collapsedSections.value = new Set(collapsedSections.value)
}

function isCollapsed(name: string): boolean {
  return collapsedSections.value.has(name)
}

function eventTypeLabel(eventType: PkEventType): string {
  switch (eventType) {
    case 'dose':
      return 'Dose'
    case 'absorption_end':
      return 'Absorption'
    case 'peak':
      return 'Peak'
    case 'half_life':
      return 'Decay'
    case 'next_dose':
      return 'Next Dose'
    default:
      return ''
  }
}

function eventTypeClass(eventType: PkEventType): string {
  switch (eventType) {
    case 'dose':
      return 'event-dose'
    case 'absorption_end':
      return 'event-absorption'
    case 'peak':
      return 'event-peak'
    case 'half_life':
      return 'event-decay'
    case 'next_dose':
      return 'event-next-dose'
    default:
      return ''
  }
}

function formatConcentration(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="pk-summary-table" role="region" aria-label="Pharmacokinetic timeline summary">
    <div
      v-for="summary in summaryData"
      :key="summary.prescriptionName"
      class="prescription-section"
    >
      <button
        class="section-header"
        type="button"
        :aria-expanded="!isCollapsed(summary.prescriptionName)"
        :aria-controls="`pk-table-${summary.prescriptionName}`"
        @click="toggleSection(summary.prescriptionName)"
      >
        <span class="section-title">{{ summary.prescriptionName }}</span>
        <span class="toggle-icon" :class="{ collapsed: isCollapsed(summary.prescriptionName) }">
          &#9660;
        </span>
      </button>

      <div
        v-if="!isCollapsed(summary.prescriptionName)"
        :id="`pk-table-${summary.prescriptionName}`"
        class="table-wrapper"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Clock Time</th>
              <th scope="col">Elapsed</th>
              <th scope="col">Event</th>
              <th scope="col">Description</th>
              <th scope="col">Concentration</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(event, index) in summary.events"
              :key="index"
              :class="eventTypeClass(event.eventType)"
            >
              <td class="col-time">{{ event.clockTime }}</td>
              <td class="col-elapsed">{{ event.elapsedTime }}</td>
              <td class="col-event">
                <span class="event-badge" :class="eventTypeClass(event.eventType)">
                  {{ eventTypeLabel(event.eventType) }}
                </span>
              </td>
              <td class="col-description">{{ event.description }}</td>
              <td class="col-concentration">{{ formatConcentration(event.relativeConcentration) }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="summary.events.length === 0" class="empty-message">
          No milestone events to display.
        </p>
      </div>
    </div>

    <p v-if="summaryData.length === 0" class="empty-message">
      No prescriptions selected for timeline summary.
    </p>
  </div>
</template>

<style scoped>
.pk-summary-table {
  margin-top: 2rem;
}

.prescription-section {
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  transition: background 0.2s;
}

.section-header:hover {
  background: #f3f4f6;
}

.section-header:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-icon {
  font-size: 0.75rem;
  transition: transform 0.2s;
  color: #6b7280;
}

.toggle-icon.collapsed {
  transform: rotate(-90deg);
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
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

.col-time {
  font-family: monospace;
  white-space: nowrap;
}

.col-elapsed {
  font-family: monospace;
  white-space: nowrap;
  color: #6b7280;
}

.col-concentration {
  font-family: monospace;
  text-align: right;
  white-space: nowrap;
}

.event-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.event-badge.event-dose {
  background: #dbeafe;
  color: #1e40af;
}

.event-badge.event-absorption {
  background: #fef3c7;
  color: #92400e;
}

.event-badge.event-peak {
  background: #d1fae5;
  color: #065f46;
}

.event-badge.event-decay {
  background: #f3f4f6;
  color: #6b7280;
}

.event-badge.event-next-dose {
  background: #e0e7ff;
  color: #3730a3;
}

.empty-message {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
  font-style: italic;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prescription-section {
    border-color: #374151;
  }

  .section-header {
    background: #1f2937;
    color: #f3f4f6;
  }

  .section-header:hover {
    background: #374151;
  }

  .toggle-icon {
    color: #9ca3af;
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

  .col-elapsed {
    color: #9ca3af;
  }

  .event-badge.event-dose {
    background: #1e3a5f;
    color: #93c5fd;
  }

  .event-badge.event-absorption {
    background: #451a03;
    color: #fcd34d;
  }

  .event-badge.event-peak {
    background: #064e3b;
    color: #6ee7b7;
  }

  .event-badge.event-decay {
    background: #374151;
    color: #9ca3af;
  }

  .event-badge.event-next-dose {
    background: #312e81;
    color: #a5b4fc;
  }

  .empty-message {
    color: #9ca3af;
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

  .col-description {
    min-width: 200px;
  }
}
</style>
