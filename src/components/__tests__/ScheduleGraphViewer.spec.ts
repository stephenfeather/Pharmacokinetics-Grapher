/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleGraphViewer from '../ScheduleGraphViewer.vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import type { Prescription } from '@/core/models/prescription'

// Setup mocks with vi.hoisted()
const { mockDestroy, MockChart } = vi.hoisted(() => {
  const mockDestroy = vi.fn()

  const MockChart = vi.fn(function (this: any) {
    this.destroy = mockDestroy
    this.isDatasetVisible = vi.fn().mockReturnValue(true)
    this.hide = vi.fn()
    this.show = vi.fn()
  })
  ;(MockChart as any).register = vi.fn()

  return { mockDestroy, MockChart: MockChart as any }
})

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}))

vi.mock('chartjs-plugin-a11y-legend', () => ({
  default: { id: 'a11y-legend' },
}))

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

function makeTitrationSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
  return {
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

function makeTaperSchedule(): DosageSchedule {
  return {
    name: 'Test Taper',
    direction: 'taper',
    basePrescription: makeBasePrescription(),
    steps: [
      { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
    ],
    totalDuration: 14,
  }
}

function mountViewer(schedule: DosageSchedule = makeTitrationSchedule(), tailOffHours?: number) {
  return mount(ScheduleGraphViewer, {
    props: { schedule, ...(tailOffHours !== undefined ? { tailOffHours } : {}) },
  })
}

describe('ScheduleGraphViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Structure ----

  describe('component structure', () => {
    it('renders a canvas element', () => {
      const wrapper = mountViewer()
      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('renders the educational disclaimer', () => {
      const wrapper = mountViewer()
      const disclaimer = wrapper.find('.disclaimer')
      expect(disclaimer.exists()).toBe(true)
      expect(disclaimer.text()).toContain('Educational purposes only')
    })

    it('renders chart container', () => {
      const wrapper = mountViewer()
      expect(wrapper.find('.chart-container').exists()).toBe(true)
    })

    it('renders step annotations', () => {
      const wrapper = mountViewer()
      const annotations = wrapper.findAll('.step-annotation')
      expect(annotations).toHaveLength(2)
    })
  })

  // ---- Step Annotations ----

  describe('step annotations', () => {
    it('shows dose labels for each step', () => {
      const wrapper = mountViewer()
      const annotations = wrapper.findAll('.step-annotation')
      expect(annotations[0]!.text()).toContain('25mg')
      expect(annotations[1]!.text()).toContain('50mg')
    })

    it('shows day labels for each step', () => {
      const wrapper = mountViewer()
      const annotations = wrapper.findAll('.step-annotation')
      expect(annotations[0]!.text()).toContain('Day 1+')
      expect(annotations[1]!.text()).toContain('Day 8+')
    })

    it('applies titration class for titration schedules', () => {
      const wrapper = mountViewer(makeTitrationSchedule())
      const annotations = wrapper.findAll('.step-annotation')
      expect(annotations[0]!.classes()).toContain('titration')
    })

    it('applies taper class for taper schedules', () => {
      const wrapper = mountViewer(makeTaperSchedule())
      const annotations = wrapper.findAll('.step-annotation')
      expect(annotations[0]!.classes()).toContain('taper')
    })

    it('shows correct number of annotations for 3-step schedule', () => {
      const schedule = makeTitrationSchedule({
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          { stepNumber: 3, dose: 100, durationDays: 7, startDay: 14 },
        ],
        totalDuration: 21,
      })
      const wrapper = mountViewer(schedule)
      expect(wrapper.findAll('.step-annotation')).toHaveLength(3)
    })
  })

  // ---- Chart Creation ----

  describe('chart creation', () => {
    it('creates a Chart instance on mount', () => {
      mountViewer()
      expect(MockChart).toHaveBeenCalledTimes(1)
    })

    it('passes schedule name as dataset label', () => {
      mountViewer(makeTitrationSchedule({ name: 'My Schedule' }))
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets[0].label).toBe('My Schedule')
    })

    it('uses green color for titration', () => {
      mountViewer(makeTitrationSchedule())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets[0].borderColor).toBe('#22c55e')
    })

    it('uses red color for taper', () => {
      mountViewer(makeTaperSchedule())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets[0].borderColor).toBe('#ef4444')
    })

    it('passes curve data points to Chart', () => {
      mountViewer()
      const chartConfig = MockChart.mock.calls[0][1]
      const data = chartConfig.data.datasets[0].data
      expect(data.length).toBeGreaterThan(0)
      expect(data[0]).toHaveProperty('x')
      expect(data[0]).toHaveProperty('y')
    })

    it('sets Y-axis max to 1.1', () => {
      mountViewer()
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.options.scales.y.max).toBe(1.1)
    })
  })

  // ---- Accessibility ----

  describe('accessibility', () => {
    it('sets role=img on canvas', () => {
      const wrapper = mountViewer()
      expect(wrapper.find('canvas').attributes('role')).toBe('img')
    })

    it('sets descriptive aria-label on canvas', () => {
      const wrapper = mountViewer(makeTitrationSchedule({ name: 'Sertraline Titration' }))
      const ariaLabel = wrapper.find('canvas').attributes('aria-label')
      expect(ariaLabel).toContain('Sertraline Titration')
      expect(ariaLabel).toContain('titration')
      expect(ariaLabel).toContain('25mg')
      expect(ariaLabel).toContain('50mg')
    })

    it('includes direction in aria-label for taper', () => {
      const wrapper = mountViewer(makeTaperSchedule())
      const ariaLabel = wrapper.find('canvas').attributes('aria-label')
      expect(ariaLabel).toContain('taper')
    })

    it('renders screen reader text', () => {
      const wrapper = mountViewer()
      const srText = wrapper.find('.sr-only')
      expect(srText.exists()).toBe(true)
      expect(srText.text()).toContain('Titration')
      expect(srText.text()).toContain('14 days')
    })
  })

  // ---- Cleanup ----

  describe('lifecycle', () => {
    it('destroys chart on unmount', () => {
      const wrapper = mountViewer()
      wrapper.unmount()
      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})
