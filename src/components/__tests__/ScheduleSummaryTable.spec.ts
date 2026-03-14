import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleSummaryTable from '../ScheduleSummaryTable.vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import type { Prescription } from '@/core/models/prescription'

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

function mountTable(schedule: DosageSchedule = makeSchedule()) {
  return mount(ScheduleSummaryTable, {
    props: { schedule },
  })
}

describe('ScheduleSummaryTable', () => {
  // ---- Structure ----

  describe('table structure', () => {
    it('renders a table element', () => {
      const wrapper = mountTable()
      expect(wrapper.find('table').exists()).toBe(true)
    })

    it('renders correct number of body rows', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows).toHaveLength(2)
    })

    it('renders 3 rows for 3-step schedule', () => {
      const schedule = makeSchedule({
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          { stepNumber: 3, dose: 100, durationDays: 7, startDay: 14 },
        ],
        totalDuration: 21,
      })
      const wrapper = mountTable(schedule)
      expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    })

    it('renders all required column headers', () => {
      const wrapper = mountTable()
      const headers = wrapper.findAll('th')
      const headerTexts = headers.map(h => h.text())
      expect(headerTexts).toContain('Step')
      expect(headerTexts).toContain('Dose')
      expect(headerTexts).toContain('Duration')
      expect(headerTexts).toContain('Days')
      expect(headerTexts).toContain('Est. SS Level')
      expect(headerTexts).toContain('Time to SS')
    })
  })

  // ---- Accessibility ----

  describe('accessibility', () => {
    it('uses scope="col" on all th elements', () => {
      const wrapper = mountTable()
      const headers = wrapper.findAll('th')
      for (const th of headers) {
        expect(th.attributes('scope')).toBe('col')
      }
    })

    it('wraps table in a region with aria-label', () => {
      const wrapper = mountTable()
      const region = wrapper.find('[role="region"]')
      expect(region.exists()).toBe(true)
      expect(region.attributes('aria-label')).toContain('summary')
    })
  })

  // ---- Data Accuracy ----

  describe('data accuracy', () => {
    it('displays correct step numbers', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('1')
      expect(rows[1]!.text()).toContain('2')
    })

    it('displays correct doses with mg unit', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('25 mg')
      expect(rows[1]!.text()).toContain('50 mg')
    })

    it('displays correct duration in days', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('7 days')
      expect(rows[1]!.text()).toContain('7 days')
    })

    it('displays correct day range', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('Day 1-7')
      expect(rows[1]!.text()).toContain('Day 8-14')
    })

    it('displays correct day range for non-contiguous start days', () => {
      const schedule = makeSchedule({
        steps: [
          { stepNumber: 1, dose: 10, durationDays: 14, startDay: 0 },
          { stepNumber: 2, dose: 20, durationDays: 21, startDay: 14 },
        ],
        totalDuration: 35,
      })
      const wrapper = mountTable(schedule)
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('Day 1-14')
      expect(rows[1]!.text()).toContain('Day 15-35')
    })

    it('displays steady-state level as relative value', () => {
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      // Step 1: 25/50 = 0.5, Step 2: 50/50 = 1.0
      expect(rows[0]!.text()).toContain('0.5')
      expect(rows[1]!.text()).toContain('1')
    })

    it('calculates time to steady-state from half-life', () => {
      // halfLife=6, so time to SS = 5 * 6 = 30 hours
      const wrapper = mountTable()
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.text()).toContain('30')
    })

    it('warns when step duration is shorter than time to steady-state', () => {
      // halfLife=48 → timeToSS=240 hours=10 days, but step is only 7 days
      const schedule = makeSchedule({
        basePrescription: makeBasePrescription({ halfLife: 48 }),
      })
      const wrapper = mountTable(schedule)
      const warnings = wrapper.findAll('.ss-warning')
      expect(warnings.length).toBeGreaterThan(0)
    })
  })
})
