<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import type { Prescription, GraphDataset } from '@/core/models/prescription'
import { getGraphData, getLastDoseTime, calculateTailOffDuration } from '@/core/calculations'
import { savePrescription, getAllPrescriptions } from '@/core/storage/prescriptionStorage'
import PrescriptionForm from '@/components/PrescriptionForm.vue'
import GraphViewer from '@/components/GraphViewer.vue'
import PrescriptionList from '@/components/PrescriptionList.vue'

// ---- State ----

const currentPrescription = ref<Prescription | null>(null)
const savedPrescriptions = ref<Prescription[]>(getAllPrescriptions())
const showForm = ref(true)
const showGraph = ref(false)
const showList = ref(false)
const comparePrescriptions = ref<Prescription[]>([])
const activeTab = ref<'form' | 'list' | 'graph'>('form')
const statusMessage = ref('')

// ---- Graph settings ----

const startHours = ref(0)
const endHours = ref(48)
 
const useAutoTimeframe = ref(true)

// ---- Refs for focus management ----

const formRef = ref<HTMLElement | null>(null)
const listContainerRef = ref<HTMLElement | null>(null)
const graphContainerRef = ref<HTMLElement | null>(null)

// ---- Computed graph data ----

const graphDatasets = computed<GraphDataset[]>(() => {
  if (comparePrescriptions.value.length === 0) return []
  return getGraphData(comparePrescriptions.value, startHours.value, endHours.value)
})

// ---- Auto-extend timeframe computation ----

/**
 * Calculate recommended end time based on prescription parameters and tail-off requirements.
 * Uses: lastDoseTime + tailOffDuration, with bounds [24, 168] hours
 * Used to determine auto-extended graph timeframe.
 */
const autoEndHours = computed<number>(() => {
  // Use comparePrescriptions array if available (when graphing multiple drugs)
  // Fall back to currentPrescription for form editing
  const prescriptionsToConsider =
    comparePrescriptions.value.length > 0
      ? comparePrescriptions.value
      : currentPrescription.value
        ? [currentPrescription.value]
        : []

  // Default: if no prescriptions, return 48 hours
  if (prescriptionsToConsider.length === 0) {
    return 48
  }

  // Calculate number of days to expand prescriptions across
  // Add 1 to ensure we capture all doses in the window
  const numDays = Math.ceil(endHours.value / 24) + 1

  // For each prescription, calculate its recommended end time
  // Use the maximum (longest tail-off)
  const maxEndTime = Math.max(
    ...prescriptionsToConsider.map((rx) => {
      const lastDoseTime = getLastDoseTime(rx, numDays)
      const tailOffDuration = calculateTailOffDuration(rx.halfLife)
      return lastDoseTime + tailOffDuration
    }),
  )

  // Apply bounds: minimum 24 hours (at least 1 day), maximum 168 hours (1 week)
  return Math.max(24, Math.min(168, maxEndTime))
})

/**
 * Effective end time for graph: switches between auto and manual based on toggle.
 * When useAutoTimeframe is true: returns autoEndHours (smart calculation)
 * When false: returns manual endHours (user slider control)
 */
 
const effectiveEndHours = computed<number>(() => {
  return useAutoTimeframe.value ? autoEndHours.value : endHours.value
})

/**
 * Dynamic slider minimum: the greater of startHours or 12
 * Ensures slider can't be moved below reasonable minimum
 */
const sliderMin = computed<number>(() => {
  return Math.max(12, startHours.value)
})

/**
 * Dynamic slider maximum: the greater of 168 hours or autoEndHours
 * Allows user to extend beyond auto-calculated value if desired
 */
const sliderMax = computed<number>(() => {
  return Math.max(168, autoEndHours.value)
})

// ---- View switching ----

function switchView(view: 'form' | 'list' | 'graph') {
  showForm.value = view === 'form'
  showList.value = view === 'list'
  showGraph.value = view === 'graph'
  activeTab.value = view

  // Announce view change to screen readers
  if (view === 'form') {
    statusMessage.value = 'Switched to form view. Add or edit a prescription.'
  } else if (view === 'list') {
    statusMessage.value = `Switched to saved prescriptions. ${savedPrescriptions.value.length} prescriptions available.`
  } else if (view === 'graph') {
    statusMessage.value = `Switched to graph view. Displaying ${comparePrescriptions.value.length} prescription${comparePrescriptions.value.length !== 1 ? 's' : ''}.`
  }

  // Focus management after next render
  nextTick(() => {
    if (view === 'form') {
      formRef.value?.querySelector('input')?.focus()
    } else if (view === 'list' && listContainerRef.value) {
      listContainerRef.value.querySelector('h2')?.focus()
    } else if (view === 'graph' && graphContainerRef.value) {
      graphContainerRef.value.focus()
    }
  })
}

// ---- Event handlers ----

function handleFormSubmit(rx: Prescription) {
  currentPrescription.value = rx
  comparePrescriptions.value = [rx]
  switchView('graph')
}

function handleImportSuccess(count: number) {
  savedPrescriptions.value = getAllPrescriptions()
  statusMessage.value = `Successfully imported ${count} prescription${count !== 1 ? 's' : ''}. Showing saved prescriptions.`
  switchView('list')
}

function saveCurrentPrescription() {
  if (currentPrescription.value) {
    const saved = savePrescription(currentPrescription.value)
    savedPrescriptions.value = getAllPrescriptions()
    currentPrescription.value = saved
  }
}

function newPrescription() {
  currentPrescription.value = null
  switchView('form')
}

// ---- PrescriptionList event handlers ----

function handleViewPrescription(rx: Prescription) {
  comparePrescriptions.value = [rx]
  statusMessage.value = `Viewing prescription: ${rx.name}`
  switchView('graph')
}

