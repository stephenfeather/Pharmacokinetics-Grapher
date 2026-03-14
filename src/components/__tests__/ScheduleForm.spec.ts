import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ScheduleForm from '../ScheduleForm.vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import type { Prescription } from '@/core/models/prescription'
import { SCHEDULE_PRESETS } from '@/core/data/schedulePresets'

function makeBasePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 25,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
    ...overrides,
  }
}

function makeSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
  return {
    id: 'sched-1',
    name: 'Test Titration',
    direction: 'titration',
    basePrescription: makeBasePrescription(),
    steps: [
      { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
    ],
    totalDuration: 14,
    ...overrides,
  }
}

function mountForm(props: { initial?: DosageSchedule } = {}) {
  return mount(ScheduleForm, { props })
}

describe('ScheduleForm', () => {
  describe('rendering', () => {
    it('renders the form', () => {
      const wrapper = mountForm()
      expect(wrapper.find('form').exists()).toBe(true)
    })

    it('renders schedule name input', () => {
      const wrapper = mountForm()
      expect(wrapper.find('input#sched-name').exists()).toBe(true)
    })

    it('renders direction radio buttons', () => {
      const wrapper = mountForm()
      const radios = wrapper.findAll('input[name="direction"]')
      expect(radios).toHaveLength(2)
    })

    it('renders frequency select with all options', () => {
      const wrapper = mountForm()
      const options = wrapper.findAll('select#sched-frequency option')
      expect(options).toHaveLength(10)
    })

    it('renders drug parameter inputs', () => {
      const wrapper = mountForm()
      expect(wrapper.find('input#sched-halflife').exists()).toBe(true)
      expect(wrapper.find('input#sched-peak').exists()).toBe(true)
      expect(wrapper.find('input#sched-uptake').exists()).toBe(true)
    })

    it('renders at least 2 step rows by default', () => {
      const wrapper = mountForm()
      const stepRows = wrapper.findAll('.step-row')
      expect(stepRows.length).toBeGreaterThanOrEqual(2)
    })

    it('renders add step button', () => {
      const wrapper = mountForm()
      expect(wrapper.find('.add-step-btn').exists()).toBe(true)
    })

    it('renders submit button', () => {
      const wrapper = mountForm()
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    })

    it('renders step preview', () => {
      const wrapper = mountForm()
      expect(wrapper.find('.step-preview').exists()).toBe(true)
    })
  })

  describe('default values', () => {
    it('defaults to titration direction', () => {
      const wrapper = mountForm()
      const titrationRadio = wrapper.find('input[value="titration"]')
      expect((titrationRadio.element as HTMLInputElement).checked).toBe(true)
    })

    it('defaults to bid frequency', () => {
      const wrapper = mountForm()
      const select = wrapper.find('select#sched-frequency')
      expect((select.element as HTMLSelectElement).value).toBe('bid')
    })
  })

  describe('step management', () => {
    it('adds a step when add button clicked', async () => {
      const wrapper = mountForm()
      const initialSteps = wrapper.findAll('.step-row').length
      await wrapper.find('.add-step-btn').trigger('click')
      await nextTick()
      const newSteps = wrapper.findAll('.step-row').length
      expect(newSteps).toBe(initialSteps + 1)
    })

    it('removes a step when remove button clicked', async () => {
      const wrapper = mountForm()
      // Add a third step first
      await wrapper.find('.add-step-btn').trigger('click')
      await nextTick()
      const stepsAfterAdd = wrapper.findAll('.step-row').length
      expect(stepsAfterAdd).toBe(3)

      // Remove last step
      const removeButtons = wrapper.findAll('.remove-step-btn')
      const lastEnabled = removeButtons.filter(b => !(b.element as HTMLButtonElement).disabled)
      await lastEnabled[lastEnabled.length - 1]!.trigger('click')
      await nextTick()
      expect(wrapper.findAll('.step-row').length).toBe(2)
    })

    it('disables remove buttons when only 2 steps remain', () => {
      const wrapper = mountForm()
      const removeButtons = wrapper.findAll('.remove-step-btn')
      for (const btn of removeButtons) {
        expect((btn.element as HTMLButtonElement).disabled).toBe(true)
      }
    })
  })

  describe('form submission', () => {
    it('emits submit with schedule data on valid form', async () => {
      const wrapper = mountForm()
      await wrapper.find('form').trigger('submit')
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      expect(emitted!).toHaveLength(1)

      const schedule = emitted![0]![0] as DosageSchedule
      expect(schedule.name).toBe('New Schedule')
      expect(schedule.direction).toBe('titration')
      expect(schedule.steps).toHaveLength(2)
      expect(schedule.basePrescription).toBeDefined()
    })

    it('does not emit submit when form is invalid', async () => {
      const wrapper = mountForm()
      // Clear name to make form invalid
      await wrapper.find('input#sched-name').setValue('')
      await nextTick()
      await wrapper.find('form').trigger('submit')
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeUndefined()
    })

    it('disables submit button when form is invalid', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#sched-name').setValue('')
      await nextTick()
      const submitBtn = wrapper.find('button[type="submit"]')
      expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  describe('edit mode (initial prop)', () => {
    it('populates form from initial schedule', () => {
      const schedule = makeSchedule({ name: 'Existing Schedule' })
      const wrapper = mountForm({ initial: schedule })
      expect((wrapper.find('input#sched-name').element as HTMLInputElement).value).toBe('Existing Schedule')
    })

    it('populates steps from initial schedule', () => {
      const schedule = makeSchedule()
      const wrapper = mountForm({ initial: schedule })
      const stepRows = wrapper.findAll('.step-row')
      expect(stepRows).toHaveLength(2)
    })

    it('sets direction from initial schedule', () => {
      const schedule = makeSchedule({ direction: 'taper' })
      const wrapper = mountForm({ initial: schedule })
      const taperRadio = wrapper.find('input[value="taper"]')
      expect((taperRadio.element as HTMLInputElement).checked).toBe(true)
    })
  })

  describe('validation display', () => {
    it('shows validation errors for invalid form', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#sched-name').setValue('')
      await nextTick()
      expect(wrapper.find('.validation-errors').exists()).toBe(true)
    })

    it('shows warnings for non-monotonic titration', async () => {
      const schedule = makeSchedule({
        direction: 'titration',
        steps: [
          { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
        ],
      })
      const wrapper = mountForm({ initial: schedule })
      await nextTick()
      expect(wrapper.find('.validation-warnings').exists()).toBe(true)
    })
  })

  describe('preset selector', () => {
    it('renders preset dropdown', () => {
      const wrapper = mountForm()
      expect(wrapper.find('select#sched-preset').exists()).toBe(true)
    })

    it('renders all presets as options plus "Start from scratch"', () => {
      const wrapper = mountForm()
      const options = wrapper.findAll('select#sched-preset option')
      expect(options).toHaveLength(SCHEDULE_PRESETS.length + 1)
    })

    it('renders load button', () => {
      const wrapper = mountForm()
      expect(wrapper.find('.load-preset-btn').exists()).toBe(true)
    })

    it('disables load button when no preset selected', () => {
      const wrapper = mountForm()
      const btn = wrapper.find('.load-preset-btn')
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('enables load button when a preset is selected', async () => {
      const wrapper = mountForm()
      const select = wrapper.find('select#sched-preset')
      await select.setValue(SCHEDULE_PRESETS[0]!.id)
      await nextTick()
      const btn = wrapper.find('.load-preset-btn')
      expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('populates form when preset is loaded', async () => {
      const wrapper = mountForm()
      const preset = SCHEDULE_PRESETS[0]!

      await wrapper.find('select#sched-preset').setValue(preset.id)
      await nextTick()
      await wrapper.find('.load-preset-btn').trigger('click')
      await nextTick()

      expect((wrapper.find('input#sched-name').element as HTMLInputElement).value).toBe(preset.schedule.name)
      const stepRows = wrapper.findAll('.step-row')
      expect(stepRows).toHaveLength(preset.schedule.steps.length)
    })

    it('resets preset selector after loading', async () => {
      const wrapper = mountForm()
      const preset = SCHEDULE_PRESETS[0]!

      await wrapper.find('select#sched-preset').setValue(preset.id)
      await nextTick()
      await wrapper.find('.load-preset-btn').trigger('click')
      await nextTick()

      expect((wrapper.find('select#sched-preset').element as HTMLSelectElement).value).toBe('')
    })

    it('"Start from scratch" does not change form when load clicked', async () => {
      const wrapper = mountForm()
      const nameBefore = (wrapper.find('input#sched-name').element as HTMLInputElement).value

      // selectedPresetId is already '' (Start from scratch), click load
      await wrapper.find('.load-preset-btn').trigger('click')
      await nextTick()

      expect((wrapper.find('input#sched-name').element as HTMLInputElement).value).toBe(nameBefore)
    })
  })

  describe('step preview', () => {
    it('shows dose amounts in preview', () => {
      const wrapper = mountForm()
      const preview = wrapper.find('.step-preview')
      expect(preview.text()).toContain('25mg')
      expect(preview.text()).toContain('50mg')
    })

    it('shows total duration in preview', () => {
      const wrapper = mountForm()
      const preview = wrapper.find('.step-preview')
      expect(preview.text()).toContain('14 days')
    })
  })
})
