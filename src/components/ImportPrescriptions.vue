<script setup lang="ts">
import { ref, computed } from 'vue'
import { validatePrescription } from '@/core/models/prescription'
import { savePrescription } from '@/core/storage/prescriptionStorage'
import { transformImportedPrescription } from '@/core/utils/importTransform'
import { logWarn, logError } from '@/core/utils/logger'

const emit = defineEmits<{
  imported: [count: number]
  close: []
}>()

const jsonInput = ref('')
const importResult = ref<{
  success: number
  failed: number
  errors: string[]
}>({ success: 0, failed: 0, errors: [] })
const showResult = ref(false)

const isValidJson = computed(() => {
  try {
    if (!jsonInput.value.trim()) return false
    JSON.parse(jsonInput.value)
    return true
  } catch (e) {
    logWarn('ImportPrescriptions.isValidJson', 'JSON parse failed during validation', {
      error: e instanceof Error ? e.message : String(e),
      inputLength: jsonInput.value.length,
    })
    return false
  }
})

function handleImport() {
  showResult.value = false
  importResult.value = { success: 0, failed: 0, errors: [] }

  try {
    const data = JSON.parse(jsonInput.value)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prescriptions: any[] = Array.isArray(data)
      ? data
      : data.prescriptions || []

    if (!Array.isArray(prescriptions)) {
      importResult.value.errors.push('JSON must contain an array or object with "prescriptions" array')
      showResult.value = true
      return
    }

    prescriptions.forEach((rawRx, index) => {
      const rx = transformImportedPrescription(rawRx)
      const validation = validatePrescription(rx)
      if (validation.valid) {
        try {
          savePrescription(rx)
          importResult.value.success++
        } catch (e) {
          logError('ImportPrescriptions.handleImport', 'Failed to save imported prescription', {
            row: index + 1,
            name: rx.name,
            error: e instanceof Error ? e.message : String(e),
          })
          importResult.value.failed++
          importResult.value.errors.push(
            `Row ${index + 1} (${rx.name}): Failed to save - ${e instanceof Error ? e.message : 'Unknown error'}`
          )
        }
      } else {
        importResult.value.failed++
        importResult.value.errors.push(
          `Row ${index + 1} (${rx.name}): ${validation.errors.join(', ')}`
        )
      }
    })

    showResult.value = true
    if (importResult.value.success > 0) {
      emit('imported', importResult.value.success)
    }
  } catch (e) {
    logError('ImportPrescriptions.handleImport', 'Failed to parse import JSON', {
      error: e instanceof Error ? e.message : String(e),
      inputLength: jsonInput.value.length,
    })
    importResult.value.errors.push(
      `Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
    )
    showResult.value = true
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="import-modal-overlay" @click.self="handleClose">
    <div class="import-modal">
      <div class="modal-header">
        <h2>Import Prescriptions</h2>
        <button type="button" class="close-btn" @click="handleClose" aria-label="Close">
          ✕
        </button>
      </div>

      <div class="modal-body">
        <p class="instruction-text">
          Paste JSON data with prescription information. Expected format:
        </p>

        <div class="format-example">
          <pre><code>{
  "prescriptions": [
    {
      "name": "Drug Name",
      "dose": 500,
      "frequency": "bid",
      "times": ["09:00", "21:00"],
      "halfLife": 6,
      "peak": 2,
      "uptake": 1.5,
      "metaboliteHalfLife": {
        "name": "Metabolite Name",
        "halfLife": 12
      }
    }
  ]
}</code></pre>
        </div>

        <textarea
          v-model="jsonInput"
          placeholder="Paste JSON here..."
          class="json-textarea"
          rows="12"
        ></textarea>

        <div v-if="showResult" class="import-result">
          <div v-if="importResult.success > 0" class="result-success">
            ✓ Successfully imported {{ importResult.success }} prescription(s)
          </div>

          <div v-if="importResult.failed > 0" class="result-failed">
            ✗ Failed to import {{ importResult.failed }} prescription(s):
            <ul>
              <li v-for="error in importResult.errors" :key="error">{{ error }}</li>
            </ul>
          </div>

          <div v-if="importResult.errors.length === 0 && importResult.success === 0" class="result-info">
            No prescriptions to import
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" @click="handleClose">
          Cancel
        </button>
        <button
          v-if="!showResult || importResult.success === 0"
          type="button"
          class="btn-primary"
          @click="handleImport"
          :disabled="!isValidJson || jsonInput.trim().length === 0"
        >
          Import
        </button>
        <button
          v-if="showResult && importResult.success > 0"
          type="button"
          class="btn-primary"
          data-testid="done-btn"
          @click="handleClose"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-modal {
  background-color: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-text);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--color-background-soft);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.instruction-text {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.format-example {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

.format-example pre {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.json-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  resize: vertical;
}

.json-textarea:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
  border-color: #3b82f6;
}

.import-result {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 4px;
}

.result-success {
  background-color: #f0fdf4;
  border: 1px solid #86efac;
  border-left: 4px solid #22c55e;
  color: #166534;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.result-failed {
  background-color: #fef2f2;
  border: 1px solid #fca5a5;
  border-left: 4px solid #ef4444;
  color: #7f1d1d;
  padding: 0.75rem;
  border-radius: 4px;
}

.result-failed ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
  font-size: 0.875rem;
}

.result-failed li {
  margin-bottom: 0.25rem;
}

.result-info {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #3b82f6;
  color: #1e40af;
  padding: 0.75rem;
  border-radius: 4px;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
}

.btn-secondary,
.btn-primary {
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
}

.btn-secondary {
  background-color: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background-color: var(--color-border);
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  background-color: var(--color-border);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .result-success {
    background-color: #064e3b;
    border-color: #059669;
    color: #d1fae5;
  }

  .result-failed {
    background-color: #450a0a;
    border-color: #991b1b;
    color: #fca5a5;
  }

  .result-info {
    background-color: #0c2d48;
    border-color: #0369a1;
    color: #bfdbfe;
  }
}
</style>
