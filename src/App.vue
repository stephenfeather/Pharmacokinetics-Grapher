<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Prescription, GraphDataset } from '@/core/models/prescription'
import { getGraphData } from '@/core/calculations'
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

// ---- Graph settings ----

const startHours = ref(0)
const endHours = ref(48)

// ---- Refs for focus management ----

const formRef = ref<HTMLElement | null>(null)
const listContainerRef = ref<HTMLElement | null>(null)
const graphContainerRef = ref<HTMLElement | null>(null)

// ---- Computed graph data ----

const graphDatasets = computed<GraphDataset[]>(() => {
  if (comparePrescriptions.value.length === 0) return []
  return getGraphData(comparePrescriptions.value, startHours.value, endHours.value)
})

// ---- View switching ----

function switchView(view: 'form' | 'list' | 'graph') {
  showForm.value = view === 'form'
  showList.value = view === 'list'
  showGraph.value = view === 'graph'
  activeTab.value = view

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
  switchView('graph')
}

function handleEditPrescription(rx: Prescription) {
  currentPrescription.value = rx
  switchView('form')
}

function handleComparePrescriptions(rxs: Prescription[]) {
  comparePrescriptions.value = rxs
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
      <div v-if="showForm" ref="formRef">
        <PrescriptionForm @submit="handleFormSubmit" />
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
          :end-hours="endHours"
        />

        <div class="graph-controls">
          <label for="timeframe-slider">Timeframe: {{ startHours }}h to {{ endHours }}h</label>
          <input
            id="timeframe-slider"
            v-model.number="endHours"
            type="range"
            min="12"
            max="168"
            step="12"
          />
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

.graph-controls label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.graph-controls input[type="range"] {
  width: 100%;
  height: 6px;
  cursor: pointer;
  accent-color: #3b82f6;
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
