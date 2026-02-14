import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImportPrescriptions from '../ImportPrescriptions.vue'
import type { Prescription } from '@/core/models/prescription'

// Mock storage module
vi.mock('@/core/storage/prescriptionStorage', () => ({
  savePrescription: vi.fn((rx: Prescription) => ({ ...rx, id: `rx-mock-${Date.now()}` })),
  getAllPrescriptions: vi.fn(() => []),
}))

import { savePrescription } from '@/core/storage/prescriptionStorage'

const mockSave = vi.mocked(savePrescription)

// Valid prescription JSON for import testing
const VALID_PRESCRIPTION: Prescription = {
  name: 'Test Import Drug',
  frequency: 'bid',
  times: ['09:00', '21:00'],
  dose: 500,
  halfLife: 6,
  peak: 2,
  uptake: 1.5,
}

const VALID_JSON_ARRAY = JSON.stringify([VALID_PRESCRIPTION])

const VALID_JSON_OBJECT = JSON.stringify({
  prescriptions: [VALID_PRESCRIPTION],
})

const MULTI_PRESCRIPTION_JSON = JSON.stringify([
  VALID_PRESCRIPTION,
  {
    name: 'Second Drug',
    frequency: 'tid',
    times: ['08:00', '14:00', '20:00'],
    dose: 400,
    halfLife: 2,
    peak: 1.5,
    uptake: 0.5,
  },
])

const INVALID_JSON = 'this is not json {'

const INVALID_PRESCRIPTION_JSON = JSON.stringify([
  {
    name: '', // Invalid: empty name
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 500,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
  },
])

function mountImport() {
  return mount(ImportPrescriptions)
}

