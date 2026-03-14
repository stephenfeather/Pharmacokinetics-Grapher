import { describe, it, expect } from 'vitest'
import type { Prescription } from '../prescription'
import type {
  ScheduleDirection,
  DoseStep,
  DosageSchedule,
  ScheduleValidationResult,
} from '../dosageSchedule'
import { validateDosageSchedule, computeStartDays } from '../dosageSchedule'

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
 * Helper: create a valid titration schedule with optional overrides.
 */
function makeValidSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
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
function makeValidTaper(): DosageSchedule {
  return {
    name: 'Test Taper',
    direction: 'taper',
    basePrescription: makeBasePrescription(),
    steps: [
      { stepNumber: 1, dose: 100, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
      { stepNumber: 3, dose: 25, durationDays: 7, startDay: 14 },
    ],
    totalDuration: 21,
  }
}

describe('Dosage Schedule Models', () => {
  // ─── Type Definitions (compile-time verification) ───

  describe('ScheduleDirection type', () => {
    it('accepts titration', () => {
      const dir: ScheduleDirection = 'titration'
      expect(dir).toBe('titration')
    })

    it('accepts taper', () => {
      const dir: ScheduleDirection = 'taper'
      expect(dir).toBe('taper')
    })
  })

  describe('DoseStep interface', () => {
    it('has stepNumber, dose, durationDays, and startDay', () => {
      const step: DoseStep = { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 }
      expect(step.stepNumber).toBe(1)
      expect(step.dose).toBe(25)
      expect(step.durationDays).toBe(7)
      expect(step.startDay).toBe(0)
    })
  })

  describe('DosageSchedule interface', () => {
    it('accepts a complete schedule object', () => {
      const schedule = makeValidSchedule()
      expect(schedule.name).toBe('Test Titration')
      expect(schedule.direction).toBe('titration')
      expect(schedule.basePrescription.name).toBe('Test Drug')
      expect(schedule.steps).toHaveLength(2)
      expect(schedule.totalDuration).toBe(14)
    })

    it('allows optional id field', () => {
      const schedule = makeValidSchedule({ id: 'sched-001' })
      expect(schedule.id).toBe('sched-001')
    })

    it('accepts a taper schedule', () => {
      const schedule = makeValidTaper()
      expect(schedule.direction).toBe('taper')
      expect(schedule.steps).toHaveLength(3)
      expect(schedule.totalDuration).toBe(21)
    })
  })

  // ─── computeStartDays ───

  describe('computeStartDays', () => {
    it('computes startDay and stepNumber from step durations', () => {
      const steps: DoseStep[] = [
        { stepNumber: 0, dose: 25, durationDays: 7, startDay: 0 },
        { stepNumber: 0, dose: 50, durationDays: 14, startDay: 0 },
        { stepNumber: 0, dose: 100, durationDays: 7, startDay: 0 },
      ]
      const result = computeStartDays(steps)
      expect(result[0]).toEqual({ stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 })
      expect(result[1]).toEqual({ stepNumber: 2, dose: 50, durationDays: 14, startDay: 7 })
      expect(result[2]).toEqual({ stepNumber: 3, dose: 100, durationDays: 7, startDay: 21 })
    })

    it('returns empty array for empty input', () => {
      expect(computeStartDays([])).toEqual([])
    })

    it('does not mutate the original array', () => {
      const original: DoseStep[] = [
        { stepNumber: 0, dose: 25, durationDays: 7, startDay: 0 },
      ]
      const result = computeStartDays(original)
      expect(original[0]!.stepNumber).toBe(0)
      expect(result[0]!.stepNumber).toBe(1)
    })
  })

  // ─── Validation: Valid Schedules ───

  describe('validateDosageSchedule', () => {
    describe('return structure', () => {
      it('returns an object with valid, errors, and warnings', () => {
        const result: ScheduleValidationResult = validateDosageSchedule(makeValidSchedule())
        expect(result).toHaveProperty('valid')
        expect(result).toHaveProperty('errors')
        expect(result).toHaveProperty('warnings')
        expect(typeof result.valid).toBe('boolean')
        expect(Array.isArray(result.errors)).toBe(true)
        expect(Array.isArray(result.warnings)).toBe(true)
      })
    })

    describe('valid schedules', () => {
      it('passes a valid titration schedule', () => {
        const result = validateDosageSchedule(makeValidSchedule())
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes a valid taper schedule', () => {
        const result = validateDosageSchedule(makeValidTaper())
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes a schedule with exactly 2 steps (minimum)', () => {
        const schedule = makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          ],
          totalDuration: 14,
        })
        const result = validateDosageSchedule(schedule)
        expect(result.valid).toBe(true)
      })

      it('passes a schedule with many steps (10)', () => {
        const steps: DoseStep[] = Array.from({ length: 10 }, (_, i) => ({
          stepNumber: i + 1,
          dose: (i + 1) * 10,
          durationDays: 3,
          startDay: i * 3,
        }))
        const schedule = makeValidSchedule({ steps, totalDuration: 30 })
        const result = validateDosageSchedule(schedule)
        expect(result.valid).toBe(true)
      })

      it('passes a schedule with optional id', () => {
        const result = validateDosageSchedule(makeValidSchedule({ id: 'sched-abc' }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Validation: Name ───

    describe('name validation', () => {
      it('rejects empty name', () => {
        const result = validateDosageSchedule(makeValidSchedule({ name: '' }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /name/i.test(e))).toBe(true)
      })

      it('rejects whitespace-only name', () => {
        const result = validateDosageSchedule(makeValidSchedule({ name: '   ' }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /name/i.test(e))).toBe(true)
      })

      it('rejects name exceeding 100 characters', () => {
        const result = validateDosageSchedule(makeValidSchedule({ name: 'A'.repeat(101) }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /name/i.test(e) && /100/i.test(e))).toBe(true)
      })

      it('accepts single character name', () => {
        const result = validateDosageSchedule(makeValidSchedule({ name: 'X' }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Validation: Direction ───

    describe('direction validation', () => {
      it('rejects invalid direction', () => {
        const result = validateDosageSchedule(
          makeValidSchedule({ direction: 'invalid' as ScheduleDirection }),
        )
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /direction/i.test(e))).toBe(true)
      })

      it('accepts titration direction', () => {
        const result = validateDosageSchedule(makeValidSchedule({ direction: 'titration' }))
        expect(result.valid).toBe(true)
      })

      it('accepts taper direction', () => {
        const result = validateDosageSchedule(makeValidSchedule({ direction: 'taper' }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Validation: Steps ───

    describe('steps validation', () => {
      it('rejects schedule with 0 steps', () => {
        const result = validateDosageSchedule(makeValidSchedule({ steps: [], totalDuration: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /step/i.test(e) && /2/i.test(e))).toBe(true)
      })

      it('rejects schedule with 1 step', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [{ stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 }],
          totalDuration: 7,
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /step/i.test(e) && /2/i.test(e))).toBe(true)
      })

      it('rejects step with dose of 0', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 0, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          ],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /dose/i.test(e) && /step 1/i.test(e))).toBe(true)
      })

      it('rejects step with negative dose', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: -10, durationDays: 7, startDay: 7 },
          ],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /dose/i.test(e) && /step 2/i.test(e))).toBe(true)
      })

      it('rejects step with duration of 0 days', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 0, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 7, startDay: 0 },
          ],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /duration/i.test(e) && /step 1/i.test(e))).toBe(true)
      })

      it('rejects step with negative duration', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: -3, startDay: 7 },
          ],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /duration/i.test(e) && /step 2/i.test(e))).toBe(true)
      })

      it('accepts steps with fractional duration days', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 3.5, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 3.5, startDay: 3.5 },
          ],
          totalDuration: 7,
        }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Validation: Warnings for non-monotonic doses ───

    describe('dose monotonicity warnings', () => {
      it('warns when titration has a dose decrease', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          direction: 'titration',
          steps: [
            { stepNumber: 1, dose: 50, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 25, durationDays: 7, startDay: 7 },
          ],
        }))
        expect(result.valid).toBe(true)
        expect(result.warnings.some(w => /decrease/i.test(w) || /titration/i.test(w))).toBe(true)
      })

      it('warns when taper has a dose increase', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          direction: 'taper',
          steps: [
            { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          ],
        }))
        expect(result.valid).toBe(true)
        expect(result.warnings.some(w => /increase/i.test(w) || /taper/i.test(w))).toBe(true)
      })

      it('does not warn when titration doses increase', () => {
        const result = validateDosageSchedule(makeValidSchedule())
        expect(result.warnings.filter(w => /decrease/i.test(w) || /increase/i.test(w))).toEqual([])
      })

      it('does not warn when taper doses decrease', () => {
        const result = validateDosageSchedule(makeValidTaper())
        expect(result.warnings.filter(w => /decrease/i.test(w) || /increase/i.test(w))).toEqual([])
      })

      it('allows equal consecutive doses without warning', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          direction: 'titration',
          steps: [
            { stepNumber: 1, dose: 50, durationDays: 7, startDay: 0 },
            { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
            { stepNumber: 3, dose: 100, durationDays: 7, startDay: 14 },
          ],
          totalDuration: 21,
        }))
        expect(result.valid).toBe(true)
        expect(result.warnings.filter(w => /decrease/i.test(w))).toEqual([])
      })
    })

    // ─── Validation: Base Prescription ───

    describe('base prescription validation', () => {
      it('rejects schedule with invalid base prescription', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          basePrescription: makeBasePrescription({ halfLife: 0 }),
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => /half-life/i.test(e) || /prescription/i.test(e))).toBe(true)
      })

      it('rejects schedule with empty drug name in base prescription', () => {
        const result = validateDosageSchedule(makeValidSchedule({
          basePrescription: makeBasePrescription({ name: '' }),
        }))
        expect(result.valid).toBe(false)
      })
    })

    // ─── Error Accumulation ───

    describe('error accumulation', () => {
      it('collects errors from multiple invalid fields', () => {
        const result = validateDosageSchedule({
          name: '',
          direction: 'invalid' as ScheduleDirection,
          basePrescription: makeBasePrescription({ halfLife: 0 }),
          steps: [],
          totalDuration: 0,
        })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(3)
      })
    })
  })

  // ─── Barrel Exports ───

  describe('barrel exports from index.ts', () => {
    it('exports dosage schedule types and functions from index', async () => {
      const indexModule = await import('../index')
      expect(indexModule.validateDosageSchedule).toBeDefined()
      expect(typeof indexModule.validateDosageSchedule).toBe('function')
      expect(indexModule.computeStartDays).toBeDefined()
      expect(typeof indexModule.computeStartDays).toBe('function')
    })
  })
})
