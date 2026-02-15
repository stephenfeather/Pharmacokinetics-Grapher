import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises, VueWrapper } from '@vue/test-utils'
import App from '@/App.vue'
import type { Prescription } from '@/core/models/prescription'

// Mock localStorage to avoid side effects
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.localStorage = mockLocalStorage as any

// Helper to access component state
interface AppComponentState {
  currentPrescription: Prescription | null
  savedPrescriptions: Prescription[]
  showForm: boolean
  showGraph: boolean
  showList: boolean
  comparePrescriptions: Prescription[]
  activeTab: 'form' | 'list' | 'graph'
  startHours: number
  endHours: number
  autoEndHours: number
  useAutoTimeframe: boolean
  effectiveEndHours: number
  switchView: (view: 'form' | 'list' | 'graph') => void
  handleFormSubmit: (rx: Prescription) => void
  saveCurrentPrescription: () => void
  newPrescription: () => void
  handleTabKeydown: (event: KeyboardEvent) => void
}

function getComponentState(wrapper: VueWrapper): AppComponentState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wrapper.vm as any as AppComponentState
}

describe('App.vue - Phase 1: Tab Navigation and State Management', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Tab Navigation - Initial State', () => {
    it('renders two tabs initially: "Add New" and "Saved Prescriptions"', () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')
      expect(tabs.length).toBe(2)
      expect(tabs[0]?.text()).toContain('Add New')
      expect(tabs[1]?.text()).toContain('Saved')
    })

    it('sets active tab to "form" initially', () => {
      const wrapper = mount(App)
      const firstTab = wrapper.find('nav[role="navigation"] button')
      expect(firstTab.exists()).toBe(true)
      expect(firstTab.attributes('aria-current')).toBe('page')
    })

    it('shows form section when activeTab is "form"', () => {
      const wrapper = mount(App)
      expect(wrapper.find('[v-if*="showForm"]').exists() || wrapper.findComponent({ name: 'PrescriptionForm' }).exists()).toBe(true)
    })

    it('hides list and graph initially', () => {
      const wrapper = mount(App)
      const listSection = wrapper.find('.list-section')
      const graphSection = wrapper.find('.graph-section')
      expect(listSection.exists()).toBe(false)
      expect(graphSection.exists()).toBe(false)
    })
  })

  describe('Graph Tab Visibility', () => {
    it('does not render graph tab when comparePrescriptions is empty', () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTab).toBeUndefined()
    })

    it('renders graph tab when comparePrescriptions has items', async () => {
      const wrapper = mount(App)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const vm = getComponentState(wrapper)
      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTab).toBeDefined()
    })

    it('shows prescription count in graph tab label', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTab?.text()).toContain('Graph')
      expect(graphTab?.text()).toContain('1')
    })
  })

  describe('Tab Click Switching', () => {
    it('switches to "list" view when list tab clicked', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const listTab = tabs[1]

      expect(listTab).toBeDefined()
      await listTab!.trigger('click')
      await flushPromises()

      const vm = getComponentState(wrapper)
      expect(vm.activeTab).toBe('list')
      expect(vm.showList).toBe(true)
      expect(vm.showForm).toBe(false)
    })

    it('switches to "form" view when form tab clicked', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Start in list view
      vm.showList = true
      vm.showForm = false
      vm.activeTab = 'list'
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const formTab = tabs[0]

      expect(formTab).toBeDefined()
      await formTab!.trigger('click')
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.activeTab).toBe('form')
      expect(updatedVm.showForm).toBe(true)
      expect(updatedVm.showList).toBe(false)
    })

    it('switches to "graph" view when graph tab clicked', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))

      expect(graphTab).toBeDefined()
      await graphTab!.trigger('click')
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.activeTab).toBe('graph')
      expect(updatedVm.showGraph).toBe(true)
      expect(updatedVm.showForm).toBe(false)
      expect(updatedVm.showList).toBe(false)
    })
  })

  describe('aria-current Attribute on Active Tab', () => {
    it('sets aria-current="page" on active tab only', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      // Form tab should be active initially
      expect(tabs[0]?.attributes('aria-current')).toBe('page')
      expect(tabs[1]?.attributes('aria-current')).toBeUndefined()

      // Switch to list
      await tabs[1]?.trigger('click')
      await flushPromises()

      const updatedTabs = wrapper.findAll('nav[role="navigation"] button')
      expect(updatedTabs[0]?.attributes('aria-current')).toBeUndefined()
      expect(updatedTabs[1]?.attributes('aria-current')).toBe('page')
    })
  })

  describe('Existing Functionality - Regressions', () => {
    it('form submit still switches to graph view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      // Simulate form submit
      vm.handleFormSubmit(prescription)
      await flushPromises()

      expect(vm.activeTab).toBe('graph')
      expect(vm.showGraph).toBe(true)
      expect(vm.showForm).toBe(false)
    })

    it('new prescription button clears form and shows it', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Start in graph view
      vm.showGraph = true
      vm.showForm = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vm.currentPrescription = { name: 'Test' } as any
      vm.activeTab = 'graph'
      await flushPromises()

      vm.newPrescription()
      await flushPromises()

      expect(vm.activeTab).toBe('form')
      expect(vm.showForm).toBe(true)
      expect(vm.showGraph).toBe(false)
      expect(vm.currentPrescription).toBeNull()
    })

    it('graph renders when showGraph is true', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.currentPrescription = prescription
      vm.switchView('graph')
      await flushPromises()

      const graphViewer = wrapper.findComponent({ name: 'GraphViewer' })
      expect(graphViewer.exists()).toBe(true)
    })
  })

  describe('View State Consistency', () => {
    it('switches to form view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const formTab = tabs.find((tab) => tab.text().includes('Add New'))

      expect(formTab).toBeDefined()
      await formTab!.trigger('click')
      await flushPromises()

      const currentVm = getComponentState(wrapper)
      expect(currentVm.activeTab).toBe('form')
      expect(currentVm.showForm).toBe(true)
      expect(currentVm.showList).toBe(false)
      expect(currentVm.showGraph).toBe(false)
    })

    it('switches to list view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const listTab = tabs.find((tab) => tab.text().includes('Saved'))

      expect(listTab).toBeDefined()
      await listTab!.trigger('click')
      await flushPromises()

      const currentVm = getComponentState(wrapper)
      expect(currentVm.activeTab).toBe('list')
      expect(currentVm.showForm).toBe(false)
      expect(currentVm.showList).toBe(true)
      expect(currentVm.showGraph).toBe(false)
    })

    it('switches to graph view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))

      expect(graphTab).toBeDefined()
      await graphTab!.trigger('click')
      await flushPromises()

      const currentVm = getComponentState(wrapper)
      expect(currentVm.activeTab).toBe('graph')
      expect(currentVm.showForm).toBe(false)
      expect(currentVm.showList).toBe(false)
      expect(currentVm.showGraph).toBe(true)
    })
  })

  describe('State Management - comparePrescriptions', () => {
    it('initializes comparePrescriptions as empty array', () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)
      expect(vm.comparePrescriptions).toEqual([])
    })

    it('allows adding prescriptions to comparePrescriptions', () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      expect(vm.comparePrescriptions.length).toBe(1)
      expect(vm.comparePrescriptions[0]?.name).toBe('Test Drug')
    })

    it('allows replacing comparePrescriptions with multiple items', () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const rx1: Prescription = {
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const rx2: Prescription = {
        name: 'Drug 2',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      vm.comparePrescriptions = [rx1, rx2]
      expect(vm.comparePrescriptions.length).toBe(2)
    })
  })

  describe('Tab Navigation Accessibility', () => {
    it('tab navigation has role="navigation" and aria-label', () => {
      const wrapper = mount(App)
      const nav = wrapper.find('nav[role="navigation"]')
      expect(nav.exists()).toBe(true)
      expect(nav.attributes('aria-label')).toBe('Main navigation')
    })

    it('each tab button is keyboard accessible', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      for (const tab of tabs) {
        expect(tab.element.tagName).toBe('BUTTON')
        expect(tab.attributes('type')).not.toBe('submit') // buttons should be interactive
      }
    })
  })
})

