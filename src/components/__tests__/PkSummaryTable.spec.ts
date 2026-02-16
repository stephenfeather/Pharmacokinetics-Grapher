import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PkSummaryTable from '../PkSummaryTable.vue'
import type { PkSummaryData } from '@/core/models/pkSummary'

const mockSummaryData: PkSummaryData[] = [
  {
    prescriptionId: 'rx-1',
    prescriptionName: 'Ibuprofen',
    events: [
      {
        eventType: 'dose',
        clockTime: '08:00',
        elapsedTime: 'T+0h',
        elapsedHours: 8,
        description: 'Dose 400mg administered — absorption begins',
        relativeConcentration: null,
        prescriptionName: 'Ibuprofen',
      },
      {
        eventType: 'absorption_end',
        clockTime: '08:30',
        elapsedTime: 'T+0.5h',
        elapsedHours: 8.5,
        description: 'Absorption phase complete (0.5h)',
        relativeConcentration: null,
        prescriptionName: 'Ibuprofen',
      },
      {
        eventType: 'peak',
        clockTime: '09:30',
        elapsedTime: 'T+1.5h',
        elapsedHours: 9.5,
        description: 'Peak concentration (Cmax) — Tmax 1.5h',
        relativeConcentration: 1.0,
        prescriptionName: 'Ibuprofen',
      },
      {
        eventType: 'half_life',
        clockTime: '11:30',
        elapsedTime: 'T+3.5h',
        elapsedHours: 11.5,
        description: '1 half-life elapsed — ~50% of peak',
        relativeConcentration: 0.5,
        prescriptionName: 'Ibuprofen',
      },
    ],
  },
]

const twoRxSummary: PkSummaryData[] = [
  ...mockSummaryData,
  {
    prescriptionId: 'rx-2',
    prescriptionName: 'Acetaminophen',
    events: [
      {
        eventType: 'dose',
        clockTime: '09:00',
        elapsedTime: 'T+0h',
        elapsedHours: 9,
        description: 'Dose 500mg administered — absorption begins',
        relativeConcentration: null,
        prescriptionName: 'Acetaminophen',
      },
    ],
  },
]

describe('PkSummaryTable', () => {
  it('renders with mock data', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    expect(wrapper.find('.pk-summary-table').exists()).toBe(true)
  })

  it('renders correct number of rows for prescription events', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(4) // dose, absorption, peak, half_life
  })

  it('displays event type badges', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    const badges = wrapper.findAll('.event-badge')
    expect(badges.length).toBe(4)
    expect(badges[0]!.text()).toBe('Dose')
    expect(badges[1]!.text()).toBe('Absorption')
    expect(badges[2]!.text()).toBe('Peak')
    expect(badges[3]!.text()).toBe('Decay')
  })

  it('formats concentration percentages correctly', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    const concCells = wrapper.findAll('.col-concentration')
    // dose event: null -> "—"
    expect(concCells[0]!.text()).toBe('—')
    // absorption_end: null -> "—"
    expect(concCells[1]!.text()).toBe('—')
    // peak: 1.0 -> "100.0%"
    expect(concCells[2]!.text()).toBe('100.0%')
    // half_life: 0.5 -> "50.0%"
    expect(concCells[3]!.text()).toBe('50.0%')
  })

  it('renders multiple prescriptions as separate sections', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: twoRxSummary },
    })

    const sections = wrapper.findAll('.prescription-section')
    expect(sections.length).toBe(2)

    const headers = wrapper.findAll('.section-title')
    expect(headers[0]!.text()).toBe('Ibuprofen')
    expect(headers[1]!.text()).toBe('Acetaminophen')
  })

  it('shows empty message when no data', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: [] },
    })

    expect(wrapper.find('.empty-message').exists()).toBe(true)
    expect(wrapper.find('.empty-message').text()).toContain('No prescriptions')
  })

  it('collapses and expands sections on click', async () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    // Initially expanded
    expect(wrapper.find('table').exists()).toBe(true)

    // Click to collapse
    await wrapper.find('.section-header').trigger('click')
    expect(wrapper.find('table').exists()).toBe(false)

    // Click to expand
    await wrapper.find('.section-header').trigger('click')
    expect(wrapper.find('table').exists()).toBe(true)
  })

  it('has proper accessibility attributes', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    // Region role
    expect(wrapper.find('[role="region"]').exists()).toBe(true)
    expect(wrapper.find('[role="region"]').attributes('aria-label')).toBe(
      'Pharmacokinetic timeline summary',
    )

    // Collapsible header
    const header = wrapper.find('.section-header')
    expect(header.attributes('aria-expanded')).toBe('true')

    // Table semantics
    expect(wrapper.findAll('th[scope="col"]').length).toBe(5)
  })

  it('displays clock time and elapsed time in monospace', () => {
    const wrapper = mount(PkSummaryTable, {
      props: { summaryData: mockSummaryData },
    })

    const timeCells = wrapper.findAll('.col-time')
    expect(timeCells[0]!.text()).toBe('08:00')

    const elapsedCells = wrapper.findAll('.col-elapsed')
    expect(elapsedCells[0]!.text()).toBe('T+0h')
  })
})
