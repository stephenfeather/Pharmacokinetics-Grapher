<script setup lang="ts">
import { ref, computed } from 'vue'
import draggable from 'vuedraggable-es'
import type { Prescription } from '@/core/models/prescription'
import { usePrescriptionStore } from '@/stores'
import ImportPrescriptions from './ImportPrescriptions.vue'

// Store
const store = usePrescriptionStore()
if (!store.isLoaded) store.load()

// Emits
const emit = defineEmits<{
  view: [prescription: Prescription]
  edit: [prescription: Prescription]
  compare: [prescriptions: Prescription[]]
}>()

// Writable computed for draggable v-model compatibility
const prescriptions = computed({
  get: () => store.prescriptions,
  set: (val: Prescription[]) => store.reorder(val),
})
const compareMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showImportModal = ref(false)

// Computed
const selectedCount = computed(() => selectedIds.value.size)

// Functions
function handleDelete(id: string) {
  if (confirm('Delete this prescription?')) {
    store.remove(id)
    const newSet = new Set(selectedIds.value)
    newSet.delete(id)
    selectedIds.value = newSet
  }
}

function handleDuplicate(id: string) {
  store.duplicate(id)
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

function handleExport() {
  const json = store.exportJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `prescriptions-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function handleExportSelected() {
  const selectedIdsArray = Array.from(selectedIds.value)
  const json = store.exportJson(selectedIdsArray)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `prescriptions-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function handleImportComplete() {
  showImportModal.value = false
  store.load()
}

function onDragEnd() {
  store.reorder(prescriptions.value)
}
</script>

<template>
  <div class="prescription-list-container">
    <!-- List header with compare toggle -->
    <div class="list-header">
      <h2>Saved Prescriptions</h2>
      <div class="header-actions">
        <button
          data-testid="export-btn"
          @click="handleExport"
          class="action-header-btn"
          :disabled="prescriptions.length === 0"
          title="Export all prescriptions as JSON"
        >
          Export
        </button>
        <button
          data-testid="import-btn"
          @click="showImportModal = true"
          class="action-header-btn"
          title="Import prescriptions from JSON"
        >
          Import
        </button>
        <button
          data-testid="compare-toggle"
          @click="compareMode ? exitCompareMode() : (compareMode = true)"
          class="compare-toggle-btn"
        >
          {{ compareMode ? 'Exit Compare' : 'Compare Mode' }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="prescriptions.length === 0" data-testid="empty-message" class="empty-state">
      <p>No prescriptions saved yet. Start by creating a new prescription above.</p>
    </div>

    <!-- Prescription list (draggable when not in compare mode) -->
    <draggable
      v-else
      v-model="prescriptions"
      item-key="id"
      handle=".drag-handle"
      ghost-class="drag-ghost"
      chosen-class="drag-chosen"
      :animation="200"
      tag="ul"
      class="prescription-list"
      @end="onDragEnd"
    >
      <template #item="{ element: rx }">
        <li class="prescription-item">
          <!-- Drag handle (hidden in compare mode) -->
          <span
            v-if="!compareMode"
            class="drag-handle"
            aria-label="Drag to reorder"
          >⠿</span>
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
      </template>
    </draggable>

    <!-- Compare bar -->
    <div
      v-if="compareMode && selectedCount > 0"
      :data-testid="compareMode && selectedCount > 0 ? 'compare-bar' : ''"
      class="compare-bar"
    >
      <span :data-testid="compareMode && selectedCount > 0 ? 'selected-count' : ''">
        {{ selectedCount }} selected
      </span>
      <div class="compare-bar-actions">
        <button
          data-testid="export-selected-btn"
          @click="handleExportSelected"
          class="export-selected-btn"
        >
          Export Selected
        </button>
        <button
          :data-testid="compareMode && selectedCount > 0 ? 'compare-submit' : ''"
          @click="handleCompare"
          class="compare-submit-btn"
        >
          Compare Selected
        </button>
      </div>
    </div>

    <!-- Import modal -->
    <ImportPrescriptions
      v-if="showImportModal"
      @imported="handleImportComplete"
      @close="showImportModal = false"
    />
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

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.action-header-btn {
  padding: 0.5rem 1rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text);
  transition: background-color 0.2s ease;
}

.action-header-btn:hover:not(:disabled) {
  background-color: var(--color-border);
}

.action-header-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.drag-handle {
  cursor: grab;
  padding: 0 0.5rem;
  color: var(--color-text);
  opacity: 0.5;
  user-select: none;
  flex-shrink: 0;
}

.drag-handle:hover {
  opacity: 1;
}

.drag-ghost {
  opacity: 0.4;
  background-color: var(--color-background-soft);
  border-style: dashed;
}

.drag-chosen {
  background-color: var(--color-background-mute);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: grabbing;
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

.compare-bar-actions {
  display: flex;
  gap: 0.5rem;
}

.export-selected-btn {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: white;
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.export-selected-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
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

  .drag-chosen {
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
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