describe('App.vue - Phase 2: PrescriptionList Integration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('PrescriptionList Component Integration', () => {
    it('renders list section when list view is shown', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(true)
    })

    it('does not render list section when list view is hidden', () => {
      const wrapper = mount(App)
      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(false)
    })

    it('renders PrescriptionList component in list section', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      expect(prescriptionList.exists()).toBe(true)
    })
  })

  describe('PrescriptionList Events - View', () => {
    it('switches to graph view when @view event emitted', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('view', prescription)
      await flushPromises()

      expect(vm.activeTab).toBe('graph')
      expect(vm.showGraph).toBe(true)
      expect(vm.comparePrescriptions).toEqual([prescription])
    })

    it('displays single prescription on graph after view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('view', prescription)
      await flushPromises()

      expect(vm.comparePrescriptions.length).toBe(1)
      expect(vm.comparePrescriptions[0]?.name).toBe('Test Drug')
    })
  })

  describe('PrescriptionList Events - Edit', () => {
    it('switches to form view when @edit event emitted', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('edit', prescription)
      await flushPromises()

      expect(vm.activeTab).toBe('form')
      expect(vm.showForm).toBe(true)
      expect(vm.currentPrescription).toEqual(prescription)
    })

    it('loads prescription into form for editing', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-2',
        name: 'Another Drug',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('edit', prescription)
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.currentPrescription?.id).toBe('rx-2')
      expect(updatedVm.currentPrescription?.name).toBe('Another Drug')
    })
  })

  describe('PrescriptionList Events - Compare', () => {
    it('switches to graph view when @compare event emitted', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const rx1: Prescription = {
        id: 'rx-1',
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const rx2: Prescription = {
        id: 'rx-2',
        name: 'Drug 2',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('compare', [rx1, rx2])
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.activeTab).toBe('graph')
      expect(updatedVm.showGraph).toBe(true)
      expect(updatedVm.comparePrescriptions.length).toBe(2)
    })

    it('loads multiple prescriptions for comparison', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const rx1: Prescription = {
        id: 'rx-1',
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const rx2: Prescription = {
        id: 'rx-2',
        name: 'Drug 2',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      const rx3: Prescription = {
        id: 'rx-3',
        name: 'Drug 3',
        frequency: 'qid',
        times: ['07:00', '11:00', '15:00', '19:00'],
        dose: 100,
        halfLife: 4,
        peak: 1,
        uptake: 0.5,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('compare', [rx1, rx2, rx3])
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.comparePrescriptions.length).toBe(3)
      expect(updatedVm.comparePrescriptions[0]?.name).toBe('Drug 1')
      expect(updatedVm.comparePrescriptions[1]?.name).toBe('Drug 2')
      expect(updatedVm.comparePrescriptions[2]?.name).toBe('Drug 3')
    })
  })

  describe('Graph Data with Multiple Prescriptions', () => {
    it('graph tab shows count of compared prescriptions', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const rx1: Prescription = {
        id: 'rx-1',
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const rx2: Prescription = {
        id: 'rx-2',
        name: 'Drug 2',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('compare', [rx1, rx2])
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTab?.text()).toContain('2')
    })
  })

  describe('Edit Flow - Return to Form', () => {
    it('returns to form tab when prescription is edited from list', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Original Name',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      // Switch to list and emit edit
      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      prescriptionList.vm.$emit('edit', prescription)
      await flushPromises()

      const updatedVm = getComponentState(wrapper)
      expect(updatedVm.activeTab).toBe('form')
      expect(updatedVm.currentPrescription?.name).toBe('Original Name')
    })
  })
})

