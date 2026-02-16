<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Prescription, FrequencyLabel, DurationUnit, ValidationResult } from '@/core/models/prescription'
import { FREQUENCY_MAP, validatePrescription } from '@/core/models/prescription'
import ImportPrescriptions from './ImportPrescriptions.vue'

// Props & Emits
const props = defineProps<{
  initial?: Prescription
}>()

const emit = defineEmits<{
  submit: [prescription: Prescription]
  imported: [count: number]
}>()

// Import modal state
const showImportModal = ref(false)

// Form state (individual refs)
const name = ref(props.initial?.name ?? 'Test Drug')
const frequency = ref<FrequencyLabel>(props.initial?.frequency ?? 'bid')
const times = ref<string[]>(
  props.initial?.times ? [...props.initial.times] : ['09:00', '21:00'],
)
const dose = ref(props.initial?.dose ?? 500)
const halfLife = ref(props.initial?.halfLife ?? 6)
const peak = ref(props.initial?.peak ?? 2)
const uptake = ref(props.initial?.uptake ?? 1.5)
const metaboliteLife = ref<number | undefined>(props.initial?.metaboliteLife)
const metaboliteConversionFraction = ref<number | undefined>(props.initial?.metaboliteConversionFraction)
const duration = ref<number | undefined>(props.initial?.duration ?? 7)
const durationUnit = ref<DurationUnit>(props.initial?.durationUnit ?? 'days')

// Phase 1.5: Watch initial prop -> reset form when editing different prescription
watch(
  () => props.initial,
  (newInitial) => {
    if (!newInitial) {
      // New prescription mode - use defaults
      name.value = 'Test Drug'
      frequency.value = 'bid'
      times.value = ['09:00', '21:00']
      dose.value = 500
      halfLife.value = 6
      peak.value = 2
      uptake.value = 1.5
      metaboliteLife.value = undefined
      metaboliteConversionFraction.value = undefined
      duration.value = 7
      durationUnit.value = 'days'
    } else {
      // Edit mode - populate from initial prescription
      name.value = newInitial.name
      frequency.value = newInitial.frequency
      times.value = newInitial.times ? [...newInitial.times] : ['09:00', '21:00']
      dose.value = newInitial.dose
      halfLife.value = newInitial.halfLife
      peak.value = newInitial.peak
      uptake.value = newInitial.uptake
      metaboliteLife.value = newInitial.metaboliteLife
      metaboliteConversionFraction.value = newInitial.metaboliteConversionFraction
      duration.value = newInitial.duration
      durationUnit.value = newInitial.durationUnit ?? 'days'
    }
  },
  { deep: true }
)

// Phase 2: Watch frequency -> adjust times array
watch(frequency, (newFreq) => {
  const expectedCount = FREQUENCY_MAP[newFreq]
  if (expectedCount === null) return // 'custom' -- leave times alone

  // Grow: add default times
  while (times.value.length < expectedCount) {
    times.value.push('12:00')
  }
  // Shrink: remove from end
  while (times.value.length > expectedCount) {
    times.value.pop()
  }
})

function addTime() {
  times.value.push('12:00')
}

function removeLastTime() {
  if (times.value.length > 1) {
    times.value.pop()
  }
}

// Phase 3: Validation
const prescription = computed<Prescription>(() => ({
  ...(props.initial?.id ? { id: props.initial.id } : {}),
  name: name.value,
  frequency: frequency.value,
  times: [...times.value],
  dose: dose.value,
  halfLife: halfLife.value,
  peak: peak.value,
  uptake: uptake.value,
  ...(metaboliteLife.value !== undefined && !isNaN(metaboliteLife.value)
    ? { metaboliteLife: metaboliteLife.value }
    : {}),
  ...(metaboliteConversionFraction.value !== undefined && !isNaN(metaboliteConversionFraction.value)
    ? { metaboliteConversionFraction: metaboliteConversionFraction.value }
    : {}),
  ...(duration.value !== undefined && !isNaN(duration.value)
    ? { duration: duration.value, durationUnit: durationUnit.value }
    : {}),
}))

const validation = computed<ValidationResult>(() => validatePrescription(prescription.value))

const canSubmit = computed(() => validation.value.valid)

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', prescription.value)
}

function handleImportSuccess(count: number) {
  showImportModal.value = false
  emit('imported', count)
}
</script>

