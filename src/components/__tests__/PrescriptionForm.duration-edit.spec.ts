import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PrescriptionForm from '../PrescriptionForm.vue'
import type { Prescription } from '@/core/models/prescription'
import { BID_MULTI_DOSE_FIXTURE } from '@/core/models/__tests__/fixtures'

describe('PrescriptionForm - Duration Edit Bug Reproduction', () => {
  it('should update form when initial prop changes (duration field)', async () => {
    const fixture1: Prescription = {
      ...BID_MULTI_DOSE_FIXTURE,
      duration: 10,
      durationUnit: 'days',
    }

    const fixture2: Prescription = {
      ...BID_MULTI_DOSE_FIXTURE,
      id: 'rx-2',
      name: 'Different Drug',
      duration: 20,
      durationUnit: 'hours',
    }

    // Mount with first prescription
    const wrapper = mount(PrescriptionForm, { props: { initial: fixture1 } })
    await nextTick()

    // Verify form loaded with first prescription's duration
    const durationInput = wrapper.find('input#rx-duration')
    expect((durationInput.element as HTMLInputElement).value).toBe('10')
    const unitSelect = wrapper.find('select#rx-duration-unit')
    expect((unitSelect.element as HTMLSelectElement).value).toBe('days')

    // Now update the initial prop to a different prescription
    await wrapper.setProps({ initial: fixture2 })
    await nextTick()

    // Form should now show the second prescription's duration values
    expect((durationInput.element as HTMLInputElement).value).toBe('20')
    expect((unitSelect.element as HTMLSelectElement).value).toBe('hours')
  })

  it('should submit new duration values even after prop changes', async () => {
    const fixture1: Prescription = {
      ...BID_MULTI_DOSE_FIXTURE,
      duration: 10,
      durationUnit: 'days',
    }

    const fixture2: Prescription = {
      ...BID_MULTI_DOSE_FIXTURE,
      id: 'rx-2',
      duration: 20,
      durationUnit: 'hours',
    }

    const wrapper = mount(PrescriptionForm, { props: { initial: fixture1 } })
    await nextTick()

    // Update prop to second prescription
    await wrapper.setProps({ initial: fixture2 })
    await nextTick()

    // User changes duration value
    await wrapper.find('input#rx-duration').setValue(25)
    await nextTick()

    // Submit and verify emitted prescription has the new duration
    await wrapper.find('form').trigger('submit')
    await nextTick()

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const prescription = (emitted?.[0]?.[0]) as Record<string, unknown>
    expect(prescription.duration).toBe(25)
    expect(prescription.durationUnit).toBe('hours')
  })
})
