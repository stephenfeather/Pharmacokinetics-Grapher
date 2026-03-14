/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleComparisonViewer from '../ScheduleComparisonViewer.vue'
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

function makeSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
  return {
    id: 'sched-1',
    name: 'Schedule A',
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

function makeTwoSchedules(): DosageSchedule[] {
  return [
    makeSchedule({ id: 'sched-1', name: 'Schedule A' }),
    makeSchedule({
      id: 'sched-2',
      name: 'Schedule B',
      direction: 'taper',
      steps: [
        { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
      ],
    }),
  ]
}

function makeThreeSchedules(): DosageSchedule[] {
  return [
    ...makeTwoSchedules(),
    makeSchedule({
      id: 'sched-3',
      name: 'Schedule C',
      steps: [
        { stepNumber: 1, dose: 10, durationDays: 14, startDay: 0 },
        { stepNumber: 2, dose: 20, durationDays: 14, startDay: 14 },
      ],
      totalDuration: 28,
    }),
  ]
}

function makeFiveSchedules(): DosageSchedule[] {
  return [
    ...makeThreeSchedules(),
    makeSchedule({ id: 'sched-4', name: 'Schedule D' }),
    makeSchedule({ id: 'sched-5', name: 'Schedule E' }),
  ]
}

function mountViewer(schedules: DosageSchedule[] = makeTwoSchedules()) {
  return mount(ScheduleComparisonViewer, {
    props: { schedules },
  })
}

describe('ScheduleComparisonViewer', () => {
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

    it('renders normalization toggle', () => {
      const wrapper = mountViewer()
      const toggle = wrapper.find('[data-testid="normalize-toggle"]')
      expect(toggle.exists()).toBe(true)
    })
  })

  // ---- Multiple Datasets ----

  describe('multiple schedule datasets', () => {
    it('creates separate datasets for each schedule', () => {
      mountViewer(makeTwoSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets).toHaveLength(2)
    })

    it('assigns schedule names as dataset labels', () => {
      mountViewer(makeTwoSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets[0].label).toBe('Schedule A')
      expect(chartConfig.data.datasets[1].label).toBe('Schedule B')
    })

    it('renders 3 datasets for 3 schedules', () => {
      mountViewer(makeThreeSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets).toHaveLength(3)
    })

    it('renders 5 datasets for 5 schedules', () => {
      mountViewer(makeFiveSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.data.datasets).toHaveLength(5)
    })

    it('includes data points in each dataset', () => {
      mountViewer(makeTwoSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      for (const dataset of chartConfig.data.datasets) {
        expect(dataset.data.length).toBeGreaterThan(0)
        expect(dataset.data[0]).toHaveProperty('x')
        expect(dataset.data[0]).toHaveProperty('y')
      }
    })
  })

  // ---- Distinct Colors ----

  describe('color assignment', () => {
    it('assigns distinct colors to each schedule', () => {
      mountViewer(makeTwoSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      const color1 = chartConfig.data.datasets[0].borderColor
      const color2 = chartConfig.data.datasets[1].borderColor
      expect(color1).not.toBe(color2)
    })

    it('uses the defined color palette', () => {
      mountViewer(makeFiveSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      const expectedColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
      for (let i = 0; i < 5; i++) {
        expect(chartConfig.data.datasets[i].borderColor).toBe(expectedColors[i])
      }
    })

    it('wraps colors when more schedules than palette size', () => {
      const schedules = [
        ...makeFiveSchedules(),
        makeSchedule({ id: 'sched-6', name: 'Schedule F' }),
      ]
      mountViewer(schedules)
      const chartConfig = MockChart.mock.calls[0][1]
      // 6th schedule should wrap to first color
      expect(chartConfig.data.datasets[5].borderColor).toBe('#3b82f6')
    })
  })

  // ---- Legend ----

  describe('legend', () => {
    it('displays legend with all schedule names', () => {
      mountViewer(makeTwoSchedules())
      const chartConfig = MockChart.mock.calls[0][1]
      expect(chartConfig.options.plugins.legend.display).toBe(true)
    })
  })

  // ---- Normalization Modes ----

  describe('normalization modes', () => {
    it('defaults to individual normalization mode', () => {
      const wrapper = mountViewer()
      const individualRadio = wrapper.find<HTMLInputElement>('input[value="individual"]')
      expect(individualRadio.element.checked).toBe(true)
    })

    it('can switch to global normalization mode', async () => {
      const wrapper = mountViewer()
      const globalRadio = wrapper.find<HTMLInputElement>('input[value="global"]')
      await globalRadio.setValue(true)
      expect(globalRadio.element.checked).toBe(true)
    })

    it('re-renders chart when normalization mode changes', async () => {
      const wrapper = mountViewer()
      MockChart.mockClear()
      const globalRadio = wrapper.find<HTMLInputElement>('input[value="global"]')
      await globalRadio.setValue(true)
      // Chart should be recreated
      expect(MockChart).toHaveBeenCalled()
    })
  })

  // ---- Accessibility ----

  describe('accessibility', () => {
    it('sets role=img on canvas', () => {
      const wrapper = mountViewer()
      expect(wrapper.find('canvas').attributes('role')).toBe('img')
    })

    it('sets descriptive aria-label on canvas', () => {
      const wrapper = mountViewer(makeTwoSchedules())
      const ariaLabel = wrapper.find('canvas').attributes('aria-label')
      expect(ariaLabel).toContain('Schedule A')
      expect(ariaLabel).toContain('Schedule B')
      expect(ariaLabel).toContain('comparison')
    })

    it('renders screen reader text', () => {
      const wrapper = mountViewer(makeTwoSchedules())
      const srText = wrapper.find('.sr-only')
      expect(srText.exists()).toBe(true)
      expect(srText.text()).toContain('2')
      expect(srText.text()).toContain('comparison')
    })
  })

  // ---- Lifecycle ----

  describe('lifecycle', () => {
    it('destroys chart on unmount', () => {
      const wrapper = mountViewer()
      wrapper.unmount()
      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})
