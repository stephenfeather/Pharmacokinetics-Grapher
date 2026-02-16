import { describe, it, expect } from 'vitest'
import type { Prescription, FrequencyLabel, TimeSeriesPoint, GraphDataset, ValidationResult } from '../prescription'
import {
  FREQUENCY_MAP,
  VALIDATION_RULES,
  KA_KE_TOLERANCE,
  validatePrescription,
} from '../prescription'
import {
  SINGLE_DOSE_FIXTURE,
  BID_MULTI_DOSE_FIXTURE,
  KA_APPROX_KE_FIXTURE,
  MIN_BOUNDARY_FIXTURE,
  MAX_BOUNDARY_FIXTURE,
  IBUPROFEN_FIXTURE,
} from './fixtures'

/**
 * Helper: create a valid prescription with optional overrides.
 * Uses a baseline that passes all validation rules.
 */
function makeValid(overrides: Partial<Prescription> = {}): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 500,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
    ...overrides,
  }
}

describe('Prescription Models', () => {
  // ─── Phase 1: Type Definitions (compile-time verification) ───

  describe('FrequencyLabel type', () => {
    it('accepts all valid frequency labels', () => {
      const labels: FrequencyLabel[] = ['once', 'qd', 'bid', 'tid', 'qid', 'q6h', 'q8h', 'q12h', 'custom']
      expect(labels).toHaveLength(9)
    })
  })

  describe('Prescription interface', () => {
    it('accepts a complete prescription object', () => {
      const rx: Prescription = makeValid()
      expect(rx.name).toBe('Test Drug')
      expect(rx.frequency).toBe('bid')
      expect(rx.times).toEqual(['09:00', '21:00'])
      expect(rx.dose).toBe(500)
      expect(rx.halfLife).toBe(6)
      expect(rx.peak).toBe(2)
      expect(rx.uptake).toBe(1.5)
    })

    it('allows optional id field', () => {
      const rx: Prescription = makeValid({ id: 'abc-123' })
      expect(rx.id).toBe('abc-123')
    })

    it('allows optional metaboliteLife field', () => {
      const rx: Prescription = makeValid({ metaboliteLife: 12 })
      expect(rx.metaboliteLife).toBe(12)
    })
  })

  describe('TimeSeriesPoint interface', () => {
    it('has time and concentration fields', () => {
      const point: TimeSeriesPoint = { time: 1.5, concentration: 0.75 }
      expect(point.time).toBe(1.5)
      expect(point.concentration).toBe(0.75)
    })
  })

  describe('GraphDataset interface', () => {
    it('has label, data, and optional color', () => {
      const dataset: GraphDataset = {
        label: 'Drug A',
        data: [{ time: 0, concentration: 0 }, { time: 1, concentration: 0.5 }],
        color: '#FF0000',
      }
      expect(dataset.label).toBe('Drug A')
      expect(dataset.data).toHaveLength(2)
      expect(dataset.color).toBe('#FF0000')
    })

    it('color is optional', () => {
      const dataset: GraphDataset = {
        label: 'Drug B',
        data: [],
      }
      expect(dataset.color).toBeUndefined()
    })
  })

  // ─── Phase 2: Constants ───

  describe('FREQUENCY_MAP', () => {
    it('maps once to 1', () => {
      expect(FREQUENCY_MAP.once).toBe(1)
    })

    it('maps qd to 1', () => {
      expect(FREQUENCY_MAP.qd).toBe(1)
    })

    it('maps bid to 2', () => {
      expect(FREQUENCY_MAP.bid).toBe(2)
    })

    it('maps tid to 3', () => {
      expect(FREQUENCY_MAP.tid).toBe(3)
    })

    it('maps qid to 4', () => {
      expect(FREQUENCY_MAP.qid).toBe(4)
    })

    it('maps q6h to 4', () => {
      expect(FREQUENCY_MAP.q6h).toBe(4)
    })

    it('maps q8h to 3', () => {
      expect(FREQUENCY_MAP.q8h).toBe(3)
    })

    it('maps q12h to 2', () => {
      expect(FREQUENCY_MAP.q12h).toBe(2)
    })

    it('maps custom to null', () => {
      expect(FREQUENCY_MAP.custom).toBeNull()
    })

    it('has exactly 9 entries', () => {
      expect(Object.keys(FREQUENCY_MAP)).toHaveLength(9)
    })
  })

  describe('VALIDATION_RULES', () => {
    it('defines name rules with required, minLength, maxLength', () => {
      expect(VALIDATION_RULES.name).toEqual({
        required: true,
        minLength: 1,
        maxLength: 100,
      })
    })

    it('defines dose rules with min 0.001 and max 10000', () => {
      expect(VALIDATION_RULES.dose).toMatchObject({
        required: true,
        min: 0.001,
        max: 10000,
      })
    })

    it('defines frequency rules with all 9 allowed values', () => {
      expect(VALIDATION_RULES.frequency.allowedValues).toEqual(
        ['once', 'qd', 'bid', 'tid', 'qid', 'q6h', 'q8h', 'q12h', 'custom'],
      )
    })

    it('defines times rules', () => {
      expect(VALIDATION_RULES.times).toMatchObject({
        required: true,
        format: 'HH:MM',
        minLength: 1,
        mustMatchFrequency: true,
      })
    })

    it('defines halfLife rules with min 0.1 and max 240', () => {
      expect(VALIDATION_RULES.halfLife).toMatchObject({
        required: true,
        min: 0.1,
        max: 240,
      })
    })

    it('defines peak rules with min 0.1 and max 48', () => {
      expect(VALIDATION_RULES.peak).toMatchObject({
        required: true,
        min: 0.1,
        max: 48,
      })
    })

    it('defines uptake rules with min 0.1 and max 24', () => {
      expect(VALIDATION_RULES.uptake).toMatchObject({
        required: true,
        min: 0.1,
        max: 24,
      })
    })

    it('defines metaboliteLife rules as optional with min 0.1 and max 1000', () => {
      expect(VALIDATION_RULES.metaboliteLife).toMatchObject({
        required: false,
        min: 0.1,
        max: 1000,
      })
    })

    it('defines metaboliteConversionFraction rules as optional with min 0.0 and max 1.0', () => {
      expect(VALIDATION_RULES.metaboliteConversionFraction).toMatchObject({
        required: false,
        min: 0.0,
        max: 1.0,
      })
    })
  })

  describe('KA_KE_TOLERANCE', () => {
    it('is 0.001', () => {
      expect(KA_KE_TOLERANCE).toBe(0.001)
    })
  })

  // ─── Phase 3: Validation Function Basics ───

  describe('validatePrescription', () => {
    describe('return structure', () => {
      it('returns an object with valid, errors, and warnings', () => {
        const result: ValidationResult = validatePrescription(makeValid())
        expect(result).toHaveProperty('valid')
        expect(result).toHaveProperty('errors')
        expect(result).toHaveProperty('warnings')
        expect(typeof result.valid).toBe('boolean')
        expect(Array.isArray(result.errors)).toBe(true)
        expect(Array.isArray(result.warnings)).toBe(true)
      })
    })

    // ─── Phase 3: Valid Prescriptions ───

    describe('valid prescriptions', () => {
      it('passes a baseline valid prescription', () => {
        const result = validatePrescription(makeValid())
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
        expect(result.warnings).toEqual([])
      })

      it('passes with optional id field', () => {
        const result = validatePrescription(makeValid({ id: 'rx-001' }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes with optional metaboliteLife', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 50 }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes with frequency once and 1 time', () => {
        const result = validatePrescription(makeValid({
          frequency: 'once',
          times: ['09:00'],
        }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes with frequency qd and 1 time', () => {
        const result = validatePrescription(makeValid({
          frequency: 'qd',
          times: ['09:00'],
        }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes with frequency custom and variable time counts', () => {
        for (const times of [['08:00'], ['08:00', '12:00', '16:00', '20:00', '23:00']]) {
          const result = validatePrescription(makeValid({
            frequency: 'custom',
            times,
          }))
          expect(result.valid).toBe(true)
          expect(result.errors).toEqual([])
        }
      })

      it('passes at boundary minimum values', () => {
        const result = validatePrescription(makeValid({
          dose: 0.001,
          halfLife: 0.1,
          peak: 0.1,
          uptake: 0.1,
        }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes at boundary maximum values', () => {
        const result = validatePrescription(makeValid({
          frequency: 'once',
          times: ['23:59'],
          dose: 10000,
          halfLife: 240,
          peak: 48,
          uptake: 24,
        }))
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('passes with all standard frequency types', () => {
        const frequencyCases: Array<{ frequency: FrequencyLabel; times: string[] }> = [
          { frequency: 'once', times: ['09:00'] },
          { frequency: 'qd', times: ['09:00'] },
          { frequency: 'bid', times: ['09:00', '21:00'] },
          { frequency: 'tid', times: ['08:00', '14:00', '20:00'] },
          { frequency: 'qid', times: ['06:00', '12:00', '18:00', '23:00'] },
          { frequency: 'q6h', times: ['00:00', '06:00', '12:00', '18:00'] },
          { frequency: 'q8h', times: ['08:00', '16:00', '00:00'] },
          { frequency: 'q12h', times: ['08:00', '20:00'] },
        ]
        for (const fc of frequencyCases) {
          const result = validatePrescription(makeValid(fc))
          expect(result.valid).toBe(true)
          expect(result.errors).toEqual([])
        }
      })
    })

    // ─── Phase 4: Name Validation ───

    describe('name validation', () => {
      it('rejects empty string name', () => {
        const result = validatePrescription(makeValid({ name: '' }))
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some((e) => /name/i.test(e) && /empty/i.test(e))).toBe(true)
      })

      it('rejects whitespace-only name', () => {
        const result = validatePrescription(makeValid({ name: '   ' }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /name/i.test(e) && /empty/i.test(e))).toBe(true)
      })

      it('rejects name exceeding 100 characters', () => {
        const result = validatePrescription(makeValid({ name: 'A'.repeat(101) }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /name/i.test(e) && /100/i.test(e))).toBe(true)
      })

      it('accepts single character name', () => {
        const result = validatePrescription(makeValid({ name: 'X' }))
        expect(result.valid).toBe(true)
      })

      it('accepts exactly 100 character name', () => {
        const result = validatePrescription(makeValid({ name: 'A'.repeat(100) }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 5: Dose Validation ───

    describe('dose validation', () => {
      it('rejects dose of 0', () => {
        const result = validatePrescription(makeValid({ dose: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /dose/i.test(e) && /0\.001/i.test(e))).toBe(true)
      })

      it('rejects negative dose', () => {
        const result = validatePrescription(makeValid({ dose: -1 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /dose/i.test(e))).toBe(true)
      })

      it('rejects dose exceeding 10000', () => {
        const result = validatePrescription(makeValid({ dose: 10001 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /dose/i.test(e) && /10[\s,]*000/i.test(e))).toBe(true)
      })

      it('rejects NaN dose', () => {
        const result = validatePrescription(makeValid({ dose: NaN }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /dose/i.test(e))).toBe(true)
      })

      it('accepts dose at minimum boundary (0.001)', () => {
        const result = validatePrescription(makeValid({ dose: 0.001 }))
        expect(result.valid).toBe(true)
      })

      it('accepts dose at maximum boundary (10000)', () => {
        const result = validatePrescription(makeValid({ dose: 10000 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical dose (500)', () => {
        const result = validatePrescription(makeValid({ dose: 500 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 6: Frequency Validation ───

    describe('frequency validation', () => {
      it('rejects invalid frequency value', () => {
        const result = validatePrescription(makeValid({ frequency: 'invalid' as FrequencyLabel }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /frequency/i.test(e))).toBe(true)
      })

      it('rejects empty string frequency', () => {
        const result = validatePrescription(makeValid({ frequency: '' as FrequencyLabel }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /frequency/i.test(e))).toBe(true)
      })

      it('accepts each of the 9 valid frequency labels', () => {
        const labels: FrequencyLabel[] = ['once', 'qd', 'bid', 'tid', 'qid', 'q6h', 'q8h', 'q12h', 'custom']
        for (const freq of labels) {
          const times = freq === 'custom'
            ? ['09:00']
            : Array.from({ length: FREQUENCY_MAP[freq] ?? 1 }, (_, i) =>
                `${String(i * 4).padStart(2, '0')}:00`,
              )
          const result = validatePrescription(makeValid({ frequency: freq, times }))
          // Should have no frequency errors (may have other field warnings)
          expect(result.errors.filter((e) => /frequency/i.test(e))).toEqual([])
        }
      })
    })

    // ─── Phase 7: Times Validation ───

    describe('times validation', () => {
      it('rejects empty times array', () => {
        const result = validatePrescription(makeValid({ times: [] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /time/i.test(e))).toBe(true)
      })

      it('rejects time 25:00', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['25:00'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /25:00/i.test(e))).toBe(true)
      })

      it('rejects single-digit hour format 9:00', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['9:00'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /9:00/i.test(e))).toBe(true)
      })

      it('rejects invalid minutes 12:60', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['12:60'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /12:60/i.test(e))).toBe(true)
      })

      it('rejects hour 24:00', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['24:00'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /24:00/i.test(e))).toBe(true)
      })

      it('rejects empty string time entry', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: [''] }))
        expect(result.valid).toBe(false)
      })

      it('rejects non-time string abc', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['abc'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /abc/i.test(e))).toBe(true)
      })

      it('rejects bid frequency with only 1 time', () => {
        const result = validatePrescription(makeValid({ frequency: 'bid', times: ['09:00'] }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /bid/i.test(e) && /2/i.test(e))).toBe(true)
      })

      it('rejects bid frequency with 3 times', () => {
        const result = validatePrescription(makeValid({
          frequency: 'bid',
          times: ['09:00', '15:00', '21:00'],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /bid/i.test(e) && /2/i.test(e))).toBe(true)
      })

      it('rejects tid frequency with 2 times', () => {
        const result = validatePrescription(makeValid({
          frequency: 'tid',
          times: ['09:00', '21:00'],
        }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /tid/i.test(e) && /3/i.test(e))).toBe(true)
      })

      it('accepts midnight 00:00', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['00:00'] }))
        expect(result.valid).toBe(true)
      })

      it('accepts end-of-day 23:59', () => {
        const result = validatePrescription(makeValid({ frequency: 'once', times: ['23:59'] }))
        expect(result.valid).toBe(true)
      })

      it('accepts bid with exactly 2 valid times', () => {
        const result = validatePrescription(makeValid({
          frequency: 'bid',
          times: ['09:00', '21:00'],
        }))
        expect(result.valid).toBe(true)
      })

      it('accepts custom frequency with 5 times', () => {
        const result = validatePrescription(makeValid({
          frequency: 'custom',
          times: ['06:00', '10:00', '14:00', '18:00', '22:00'],
        }))
        expect(result.valid).toBe(true)
      })

      it('accepts custom frequency with 1 time', () => {
        const result = validatePrescription(makeValid({
          frequency: 'custom',
          times: ['12:00'],
        }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 8: halfLife Validation ───

    describe('halfLife validation', () => {
      it('rejects halfLife of 0', () => {
        const result = validatePrescription(makeValid({ halfLife: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /half-life/i.test(e) && /0\.1/i.test(e))).toBe(true)
      })

      it('rejects halfLife below minimum (0.09)', () => {
        const result = validatePrescription(makeValid({ halfLife: 0.09 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /half-life/i.test(e))).toBe(true)
      })

      it('rejects halfLife above maximum (241)', () => {
        const result = validatePrescription(makeValid({ halfLife: 241 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /half-life/i.test(e) && /240/i.test(e))).toBe(true)
      })

      it('rejects NaN halfLife', () => {
        const result = validatePrescription(makeValid({ halfLife: NaN }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /half-life/i.test(e))).toBe(true)
      })

      it('accepts halfLife at minimum boundary (0.1)', () => {
        const result = validatePrescription(makeValid({ halfLife: 0.1 }))
        expect(result.valid).toBe(true)
      })

      it('accepts halfLife at maximum boundary (240)', () => {
        const result = validatePrescription(makeValid({ halfLife: 240 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical halfLife (6)', () => {
        const result = validatePrescription(makeValid({ halfLife: 6 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 9: Peak Validation ───

    describe('peak validation', () => {
      it('rejects peak of 0', () => {
        const result = validatePrescription(makeValid({ peak: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /peak/i.test(e))).toBe(true)
      })

      it('rejects peak below minimum (0.09)', () => {
        const result = validatePrescription(makeValid({ peak: 0.09 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /peak/i.test(e))).toBe(true)
      })

      it('rejects peak above maximum (49)', () => {
        const result = validatePrescription(makeValid({ peak: 49 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /peak/i.test(e) && /48/i.test(e))).toBe(true)
      })

      it('accepts peak at minimum boundary (0.1)', () => {
        const result = validatePrescription(makeValid({ peak: 0.1 }))
        expect(result.valid).toBe(true)
      })

      it('accepts peak at maximum boundary (48)', () => {
        const result = validatePrescription(makeValid({ peak: 48 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical peak (2)', () => {
        const result = validatePrescription(makeValid({ peak: 2 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 10: Uptake Validation ───

    describe('uptake validation', () => {
      it('rejects uptake of 0', () => {
        const result = validatePrescription(makeValid({ uptake: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /uptake/i.test(e))).toBe(true)
      })

      it('rejects uptake below minimum (0.09)', () => {
        const result = validatePrescription(makeValid({ uptake: 0.09 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /uptake/i.test(e))).toBe(true)
      })

      it('rejects uptake above maximum (25)', () => {
        const result = validatePrescription(makeValid({ uptake: 25 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /uptake/i.test(e) && /24/i.test(e))).toBe(true)
      })

      it('accepts uptake at minimum boundary (0.1)', () => {
        const result = validatePrescription(makeValid({ uptake: 0.1 }))
        expect(result.valid).toBe(true)
      })

      it('accepts uptake at maximum boundary (24)', () => {
        const result = validatePrescription(makeValid({ uptake: 24 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical uptake (1.5)', () => {
        const result = validatePrescription(makeValid({ uptake: 1.5 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 11: metaboliteLife Validation ───

    describe('metaboliteLife validation', () => {
      it('accepts undefined metaboliteLife (optional field)', () => {
        const rx = makeValid()
        delete (rx as Partial<Prescription>).metaboliteLife
        const result = validatePrescription(rx)
        expect(result.valid).toBe(true)
      })

      it('accepts metaboliteLife not present on object', () => {
        // makeValid() does not include metaboliteLife by default
        const result = validatePrescription(makeValid())
        expect(result.valid).toBe(true)
      })

      it('rejects metaboliteLife of 0', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 0 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /metabolite/i.test(e))).toBe(true)
      })

      it('rejects metaboliteLife below minimum (0.09)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 0.09 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /metabolite/i.test(e))).toBe(true)
      })

      it('rejects metaboliteLife above maximum (1001)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 1001 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /metabolite/i.test(e) && /1[\s,]*000/i.test(e))).toBe(true)
      })

      it('accepts metaboliteLife at minimum boundary (0.1)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 0.1 }))
        expect(result.valid).toBe(true)
      })

      it('accepts metaboliteLife at maximum boundary (1000)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 1000 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical metaboliteLife (50)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 50 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 11b: Metabolite Conversion Fraction Validation ───

    describe('metaboliteConversionFraction validation', () => {
      it('accepts undefined metaboliteConversionFraction (optional field)', () => {
        const rx = makeValid()
        delete (rx as Partial<Prescription>).metaboliteConversionFraction
        const result = validatePrescription(rx)
        expect(result.valid).toBe(true)
      })

      it('accepts metaboliteConversionFraction not present on object', () => {
        // makeValid() does not include metaboliteConversionFraction by default
        const result = validatePrescription(makeValid())
        expect(result.valid).toBe(true)
      })

      it('rejects metaboliteConversionFraction below 0 (-0.1)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: -0.1 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /metabolite.*conversion/i.test(e))).toBe(true)
      })

      it('rejects metaboliteConversionFraction above 1.0 (1.5)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: 1.5 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /metabolite.*conversion/i.test(e))).toBe(true)
      })

      it('accepts metaboliteConversionFraction at minimum boundary (0.0)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: 0.0 }))
        expect(result.valid).toBe(true)
      })

      it('accepts metaboliteConversionFraction at maximum boundary (1.0)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: 1.0 }))
        expect(result.valid).toBe(true)
      })

      it('accepts typical metaboliteConversionFraction (0.8)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: 0.8 }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 12: Cross-Field Warnings ───

    describe('cross-field warnings', () => {
      it('warns when uptake equals halfLife (atypical kinetics)', () => {
        // uptake=6, halfLife=6 -> ka=ke, both atypical and ka~ke
        const result = validatePrescription(makeValid({ uptake: 6, halfLife: 6 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some((w) => /atypical/i.test(w) || /uptake/i.test(w))).toBe(true)
      })

      it('warns when uptake is greater than halfLife', () => {
        // uptake=8, halfLife=6 -> uptake > halfLife
        const result = validatePrescription(makeValid({ uptake: 8, halfLife: 6 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some((w) => /atypical/i.test(w) || /uptake/i.test(w))).toBe(true)
      })

      it('warns when ka approximately equals ke (within tolerance)', () => {
        // Find values where |ka - ke| < 0.001 but uptake != halfLife
        // ka = 0.693/uptake, ke = 0.693/halfLife
        // If uptake=6 and halfLife=6: ka=ke=0.1155, |ka-ke|=0 < 0.001
        const result = validatePrescription(makeValid({ uptake: 6, halfLife: 6 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => /ka/i.test(w) || /ke/i.test(w) || /fallback/i.test(w) || /rate constant/i.test(w))).toBe(true)
      })

      it('does not warn when uptake is less than halfLife (normal case)', () => {
        const result = validatePrescription(makeValid({ uptake: 1.5, halfLife: 6 }))
        expect(result.valid).toBe(true)
        expect(result.warnings).toEqual([])
      })

      it('warns when only metaboliteLife is provided (missing conversion fraction)', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 12 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => /metabolite.*conversion/i.test(w) || /both.*required/i.test(w))).toBe(true)
      })

      it('warns when only metaboliteConversionFraction is provided (missing half-life)', () => {
        const result = validatePrescription(makeValid({ metaboliteConversionFraction: 0.8 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.some((w) => /metabolite.*half-life/i.test(w) || /both.*required/i.test(w))).toBe(true)
      })

      it('does not warn when both metaboliteLife and metaboliteConversionFraction are provided', () => {
        const result = validatePrescription(makeValid({ metaboliteLife: 12, metaboliteConversionFraction: 0.8 }))
        expect(result.valid).toBe(true)
        // Should have no metabolite-related warnings
        expect(result.warnings.some((w) => /metabolite.*conversion/i.test(w) || /metabolite.*half-life/i.test(w))).toBe(false)
      })

      it('warnings do not cause valid to be false', () => {
        const result = validatePrescription(makeValid({ uptake: 8, halfLife: 6 }))
        expect(result.valid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
      })
    })

    // ─── Phase 13: Multiple Errors (No Short-Circuit) ───

    describe('error accumulation (no short-circuit)', () => {
      it('collects errors from multiple invalid fields', () => {
        const result = validatePrescription({
          name: '',
          frequency: 'invalid' as FrequencyLabel,
          times: [],
          dose: 0,
          halfLife: NaN,
          peak: 0,
          uptake: 0,
        })
        expect(result.valid).toBe(false)
        // Should have at least one error for each invalid field
        expect(result.errors.length).toBeGreaterThanOrEqual(5)
      })

      it('returns all name and dose errors together', () => {
        const result = validatePrescription(makeValid({ name: '', dose: -1 }))
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => /name/i.test(e))).toBe(true)
        expect(result.errors.some((e) => /dose/i.test(e))).toBe(true)
      })
    })

    // ─── Phase 14: Edge Cases ───

    describe('edge cases', () => {
      it('accepts prescription with all fields at exact minimums', () => {
        const result = validatePrescription({
          name: 'X',
          frequency: 'once',
          times: ['00:00'],
          dose: 0.001,
          halfLife: 0.1,
          peak: 0.1,
          uptake: 0.1,
        })
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('accepts prescription with all fields at exact maximums', () => {
        const result = validatePrescription({
          name: 'A'.repeat(100),
          frequency: 'once',
          times: ['23:59'],
          dose: 10000,
          halfLife: 240,
          peak: 48,
          uptake: 24,
        })
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('rejects 101-character name', () => {
        const result = validatePrescription(makeValid({ name: 'A'.repeat(101) }))
        expect(result.valid).toBe(false)
      })

      it('accepts exact 100-character name', () => {
        const result = validatePrescription(makeValid({ name: 'A'.repeat(100) }))
        expect(result.valid).toBe(true)
      })
    })

    // ─── Phase 15: Reference Fixtures Validation ───

    describe('reference test fixtures', () => {
      it('validates SINGLE_DOSE_FIXTURE', () => {
        const result = validatePrescription(SINGLE_DOSE_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('validates BID_MULTI_DOSE_FIXTURE', () => {
        const result = validatePrescription(BID_MULTI_DOSE_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('validates KA_APPROX_KE_FIXTURE with warnings', () => {
        const result = validatePrescription(KA_APPROX_KE_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('validates MIN_BOUNDARY_FIXTURE', () => {
        const result = validatePrescription(MIN_BOUNDARY_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('validates MAX_BOUNDARY_FIXTURE', () => {
        const result = validatePrescription(MAX_BOUNDARY_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
      })

      it('validates IBUPROFEN_FIXTURE', () => {
        const result = validatePrescription(IBUPROFEN_FIXTURE)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
        expect(result.warnings).toEqual([])
      })
    })
  })

  // ─── Phase 15: Duration Fields ───

  describe('Prescription interface with duration', () => {
    it('allows optional duration field', () => {
      const rx: Prescription = makeValid({ duration: 7 })
      expect(rx.duration).toBe(7)
    })

    it('allows optional durationUnit field', () => {
      const rx: Prescription = makeValid({ durationUnit: 'days' })
      expect(rx.durationUnit).toBe('days')
    })

    it('accepts both duration and durationUnit together', () => {
      const rx: Prescription = makeValid({ duration: 10, durationUnit: 'hours' })
      expect(rx.duration).toBe(10)
      expect(rx.durationUnit).toBe('hours')
    })

    it('durationUnit can be "days" or "hours"', () => {
      const days: Prescription = makeValid({ durationUnit: 'days' })
      const hours: Prescription = makeValid({ durationUnit: 'hours' })
      expect(days.durationUnit).toBe('days')
      expect(hours.durationUnit).toBe('hours')
    })
  })

  describe('Duration Validation', () => {
    it('validateDuration accepts valid day duration', () => {
      // Import validateDuration when it exists
      // For now this test documents expected behavior
      const rx: Prescription = makeValid({ duration: 7, durationUnit: 'days' })
      const result = validatePrescription(rx)
      // Should be valid with duration and unit
      expect(result.valid).toBe(true)
    })

    it('validateDuration accepts valid hour duration', () => {
      const rx: Prescription = makeValid({ duration: 168, durationUnit: 'hours' })
      const result = validatePrescription(rx)
      expect(result.valid).toBe(true)
    })

    it('validatePrescription passes when duration is undefined', () => {
      const rx: Prescription = makeValid()
      // Test that prescription without duration fields is still valid
      const rxWithoutDuration: Prescription = {
        ...rx,
        duration: undefined,
        durationUnit: undefined,
      }
      const result = validatePrescription(rxWithoutDuration)
      expect(result.valid).toBe(true)
    })

    it('validatePrescription errors when duration provided without durationUnit', () => {
      const rx: Prescription = makeValid({ duration: 7 })
      const result = validatePrescription(rx)
      // Should fail cross-field validation
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription errors when durationUnit provided without duration', () => {
      const rx: Prescription = makeValid({ durationUnit: 'days' })
      const result = validatePrescription(rx)
      // Should fail cross-field validation
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription errors when duration is negative', () => {
      const rx: Prescription = makeValid({ duration: -5, durationUnit: 'days' })
      const result = validatePrescription(rx)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription errors when duration is zero', () => {
      const rx: Prescription = makeValid({ duration: 0, durationUnit: 'days' })
      const result = validatePrescription(rx)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription errors when duration exceeds max for days (365)', () => {
      const rx: Prescription = makeValid({ duration: 366, durationUnit: 'days' })
      const result = validatePrescription(rx)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription errors when duration exceeds max for hours (8760)', () => {
      const rx: Prescription = makeValid({ duration: 8761, durationUnit: 'hours' })
      const result = validatePrescription(rx)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validatePrescription accepts boundary: 0.1 days', () => {
      const rx: Prescription = makeValid({ duration: 0.1, durationUnit: 'days' })
      const result = validatePrescription(rx)
      expect(result.valid).toBe(true)
    })

    it('validatePrescription accepts boundary: 365 days', () => {
      const rx: Prescription = makeValid({ duration: 365, durationUnit: 'days' })
      const result = validatePrescription(rx)
      expect(result.valid).toBe(true)
    })

    it('validatePrescription accepts boundary: 0.1 hours', () => {
      const rx: Prescription = makeValid({ duration: 0.1, durationUnit: 'hours' })
      const result = validatePrescription(rx)
      expect(result.valid).toBe(true)
    })

    it('validatePrescription accepts boundary: 8760 hours', () => {
      const rx: Prescription = makeValid({ duration: 8760, durationUnit: 'hours' })
      const result = validatePrescription(rx)
      expect(result.valid).toBe(true)
    })
  })

  // ─── Phase 16: Barrel Exports ───

  describe('barrel exports from index.ts', () => {
    it('exports all types and values from index', async () => {
      const indexModule = await import('../index')
      expect(indexModule.FREQUENCY_MAP).toBeDefined()
      expect(indexModule.VALIDATION_RULES).toBeDefined()
      expect(indexModule.KA_KE_TOLERANCE).toBeDefined()
      expect(indexModule.validatePrescription).toBeDefined()
      expect(typeof indexModule.validatePrescription).toBe('function')
    })
  })
})
