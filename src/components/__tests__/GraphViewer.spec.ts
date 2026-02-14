/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GraphViewer from '../GraphViewer.vue'

// Setup mocks with vi.hoisted() for proper hoisting
const { mockDestroy, mockToBase64Image, MockChart, mockDownloadImage } = vi.hoisted(() => {
  const mockDestroy = vi.fn()
  const mockToBase64Image = vi.fn().mockReturnValue('data:image/png;base64,mock-image-data')

  // Create a spy on a constructor function
  const MockChart = vi.fn(function (this: any) {
    this.destroy = mockDestroy
    this.toBase64Image = mockToBase64Image
  })
  ;(MockChart as any).register = vi.fn()

  const mockDownloadImage = vi.fn().mockReturnValue(true)

  return { mockDestroy, mockToBase64Image, MockChart: MockChart as any, mockDownloadImage }
})

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}))

vi.mock('@/core/export', () => ({
  generateFilename: vi.fn(
    (names: string[] = []) => `pk-graph-${names.join('-')}-test.png`,
  ),
  downloadImage: mockDownloadImage,
}))

vi.mock('chartjs-plugin-a11y-legend', () => ({
  default: { id: 'a11y-legend' },
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

  // ---- Phase 4: Download Button ----

  describe('download button', () => {
    it('does not render download button when datasets are empty', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      expect(wrapper.find('[data-testid="download-graph-btn"]').exists()).toBe(false)
    })

    it('renders download button when datasets exist', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      expect(wrapper.find('[data-testid="download-graph-btn"]').exists()).toBe(true)
    })

    it('download button text is "Download as PNG"', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      expect(wrapper.find('[data-testid="download-graph-btn"]').text()).toBe('Download as PNG')
    })

    it('download button has aria-label', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const btn = wrapper.find('[data-testid="download-graph-btn"]')
      expect(btn.attributes('aria-label')).toBe('Download graph as PNG image')
    })

    it('download button has type="button"', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const btn = wrapper.find('[data-testid="download-graph-btn"]')
      expect(btn.attributes('type')).toBe('button')
    })
  })

  // ---- Phase 5: Export Functionality ----

  describe('export functionality', () => {
    it('calls toBase64Image when download button is clicked', async () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      await wrapper.find('[data-testid="download-graph-btn"]').trigger('click')
      expect(mockToBase64Image).toHaveBeenCalledWith('image/png', 1.0)
    })

    it('calls downloadImage with generated filename', async () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      await wrapper.find('[data-testid="download-graph-btn"]').trigger('click')
      expect(mockDownloadImage).toHaveBeenCalledWith(
        'data:image/png;base64,mock-image-data',
        expect.stringContaining('pk-graph'),
      )
    })

    it('hides download button after datasets become empty', async () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      expect(wrapper.find('[data-testid="download-graph-btn"]').exists()).toBe(true)

      await wrapper.setProps({ datasets: [] })
      expect(wrapper.find('[data-testid="download-graph-btn"]').exists()).toBe(false)
    })
  })

  // ---- Phase 6: defineExpose ----

  describe('exposed methods', () => {
    it('exposes getChartInstance method', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const vm = wrapper.vm as any
      expect(typeof vm.getChartInstance).toBe('function')
    })

    it('getChartInstance returns null when no datasets', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      const vm = wrapper.vm as any
      expect(vm.getChartInstance()).toBeNull()
    })

    it('exposes exportAsImage method', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const vm = wrapper.vm as any
      expect(typeof vm.exportAsImage).toBe('function')
    })

    it('exportAsImage returns false when no chart instance', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      const vm = wrapper.vm as any
      expect(vm.exportAsImage()).toBe(false)
    })

    it('exportAsImage returns true when chart exists', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const vm = wrapper.vm as any
      expect(vm.exportAsImage()).toBe(true)
    })
  })

  // ---- Phase 7: Legend Configuration ----

  describe('legend configuration', () => {
    const singleDataset = [
      { label: 'Ibuprofen 400mg (tid)', data: [{ time: 0, concentration: 0 }] },
    ]

    const multiDataset = [
      { label: 'Ibuprofen 400mg (tid)', data: [{ time: 0, concentration: 0 }] },
      { label: 'Amoxicillin 500mg (bid)', data: [{ time: 0, concentration: 0 }] },
    ]

    it('enables legend display', () => {
      mount(GraphViewer, { props: { datasets: singleDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.plugins?.legend?.display).toBe(true)
    })

    it('positions legend at top by default', () => {
      mount(GraphViewer, { props: { datasets: singleDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.plugins?.legend?.position).toBe('top')
    })

    it('configures usePointStyle for legend labels', () => {
      mount(GraphViewer, { props: { datasets: singleDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.options?.plugins?.legend?.labels?.usePointStyle).toBe(true)
    })

    it('defines explicit onClick handler for legend', () => {
      mount(GraphViewer, { props: { datasets: singleDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(typeof config?.options?.plugins?.legend?.onClick).toBe('function')
    })

    it('defines generateLabels callback for custom label formatting', () => {
      mount(GraphViewer, { props: { datasets: singleDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(typeof config?.options?.plugins?.legend?.labels?.generateLabels).toBe('function')
    })

    it('passes all dataset labels to Chart.js', () => {
      mount(GraphViewer, { props: { datasets: multiDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      expect(config?.data?.datasets?.[0]?.label).toBe('Ibuprofen 400mg (tid)')
      expect(config?.data?.datasets?.[1]?.label).toBe('Amoxicillin 500mg (bid)')
    })

    it('assigns distinct colors from 8-color palette to datasets', () => {
      mount(GraphViewer, { props: { datasets: multiDataset } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      const color0 = config?.data?.datasets?.[0]?.borderColor
      const color1 = config?.data?.datasets?.[1]?.borderColor
      expect(color0).toBe('#3B82F6') // blue
      expect(color1).toBe('#EF4444') // red
      expect(color0).not.toBe(color1) // distinct
    })
  })

  // ---- Phase 8: Canvas Accessibility ----

  describe('canvas accessibility', () => {
    it('canvas has role="img"', () => {
      const datasets = [
        { label: 'Test', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('role')).toBe('img')
    })

    it('canvas has descriptive aria-label with dataset names', () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
        { label: 'Drug B', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const ariaLabel = wrapper.find('canvas').attributes('aria-label')
      expect(ariaLabel).toContain('Drug A')
      expect(ariaLabel).toContain('Drug B')
    })

    it('canvas aria-label indicates no data when datasets empty', () => {
      const wrapper = mount(GraphViewer, { props: { datasets: [] } })
      const ariaLabel = wrapper.find('canvas').attributes('aria-label')
      expect(ariaLabel).toContain('no data')
    })

    it('renders screen-reader summary text', () => {
      const datasets = [
        { label: 'Test Drug', data: [{ time: 0, concentration: 0 }] },
      ]
      const wrapper = mount(GraphViewer, { props: { datasets } })
      const srOnly = wrapper.find('.sr-only')
      expect(srOnly.exists()).toBe(true)
      expect(srOnly.text()).toContain('Test Drug')
    })
  })

  // ---- Phase 9: Legend onClick Handler ----

  describe('legend onClick handler', () => {
    it('onClick handler calls chart.hide for visible dataset', () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      const onClick = config?.options?.plugins?.legend?.onClick

      // Create mock chart and legend item
      const mockHide = vi.fn()
      const mockShow = vi.fn()
      const mockChart = {
        isDatasetVisible: vi.fn().mockReturnValue(true),
        hide: mockHide,
        show: mockShow,
      }
      const legendItem = { datasetIndex: 0 }
      const legend = { chart: mockChart }

      onClick(null, legendItem, legend)

      expect(mockChart.isDatasetVisible).toHaveBeenCalledWith(0)
      expect(mockHide).toHaveBeenCalledWith(0)
      expect(mockShow).not.toHaveBeenCalled()
    })

    it('onClick handler calls chart.show for hidden dataset', () => {
      const datasets = [
        { label: 'Drug A', data: [{ time: 0, concentration: 0 }] },
      ]
      mount(GraphViewer, { props: { datasets } })
      const config = (MockChart as any).mock.calls[0]?.[1]
      const onClick = config?.options?.plugins?.legend?.onClick

      const mockHide = vi.fn()
      const mockShow = vi.fn()
      const mockChart = {
        isDatasetVisible: vi.fn().mockReturnValue(false),
        hide: mockHide,
        show: mockShow,
      }
      const legendItem = { datasetIndex: 0 }
      const legend = { chart: mockChart }

      onClick(null, legendItem, legend)

      expect(mockShow).toHaveBeenCalledWith(0)
      expect(mockHide).not.toHaveBeenCalled()
    })
  })
})