<template>
  <div class="prescription-form-container">
    <!-- Phase 4: Educational Disclaimer -->
    <div class="educational-disclaimer" role="note" aria-label="Educational disclaimer">
      <strong>Educational Use Only</strong>
      <p>
        This tool is for visualization and educational purposes only. It is not intended for
        medical dosing decisions. Outputs show approximate relative concentration curves based on
        simplified pharmacokinetic models. Actual drug levels vary by individual (weight,
        metabolism, food, drug interactions, etc.). Always follow prescriptions written by
        licensed healthcare providers.
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="prescription-form">
      <!-- Phase 1: All input fields -->

      <!-- Drug name -->
      <div class="form-field">
        <label for="rx-name">Drug Name</label>
        <input
          id="rx-name"
          v-model="name"
          type="text"
          maxlength="100"
          aria-describedby="hint-name"
        />
        <small id="hint-name" class="field-hint">Drug or brand name (1-100 characters)</small>
      </div>

      <!-- Frequency -->
      <div class="form-field">
        <label for="rx-frequency">Dosing Frequency</label>
        <select id="rx-frequency" v-model="frequency">
          <option value="once">Once daily</option>
          <option value="bid">BID (twice daily)</option>
          <option value="tid">TID (three times daily)</option>
          <option value="qid">QID (four times daily)</option>
          <option value="q6h">Q6H (every 6 hours)</option>
          <option value="q8h">Q8H (every 8 hours)</option>
          <option value="q12h">Q12H (every 12 hours)</option>
          <option value="custom">Custom times</option>
        </select>
      </div>

      <!-- Dose -->
      <div class="form-field">
        <label for="rx-dose">Dose per Administration</label>
        <input
          id="rx-dose"
          v-model.number="dose"
          type="number"
          min="0.001"
          max="10000"
          step="0.001"
          aria-describedby="hint-dose"
        />
        <small id="hint-dose" class="field-hint">Range: 0.001 - 10,000</small>
      </div>

      <!-- Half-life -->
      <div class="form-field">
        <label for="rx-halflife">Half-life (hours)</label>
        <input
          id="rx-halflife"
          v-model.number="halfLife"
          type="number"
          min="0.1"
          max="240"
          step="0.01"
          aria-describedby="hint-halflife"
        />
        <small id="hint-halflife" class="field-hint">Range: 0.1 - 240 hours</small>
      </div>

      <!-- Peak (Tmax) -->
      <div class="form-field">
        <label for="rx-peak">Time to Peak (Tmax, hours)</label>
        <input
          id="rx-peak"
          v-model.number="peak"
          type="number"
          min="0.1"
          max="48"
          step="0.01"
          aria-describedby="hint-peak"
        />
        <small id="hint-peak" class="field-hint">Range: 0.1 - 48 hours</small>
      </div>

      <!-- Uptake -->
      <div class="form-field">
        <label for="rx-uptake">Absorption Time (hours)</label>
        <input
          id="rx-uptake"
          v-model.number="uptake"
          type="number"
          min="0.1"
          max="24"
          step="0.01"
          aria-describedby="hint-uptake"
        />
        <small id="hint-uptake" class="field-hint">Range: 0.1 - 24 hours</small>
      </div>

      <!-- Metabolite half-life (optional) -->
      <div class="form-field">
        <label for="rx-metabolite">Metabolite Half-life (hours, optional)</label>
        <input
          id="rx-metabolite"
          v-model.number="metaboliteLife"
          type="number"
          min="0.1"
          max="1000"
          step="0.01"
          aria-describedby="hint-metabolite"
        />
        <small id="hint-metabolite" class="field-hint"
          >Optional. Range: 0.1 - 1,000 hours</small
        >
      </div>

      <!-- Metabolite Conversion Fraction (optional) -->
      <div class="form-field">
        <label for="rx-metabolite-fm">
          Metabolite Conversion Fraction (optional)
        </label>
        <input
          id="rx-metabolite-fm"
          v-model.number="metaboliteConversionFraction"
          type="number"
          min="0.0"
          max="1.0"
          step="0.01"
          aria-describedby="hint-metabolite-fm"
        />
        <small id="hint-metabolite-fm" class="field-hint">
          Optional. Fraction of parent drug converted to metabolite (0.0 - 1.0).
          Both half-life and fraction required for metabolite visualization.
        </small>
      </div>

      <!-- Medication Duration -->
      <div class="duration-input-group">
        <div class="form-field duration-value">
          <label for="rx-duration">Medication Duration</label>
          <input
            id="rx-duration"
            v-model.number="duration"
            type="number"
            min="0.1"
            step="0.01"
            aria-describedby="hint-duration"
          />
          <small id="hint-duration" class="field-hint">
            {{ durationUnit === 'days' ? 'Range: 0.1 - 365 days' : 'Range: 0.1 - 8760 hours' }}
          </small>
        </div>

        <div class="form-field duration-unit">
          <label for="rx-duration-unit">Unit</label>
          <select id="rx-duration-unit" v-model="durationUnit">
            <option value="days">Days</option>
            <option value="hours">Hours</option>
          </select>
        </div>
      </div>

      <!-- Phase 2: Dynamic time inputs with fieldset -->
      <fieldset>
        <legend>Dosing Times</legend>
        <div v-for="(_, index) in times" :key="index" class="time-input-row">
          <label :for="`rx-time-${index}`">Time {{ index + 1 }}</label>
          <input
            :id="`rx-time-${index}`"
            v-model="times[index]"
            type="time"
            required
          />
        </div>
        <!-- Custom frequency: add/remove buttons -->
        <div v-if="frequency === 'custom'" class="custom-time-controls">
          <button type="button" @click="addTime">+ Add Time</button>
          <button type="button" @click="removeLastTime" :disabled="times.length <= 1">
            - Remove Last
          </button>
        </div>
      </fieldset>

      <!-- Phase 3: Error/warning display -->

      <!-- Validation Errors -->
      <div
        v-if="validation.errors.length > 0"
        class="validation-errors"
        role="alert"
        aria-live="assertive"
      >
        <h3>Validation Errors</h3>
        <ul>
          <li v-for="error in validation.errors" :key="error">{{ error }}</li>
        </ul>
      </div>

      <!-- Validation Warnings -->
      <div
        v-if="validation.warnings.length > 0"
        class="validation-warnings"
        aria-live="polite"
      >
        <h3>Warnings</h3>
        <ul>
          <li v-for="warning in validation.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>

      <!-- Submit button -->
      <button
        type="submit"
        :disabled="!canSubmit"
        :aria-disabled="!canSubmit"
      >
        Generate Graph
      </button>

      <!-- Import link -->
      <div class="import-link-container">
        <button
          type="button"
          @click="showImportModal = true"
          class="import-link"
          aria-label="Import prescriptions from JSON"
        >
          or import prescriptions
        </button>
      </div>
    </form>

    <!-- Import modal -->
    <ImportPrescriptions
      v-if="showImportModal"
      @imported="handleImportSuccess"
      @close="showImportModal = false"
    />
  </div>
