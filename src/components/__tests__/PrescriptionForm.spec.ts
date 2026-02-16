import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PrescriptionForm from '../PrescriptionForm.vue'
import type { Prescription } from '@/core/models/prescription'
import {
  SINGLE_DOSE_FIXTURE,
  BID_MULTI_DOSE_FIXTURE,
  IBUPROFEN_FIXTURE,
  KA_APPROX_KE_FIXTURE,
} from '@/core/models/__tests__/fixtures'

function mountForm(props: { initial?: Prescription } = {}) {
  return mount(PrescriptionForm, { props })
}

describe('PrescriptionForm', () => {
  describe('rendering', () => {
    it('renders all required form fields', () => {
      const wrapper = mountForm()
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.find('input#rx-name').exists()).toBe(true)
      expect(wrapper.find('select#rx-frequency').exists()).toBe(true)
      expect(wrapper.find('input#rx-dose').exists()).toBe(true)
      expect(wrapper.find('input#rx-halflife').exists()).toBe(true)
      expect(wrapper.find('input#rx-peak').exists()).toBe(true)
      expect(wrapper.find('input#rx-uptake').exists()).toBe(true)
      expect(wrapper.find('input#rx-metabolite').exists()).toBe(true)
    })

    it('renders frequency select with all 8 options', () => {
      const wrapper = mountForm()
      const options = wrapper.findAll('select#rx-frequency option')
      expect(options).toHaveLength(8)
      const values = options.map((opt) => opt.attributes('value'))
      expect(values).toEqual([
        'once',
        'bid',
        'tid',
        'qid',
        'q6h',
        'q8h',
        'q12h',
        'custom',
      ])
    })

    it('renders number inputs with correct min/max/step attributes', () => {
      const wrapper = mountForm()

      const dose = wrapper.find('input#rx-dose')
      expect(dose.attributes('min')).toBe('0.001')
      expect(dose.attributes('max')).toBe('10000')
      expect(dose.attributes('step')).toBe('0.001')

      const halfLife = wrapper.find('input#rx-halflife')
      expect(halfLife.attributes('min')).toBe('0.1')
      expect(halfLife.attributes('max')).toBe('240')

      const peak = wrapper.find('input#rx-peak')
      expect(peak.attributes('min')).toBe('0.1')
      expect(peak.attributes('max')).toBe('48')
      expect(peak.attributes('step')).toBe('0.01')

      const uptake = wrapper.find('input#rx-uptake')
      expect(uptake.attributes('min')).toBe('0.1')
      expect(uptake.attributes('max')).toBe('24')
    })

    it('renders educational disclaimer text', () => {
      const wrapper = mountForm()
      const disclaimer = wrapper.find('.educational-disclaimer')
      expect(disclaimer.exists()).toBe(true)
      expect(disclaimer.text()).toContain('Educational Use Only')
      expect(disclaimer.text()).toContain('visualization')
    })

    it('renders submit button', () => {
      const wrapper = mountForm()
      const button = wrapper.find('button[type="submit"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Generate Graph')
    })

    it('all inputs have associated labels', () => {
      const wrapper = mountForm()
      const labels = wrapper.findAll('label')
      const inputIds = [
        'rx-name',
        'rx-frequency',
        'rx-dose',
        'rx-halflife',
        'rx-peak',
        'rx-uptake',
        'rx-metabolite',
      ]
      const labelFors = labels.map((l) => l.attributes('for'))
      inputIds.forEach((id) => {
        expect(labelFors).toContain(id)
      })
    })

    it('renders hint text for numeric fields', () => {
      const wrapper = mountForm()
      const hints = wrapper.findAll('.field-hint')
      expect(hints.length).toBeGreaterThan(0)
      const hintTexts = hints.map((h) => h.text())
      expect(hintTexts.some((t) => t.includes('Range'))).toBe(true)
    })
  })

  describe('initial prop', () => {
    it('populates form fields from initial prop', () => {
      const wrapper = mountForm({ initial: BID_MULTI_DOSE_FIXTURE })
      expect((wrapper.find('input#rx-name').element as HTMLInputElement).value).toBe(
        'Test Drug B',
      )
      expect((wrapper.find('select#rx-frequency').element as HTMLSelectElement).value).toBe(
        'bid',
      )
      expect((wrapper.find('input#rx-dose').element as HTMLInputElement).value).toBe('500')
      expect((wrapper.find('input#rx-halflife').element as HTMLInputElement).value).toBe('6')
    })

    it('renders correct number of time inputs matching initial frequency', () => {
      const wrapper = mountForm({ initial: IBUPROFEN_FIXTURE })
      // tid should have 3 times
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(3)
    })

    it('defaults to sensible values when no initial prop provided', () => {
      const wrapper = mountForm()
      const frequencySelect = wrapper.find('select#rx-frequency').element as HTMLSelectElement
      const doseInput = wrapper.find('input#rx-dose').element as HTMLInputElement

      // Should have sensible defaults
      expect(frequencySelect.value).toBe('bid')
      expect(doseInput.value).toBe('500')
    })

    it('preserves initial id for edit mode', () => {
      const prescriptionWithId: Prescription = {
        ...BID_MULTI_DOSE_FIXTURE,
        id: 'rx-12345',
      }
      const wrapper = mountForm({ initial: prescriptionWithId })
      // Verify form loads - the id will be in the emitted event
      expect(wrapper.find('input#rx-name').exists()).toBe(true)
    })
  })

  describe('frequency-times reactivity', () => {
    it('adjusts times to 1 when frequency changes to once', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('once')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(1)
    })

    it('adjusts times to 2 when frequency changes to bid', async () => {
      const wrapper = mountForm({ initial: IBUPROFEN_FIXTURE })
      await wrapper.find('select#rx-frequency').setValue('bid')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(2)
    })

    it('adjusts times to 3 when frequency changes to tid', async () => {
      const wrapper = mountForm({ initial: BID_MULTI_DOSE_FIXTURE })
      await wrapper.find('select#rx-frequency').setValue('tid')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(3)
    })

    it('adjusts times to 4 when frequency changes to qid', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('qid')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(4)
    })

    it('adjusts times to 4 when frequency changes to q6h', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('q6h')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(4)
    })

    it('adjusts times to 3 when frequency changes to q8h', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('q8h')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(3)
    })

    it('adjusts times to 2 when frequency changes to q12h', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('q12h')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(2)
    })

    it('does not change times when frequency changes to custom', async () => {
      const wrapper = mountForm({ initial: IBUPROFEN_FIXTURE })
      const beforeCount = wrapper.findAll('input[type="time"]').length
      await wrapper.find('select#rx-frequency').setValue('custom')
      await nextTick()
      const afterCount = wrapper.findAll('input[type="time"]').length
      expect(afterCount).toBe(beforeCount)
    })

    it('preserves existing time values when shrinking', async () => {
      const wrapper = mountForm({ initial: IBUPROFEN_FIXTURE })
      // tid has 3 times: ['08:00', '14:00', '20:00']
      await wrapper.find('select#rx-frequency').setValue('bid')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(2)
      // First two times should be preserved
      const input0 = timeInputs[0]?.element as HTMLInputElement | undefined
      const input1 = timeInputs[1]?.element as HTMLInputElement | undefined
      expect(input0?.value).toBe('08:00')
      expect(input1?.value).toBe('14:00')
    })

    it('adds default 12:00 when growing', async () => {
      const wrapper = mountForm({ initial: SINGLE_DOSE_FIXTURE })
      // once has 1 time
      await wrapper.find('select#rx-frequency').setValue('tid')
      await nextTick()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs).toHaveLength(3)
      // Original time preserved
      const input0 = timeInputs[0]?.element as HTMLInputElement | undefined
      const input1 = timeInputs[1]?.element as HTMLInputElement | undefined
      const input2 = timeInputs[2]?.element as HTMLInputElement | undefined
      expect(input0?.value).toBe('09:00')
      // New times should be '12:00'
      expect(input1?.value).toBe('12:00')
      expect(input2?.value).toBe('12:00')
    })

    it('shows add/remove buttons only for custom frequency', async () => {
      const wrapper = mountForm()
      // Initially 'bid' - no buttons
      let customControls = wrapper.find('.custom-time-controls')
      expect(customControls.exists()).toBe(false)

      // Switch to custom
      await wrapper.find('select#rx-frequency').setValue('custom')
      await nextTick()
      customControls = wrapper.find('.custom-time-controls')
      expect(customControls.exists()).toBe(true)
      expect(customControls.findAll('button').length).toBe(2)
    })

    it('add button appends a time input', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('custom')
      await nextTick()
      const beforeCount = wrapper.findAll('input[type="time"]').length
      await wrapper.find('.custom-time-controls button:first-child').trigger('click')
      await nextTick()
      const afterCount = wrapper.findAll('input[type="time"]').length
      expect(afterCount).toBe(beforeCount + 1)
    })

    it('remove button removes last time input', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('custom')
      await nextTick()
      const beforeCount = wrapper.findAll('input[type="time"]').length
      const buttons = wrapper.findAll('.custom-time-controls button')
      const removeBtn = buttons[1]
      expect(removeBtn).toBeDefined()
      await removeBtn!.trigger('click')
      await nextTick()
      const afterCount = wrapper.findAll('input[type="time"]').length
      expect(afterCount).toBe(beforeCount - 1)
    })

    it('remove button is disabled when 1 time remains', async () => {
      const wrapper = mountForm()
      await wrapper.find('select#rx-frequency').setValue('custom')
      await nextTick()
      // Reduce to 1 time
      let buttons = wrapper.findAll('.custom-time-controls button')
      let removeBtn = buttons[1]
      while (wrapper.findAll('input[type="time"]').length > 1) {
        expect(removeBtn).toBeDefined()
        await removeBtn!.trigger('click')
        await nextTick()
        buttons = wrapper.findAll('.custom-time-controls button')
        removeBtn = buttons[1]
      }
      expect(removeBtn).toBeDefined()
      expect(removeBtn!.attributes('disabled')).toBeDefined()
    })

    it('time inputs use HTML5 type="time"', () => {
      const wrapper = mountForm()
      const timeInputs = wrapper.findAll('input[type="time"]')
      expect(timeInputs.length).toBeGreaterThan(0)
      timeInputs.forEach((input) => {
        expect(input.attributes('type')).toBe('time')
      })
    })

    it('each time input has unique id and matching label', () => {
      const wrapper = mountForm()
      const timeInputs = wrapper.findAll('input[type="time"]')
      const ids = timeInputs.map((input) => input.attributes('id'))
      // Should be unique
      expect(new Set(ids).size).toBe(ids.length)
      // Each should have a label
      ids.forEach((id) => {
        const label = wrapper.find(`label[for="${id}"]`)
        expect(label.exists()).toBe(true)
      })
    })
  })

  describe('validation display', () => {
    it('shows no errors when form has valid defaults', async () => {
      const wrapper = mountForm()
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.exists()).toBe(false)
    })

    it('shows error when name is cleared', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.exists()).toBe(true)
      expect(errorContainer.text()).toContain('Name')
    })

    it('shows error when dose is set to 0', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-dose').setValue(0)
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.exists()).toBe(true)
    })

    it('shows error when halfLife is set below minimum', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-halflife').setValue(0.05)
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.exists()).toBe(true)
      expect(errorContainer.text()).toContain('Half-life')
    })

    it('shows warning when uptake >= halfLife', async () => {
      const wrapper = mountForm({ initial: KA_APPROX_KE_FIXTURE })
      // This fixture has uptake=4, halfLife=4
      await nextTick()
      const warningContainer = wrapper.find('.validation-warnings')
      expect(warningContainer.exists()).toBe(true)
      expect(warningContainer.text().toLowerCase()).toContain('uptake')
    })

    it('shows multiple errors for multiple invalid fields', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await wrapper.find('input#rx-dose').setValue(-1)
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.exists()).toBe(true)
      const errorItems = errorContainer.findAll('li')
      expect(errorItems.length).toBeGreaterThanOrEqual(2)
    })

    it('error container has role=alert', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await nextTick()
      const errorContainer = wrapper.find('.validation-errors')
      expect(errorContainer.attributes('role')).toBe('alert')
    })

    it('warning container has aria-live=polite', async () => {
      const wrapper = mountForm({ initial: KA_APPROX_KE_FIXTURE })
      await nextTick()
      const warningContainer = wrapper.find('.validation-warnings')
      expect(warningContainer.exists()).toBe(true)
      expect(warningContainer.attributes('aria-live')).toBe('polite')
    })
  })

  describe('submit behavior', () => {
    it('submit button is enabled when form is valid', () => {
      const wrapper = mountForm()
      const button = wrapper.find('button[type="submit"]')
      expect((button.element as HTMLButtonElement).disabled).toBe(false)
    })

    it('submit button is disabled when form has errors', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await nextTick()
      const button = wrapper.find('button[type="submit"]')
      expect(button.attributes('disabled')).toBeDefined()
    })

    it('emits submit event with prescription data on valid submit', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      expect(Array.isArray(emitted) && emitted.length > 0).toBe(true)
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription).toHaveProperty('name')
      expect(prescription).toHaveProperty('frequency')
      expect(prescription).toHaveProperty('times')
      expect(prescription).toHaveProperty('dose')
    })

    it('does not emit submit event when form is invalid', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await nextTick()
      await wrapper.find('form').trigger('submit')
      expect(wrapper.emitted('submit')).toBeUndefined()
    })

    it('emitted prescription matches form field values', async () => {
      const wrapper = mountForm()
      const nameValue = 'Aspirin'
      const doseValue = 325
      await wrapper.find('input#rx-name').setValue(nameValue)
      await wrapper.find('input#rx-dose').setValue(doseValue)
      await nextTick()
      await wrapper.find('form').trigger('submit')
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.name).toBe(nameValue)
      expect(prescription.dose).toBe(doseValue)
    })

    it('emitted prescription excludes metaboliteLife when undefined', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.metaboliteLife).toBeUndefined()
    })

    it('emitted prescription includes metaboliteLife when provided', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('input#rx-metabolite').setValue(12)
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.metaboliteLife).toBe(12)
    })

    it('renders metabolite conversion fraction input field', () => {
      const wrapper = mountForm()
      const input = wrapper.find('input#rx-metabolite-fm')
      expect(input.exists()).toBe(true)
      expect(input.attributes('type')).toBe('number')
      // HTML renders min/max as string; 0.0 or 0 both valid
      expect(['0', '0.0']).toContain(input.attributes('min'))
      expect(['1', '1.0']).toContain(input.attributes('max'))
      expect(input.attributes('step')).toBe('0.01')
    })

    it('emitted prescription excludes metaboliteConversionFraction when undefined', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.metaboliteConversionFraction).toBeUndefined()
    })

    it('emitted prescription includes metaboliteConversionFraction when provided', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('input#rx-metabolite-fm').setValue(0.8)
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      expect(emitted).toBeTruthy()
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.metaboliteConversionFraction).toBe(0.8)
    })

    it('accepts metaboliteConversionFraction value of 0', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('input#rx-metabolite-fm').setValue(0)
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      // Even though fm=0 is unusual, the form should accept it
      expect(prescription.metaboliteConversionFraction).toBe(0)
    })

    it('accepts metaboliteConversionFraction value of 1.0', async () => {
      const wrapper = mountForm()
      await nextTick()
      await wrapper.find('input#rx-metabolite-fm').setValue(1.0)
      await nextTick()
      await wrapper.find('form').trigger('submit')
      await nextTick()
      const emitted = wrapper.emitted('submit')
      const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
      expect(prescription.metaboliteConversionFraction).toBe(1.0)
    })
  })

  describe('import event propagation (regression)', () => {
    it('renders import link button', () => {
      const wrapper = mountForm()
      const importLink = wrapper.find('.import-link')
      expect(importLink.exists()).toBe(true)
      expect(importLink.text()).toContain('import')
    })

    it('shows import modal when import link is clicked', async () => {
      const wrapper = mountForm()
      await wrapper.find('.import-link').trigger('click')
      await nextTick()
      // ImportPrescriptions component should now be visible
      const importModal = wrapper.findComponent({ name: 'ImportPrescriptions' })
      expect(importModal.exists()).toBe(true)
    })

    it('re-emits imported event from ImportPrescriptions upward', async () => {
      const wrapper = mountForm()
      // Open the import modal
      await wrapper.find('.import-link').trigger('click')
      await nextTick()

      // Find the ImportPrescriptions child and simulate it emitting 'imported'
      const importComponent = wrapper.findComponent({ name: 'ImportPrescriptions' })
      expect(importComponent.exists()).toBe(true)
      importComponent.vm.$emit('imported', 3)
      await nextTick()

      // PrescriptionForm should re-emit the 'imported' event upward
      const emitted = wrapper.emitted('imported')
      expect(emitted).toBeTruthy()
      expect(emitted![0]).toEqual([3])
    })

    it('closes import modal after import success', async () => {
      const wrapper = mountForm()
      // Open the import modal
      await wrapper.find('.import-link').trigger('click')
      await nextTick()

      const importComponent = wrapper.findComponent({ name: 'ImportPrescriptions' })
      expect(importComponent.exists()).toBe(true)

      // Simulate close event from ImportPrescriptions
      importComponent.vm.$emit('close')
      await nextTick()

      // Modal should be closed
      const importModal = wrapper.findComponent({ name: 'ImportPrescriptions' })
      expect(importModal.exists()).toBe(false)
    })
  })

  describe('accessibility', () => {
    it('all inputs have matching label elements', () => {
      const wrapper = mountForm()
      const inputs = wrapper.findAll('input, select')
      const inputIds = inputs
        .map((input) => input.attributes('id'))
        .filter((id) => id && !id.startsWith('rx-time-'))
      const labelIds = wrapper.findAll('label').map((label) => label.attributes('for'))
      // Verify all non-time input IDs have matching labels
      inputIds.forEach((id) => {
        expect(labelIds).toContain(id)
      })
    })

    it('submit button has aria-disabled when invalid', async () => {
      const wrapper = mountForm()
      await wrapper.find('input#rx-name').setValue('')
      await nextTick()
      const button = wrapper.find('button[type="submit"]')
      expect(button.attributes('aria-disabled')).toBe('true')
    })

    it('times fieldset has a legend', () => {
      const wrapper = mountForm()
      const fieldset = wrapper.find('fieldset')
      expect(fieldset.exists()).toBe(true)
      const legend = fieldset.find('legend')
      expect(legend.exists()).toBe(true)
      expect(legend.text()).toContain('Time')
    })

    it('numeric inputs have aria-describedby pointing to hint text', () => {
      const wrapper = mountForm()
      const doseInput = wrapper.find('input#rx-dose')
      const describedBy = doseInput.attributes('aria-describedby')
      expect(describedBy).toBeDefined()
      const hint = wrapper.find(`#${describedBy}`)
      expect(hint.exists()).toBe(true)
    })
  })
})
