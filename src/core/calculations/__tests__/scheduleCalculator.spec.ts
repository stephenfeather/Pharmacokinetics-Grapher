import { describe, it, expect } from 'vitest'
import type { Prescription } from '../../models/prescription'
import type { DosageSchedule, DoseStep } from '../../models/dosageSchedule'
import { expandScheduleDoses, accumulateScheduleDoses } from '../scheduleCalculator'

/**
 * Helper: create a valid base prescription for schedule tests.
 */
function makeBasePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 50,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
    ...overrides,
  }
}

/**
 * Helper: create a valid titration schedule.
 */
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

/**
 * Helper: create a valid taper schedule.
 */
function makeTaperSchedule(): DosageSchedule {
  return {
    name: 'Test Taper',
    direction: 'taper',
    basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
    steps: [
      { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
      { stepNumber: 3, dose: 25, durationDays: 7, startDay: 14 },
    ],
    totalDuration: 21,
  }
}

describe('Schedule Calculator', () => {
  // ─── expandScheduleDoses ───

  describe('expandScheduleDoses', () => {
    it('generates correct number of events for bid schedule over 2 steps', () => {
      const schedule = makeTitrationSchedule()
      // bid = 2 doses/day, 7 days per step, 2 steps = 2 * 7 * 2 = 28 events
      const events = expandScheduleDoses(schedule)
      expect(events).toHaveLength(28)
    })

    it('generates correct number of events for qd schedule over 3 steps', () => {
      const schedule = makeTaperSchedule()
      // qd = 1 dose/day, 7 days per step, 3 steps = 1 * 7 * 3 = 21 events
      const events = expandScheduleDoses(schedule)
      expect(events).toHaveLength(21)
    })

    it('assigns correct dose per step', () => {
      const schedule = makeTitrationSchedule()
      const events = expandScheduleDoses(schedule)

      // First 14 events (step 1, 7 days * 2 doses/day) should have dose 25
      for (let i = 0; i < 14; i++) {
        expect(events[i]!.dose).toBe(25)
      }
      // Next 14 events (step 2) should have dose 50
      for (let i = 14; i < 28; i++) {
        expect(events[i]!.dose).toBe(50)
      }
    })

    it('events are sorted by time', () => {
      const schedule = makeTitrationSchedule()
      const events = expandScheduleDoses(schedule)

      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.time).toBeGreaterThanOrEqual(events[i - 1]!.time)
      }
    })

    it('first event starts at the first dosing time', () => {
      const schedule = makeTitrationSchedule()
      const events = expandScheduleDoses(schedule)
      // First dose time is 09:00 = 9 hours
      expect(events[0]!.time).toBe(9)
    })

    it('time values span across day boundaries correctly', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['08:00'] }),
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 3, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 3, startDay: 3 },
        ],
        totalDuration: 6,
      })
      const events = expandScheduleDoses(schedule)

      // 6 events total (1 dose/day * 3 days * 2 steps)
      expect(events).toHaveLength(6)
      // Day 0: 8h, Day 1: 32h, Day 2: 56h, Day 3: 80h, Day 4: 104h, Day 5: 128h
      expect(events[0]!.time).toBe(8)
      expect(events[1]!.time).toBe(32)
      expect(events[2]!.time).toBe(56)
      expect(events[3]!.time).toBe(80)
      expect(events[4]!.time).toBe(104)
      expect(events[5]!.time).toBe(128)
    })

    it('handles single-day steps', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
        steps: [
          { stepNumber: 1, dose: 10, durationDays: 1, startDay: 0 },
          { stepNumber: 2, dose: 20, durationDays: 1, startDay: 1 },
        ],
        totalDuration: 2,
      })
      const events = expandScheduleDoses(schedule)

      expect(events).toHaveLength(2)
      expect(events[0]!.dose).toBe(10)
      expect(events[0]!.time).toBe(9)
      expect(events[1]!.dose).toBe(20)
      expect(events[1]!.time).toBe(33) // day 1 * 24 + 9
    })

    it('returns empty array for schedule with no steps', () => {
      const schedule = makeTitrationSchedule({ steps: [], totalDuration: 0 })
      const events = expandScheduleDoses(schedule)
      expect(events).toEqual([])
    })
  })

  // ─── accumulateScheduleDoses ───

  describe('accumulateScheduleDoses', () => {
    it('returns TimeSeriesPoint array', () => {
      const schedule = makeTitrationSchedule()
      const totalHours = schedule.totalDuration * 24
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      expect(points.length).toBeGreaterThan(0)
      expect(points[0]).toHaveProperty('time')
      expect(points[0]).toHaveProperty('concentration')
    })

    it('normalizes peak concentration to 1.0', () => {
      const schedule = makeTitrationSchedule()
      const totalHours = schedule.totalDuration * 24
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      const maxConc = Math.max(...points.map(p => p.concentration))
      expect(maxConc).toBeCloseTo(1.0, 5)
    })

    it('all concentrations are non-negative', () => {
      const schedule = makeTitrationSchedule()
      const totalHours = schedule.totalDuration * 24
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      for (const p of points) {
        expect(p.concentration).toBeGreaterThanOrEqual(0)
      }
    })

    it('titration curve has higher concentrations in later steps', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 14, startDay: 0 },
          { stepNumber: 2, dose: 100, durationDays: 14, startDay: 14 },
        ],
        totalDuration: 28,
      })
      const totalHours = schedule.totalDuration * 24
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      // Compare average concentration in first half vs second half
      const midIdx = Math.floor(points.length / 2)
      const firstHalf = points.slice(0, midIdx)
      const secondHalf = points.slice(midIdx)

      const avgFirst = firstHalf.reduce((s, p) => s + p.concentration, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((s, p) => s + p.concentration, 0) / secondHalf.length

      expect(avgSecond).toBeGreaterThan(avgFirst)
    })

    it('taper curve has lower concentrations in later steps', () => {
      const schedule = makeTaperSchedule()
      const totalHours = schedule.totalDuration * 24 + 48 // tail-off
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      // Compare average concentration in first third vs last third
      const thirdIdx = Math.floor(points.length / 3)
      const firstThird = points.slice(0, thirdIdx)
      const lastThird = points.slice(2 * thirdIdx)

      const avgFirst = firstThird.reduce((s, p) => s + p.concentration, 0) / firstThird.length
      const avgLast = lastThird.reduce((s, p) => s + p.concentration, 0) / lastThird.length

      expect(avgFirst).toBeGreaterThan(avgLast)
    })

    it('respects intervalMinutes parameter', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 2, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 2, startDay: 2 },
        ],
        totalDuration: 4,
      })
      const totalHours = 96 // 4 days

      const points15 = accumulateScheduleDoses(schedule, 0, totalHours, 15)
      const points30 = accumulateScheduleDoses(schedule, 0, totalHours, 30)

      // 15-min intervals should produce roughly 2x the points of 30-min
      expect(points15.length).toBeGreaterThan(points30.length)
      expect(points15.length).toBeCloseTo(points30.length * 2, -1)
    })

    it('concentration is zero before first dose', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
      })
      const points = accumulateScheduleDoses(schedule, 0, 8)

      // Before 09:00 (9 hours), all concentrations should be 0
      const preDosePoints = points.filter(p => p.time < 9)
      expect(preDosePoints.length).toBeGreaterThan(0)
      for (const p of preDosePoints) {
        expect(p.concentration).toBe(0)
      }
    })

    it('handles very short steps (1 day)', () => {
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 1, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 1, startDay: 1 },
        ],
        totalDuration: 2,
      })
      const points = accumulateScheduleDoses(schedule, 0, 72)

      expect(points.length).toBeGreaterThan(0)
      const maxConc = Math.max(...points.map(p => p.concentration))
      expect(maxConc).toBeCloseTo(1.0, 5)
    })

    it('handles long schedules (30+ days)', () => {
      const steps: DoseStep[] = Array.from({ length: 6 }, (_, i) => ({
        stepNumber: i + 1,
        dose: (i + 1) * 25,
        durationDays: 7,
        startDay: i * 7,
      }))
      const schedule = makeTitrationSchedule({
        basePrescription: makeBasePrescription({ frequency: 'qd', times: ['09:00'] }),
        steps,
        totalDuration: 42,
      })
      const totalHours = 42 * 24
      const points = accumulateScheduleDoses(schedule, 0, totalHours)

      expect(points.length).toBeGreaterThan(0)
      const maxConc = Math.max(...points.map(p => p.concentration))
      expect(maxConc).toBeCloseTo(1.0, 5)
    })
  })
})