</template>

<style scoped>
.prescription-form-container {
  width: 100%;
}

.educational-disclaimer {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-left: 4px solid #f59e0b;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.educational-disclaimer strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #d97706;
}

.educational-disclaimer p {
  margin: 0;
}

.prescription-form {
  max-width: 600px;
  margin: 0 auto;
}

.form-field {
  margin-bottom: 1rem;
}

.form-field label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.form-field input,
.form-field select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
}

.form-field input:focus,
.form-field select:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
  border-color: #3b82f6;
}

.field-hint {
  display: block;
  color: var(--vt-c-text-light-2);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

fieldset {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

fieldset legend {
  font-weight: 600;
  padding: 0 0.5rem;
}

.time-input-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.time-input-row label {
  margin-bottom: 0;
}

.time-input-row input {
  margin: 0;
}

.custom-time-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.custom-time-controls button {
  flex: 1;
  padding: 0.5rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text);
}

.custom-time-controls button:hover:not(:disabled) {
  background-color: var(--color-border);
}

.custom-time-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.validation-errors {
  background-color: #fef2f2;
  border: 1px solid #fca5a5;
  border-left: 4px solid #ef4444;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  border-radius: 4px;
}

.validation-errors h3 {
  color: #dc2626;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.validation-errors ul {
  margin: 0;
  padding-left: 1.5rem;
}

.validation-errors li {
  color: #dc2626;
  margin-bottom: 0.25rem;
}

.validation-warnings {
  background-color: #fffbeb;
  border: 1px solid #fcd34d;
  border-left: 4px solid #f59e0b;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  border-radius: 4px;
}

.validation-warnings h3 {
  color: #d97706;
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.validation-warnings ul {
  margin: 0;
  padding-left: 1.5rem;
}

.validation-warnings li {
  color: #d97706;
  margin-bottom: 0.25rem;
}

.duration-input-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
}

.duration-input-group .duration-value {
  flex: 2;
  margin-bottom: 0;
}

.duration-input-group .duration-unit {
  flex: 1;
  margin-bottom: 0;
}

.duration-input-group .form-field label {
  margin-bottom: 0.25rem;
}

@media (max-width: 600px) {
  .duration-input-group {
    flex-direction: column;
    gap: 0;
  }

  .duration-input-group .duration-value {
    flex: 1;
    margin-bottom: 1rem;
  }

  .duration-input-group .duration-unit {
    flex: 1;
    margin-bottom: 0;
  }
}

button[type='submit'] {
  width: 100%;
  margin-top: 1.5rem;
  padding: 0.75rem 2rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

button[type='submit']:hover:not(:disabled) {
  background-color: #2563eb;
}

button[type='submit']:disabled {
  background-color: var(--color-border);
  cursor: not-allowed;
  opacity: 0.6;
}

.import-link-container {
  text-align: center;
  margin-top: 0.75rem;
}

.import-link {
  background: none;
  border: none;
  color: var(--vt-c-text-light-2);
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  transition: color 0.2s ease;
}

.import-link:hover {
  color: var(--color-text);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .prescription-form-container {
    background-color: #1a1a1a;
  }

  .form-field label {
    color: #ffffff;
  }

  .field-hint {
    color: #b0b0b0;
  }

  fieldset legend {
    color: #ffffff;
  }

  .educational-disclaimer strong {
    color: #fcd34d;
  }

  .validation-errors {
    background-color: #450a0a;
    border-color: #991b1b;
  }

  .validation-errors h3,
  .validation-errors li {
    color: #fca5a5;
  }

  .validation-warnings {
    background-color: #451a03;
    border-color: #92400e;
  }

  .validation-warnings h3,
  .validation-warnings li {
    color: #fcd34d;
  }

  .import-link {
    color: #60a5fa;
  }

  .import-link:hover {
    color: #93c5fd;
  }
}
</style>