describe('ImportPrescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders modal overlay and content', () => {
      const wrapper = mountImport()
      expect(wrapper.find('.import-modal-overlay').exists()).toBe(true)
      expect(wrapper.find('.import-modal').exists()).toBe(true)
    })

    it('renders header with title and close button', () => {
      const wrapper = mountImport()
      expect(wrapper.find('.modal-header h2').text()).toBe('Import Prescriptions')
      expect(wrapper.find('.close-btn').exists()).toBe(true)
    })

    it('renders textarea for JSON input', () => {
      const wrapper = mountImport()
      expect(wrapper.find('.json-textarea').exists()).toBe(true)
    })

    it('renders Import button (initially disabled)', () => {
      const wrapper = mountImport()
      const importBtn = wrapper.find('.btn-primary')
      expect(importBtn.exists()).toBe(true)
      expect(importBtn.text()).toBe('Import')
      expect(importBtn.attributes('disabled')).toBeDefined()
    })

    it('renders Cancel button', () => {
      const wrapper = mountImport()
      const cancelBtn = wrapper.find('.btn-secondary')
      expect(cancelBtn.exists()).toBe(true)
      expect(cancelBtn.text()).toBe('Cancel')
    })

    it('renders format example', () => {
      const wrapper = mountImport()
      expect(wrapper.find('.format-example').exists()).toBe(true)
    })
  })

  describe('JSON validation', () => {
    it('enables Import button when valid JSON is entered', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      const importBtn = wrapper.find('.btn-primary')
      expect(importBtn.attributes('disabled')).toBeUndefined()
    })

    it('keeps Import button disabled for invalid JSON', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_JSON)
      await nextTick()
      const importBtn = wrapper.find('.btn-primary')
      expect(importBtn.attributes('disabled')).toBeDefined()
    })

    it('keeps Import button disabled for empty input', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue('')
      await nextTick()
      const importBtn = wrapper.find('.btn-primary')
      expect(importBtn.attributes('disabled')).toBeDefined()
    })

    it('keeps Import button disabled for whitespace-only input', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue('   ')
      await nextTick()
      const importBtn = wrapper.find('.btn-primary')
      expect(importBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('successful import', () => {
    it('saves valid prescriptions to localStorage via savePrescription', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).toHaveBeenCalledTimes(1)
      expect(mockSave).toHaveBeenCalledWith(VALID_PRESCRIPTION)
    })

    it('handles JSON object with prescriptions array', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_OBJECT)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('saves multiple prescriptions', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).toHaveBeenCalledTimes(2)
    })

    it('shows success message after import', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const successMsg = wrapper.find('.result-success')
      expect(successMsg.exists()).toBe(true)
      expect(successMsg.text()).toContain('1 prescription')
    })

    it('shows success count for multiple prescriptions', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const successMsg = wrapper.find('.result-success')
      expect(successMsg.exists()).toBe(true)
      expect(successMsg.text()).toContain('2 prescription')
    })

    it('emits imported event with count after successful import', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted![0]).toEqual([1])
    })

    it('emits imported event with correct count for multiple prescriptions', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted![0]).toEqual([2])
    })
  })

  describe('import feedback timing', () => {
    it('shows result feedback and a Done button after successful import', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // After import, user should see the success message
      expect(wrapper.find('.result-success').exists()).toBe(true)

      // There should be a Done button to close the modal after reviewing feedback
      const doneBtn = wrapper.find('[data-testid="done-btn"]')
      expect(doneBtn.exists()).toBe(true)
      expect(doneBtn.text()).toBe('Done')
    })

    it('Import button is hidden after successful import (replaced by Done)', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Import button should be hidden after import
      const importBtn = wrapper.find('.btn-primary:not([data-testid="done-btn"])')
      expect(importBtn.exists()).toBe(false)
    })

    it('Done button emits close event when clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const doneBtn = wrapper.find('[data-testid="done-btn"]')
      await doneBtn.trigger('click')

      const closeEmitted = wrapper.emitted('close')
      expect(closeEmitted).toBeTruthy()
    })
  })

  describe('invalid JSON handling', () => {
    it('shows error for invalid JSON', async () => {
      // Force the button to be clickable by using valid-then-invalid approach
      const wrapper = mountImport()
      // We need to manually trigger import with invalid JSON
      // Since the button is disabled for invalid JSON, we test the error path
      // by providing syntactically valid JSON that has no prescriptions array
      const notAnArray = JSON.stringify({ foo: 'bar' })
      await wrapper.find('.json-textarea').setValue(notAnArray)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Should show info message about no prescriptions
      const resultInfo = wrapper.find('.result-info')
      expect(resultInfo.exists()).toBe(true)
    })

    it('shows validation errors for invalid prescription data', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const failedMsg = wrapper.find('.result-failed')
      expect(failedMsg.exists()).toBe(true)
      expect(failedMsg.text()).toContain('Failed')
    })

    it('does not emit imported event when all prescriptions fail', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeUndefined()
    })

    it('does not call savePrescription for invalid prescriptions', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).not.toHaveBeenCalled()
    })
  })

  describe('close behavior', () => {
    it('emits close event when Cancel button is clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.btn-secondary').trigger('click')
      const emitted = wrapper.emitted('close')
      expect(emitted).toBeTruthy()
    })

    it('emits close event when close button (X) is clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.close-btn').trigger('click')
      const emitted = wrapper.emitted('close')
      expect(emitted).toBeTruthy()
    })

    it('emits close event when overlay is clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.import-modal-overlay').trigger('click')
      const emitted = wrapper.emitted('close')
      expect(emitted).toBeTruthy()
    })
  })

  describe('event chain propagation (regression)', () => {
    // These tests verify the event chain:
    // ImportPrescriptions emits 'imported' -> PrescriptionForm re-emits 'imported' -> App.vue handles it

    it('ImportPrescriptions emits imported event with correct payload', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted!.length).toBe(1)
      expect(emitted![0]![0]).toBe(1) // count of imported prescriptions
    })

    it('imported event includes count matching saved prescriptions', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_PRESCRIPTION_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      const importCount = emitted![0]![0] as number
      expect(importCount).toBe(2)
      // The count should match the number of savePrescription calls
      expect(mockSave).toHaveBeenCalledTimes(importCount)
    })
  })

  describe('mixed valid and invalid prescriptions', () => {
    it('saves valid prescriptions and reports errors for invalid ones', async () => {
      const mixedJson = JSON.stringify([
        VALID_PRESCRIPTION,
        {
          name: '', // Invalid: empty name
          frequency: 'bid',
          times: ['09:00', '21:00'],
          dose: 500,
          halfLife: 6,
          peak: 2,
          uptake: 1.5,
        },
      ])

      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(mixedJson)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      // Should save the valid one
      expect(mockSave).toHaveBeenCalledTimes(1)

      // Should show both success and failure
      expect(wrapper.find('.result-success').exists()).toBe(true)
      expect(wrapper.find('.result-failed').exists()).toBe(true)

      // Should emit imported with count of 1 (only the valid one)
      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted![0]).toEqual([1])
    })
  })
})
