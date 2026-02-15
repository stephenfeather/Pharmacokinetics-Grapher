import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GraphViewer from '../GraphViewer.vue'
import type { GraphDataset } from '@/core/models/prescription'

// Setup mocks with vi.hoisted() for proper hoisting
 
const { MockChart, mockDownloadImage } = vi.hoisted(() => {
  const mockDestroy = vi.fn()
  const mockToBase64Image = vi.fn().mockReturnValue('data:image/png;base64,mock-image-data')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockChart = vi.fn(function (this: any) {
    this.destroy = mockDestroy
    this.toBase64Image = mockToBase64Image
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(MockChart as any).register = vi.fn()

  const mockDownloadImage = vi.fn().mockReturnValue(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { MockChart: MockChart as any, mockDownloadImage }
})

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}))

vi.mock('@/core/export', () => ({
  generateFilename: vi.fn((names: string[] = []) => `pk-graph-${names.join('-')}-test.png`),
  downloadImage: mockDownloadImage,
}))

vi.mock('chartjs-plugin-a11y-legend', () => ({
  default: { id: 'a11y-legend' },
}))

describe('GraphViewer - Clock Time X-Axis Mode', () => {
  const mockDataset: GraphDataset[] = [
    {
      label: 'Test Drug',
      data: [
        { time: 0, concentration: 0.5 },
        { time: 12, concentration: 0.8 },
        { time: 24, concentration: 0.6 },
      ],
      color: '#3B82F6',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with hours mode by default', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('accepts xAxisMode and firstDoseTime props', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    expect(wrapper.props('xAxisMode')).toBe('clock')
    expect(wrapper.props('firstDoseTime')).toBe('09:00')
  })

  it('updates aria-label for clock time mode', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    const canvas = wrapper.find('canvas')
    const ariaLabel = canvas.attributes('aria-label')
    expect(ariaLabel).toContain('Clock time starting from 09:00')
  })

  it('includes time range in aria-label for hours mode', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'hours',
        startHours: 0,
        endHours: 48,
      },
    })
    const canvas = wrapper.find('canvas')
    const ariaLabel = canvas.attributes('aria-label')
    expect(ariaLabel).toContain('Hours from 0 to 48')
  })

  it('has correct default values for new props', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
      },
    })
    expect(wrapper.props('xAxisMode')).toBe('hours')
    expect(wrapper.props('firstDoseTime')).toBe('00:00')
  })

  it('re-renders when xAxisMode changes', async () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'hours',
      },
    })
    await wrapper.setProps({ xAxisMode: 'clock', firstDoseTime: '09:00' })
    expect(wrapper.props('xAxisMode')).toBe('clock')
  })

  it('re-renders when firstDoseTime changes', async () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    await wrapper.setProps({ firstDoseTime: '14:00' })
    expect(wrapper.props('firstDoseTime')).toBe('14:00')
  })

  it('handles empty datasets gracefully in clock mode', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: [],
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    expect(wrapper.find('canvas').attributes('aria-label')).toContain('no data loaded')
  })

  it('displays disclaimer even in clock mode', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    expect(wrapper.text()).toContain('Educational purposes only')
  })

  it('accepts custom time range with clock mode', () => {
    const wrapper = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
        startHours: 12,
        endHours: 36,
      },
    })
    expect(wrapper.props('startHours')).toBe(12)
    expect(wrapper.props('endHours')).toBe(36)
  })

  it('has download button in both modes', () => {
    const wrapperHours = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'hours',
      },
    })
    const wrapperClock = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    expect(wrapperHours.find('button[aria-label*="Download"]').exists()).toBe(true)
    expect(wrapperClock.find('button[aria-label*="Download"]').exists()).toBe(true)
  })

  it('preserves screen reader text in both modes', () => {
    const wrapperHours = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'hours',
      },
    })
    const wrapperClock = mount(GraphViewer, {
      props: {
        datasets: mockDataset,
        xAxisMode: 'clock',
        firstDoseTime: '09:00',
      },
    })
    expect(wrapperHours.find('.sr-only').exists()).toBe(true)
    expect(wrapperClock.find('.sr-only').exists()).toBe(true)
  })
})
