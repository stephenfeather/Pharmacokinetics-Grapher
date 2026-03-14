<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FrequencyLabel } from '@/core/models/prescription'
import { DEFAULT_TIMES } from '@/core/models/prescription'
import type { DosageSchedule, DoseStep, ScheduleDirection } from '@/core/models/dosageSchedule'
import { validateDosageSchedule, computeStartDays } from '@/core/models/dosageSchedule'
import draggable from 'vuedraggable-es'

// Props & Emits
const props = defineProps<{
  initial?: DosageSchedule
}>()

const emit = defineEmits<{
  submit: [schedule: DosageSchedule]
}>()

// Form state
const name = ref(props.initial?.name ?? 'New Schedule')
const direction = ref<ScheduleDirection>(props.initial?.direction ?? 'titration')
const frequency = ref<FrequencyLabel>(props.initial?.basePrescription?.frequency ?? 'bid')
const times = ref<string[]>(
  props.initial?.basePrescription?.times
    ? [...props.initial.basePrescription.times]
    : ['09:00', '21:00'],
)
const halfLife = ref(props.initial?.basePrescription?.halfLife ?? 6)
const uptake = ref(props.initial?.basePrescription?.uptake ?? 1.5)
const peak = ref(props.initial?.basePrescription?.peak ?? 2)

