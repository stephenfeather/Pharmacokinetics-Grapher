<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import {
  getAllSchedules,
  deleteSchedule,
  duplicateSchedule,
  exportSchedulesAsJson,
} from '@/core/storage/scheduleStorage'

// Emits
const emit = defineEmits<{
  view: [schedule: DosageSchedule]
  edit: [schedule: DosageSchedule]
  compare: [schedules: DosageSchedule[]]
  import: []
}>()

// Reactive state
const schedules = ref<DosageSchedule[]>(getAllSchedules())
const selectedIds = ref<Set<string>>(new Set())

// Functions
function refresh() {
  schedules.value = getAllSchedules()
}

function handleDelete(id: string) {
  if (confirm('Delete this schedule?')) {
    deleteSchedule(id)
    refresh()
  }
}

function handleDuplicate(id: string) {
  duplicateSchedule(id)
  refresh()
}

function handleEdit(schedule: DosageSchedule) {
  emit('edit', schedule)
}

function toggleSelection(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  // Trigger reactivity
  selectedIds.value = new Set(selectedIds.value)
}

const canCompare = computed(() => selectedIds.value.size >= 2)

function handleCompare() {
  const selected = schedules.value.filter(s => s.id && selectedIds.value.has(s.id))
  if (selected.length >= 2) {
    emit('compare', selected)
  }
}

function handleExport() {
  const json = exportSchedulesAsJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'schedules-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function formatStepSummary(schedule: DosageSchedule): string {
  const doses = schedule.steps.map(s => `${s.dose}mg`).join(' \u2192 ')
  return `${doses} over ${schedule.totalDuration} days`
}

defineExpose({ refresh })
</script>

<template>
  <div class="schedule-list-container">
    <div class="list-header">
      <h2>Saved Schedules</h2>
      <div class="header-actions">
        <button
          v-if="schedules.length > 0"
          type="button"
          class="action-btn"
          data-testid="export-btn"
          @click="handleExport"
        >
          Export JSON
        </button>
        <button
          type="button"
          class="action-btn"
          data-testid="import-btn"
          @click="emit('import')"
        >
          Import
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="schedules.length === 0" data-testid="empty-message" class="empty-state">
      <p>No schedules saved yet. Create a titration or taper schedule to get started.</p>
    </div>

    <!-- Schedule list -->
    <ul v-else class="schedule-list">
      <li
        v-for="schedule in schedules"
        :key="schedule.id"
        class="schedule-item"
      >
        <!-- Compare checkbox -->
        <input
          v-if="schedule.id"
          type="checkbox"
          class="compare-checkbox"
          :checked="selectedIds.has(schedule.id)"
          :aria-label="`Select ${schedule.name} for comparison`"
          @change="toggleSelection(schedule.id!)"
        />

        <!-- Schedule info -->
        <div class="sched-info">
          <div class="sched-name-row">
            <span class="sched-name">{{ schedule.name }}</span>
            <span
              class="direction-badge"
              :class="schedule.direction"
            >
              {{ schedule.direction === 'titration' ? 'Titration' : 'Taper' }}
            </span>
          </div>
          <div class="sched-summary">
            {{ formatStepSummary(schedule) }}
          </div>
          <div class="sched-details">
            <span class="frequency-badge">{{ schedule.basePrescription.frequency }}</span>
            <span class="sched-drug">{{ schedule.basePrescription.name }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="sched-actions">
          <button
            :data-testid="`view-btn-${schedule.id}`"
            @click="emit('view', schedule)"
            class="action-btn"
          >
            View
          </button>
          <button
            :data-testid="`edit-btn-${schedule.id}`"
            @click="handleEdit(schedule)"
            class="action-btn"
          >
            Edit
          </button>
          <button
            v-if="schedule.id"
            :data-testid="`duplicate-btn-${schedule.id}`"
            @click="handleDuplicate(schedule.id)"
            class="action-btn"
          >
            Duplicate
          </button>
          <button
            v-if="schedule.id"
            :data-testid="`delete-btn-${schedule.id}`"
            @click="handleDelete(schedule.id)"
            class="action-btn danger"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>

    <!-- Compare button (shown when 2+ schedules selected) -->
    <div v-if="canCompare" class="compare-bar">
      <button
        data-testid="compare-btn"
        class="compare-btn"
        @click="handleCompare"
      >
        Compare Selected ({{ selectedIds.size }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.schedule-list-container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 0 0.5rem;
}

.list-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text);
  font-size: 1rem;
}

.empty-state p {
  margin: 0;
}

.schedule-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.schedule-item:hover {
  background-color: var(--color-border);
}

.sched-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sched-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sched-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
}

.direction-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.direction-badge.titration {
  background-color: #dcfce7;
  color: #166534;
}

.direction-badge.taper {
  background-color: #fee2e2;
  color: #991b1b;
}

.sched-summary {
  font-size: 0.9rem;
  color: var(--vt-c-text-light-2);
}

.sched-details {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.85rem;
  color: var(--color-text);
}

.frequency-badge {
  display: inline-block;
  padding: 0.2rem 0.45rem;
  background-color: #3b82f6;
  color: white;
  border-radius: 3px;
  font-weight: 500;
  font-size: 0.7rem;
  text-transform: uppercase;
}

.sched-drug {
  color: var(--vt-c-text-light-2);
}

.sched-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  padding: 0.5rem 0.75rem;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text);
  transition: background-color 0.2s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background-color: var(--color-border);
}

.action-btn.danger {
  border-color: #ef4444;
  color: #ef4444;
}

.action-btn.danger:hover {
  background-color: #fef2f2;
}

.compare-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.compare-bar {
  margin-top: 1rem;
  text-align: center;
}

.compare-btn {
  padding: 0.65rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.compare-btn:hover {
  background-color: #2563eb;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .direction-badge.titration {
    background-color: #064e3b;
    color: #6ee7b7;
  }

  .direction-badge.taper {
    background-color: #450a0a;
    color: #fca5a5;
  }

  .action-btn.danger {
    border-color: #fca5a5;
    color: #fca5a5;
  }

  .action-btn.danger:hover {
    background-color: #450a0a;
  }
}
</style>
