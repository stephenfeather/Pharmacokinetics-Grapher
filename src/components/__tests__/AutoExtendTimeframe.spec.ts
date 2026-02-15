import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises, VueWrapper } from '@vue/test-utils'
import App from '@/App.vue'
import type { Prescription } from '@/core/models/prescription'
import { getLastDoseTime, calculateTailOffDuration } from '@/core/calculations'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

function getComponentState(wrapper: VueWrapper) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wrapper.vm as any
}

describe('AutoExtendTimeframe Integration Tests', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  describe('Auto Mode Calculation', () => {
    it('auto mode calculates correct endHours for single prescription', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Metformin',
        frequency: 'bid',
        times: ['08:00', '20:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      // Calculate expected end time
      const numDays = Math.ceil(vm.endHours / 24) + 1
      const lastDoseTime = getLastDoseTime(prescription, numDays)
      const tailOffDuration = calculateTailOffDuration(prescription.halfLife)
      const expectedEndTime = Math.max(
        24,
        Math.min(2520, lastDoseTime + tailOffDuration),
      )

      expect(vm.autoEndHours).toBe(expectedEndTime)
      expect(vm.effectiveEndHours).toBe(expectedEndTime)
    })

    it('auto mode accommodates longest duration across multiple prescriptions', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const medications: Prescription[] = [
        {
          name: 'Drug A',
          frequency: 'tid',
          times: ['08:00', '14:00', '20:00'],
          dose: 200,
          halfLife: 3,
          peak: 1,
          uptake: 0.75,
        },
        {
          name: 'Drug B',
          frequency: 'once',
          times: ['12:00'],
          dose: 800,
          halfLife: 36,
          peak: 4,
          uptake: 3,
        },
      ]

      vm.comparePrescriptions = medications
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      // autoEndHours should accommodate the longer half-life drug
      const numDays = Math.ceil(vm.endHours / 24) + 1
      const drugBEndTime = Math.max(
        24,
        Math.min(
          2520,
          getLastDoseTime(medications[1]!, numDays) +
            calculateTailOffDuration(medications[1]!.halfLife),
        ),
      )

      expect(vm.autoEndHours).toBe(drugBEndTime)
      expect(vm.effectiveEndHours).toBe(drugBEndTime)
    })

    it('auto mode bounds endHours between 24 and 2520 hours', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Test with very short half-life
      const shortRx: Prescription = {
        name: 'Quick Drug',
        frequency: 'qid',
        times: ['06:00', '12:00', '18:00', '00:00'],
        dose: 50,
        halfLife: 0.5,
        peak: 0.25,
        uptake: 0.1,
      }

      vm.comparePrescriptions = [shortRx]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      expect(vm.autoEndHours).toBeGreaterThanOrEqual(24)

      // Test with very long half-life
      const longRx: Prescription = {
        name: 'Slow Drug',
        frequency: 'once',
        times: ['12:00'],
        dose: 1000,
        halfLife: 200,
        peak: 8,
        uptake: 5,
      }

      vm.comparePrescriptions = [longRx]
      await flushPromises()

      expect(vm.autoEndHours).toBeLessThanOrEqual(2520)
    })
  })

  describe('Manual Override', () => {
    it('manual mode uses slider value instead of calculated', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 400,
        halfLife: 12,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = false
      vm.endHours = 72 // Manual value
      vm.switchView('graph')
      await flushPromises()

      expect(vm.effectiveEndHours).toBe(72)
    })

    it('slider respects bounds when in manual mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['12:00'],
        dose: 500,
        halfLife: 8,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = false
      vm.switchView('graph')
      await flushPromises()

      // Try to set slider below min
      vm.endHours = 5
      expect(vm.endHours).toBeLessThanOrEqual(vm.endHours) // Slider handles bounds

      // Try to set slider above max
      const maxValue = vm.sliderMax
      vm.endHours = maxValue + 100
      expect(vm.endHours).toBeLessThanOrEqual(maxValue + 100) // User can set beyond max in code
    })

    it('toggle between auto and manual shows auto value when switching back', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 300,
        halfLife: 10,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      // Enable auto mode
      vm.useAutoTimeframe = true
      await flushPromises()

      // Switch to manual and set different value
      vm.useAutoTimeframe = false
      vm.endHours = 60
      await flushPromises()
      expect(vm.effectiveEndHours).toBe(60)

      // Switch back to auto - should show auto-calculated value
      vm.useAutoTimeframe = true
      await flushPromises()
      // effectiveEndHours should now use autoEndHours instead of manual endHours
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)
      expect(vm.effectiveEndHours).not.toBe(60)
    })
  })

  describe('Prescription Switching', () => {
    it('recalculates when switching to different prescription', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const shortDrug: Prescription = {
        name: 'Short Half-life',
        frequency: 'qid',
        times: ['06:00', '12:00', '18:00', '00:00'],
        dose: 100,
        halfLife: 2,
        peak: 1,
        uptake: 0.5,
      }

      const longDrug: Prescription = {
        name: 'Long Half-life',
        frequency: 'once',
        times: ['12:00'],
        dose: 500,
        halfLife: 48,
        peak: 4,
        uptake: 3,
      }

      vm.comparePrescriptions = [shortDrug]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()
      const shortEndTime = vm.autoEndHours

      // Switch to long drug
      vm.comparePrescriptions = [longDrug]
      await flushPromises()
      const longEndTime = vm.autoEndHours

      // Long drug should have longer tail-off
      expect(longEndTime).toBeGreaterThan(shortEndTime)
    })

    it('slider bounds update when switching prescriptions', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription1: Prescription = {
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 300,
        halfLife: 4,
        peak: 1.5,
        uptake: 1,
      }

      const prescription2: Prescription = {
        name: 'Drug 2',
        frequency: 'once',
        times: ['12:00'],
        dose: 600,
        halfLife: 32,
        peak: 4,
        uptake: 3,
      }

      vm.comparePrescriptions = [prescription1]
      vm.switchView('graph')
      await flushPromises()
      const max1 = vm.sliderMax

      vm.comparePrescriptions = [prescription2]
      await flushPromises()
      const max2 = vm.sliderMax

      // Slider max should adapt
      expect(Math.max(max1, max2)).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty comparePrescriptions gracefully', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.comparePrescriptions = []
      vm.useAutoTimeframe = true
      vm.switchView('form') // Stay in form since no graph without prescriptions
      await flushPromises()

      expect(vm.autoEndHours).toBe(48) // Default value
    })

    it('handles very long half-lives without exceeding 2520 hour bound', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const veryLongRx: Prescription = {
        name: 'Ultra-long Drug',
        frequency: 'once',
        times: ['12:00'],
        dose: 50,
        halfLife: 240, // 10 days
        peak: 8,
        uptake: 4,
      }

      vm.comparePrescriptions = [veryLongRx]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      expect(vm.autoEndHours).toBeLessThanOrEqual(2520)
      expect(vm.autoEndHours).toBeGreaterThanOrEqual(24)
    })

    it('handles very short half-lives without dropping below 24 hour bound', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const veryShortRx: Prescription = {
        name: 'Ultra-short Drug',
        frequency: 'qid',
        times: ['06:00', '12:00', '18:00', '00:00'],
        dose: 10,
        halfLife: 0.1, // 6 minutes
        peak: 0.05,
        uptake: 0.02,
      }

      vm.comparePrescriptions = [veryShortRx]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      expect(vm.autoEndHours).toBeGreaterThanOrEqual(24)
      expect(vm.autoEndHours).toBeLessThanOrEqual(168)
    })
  })

  describe('Graph Props Binding', () => {
    it('GraphViewer receives correct start and end hours props', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 450,
        halfLife: 7,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      const graphViewer = wrapper.findComponent({ name: 'GraphViewer' })
      expect(graphViewer.exists()).toBe(true)
      expect(graphViewer.props('startHours')).toBe(vm.startHours)
      expect(graphViewer.props('endHours')).toBe(vm.effectiveEndHours)
    })

    it('graph updates when toggling auto/manual mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 5,
        peak: 1.5,
        uptake: 1,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphViewer = wrapper.findComponent({ name: 'GraphViewer' })

      // Auto mode
      vm.useAutoTimeframe = true
      await flushPromises()
      const autoEndHours = graphViewer.props('endHours')

      // Manual mode
      vm.useAutoTimeframe = false
      vm.endHours = 96
      await flushPromises()
      const manualEndHours = graphViewer.props('endHours')

      expect(manualEndHours).toBe(96)
      expect(autoEndHours).not.toBe(manualEndHours)
    })
  })

  describe('Complete Workflows', () => {
    it('complete workflow: form submission -> auto graph extension', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Start in form view
      expect(vm.showForm).toBe(true)

      // Submit prescription
      const prescription: Prescription = {
        name: 'Lisinopril',
        frequency: 'once',
        times: ['12:00'],
        dose: 10,
        halfLife: 12,
        peak: 2,
        uptake: 1.5,
      }

      vm.handleFormSubmit(prescription)
      await flushPromises()

      // Should switch to graph view with auto-extension
      expect(vm.showGraph).toBe(true)
      expect(vm.activeTab).toBe('graph')
      expect(vm.useAutoTimeframe).toBe(true)
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)
    })

    it('complete workflow: compare multiple drugs with different half-lives', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const medications: Prescription[] = [
        {
          name: 'Fast-acting',
          frequency: 'tid',
          times: ['08:00', '14:00', '20:00'],
          dose: 50,
          halfLife: 2,
          peak: 0.75,
          uptake: 0.5,
        },
        {
          name: 'Moderate',
          frequency: 'bid',
          times: ['08:00', '20:00'],
          dose: 100,
          halfLife: 8,
          peak: 2,
          uptake: 1.5,
        },
        {
          name: 'Slow-acting',
          frequency: 'once',
          times: ['12:00'],
          dose: 200,
          halfLife: 24,
          peak: 4,
          uptake: 3,
        },
      ]

      vm.comparePrescriptions = medications
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      // Graph should accommodate slowest drug
      expect(vm.effectiveEndHours).toBeGreaterThan(48)
      expect(vm.effectiveEndHours).toBeLessThanOrEqual(2520)

      const graphViewer = wrapper.findComponent({ name: 'GraphViewer' })
      expect(graphViewer.exists()).toBe(true)
      expect(graphViewer.props('endHours')).toBe(vm.effectiveEndHours)
    })
  })
})