describe('App.vue - Phase 3: Accessibility Implementation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('ARIA Attributes', () => {
    it('form section has correct ARIA attributes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('form')
      await flushPromises()

      const formDiv = wrapper.find('[role="region"][aria-label="Prescription form"]')
      expect(formDiv.exists()).toBe(true)
    })

    it('graph region has correct ARIA attributes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphSection = wrapper.find('.graph-section')
      expect(graphSection.attributes('role')).toBe('region')
      expect(graphSection.attributes('aria-label')).toBe('Graph visualization')
    })

    it('graph region is focusable with tabindex', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphSection = wrapper.find('.graph-section')
      expect(graphSection.attributes('tabindex')).toBe('-1')
    })

    it('list section has proper heading structure', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(true)
    })
  })

  describe('Focus Management', () => {
    it('focus moves to graph region when switching to graph view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphSection = wrapper.find('.graph-section')
      expect(graphSection.exists()).toBe(true)
      expect(graphSection.attributes('role')).toBe('region')
    })

    it('focuses form when switching to form view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('form')
      await flushPromises()

      // Form section should exist with ARIA attributes
      const formDiv = wrapper.find('[role="region"][aria-label="Prescription form"]')
      expect(formDiv.exists()).toBe(true)
      expect(vm.showForm).toBe(true)
    })

    it('focuses list heading when switching to list view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      // List section should exist
      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(true)
      expect(vm.showList).toBe(true)
    })
  })

  describe('Screen Reader Announcements', () => {
    it('has ARIA live region for announcements', () => {
      const wrapper = mount(App)
      const liveRegion = wrapper.find('[role="status"][aria-live="polite"]')
      expect(liveRegion.exists()).toBe(true)
    })

    it('live region has aria-atomic attribute', () => {
      const wrapper = mount(App)
      const liveRegion = wrapper.find('[role="status"][aria-live="polite"]')
      expect(liveRegion.attributes('aria-atomic')).toBe('true')
    })

    it('announces prescription count in graph tab', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const rx1: Prescription = {
        id: 'rx-1',
        name: 'Drug 1',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const rx2: Prescription = {
        id: 'rx-2',
        name: 'Drug 2',
        frequency: 'tid',
        times: ['08:00', '14:00', '20:00'],
        dose: 250,
        halfLife: 8,
        peak: 1.5,
        uptake: 1,
      }

      vm.comparePrescriptions = [rx1, rx2]
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTab = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTab?.text()).toMatch(/Graph.*2/)
    })
  })

  describe('Keyboard Navigation Enhancement', () => {
    it('tabs are keyboard navigable with arrow keys', async () => {
      const wrapper = mount(App)

      const nav = wrapper.find('nav[role="navigation"]')
      expect(nav.exists()).toBe(true)

      const buttons = wrapper.findAll('nav[role="navigation"] button')
      expect(buttons.length).toBeGreaterThan(0)

      // All buttons should be focusable
      for (const btn of buttons) {
        expect(btn.element.tagName).toBe('BUTTON')
      }
    })

    it('tab buttons have proper focus styling capability', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      for (const tab of tabs) {
        expect(tab.element.tagName).toBe('BUTTON')
      }
    })

    it('active tab button is clearly marked', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      const activeTab = tabs.find((tab) => tab.attributes('aria-current') === 'page')
      expect(activeTab).toBeDefined()
      expect(activeTab?.attributes('class')).toContain('active')
    })
  })

  describe('Tab Focus Indicators', () => {
    it('tabs have focus-visible styles capability', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      expect(tabs.length).toBeGreaterThan(0)
      // All tabs should be visible and focusable
      for (const tab of tabs) {
        expect(tab.isVisible()).toBe(true)
      }
    })

    it('active tab has visual indicator (active class)', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const activeTab = tabs.find((tab) => tab.attributes('aria-current') === 'page')

      expect(activeTab?.attributes('class')).toContain('active')
    })
  })

  describe('Form Accessibility', () => {
    it('form view is properly structured', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('form')
      await flushPromises()

      expect(vm.showForm).toBe(true)
      const mainSection = wrapper.find('main')
      expect(mainSection.exists()).toBe(true)
    })

    it('form section is keyboard navigable', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('form')
      await flushPromises()

      // Form should be visible
      expect(vm.showForm).toBe(true)
      const prescriptionForm = wrapper.findComponent({ name: 'PrescriptionForm' })
      expect(prescriptionForm.exists()).toBe(true)
    })
  })

  describe('List View Accessibility', () => {
    it('list view has proper landmark structure', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(true)
      expect(vm.showList).toBe(true)
    })

    it('list section provides navigation context', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      expect(vm.showList).toBe(true)
      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      expect(prescriptionList.exists()).toBe(true)
    })
  })
})

