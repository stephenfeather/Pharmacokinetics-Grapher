/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GraphViewer from '../GraphViewer.vue'

// Setup mocks with vi.hoisted() for proper hoisting
const { mockDestroy, MockChart } = vi.hoisted(() => {
  const mockDestroy = vi.fn()

  // Create a spy on a constructor function
  const MockChart = vi.fn(function (this: any) {
    this.destroy = mockDestroy
  })
  ;(MockChart as any).register = vi.fn()

  return { mockDestroy, MockChart: MockChart as any }
})

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}))

describe('GraphViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Phase 1: Structure and Setup ----

  describe('component structure', () => {
    it('renders a canvas element', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('renders the educational disclaimer', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      const disclaimer = wrapper.find('.disclaimer')
      expect(disclaimer.exists()).toBe(true)
      expect(disclaimer.text()).toContain('Educational purposes only')
      expect(disclaimer.text()).toContain('Not for medical decisions')
    })

    it('renders chart container with correct class', () => {
      const wrapper = mount(GraphViewer, {
        props: { datasets: [] },
      })
      expect(wrapper.find('.chart-container').exists()).toBe(true)
    })
  })

  // ---- Phase 2: Chart Creation ----

  describe('chart creation', () => {
    it('registers Chart.js modules on import', () => {
      mount(GraphViewer, { props: { datasets: [] } })
      expect((MockChart as any).register).toHaveBeenCalled()
    })

    it('does not create Chart instance when datasets is empty', () => {
      mount(GraphViewer, { props: { datasets: [] } })
      expect(MockChart).not.toHaveBeenCalled()
    })

    it('creates Chart instance when datasets are provided', () => {
      const datasets = [
        {
          label: 'Test Drug',
          data: [
            { time: 0, concentration: 0 },
            { time: 1, concentration: 0.5 },
            { time: 2, concentration: 1.0 },
            { time: 4, concentration: 0.5 },
          ],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)
    })

    it('passes canvas element to Chart constructor', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const firstArg = (MockChart as any).mock.calls[0]?.[0]
      expect(firstArg).toBeInstanceOf(HTMLCanvasElement)
    })

    it('configures line chart type', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.type).toBe('line')
    })

    it('uses default startHours=0 and endHours=48 when not provided', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.scales?.x?.min).toBe(0)
      expect(config?.options?.scales?.x?.max).toBe(48)
    })

    it('uses provided startHours and endHours props', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      mount(GraphViewer, {
        props: { datasets, startHours: 6, endHours: 72 },
      })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.scales?.x?.min).toBe(6)
      expect(config?.options?.scales?.x?.max).toBe(72)
    })

    it('fixes y-axis range to 0-1', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.scales?.y?.min).toBe(0)
      expect(config?.options?.scales?.y?.max).toBe(1)
    })

    it('maps TimeSeriesPoint data to Chart.js {x, y} format', () => {
      const datasets = [
        {
          label: 'Drug A',
          data: [
            { time: 0, concentration: 0 },
            { time: 2, concentration: 0.8 },
          ],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      const chartData = config?.data?.datasets?.[0]?.data
      expect(chartData).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0.8 },
      ])
    })

    it('uses dataset color when provided', () => {
      const datasets = [
        {
          label: 'Drug A',
          data: [{ time: 0, concentration: 0 }],
          color: '#FF0000',
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.data?.datasets?.[0]?.borderColor).toBe('#FF0000')
    })

    it('assigns default palette colors when color not provided', () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
        { label: 'Drug B', data: [{ time: 0, concentration: 0 }] },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.data?.datasets?.[0]?.borderColor).toBe('#3B82F6')
      expect(config?.data?.datasets?.[1]?.borderColor).toBe('#EF4444')
    })

    it('renders multiple datasets for multi-drug overlay', () => {
      const datasets = [
        {
          label: 'Drug A',
          data: [
            { time: 0, concentration: 0 },
            { time: 1, concentration: 1 },
          ],
        },
        {
          label: 'Drug B',
          data: [
            { time: 0, concentration: 0 },
            { time: 2, concentration: 0.7 },
          ],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.data?.datasets).toHaveLength(2)
      expect(config?.data?.datasets?.[0]?.label).toBe('Drug A')
      expect(config?.data?.datasets?.[1]?.label).toBe('Drug B')
    })
  })

  // ---- Phase 3: Lifecycle and Reactivity ----

  describe('lifecycle management', () => {
    it('destroys chart instance on unmount', () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      wrapper.unmount()
      expect(mockDestroy).toHaveBeenCalledTimes(1)
    })

    it('destroys and recreates chart when datasets change', async () => {
      const initialDatasets = [
        {
          label: 'Drug A',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      const wrapper = mount(GraphViewer, {
        props: { datasets: initialDatasets },
      })

      const updatedDatasets = [
        {
          label: 'Drug B',
          data: [
            { time: 0, concentration: 0 },
            { time: 3, concentration: 0.9 },
          ],
        },
      ]
      await wrapper.setProps({ datasets: updatedDatasets })

      // Old instance destroyed, then new one created
      expect(mockDestroy).toHaveBeenCalled()
      expect(MockChart).toHaveBeenCalledTimes(2)
    })

    it('re-renders chart when endHours changes', async () => {
      const datasets = [
        {
          label: 'Test',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      const wrapper = mount(GraphViewer, {
        props: { datasets, endHours: 48 },
      })

      await wrapper.setProps({ endHours: 72 })

      expect(MockChart).toHaveBeenCalledTimes(2)
      const secondConfig = (MockChart as any).mock.calls[1]?.[1]
      expect(secondConfig?.options?.scales?.x?.max).toBe(72)
    })

    it('does not create chart instance with empty datasets after unmount', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      wrapper.unmount()
      // destroy is not called because no chart was ever created
      expect(mockDestroy).not.toHaveBeenCalled()
    })
  })

  // ---- Edge Cases ----

  describe('edge cases', () => {
    it('handles transition from datasets to empty datasets', async () => {
      const datasets = [
        {
          label: 'Drug A',
          data: [{ time: 0, concentration: 0 }],
        },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)

      await wrapper.setProps({ datasets: [] })
      // Old chart destroyed, no new chart created
      expect(mockDestroy).toHaveBeenCalled()
    })

    it('handles single data point in dataset', () => {
      const datasets = [
        {
          label: 'Single Point',
          data: [{ time: 5, concentration: 0.5 }],
        },
      ]
      mount(GraphViewer, { props: { datasets } })
      expect(MockChart).toHaveBeenCalledTimes(1)
    })

    it('wraps color palette for more than 8 datasets', () => {
      const datasets = Array.from({ length: 10 }, (_, i) => ({
        label: `Drug ${i}`,
        data: [{ time: 0, concentration: 0 }],
      }))
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      // 9th dataset (index 8) wraps to first color
      expect(config?.data?.datasets?.[8]?.borderColor).toBe('#3B82F6')
      // 10th dataset (index 9) wraps to second color
      expect(config?.data?.datasets?.[9]?.borderColor).toBe('#EF4444')
    })
  })
})