function handleEditPrescription(rx: Prescription) {
  currentPrescription.value = rx
  statusMessage.value = `Editing prescription: ${rx.name}`
  switchView('form')
}

function handleComparePrescriptions(rxs: Prescription[]) {
  comparePrescriptions.value = rxs
  statusMessage.value = `Comparing ${rxs.length} prescription${rxs.length !== 1 ? 's' : ''}: ${rxs.map((r) => r.name).join(', ')}`
  switchView('graph')
}

// ---- Tab keyboard navigation ----

function handleTabKeydown(event: KeyboardEvent) {
  const nav = event.currentTarget as HTMLElement
  const buttons = Array.from(nav.querySelectorAll('button'))
  const activeButton = nav.querySelector('[aria-current="page"]')
  const activeIndex = buttons.indexOf(activeButton as HTMLButtonElement)

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    const prevIndex = activeIndex - 1 < 0 ? buttons.length - 1 : activeIndex - 1
    buttons[prevIndex]?.focus()
    buttons[prevIndex]?.click()
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = (activeIndex + 1) % buttons.length
    buttons[nextIndex]?.focus()
    buttons[nextIndex]?.click()
  }
}

// ---- Edge Case Handling: Auto-switch from graph if prescriptions deleted ----

watch(comparePrescriptions, (newVal) => {
  if (newVal.length === 0 && activeTab.value === 'graph') {
    switchView('list')
  }
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Pharmacokinetics Grapher</h1>
      <p class="subtitle">Educational visualization of medication concentration</p>
    </header>

    <div class="disclaimer-banner">
      ⚠️ This app is for educational purposes only. Not for medical decisions.
    </div>

    <!-- ARIA live region for screen reader announcements -->
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ statusMessage }}
    </div>

    <!-- Tab Navigation -->
    <nav
      class="tab-navigation"
      role="navigation"
      aria-label="Main navigation"
      @keydown="handleTabKeydown"
    >
      <button
        :class="{ active: activeTab === 'form' }"
        :aria-current="activeTab === 'form' ? 'page' : undefined"
        @click="switchView('form')"
      >
        Add New Prescription
      </button>
      <button
        :class="{ active: activeTab === 'list' }"
        :aria-current="activeTab === 'list' ? 'page' : undefined"
        @click="switchView('list')"
      >
        Saved Prescriptions
      </button>
      <button
        v-if="comparePrescriptions.length > 0"
        :class="{ active: activeTab === 'graph' }"
        :aria-current="activeTab === 'graph' ? 'page' : undefined"
        @click="switchView('graph')"
      >
        Graph ({{ comparePrescriptions.length }})
      </button>
    </nav>

    <main class="app-main">
      <div v-if="showForm" ref="formRef" role="region" aria-label="Prescription form">
        <PrescriptionForm @submit="handleFormSubmit" @imported="handleImportSuccess" />
      </div>

      <div v-if="showList" class="list-section" ref="listContainerRef">
        <PrescriptionList
          @view="handleViewPrescription"
          @edit="handleEditPrescription"
          @compare="handleComparePrescriptions"
        />
      </div>

      <div v-if="showGraph" class="graph-section" ref="graphContainerRef" role="region" aria-label="Graph visualization" tabindex="-1">
        <GraphViewer
          :datasets="graphDatasets"
          :start-hours="startHours"
          :end-hours="effectiveEndHours"
        />

        <div class="graph-controls">
          <!-- Auto-extend toggle -->
          <div class="control-group">
            <label for="auto-timeframe-toggle" class="toggle-label">
              <input
                id="auto-timeframe-toggle"
                v-model="useAutoTimeframe"
                type="checkbox"
                class="toggle-checkbox"
                aria-label="Enable auto-extend timeframe for intelligent graph sizing"
              />
              Auto-extend timeframe
            </label>
          </div>

          <!-- Timeframe slider -->
          <div class="control-group">
            <label for="timeframe-slider">
              Timeframe: {{ startHours }}h to {{ effectiveEndHours }}h
              <span v-if="!useAutoTimeframe" class="mode-indicator">(manual)</span>
              <span v-else class="mode-indicator">(auto)</span>
            </label>
            <input
              id="timeframe-slider"
              v-model.number="endHours"
              type="range"
              :min="sliderMin"
              :max="sliderMax"
              step="12"
              :disabled="useAutoTimeframe"
              aria-label="Manually adjust graph timeframe when auto-extend is disabled"
            />
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-primary" @click="saveCurrentPrescription">
            Save Prescription
          </button>
          <button class="btn btn-secondary" @click="newPrescription">
            New Prescription
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  flex-direction: column;
}

.app-header {
  background: white;
  padding: 2rem 1rem;
  text-align: center;
  border-bottom: 2px solid #e5e7eb;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  color: #1f2937;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 1rem;
  color: #6b7280;
  font-weight: 400;
}

.disclaimer-banner {
  background: #fef3c7;
  border: 2px solid #f59e0b;
  border-radius: 8px;
  padding: 1rem;
  margin: 1.5rem 1rem;
  font-size: 0.95rem;
  color: #92400e;
  text-align: center;
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.graph-section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.graph-controls {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.control-group {
  margin-bottom: 1.5rem;
}

.control-group:last-child {
  margin-bottom: 0;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.toggle-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.graph-controls label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.mode-indicator {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 400;
}

.graph-controls input[type="range"] {
  width: 100%;
  height: 6px;
  cursor: pointer;
  accent-color: #3b82f6;
  transition: opacity 0.2s ease;
}

.graph-controls input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 150px;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

@media (max-width: 768px) {
  .app-header h1 {
    font-size: 1.75rem;
  }

  .app-main {
    padding: 1rem;
  }

  .graph-section {
    padding: 1.5rem;
  }

  .actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