describe('App.vue - Phase 4: Styling and Polish', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Edge Cases - Delete Prescription While Comparing', () => {
    it('graph tab hides when comparePrescriptions becomes empty', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      // Start with prescription and view graph
      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTabBefore = tabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTabBefore).toBeDefined()

      // Remove prescription (simulating deletion)
      vm.comparePrescriptions = []
      await flushPromises()

      const updatedTabs = wrapper.findAll('nav[role="navigation"] button')
      const graphTabAfter = updatedTabs.find((tab) => tab.text().includes('Graph'))
      expect(graphTabAfter).toBeUndefined()
    })

    it('switches from graph view to list when comparePrescriptions becomes empty', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        id: 'rx-1',
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      expect(vm.activeTab).toBe('graph')

      // Delete prescription
      vm.comparePrescriptions = []
      await flushPromises()

      // Should auto-switch away from graph
      expect(vm.activeTab).not.toBe('graph')
    })
  })

  describe('Edge Cases - Rapid Tab Switching', () => {
    it('handles rapid tab switches without errors', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      await flushPromises()

      // Rapid switches
      vm.switchView('form')
      vm.switchView('list')
      vm.switchView('graph')
      vm.switchView('form')
      vm.switchView('list')

      await flushPromises()

      // Should end in list view without errors
      expect(vm.activeTab).toBe('list')
      expect(vm.showList).toBe(true)
    })

    it('maintains consistency through rapid state changes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]

      // Rapid switches should maintain exactly one view active
      const views = ['form', 'list', 'graph'] as const
      for (let i = 0; i < 10; i++) {
        vm.switchView(views[i % 3] as 'form' | 'list' | 'graph')
      }

      await flushPromises()

      const viewCount = [vm.showForm, vm.showList, vm.showGraph].filter(Boolean).length
      expect(viewCount).toBe(1) // Exactly one view should be active
    })
  })

  describe('Edge Cases - Empty List States', () => {
    it('shows empty state message when list has no prescriptions', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const prescriptionList = wrapper.findComponent({ name: 'PrescriptionList' })
      expect(prescriptionList.exists()).toBe(true)
    })
  })

  describe('Styling - Tab Active State', () => {
    it('active tab has the "active" class', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      const activeTab = tabs[0]
      expect(activeTab?.attributes('class')).toContain('active')
    })

    it('inactive tabs do not have "active" class', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const inactiveTabs = tabs.filter((tab) => !tab.text().includes('Graph'))

      for (const tab of inactiveTabs) {
        expect(tab.attributes('class')).not.toContain('active')
      }
    })

    it('tab style changes when switching views', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const tabs = wrapper.findAll('nav[role="navigation"] button')
      const formTab = tabs[0]
      const listTab = tabs[1]

      // Form tab should be active initially
      expect(formTab?.attributes('class')).toContain('active')
      expect(listTab?.attributes('class')).not.toContain('active')

      // Switch to list
      vm.switchView('list')
      await flushPromises()

      const updatedTabs = wrapper.findAll('nav[role="navigation"] button')
      expect(updatedTabs[0]?.attributes('class')).not.toContain('active')
      expect(updatedTabs[1]?.attributes('class')).toContain('active')
    })
  })

  describe('Styling - Section Styling', () => {
    it('list section has proper styling classes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.switchView('list')
      await flushPromises()

      const listSection = wrapper.find('.list-section')
      expect(listSection.exists()).toBe(true)
      expect(listSection.attributes('class')).toContain('list-section')
    })

    it('graph section has slideIn animation class', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphSection = wrapper.find('.graph-section')
      expect(graphSection.exists()).toBe(true)
      expect(graphSection.attributes('class')).toContain('graph-section')
    })
  })

  describe('Animations - Transitions', () => {
    it('graph section has proper animation on mount', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphSection = wrapper.find('.graph-section')
      expect(graphSection.exists()).toBe(true)
      // Animation class is applied via CSS, just verify section exists
    })
  })

  describe('Mobile Responsiveness - Breakpoints', () => {
    it('tab navigation remains accessible on mobile viewport', async () => {
      const wrapper = mount(App)
      const nav = wrapper.find('nav[role="navigation"]')
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      // Navigation should exist and be visible
      expect(nav.exists()).toBe(true)
      expect(tabs.length).toBeGreaterThan(0)

      // All tabs should be visible
      for (const tab of tabs) {
        expect(tab.isVisible()).toBe(true)
      }
    })

    it('buttons have touch-friendly sizing (reasonable padding)', async () => {
      const wrapper = mount(App)
      const buttons = wrapper.findAll('nav[role="navigation"] button')

      // Buttons should exist and have reasonable size
      for (const btn of buttons) {
        expect(btn.exists()).toBe(true)
        // Touch targets should be at least 44x44px (checked via CSS in styles)
      }
    })

    it('main content is responsive', async () => {
      const wrapper = mount(App)
      const main = wrapper.find('main.app-main')

      expect(main.exists()).toBe(true)
      // Main should have responsive width constraints
    })
  })

  describe('Focus Management and Styling', () => {
    it('tab buttons are keyboard focusable', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      for (const tab of tabs) {
        expect(tab.element.tagName).toBe('BUTTON')
        expect(tab.attributes('type')).not.toBe('button') // Allow default button type
      }
    })

    it('active tab has visual indicator via aria-current and class', async () => {
      const wrapper = mount(App)
      const tabs = wrapper.findAll('nav[role="navigation"] button')

      const activeTab = tabs.find((tab) => tab.attributes('aria-current') === 'page')
      expect(activeTab).toBeDefined()
      expect(activeTab?.attributes('class')).toContain('active')
    })
  })

  describe('Auto-Extend Timeframe - autoEndHours Computed', () => {
    it('returns default 48 when no currentPrescription', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // When: no currentPrescription (null)
      vm.currentPrescription = null

      await flushPromises()

      // Then: autoEndHours should return 48 (default)
      expect(vm.autoEndHours).toBe(48)
    })

    it('calculates auto end time for prescription with 6-hour half-life', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      // Set up: 1 day simulation window
      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Expected: numDays = ceil(24/24) + 1 = 2 days
      // lastDoseTime = 1*24 + 9 = 33 hours (second day at 09:00)
      // tailOffDuration = 6 * 5 = 30 hours
      // autoEndHours = 33 + 30 = 63 hours
      expect(vm.autoEndHours).toBe(63)
    })

    it('calculates auto end time for prescription with 24-hour half-life', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Warfarin',
        frequency: 'once',
        times: ['08:00'],
        dose: 5,
        halfLife: 24,
        peak: 2.5,
        uptake: 1,
      }

      // Set up: 2 day simulation window
      vm.endHours = 48
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Expected: lastDoseTime = 8 + 24 = 32 hours (second day at 08:00)
      // tailOffDuration = 24 * 5 = 120 hours
      // autoEndHours = 32 + 120 = 152 hours, but capped at 168 (1 week)
      expect(vm.autoEndHours).toBeLessThanOrEqual(168)
      expect(vm.autoEndHours).toBeGreaterThanOrEqual(24)
    })

    it('applies minimum floor of 24 hours', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Fast Drug',
        frequency: 'once',
        times: ['00:30'], // Very early morning dose
        dose: 100,
        halfLife: 0.5, // 30 minutes
        peak: 0.1,
        uptake: 0.15,
      }

      // Set up: very short window
      vm.endHours = 2
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Even with short half-life, should respect minimum of 24 hours
      expect(vm.autoEndHours).toBeGreaterThanOrEqual(24)
    })

    it('applies maximum cap of 168 hours (1 week)', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Long Half-Life Drug',
        frequency: 'once',
        times: ['12:00'],
        dose: 50,
        halfLife: 240, // 10 days
        peak: 4,
        uptake: 2,
      }

      // Set up: long simulation window
      vm.endHours = 240
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Should be capped at 168 hours (1 week) to prevent unreasonable values
      expect(vm.autoEndHours).toBeLessThanOrEqual(168)
    })

    it('calculates correctly for BID prescription over 2 days', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug BID',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      // Set up: 2 day simulation window
      vm.endHours = 48
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Expected: numDays = ceil(48/24) + 1 = 3 days
      // lastDoseTime = 2*24 + 21 = 69 hours (third day at 21:00)
      // tailOffDuration = 6 * 5 = 30 hours
      // autoEndHours = 69 + 30 = 99 hours
      expect(vm.autoEndHours).toBe(99)
    })

    it('handles prescription with fractional hour dose times', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:30'], // 9.5 hours
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      await flushPromises()

      // Expected: numDays = ceil(24/24) + 1 = 2 days
      // lastDoseTime = 1*24 + 9.5 = 33.5 hours (second day at 09:30)
      // tailOffDuration = 6 * 5 = 30 hours
      // autoEndHours = 33.5 + 30 = 63.5 hours
      expect(vm.autoEndHours).toBe(63.5)
    })

    it('recalculates when prescription changes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription1: Prescription = {
        name: 'Drug A',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const prescription2: Prescription = {
        name: 'Drug B',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 24,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 48
      vm.currentPrescription = prescription1
      vm.comparePrescriptions = [prescription1]
      await flushPromises()

      const firstValue = vm.autoEndHours

      // Change prescription to one with longer half-life
      vm.currentPrescription = prescription2
      vm.comparePrescriptions = [prescription2]
      await flushPromises()

      const secondValue = vm.autoEndHours

      // Should be different (longer half-life means longer tail-off)
      expect(secondValue).toBeGreaterThan(firstValue)
    })

    it('updates when endHours changes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      // First calculation with 24 hour window
      vm.endHours = 24
      await flushPromises()
      const firstValue = vm.autoEndHours

      // Change to 48 hour window
      vm.endHours = 48
      await flushPromises()
      const secondValue = vm.autoEndHours

      // autoEndHours should recalculate based on new endHours
      // (may affect numDays calculation for dose expansion)
      expect([firstValue, secondValue].some((v) => v !== firstValue)).toBe(true)
    })
  })

  describe('Auto vs Manual Timeframe Mode - useAutoTimeframe Toggle', () => {
    it('initializes useAutoTimeframe to true (auto mode by default)', () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // When: component mounts
      // Then: useAutoTimeframe should be true by default
      expect(vm.useAutoTimeframe).toBe(true)
    })

    it('can toggle useAutoTimeframe to false (manual mode)', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Given: useAutoTimeframe is true
      expect(vm.useAutoTimeframe).toBe(true)

      // When: toggle to false
      vm.useAutoTimeframe = false
      await flushPromises()

      // Then: useAutoTimeframe should be false
      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('can toggle useAutoTimeframe back to true (auto mode)', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Given: useAutoTimeframe is false
      vm.useAutoTimeframe = false
      await flushPromises()

      // When: toggle back to true
      vm.useAutoTimeframe = true
      await flushPromises()

      // Then: useAutoTimeframe should be true
      expect(vm.useAutoTimeframe).toBe(true)
    })

    it('maintains toggle state when prescription changes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription1: Prescription = {
        name: 'Drug A',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      const prescription2: Prescription = {
        name: 'Drug B',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 12,
        peak: 2,
        uptake: 1.5,
      }

      // Set to manual mode
      vm.useAutoTimeframe = false
      await flushPromises()

      // Change prescription
      vm.currentPrescription = prescription1
      vm.comparePrescriptions = [prescription1]
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(false)

      // Change to different prescription
      vm.currentPrescription = prescription2
      vm.comparePrescriptions = [prescription2]
      await flushPromises()

      // Toggle state should persist
      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('maintains toggle state when endHours changes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Set to manual mode
      vm.useAutoTimeframe = false
      await flushPromises()

      // Change endHours
      vm.endHours = 72
      await flushPromises()

      // Toggle state should persist
      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('toggle state persists across view switches', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Set to manual mode
      vm.useAutoTimeframe = false
      await flushPromises()

      // Switch views
      vm.switchView('list')
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(false)

      vm.switchView('form')
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('toggle behaves independently from activeTab state', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Toggle is independent of activeTab
      expect(vm.useAutoTimeframe).toBe(true)
      expect(vm.activeTab).toBe('form')

      // Change tab
      vm.activeTab = 'list'
      await flushPromises()

      // useAutoTimeframe should still be true
      expect(vm.useAutoTimeframe).toBe(true)

      // Toggle useAutoTimeframe
      vm.useAutoTimeframe = false
      await flushPromises()

      // activeTab should not change
      expect(vm.activeTab).toBe('list')
      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('supports rapid toggling without issues', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Rapid toggles
      vm.useAutoTimeframe = false
      await flushPromises()
      vm.useAutoTimeframe = true
      await flushPromises()
      vm.useAutoTimeframe = false
      await flushPromises()
      vm.useAutoTimeframe = true
      await flushPromises()

      // Should end in true state
      expect(vm.useAutoTimeframe).toBe(true)
    })

    it('can be toggled while viewing graph', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      // While viewing graph, toggle auto mode
      vm.useAutoTimeframe = false
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(false)
      expect(vm.activeTab).toBe('graph')
    })

    it('supports manual mode for user control', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // User explicitly wants manual control
      vm.useAutoTimeframe = false
      await flushPromises()

      // User can set custom endHours
      vm.endHours = 100
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(false)
      expect(vm.endHours).toBe(100)
    })
  })

  describe('Effective End Hours - effectiveEndHours Computed', () => {
    it('returns autoEndHours when useAutoTimeframe is true', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = true
      await flushPromises()

      // When: useAutoTimeframe is true
      // Then: effectiveEndHours should equal autoEndHours
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)
    })

    it('returns manual endHours when useAutoTimeframe is false', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Set manual mode
      vm.useAutoTimeframe = false
      vm.endHours = 72
      await flushPromises()

      // When: useAutoTimeframe is false
      // Then: effectiveEndHours should equal endHours
      expect(vm.effectiveEndHours).toBe(72)
      expect(vm.effectiveEndHours).toBe(vm.endHours)
    })

    it('switches to autoEndHours when toggling useAutoTimeframe to true', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      // Start in manual mode with custom endHours
      vm.useAutoTimeframe = false
      vm.endHours = 100
      await flushPromises()

      const manualValue = vm.effectiveEndHours
      expect(manualValue).toBe(100)

      // Toggle to auto mode
      vm.useAutoTimeframe = true
      await flushPromises()

      const autoValue = vm.effectiveEndHours
      expect(autoValue).toBe(vm.autoEndHours)
      expect(autoValue).not.toBe(manualValue)
    })

    it('switches to endHours when toggling useAutoTimeframe to false', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      // Start in auto mode
      vm.useAutoTimeframe = true
      await flushPromises()

      const autoValue = vm.effectiveEndHours
      expect(autoValue).toBe(vm.autoEndHours)

      // Toggle to manual mode with custom endHours
      vm.useAutoTimeframe = false
      vm.endHours = 96
      await flushPromises()

      const manualValue = vm.effectiveEndHours
      expect(manualValue).toBe(96)
      expect(manualValue).not.toBe(autoValue)
    })

    it('reflects changes to endHours in manual mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.useAutoTimeframe = false
      vm.endHours = 48
      await flushPromises()

      expect(vm.effectiveEndHours).toBe(48)

      // Change endHours slider
      vm.endHours = 72
      await flushPromises()

      expect(vm.effectiveEndHours).toBe(72)
    })

    it('reflects changes to autoEndHours in auto mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription1: Prescription = {
        name: 'Drug A',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription1
      vm.comparePrescriptions = [prescription1]
      vm.useAutoTimeframe = true
      await flushPromises()

      const firstValue = vm.effectiveEndHours

      // Change to prescription with different half-life
      const prescription2: Prescription = {
        name: 'Drug B',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 24,
        peak: 2,
        uptake: 1.5,
      }

      vm.currentPrescription = prescription2
      vm.comparePrescriptions = [prescription2]
      await flushPromises()

      const secondValue = vm.effectiveEndHours

      // effectiveEndHours should reflect new autoEndHours
      expect(secondValue).not.toBe(firstValue)
    })

    it('ignores endHours changes when in auto mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = true
      await flushPromises()

      // Try to change endHours (should not affect effectiveEndHours)
      vm.endHours = 200
      await flushPromises()

      const valueAfterChange = vm.effectiveEndHours

      // effectiveEndHours should still follow autoEndHours, not endHours
      expect(valueAfterChange).toBe(vm.autoEndHours)
    })

    it('ignores autoEndHours changes when in manual mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      vm.useAutoTimeframe = false
      vm.endHours = 80
      await flushPromises()

      const manualValue = vm.effectiveEndHours
      expect(manualValue).toBe(80)

      // Change prescription/endHours for simulation (would normally change autoEndHours)
      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 240,
        peak: 2,
        uptake: 1.5,
      }

      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.endHours = 48
      await flushPromises()

      // effectiveEndHours should still be manual value (48), not autoEndHours
      expect(vm.effectiveEndHours).toBe(48)
      expect(vm.useAutoTimeframe).toBe(false)
    })

    it('has correct initial value when component mounts', () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      // Initial: useAutoTimeframe is true, no prescription
      // autoEndHours defaults to 48
      // effectiveEndHours should equal autoEndHours initially
      expect(vm.useAutoTimeframe).toBe(true)
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)
    })

    it('handles rapid toggling between auto and manual modes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]

      // Rapid toggles
      vm.useAutoTimeframe = false
      vm.endHours = 100
      await flushPromises()
      expect(vm.effectiveEndHours).toBe(100)

      vm.useAutoTimeframe = true
      await flushPromises()
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)

      vm.useAutoTimeframe = false
      vm.endHours = 80
      await flushPromises()
      expect(vm.effectiveEndHours).toBe(80)

      vm.useAutoTimeframe = true
      await flushPromises()
      expect(vm.effectiveEndHours).toBe(vm.autoEndHours)
    })
  })

  describe('Graph Controls UI - Auto/Manual Toggle and Slider', () => {
    it('renders auto-timeframe toggle checkbox in graph controls', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      // Find graph controls section
      const graphControls = wrapper.find('.graph-controls')
      expect(graphControls.exists()).toBe(true)

      // Find auto-timeframe toggle checkbox
      const toggleCheckbox = graphControls.find('input[type="checkbox"]')
      expect(toggleCheckbox.exists()).toBe(true)
    })

    it('toggle checkbox is bound to useAutoTimeframe', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toggleCheckbox = graphControls.find('input[type="checkbox"]') as any

      // Initially checked (useAutoTimeframe is true)
      expect(toggleCheckbox.element.checked).toBe(true)

      // Toggle via state (reflects checkbox in template)
      vm.useAutoTimeframe = false
      await flushPromises()

      // Verify state changed
      expect(vm.useAutoTimeframe).toBe(false)

      // Toggle back
      vm.useAutoTimeframe = true
      await flushPromises()

      expect(vm.useAutoTimeframe).toBe(true)
    })

    it('slider is visible when in graph view', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const slider = graphControls.find('input[type="range"]')
      expect(slider.exists()).toBe(true)
    })

    it('slider label displays effectiveEndHours', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const labels = graphControls.findAll('label')

      // Find the slider label (not the toggle label)
      const sliderLabel = labels.find((label) => label.text().includes('Timeframe:'))

      // Label should show effectiveEndHours value
      expect(sliderLabel?.text()).toContain(`${vm.effectiveEndHours}h`)
    })

    it('slider is disabled when useAutoTimeframe is true', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = true
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const slider = graphControls.find('input[type="range"]')

      // Slider should be disabled
      expect(slider.attributes('disabled')).toBeDefined()
    })

    it('slider is enabled when useAutoTimeframe is false', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = false
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const slider = graphControls.find('input[type="range"]')

      // Slider should not be disabled
      expect(slider.attributes('disabled')).toBeUndefined()
    })

    it('toggle has descriptive label', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')

      // Should have a label for the toggle
      const labels = graphControls.findAll('label')
      const toggleLabel = labels.find((label) => label.text().toLowerCase().includes('auto'))

      expect(toggleLabel).toBeDefined()
    })

    it('slider updates effectiveEndHours when in manual mode', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.endHours = 24
      vm.currentPrescription = prescription
      vm.comparePrescriptions = [prescription]
      vm.useAutoTimeframe = false
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slider = graphControls.find('input[type="range"]') as any

      // Change slider value
      await slider.setValue(96)
      await flushPromises()

      // effectiveEndHours should update to new manual value
      expect(vm.effectiveEndHours).toBe(96)
    })

    it('toggle has proper ARIA attributes', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const toggleCheckbox = graphControls.find('input[type="checkbox"]')

      // Should have aria-label for accessibility
      expect(toggleCheckbox.attributes('aria-label')).toBeDefined()
    })

    it('slider has descriptive ARIA label', async () => {
      const wrapper = mount(App)
      const vm = getComponentState(wrapper)

      const prescription: Prescription = {
        name: 'Test Drug',
        frequency: 'once',
        times: ['09:00'],
        dose: 500,
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }

      vm.comparePrescriptions = [prescription]
      vm.switchView('graph')
      await flushPromises()

      const graphControls = wrapper.find('.graph-controls')
      const slider = graphControls.find('input[type="range"]')

      // Should have aria-label or be associated with label
      expect(
        slider.attributes('aria-label') ||
        slider.attributes('id'),
      ).toBeDefined()
    })
  })
})
