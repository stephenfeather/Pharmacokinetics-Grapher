<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Prescription } from '@/core/models/prescription'
import {
  getAllPrescriptions,
  deletePrescription,
  duplicatePrescription,
} from '@/core/storage/prescriptionStorage'

// Emits
const emit = defineEmits<{
  view: [prescription: Prescription]
  edit: [prescription: Prescription]
  compare: [prescriptions: Prescription[]]
}>()

// Reactive state
const prescriptions = ref<Prescription[]>(getAllPrescriptions())
const compareMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

// Computed
const selectedCount = computed(() => selectedIds.value.size)

// Functions
function refresh() {
  prescriptions.value = getAllPrescriptions()
}

function handleDelete(id: string) {
  if (confirm('Delete this prescription?')) {
    deletePrescription(id)
    // Also remove from selectedIds if in compare mode
    const newSet = new Set(selectedIds.value)
    newSet.delete(id)
    selectedIds.value = newSet
    refresh()
  }
}

function handleDuplicate(id: string) {
  duplicatePrescription(id)
  refresh()
}

function handleEdit(rx: Prescription) {
  emit('edit', rx)
}

function toggleSelect(id: string) {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedIds.value = newSet
}

function handleCompare() {
  const selected = prescriptions.value.filter((rx) => rx.id && selectedIds.value.has(rx.id))
  if (selected.length > 0) {
    emit('compare', selected)
  }
}

function exitCompareMode() {
  compareMode.value = false
  selectedIds.value = new Set()
}
</script>

<template>
  <div class="prescription-list-container">
    <!-- List header with compare toggle -->
    <div class="list-header">
      <h2>Saved Prescriptions</h2>
      <button
        data-testid="compare-toggle"
        @click="compareMode ? exitCompareMode() : (compareMode = true)"
        class="compare-toggle-btn"
      >
        {{ compareMode ? 'Exit Compare' : 'Compare Mode' }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="prescriptions.length === 0" data-testid="empty-message" class="empty-state">
      <p>No prescriptions saved yet. Start by creating a new prescription above.</p>
    </div>

    <!-- Prescription list -->
    <ul v-else class="prescription-list">
      <li v-for="rx in prescriptions" :key="rx.id" class="prescription-item">
        <!-- Checkbox (compare mode) -->
        <input
          v-if="compareMode"
          :data-testid="`compare-checkbox-${rx.id}`"
          type="checkbox"
          :checked="rx.id ? selectedIds.has(rx.id) : false"
          @change="rx.id && toggleSelect(rx.id)"
          class="compare-checkbox"
        />

        <!-- Prescription info -->
        <div class="rx-info">
          <div class="rx-name">{{ rx.name }}</div>
          <div class="rx-details">
            <span class="frequency-badge">{{ rx.frequency }}</span>
            <span class="rx-dose">{{ rx.dose }}mg</span>
            <span class="rx-halflife">t1/2={{ rx.halfLife }}h</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="rx-actions">
          <button
            :data-testid="`view-btn-${rx.id}`"
            @click="emit('view', rx)"
            class="action-btn"
          >
            View
          </button>
          <button :data-testid="`edit-btn-${rx.id}`" @click="handleEdit(rx)" class="action-btn">
            Edit
          </button>
          <button
            v-if="rx.id"
            :data-testid="`duplicate-btn-${rx.id}`"
            @click="handleDuplicate(rx.id)"
            class="action-btn"
          >
            Duplicate
          </button>
          <button
            v-if="rx.id"
            :data-testid="`delete-btn-${rx.id}`"
            @click="handleDelete(rx.id)"
            class="action-btn danger"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>

    <!-- Compare bar -->
    <div
      v-if="compareMode && selectedCount > 0"
      :data-testid="compareMode && selectedCount > 0 ? 'compare-bar' : ''"
      class="compare-bar"
    >
      <span :data-testid="compareMode && selectedCount > 0 ? 'selected-count' : ''">
        {{ selectedCount }} selected
      </span>
      <button
        :data-testid="compareMode && selectedCount > 0 ? 'compare-submit' : ''"
        @click="handleCompare"
        class="compare-submit-btn"
      >
        Compare Selected
      </button>
    </div>
  </div>
</template>

<style scoped>
.prescription-list-container {
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

.compare-toggle-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text);
  transition: background-color 0.2s ease;
}

.compare-toggle-btn:hover {
  background-color: var(--color-border);
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

.prescription-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prescription-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.prescription-item:hover {
  background-color: var(--color-border);
}

.compare-checkbox {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.rx-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rx-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
}

.rx-details {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-text);
}

.frequency-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: #3b82f6;
  color: white;
  border-radius: 3px;
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.rx-actions {
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

.compare-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #3b82f6;
  color: white;
  border-radius: 4px;
  margin-top: 1.5rem;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}

.compare-submit-btn {
  padding: 0.5rem 1rem;
  background-color: white;
  color: #3b82f6;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.compare-submit-btn:hover {
  background-color: #f0f9ff;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .prescription-item:hover {
    background-color: var(--color-border);
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