// Steps (mutable array)
const steps = ref<DoseStep[]>(
  props.initial?.steps
    ? props.initial.steps.map(s => ({ ...s }))
    : [
        { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
      ],
)

// Watch initial prop -> reset form when editing different schedule
watch(
  () => props.initial,
  (newInitial) => {
    if (!newInitial) {
      name.value = 'New Schedule'
      direction.value = 'titration'
      frequency.value = 'bid'
      times.value = ['09:00', '21:00']
      halfLife.value = 6
      uptake.value = 1.5
      peak.value = 2
      steps.value = [
        { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
      ]
    } else {
      name.value = newInitial.name
      direction.value = newInitial.direction
      frequency.value = newInitial.basePrescription.frequency
      times.value = [...newInitial.basePrescription.times]
      halfLife.value = newInitial.basePrescription.halfLife
      uptake.value = newInitial.basePrescription.uptake
      peak.value = newInitial.basePrescription.peak
      steps.value = newInitial.steps.map(s => ({ ...s }))
    }
  },
  { deep: true },
)

// Watch frequency -> update times
watch(frequency, (newFreq) => {
  if (newFreq === 'custom') return
  times.value = [...DEFAULT_TIMES[newFreq]]
})

// Step management
function addStep() {
  const lastStep = steps.value[steps.value.length - 1]!
  const newDose =
    direction.value === 'titration'
      ? lastStep.dose * 2
      : Math.max(1, Math.round((lastStep.dose / 2) * 10) / 10)
  steps.value.push({
    stepNumber: steps.value.length + 1,
    dose: Math.round(newDose * 10) / 10,
    durationDays: 7,
    startDay: 0,
  })
  recomputeSteps()
}

function removeStep(index: number) {
  if (steps.value.length <= 2) return
  steps.value.splice(index, 1)
  recomputeSteps()
}

function recomputeSteps() {
  steps.value = computeStartDays(steps.value)
}

// Recompute after drag reorder
function onDragEnd() {
  recomputeSteps()
}

// Build the schedule object
const schedule = computed<DosageSchedule>(() => {
  const recomputedSteps = computeStartDays(steps.value)
  const totalDuration = recomputedSteps.reduce((sum, s) => sum + s.durationDays, 0)
  return {
    ...(props.initial?.id ? { id: props.initial.id } : {}),
    name: name.value,
    direction: direction.value,
    basePrescription: {
      name: name.value,
      frequency: frequency.value,
      times: [...times.value],
      dose: recomputedSteps[0]?.dose ?? 0,
      halfLife: halfLife.value,
      peak: peak.value,
      uptake: uptake.value,
    },
    steps: recomputedSteps,
    totalDuration,
  }
})

// Validation
const validation = computed(() => validateDosageSchedule(schedule.value))
const canSubmit = computed(() => validation.value.valid)

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', schedule.value)
}
</script>

<template>
  <div class="schedule-form-container">
    <form @submit.prevent="handleSubmit" class="schedule-form">
      <!-- Schedule Name -->
      <div class="form-field">
        <label for="sched-name">Schedule Name</label>
        <input
          id="sched-name"
          v-model="name"
          type="text"
          maxlength="100"
          aria-describedby="hint-sched-name"
        />
        <small id="hint-sched-name" class="field-hint">Descriptive name (e.g., "Sertraline Titration")</small>
      </div>

      <!-- Direction Toggle -->
      <fieldset class="direction-fieldset">
        <legend>Schedule Type</legend>
        <div class="direction-options">
          <label class="direction-option">
            <input
              type="radio"
              name="direction"
              value="titration"
              v-model="direction"
            />
            <span class="direction-label titration-label">Titration</span>
            <small>Gradually increasing dose</small>
          </label>
          <label class="direction-option">
            <input
              type="radio"
              name="direction"
              value="taper"
              v-model="direction"
            />
            <span class="direction-label taper-label">Taper</span>
            <small>Gradually decreasing dose</small>
          </label>
        </div>
      </fieldset>

      <!-- Base Drug Parameters -->
      <fieldset>
        <legend>Drug Parameters</legend>

        <div class="form-field">
          <label for="sched-frequency">Dosing Frequency</label>
          <select id="sched-frequency" v-model="frequency">
            <option value="once">Once daily</option>
            <option value="qd">QD (once daily)</option>
            <option value="bid">BID (twice daily)</option>
            <option value="tid">TID (three times daily)</option>
            <option value="qid">QID (four times daily)</option>
            <option value="q3h">Q3H (every 3 hours)</option>
            <option value="q6h">Q6H (every 6 hours)</option>
            <option value="q8h">Q8H (every 8 hours)</option>
            <option value="q12h">Q12H (every 12 hours)</option>
            <option value="custom">Custom times</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="sched-halflife">Half-life (hours)</label>
            <input
              id="sched-halflife"
              v-model.number="halfLife"
              type="number"
              min="0.1"
              max="240"
              step="0.01"
            />
          </div>

          <div class="form-field">
            <label for="sched-peak">Tmax (hours)</label>
            <input
              id="sched-peak"
              v-model.number="peak"
              type="number"
              min="0.1"
              max="48"
              step="0.01"
            />
          </div>

          <div class="form-field">
            <label for="sched-uptake">Absorption (hours)</label>
            <input
              id="sched-uptake"
              v-model.number="uptake"
              type="number"
              min="0.1"
              max="24"
              step="0.01"
            />
          </div>
        </div>

        <!-- Dosing Times -->
        <fieldset class="times-fieldset">
          <legend>Dosing Times</legend>
          <div v-for="(_, index) in times" :key="index" class="time-input-row">
            <label :for="`sched-time-${index}`">Time {{ index + 1 }}</label>
            <input
              :id="`sched-time-${index}`"
              v-model="times[index]"
              type="time"
              required
            />
          </div>
        </fieldset>
      </fieldset>

      <!-- Steps -->
      <fieldset class="steps-fieldset">
        <legend>Dose Steps</legend>
        <small class="steps-hint">
          Define dose amounts and durations for each step. Drag to reorder.
        </small>

        <draggable
          v-model="steps"
          item-key="stepNumber"
          handle=".drag-handle"
          @end="onDragEnd"
          tag="div"
          class="steps-list"
        >
          <template #item="{ element, index }">
            <div class="step-row" :data-step="element.stepNumber">
              <span class="drag-handle" aria-label="Drag to reorder">&#x2630;</span>
              <span class="step-number">{{ index + 1 }}</span>
              <div class="step-fields">
                <div class="step-field">
                  <label :for="`step-dose-${index}`">Dose</label>
                  <input
                    :id="`step-dose-${index}`"
                    v-model.number="element.dose"
                    type="number"
                    min="0.001"
                    max="10000"
                    step="0.001"
                  />
                </div>
                <div class="step-field">
                  <label :for="`step-days-${index}`">Days</label>
                  <input
                    :id="`step-days-${index}`"
                    v-model.number="element.durationDays"
                    type="number"
                    min="1"
                    step="1"
                  />
                </div>
              </div>
              <button
                type="button"
                class="remove-step-btn"
                :disabled="steps.length <= 2"
                :aria-label="`Remove step ${index + 1}`"
                @click="removeStep(index)"
              >
                &times;
              </button>
            </div>
          </template>
        </draggable>

        <button type="button" class="add-step-btn" @click="addStep">
          + Add Step
        </button>
      </fieldset>

      <!-- Step Preview -->
      <div class="step-preview" aria-label="Step progression preview">
        <span
          v-for="(step, i) in steps"
          :key="i"
          class="preview-step"
        >
          {{ step.dose }}mg
          <small>({{ step.durationDays }}d)</small>
          <span v-if="i < steps.length - 1" class="preview-arrow">
            {{ direction === 'titration' ? '&rarr;' : '&rarr;' }}
          </span>
        </span>
        <small class="preview-total">Total: {{ schedule.totalDuration }} days</small>
      </div>

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

      <!-- Submit -->
      <button
        type="submit"
        :disabled="!canSubmit"
        :aria-disabled="!canSubmit"
      >
        Generate Schedule Graph
      </button>
    </form>
  </div>
</template>

<style scoped>
.schedule-form-container {
  width: 100%;
}

.schedule-form {
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
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

/* Direction toggle */
.direction-fieldset {
  margin-bottom: 1rem;
}

.direction-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.direction-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.direction-option:has(input:checked) {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.direction-option input[type="radio"] {
  margin-bottom: 0.25rem;
}

.direction-label {
  font-weight: 600;
  font-size: 1rem;
}

.titration-label {
  color: #22c55e;
}

.taper-label {
  color: #ef4444;
}

.direction-option small {
  color: var(--vt-c-text-light-2);
  font-size: 0.75rem;
}

/* Times */
.times-fieldset {
  border: 1px dashed var(--color-border);
  margin-top: 0.75rem;
}

.time-input-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

/* Steps */
.steps-hint {
  display: block;
  color: var(--vt-c-text-light-2);
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
}

.drag-handle {
  cursor: grab;
  font-size: 1.2rem;
  color: var(--vt-c-text-light-2);
  user-select: none;
  padding: 0 0.25rem;
}

.drag-handle:active {
  cursor: grabbing;
}

.step-number {
  font-weight: 700;
  min-width: 1.5rem;
  text-align: center;
  color: var(--vt-c-text-light-2);
}

.step-fields {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.step-field {
  flex: 1;
}

.step-field label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.15rem;
}

.step-field input {
  width: 100%;
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
}

.remove-step-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 1.2rem;
  cursor: pointer;
  color: #ef4444;
  padding: 0.25rem 0.5rem;
  line-height: 1;
}

.remove-step-btn:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
}

.remove-step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.add-step-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-text);
}

.add-step-btn:hover {
  background-color: var(--color-border);
}

/* Step Preview */
.step-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: var(--color-background-soft);
  border-radius: 4px;
  font-size: 0.9rem;
}

.preview-step {
  white-space: nowrap;
}

.preview-step small {
  color: var(--vt-c-text-light-2);
}

.preview-arrow {
  margin: 0 0.25rem;
  color: var(--vt-c-text-light-2);
}

.preview-total {
  margin-left: auto;
  color: var(--vt-c-text-light-2);
  font-weight: 600;
}

/* Validation styles (same as PrescriptionForm) */
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

@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .direction-options {
    grid-template-columns: 1fr;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .direction-option:has(input:checked) {
    background: rgba(59, 130, 246, 0.1);
  }

  .remove-step-btn:hover:not(:disabled) {
    background: #450a0a;
    border-color: #991b1b;
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
}
</style>
