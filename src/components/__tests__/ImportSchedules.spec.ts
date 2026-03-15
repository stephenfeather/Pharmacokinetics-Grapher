import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImportSchedules from '../ImportSchedules.vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import type { Prescription } from '@/core/models/prescription'

// Mock storage module
vi.mock('@/core/storage/scheduleStorage', () => ({
  getAllSchedules: vi.fn(() => []),
  saveSchedule: vi.fn((s: DosageSchedule) => ({ ...s, id: `sched-mock-${Date.now()}` })),
  updateSchedule: vi.fn(() => true),
  deleteSchedule: vi.fn(() => true),
  duplicateSchedule: vi.fn(),
  exportSchedulesAsJson: vi.fn(() => '[]'),
  clearAllSchedules: vi.fn(),
}))

import { saveSchedule } from '@/core/storage/scheduleStorage'

const mockSave = vi.mocked(saveSchedule)

function makeBasePrescription(): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 25,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
  }
}

const VALID_SCHEDULE: DosageSchedule = {
  name: 'Test Titration',
  direction: 'titration',
  basePrescription: makeBasePrescription(),
  steps: [
    { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
    { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
  ],
  totalDuration: 14,
}

const VALID_JSON_ARRAY = JSON.stringify([VALID_SCHEDULE])

const MULTI_SCHEDULE_JSON = JSON.stringify([
  VALID_SCHEDULE,
  {
    ...VALID_SCHEDULE,
    name: 'Second Schedule',
    direction: 'taper',
    steps: [
      { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
    ],
  },
])

const INVALID_JSON = 'this is not json {'

const INVALID_SCHEDULE_JSON = JSON.stringify([
  {
    name: '', // Invalid: empty name
    direction: 'titration',
    basePrescription: makeBasePrescription(),
    steps: [
      { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
    ],
    totalDuration: 14,
  },
])

function mountImport() {
  return mount(ImportSchedules)
}

describe('ImportSchedules', () => {
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
      expect(wrapper.find('.modal-header h2').text()).toBe('Import Schedules')
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
  })

  describe('successful import', () => {
    it('saves valid schedules via saveSchedule', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).toHaveBeenCalledTimes(1)
    })

    it('saves multiple schedules', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_SCHEDULE_JSON)
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
      expect(successMsg.text()).toContain('1 schedule')
    })

    it('emits imported event with count', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(MULTI_SCHEDULE_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted![0]).toEqual([2])
    })

    it('shows Done button after successful import', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(VALID_JSON_ARRAY)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const doneBtn = wrapper.find('[data-testid="done-btn"]')
      expect(doneBtn.exists()).toBe(true)
    })
  })

  describe('invalid schedule handling', () => {
    it('shows validation errors for invalid schedules', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_SCHEDULE_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      const failedMsg = wrapper.find('.result-failed')
      expect(failedMsg.exists()).toBe(true)
    })

    it('does not emit imported when all schedules fail', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_SCHEDULE_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(wrapper.emitted('imported')).toBeUndefined()
    })

    it('does not call saveSchedule for invalid schedules', async () => {
      const wrapper = mountImport()
      await wrapper.find('.json-textarea').setValue(INVALID_SCHEDULE_JSON)
      await nextTick()
      await wrapper.find('.btn-primary').trigger('click')
      await nextTick()

      expect(mockSave).not.toHaveBeenCalled()
    })
  })

  describe('close behavior', () => {
    it('emits close when Cancel clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.btn-secondary').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when X button clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when overlay clicked', async () => {
      const wrapper = mountImport()
      await wrapper.find('.import-modal-overlay').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })
})
