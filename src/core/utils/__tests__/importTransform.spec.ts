import { describe, it, expect } from 'vitest'
import { transformImportedPrescription } from '../importTransform'

describe('transformImportedPrescription', () => {
  describe('nested metaboliteHalfLife transformation', () => {
    it('transforms metaboliteHalfLife.halfLife to metaboliteLife', () => {
      const input = {
        name: 'Zoloft',
        metaboliteHalfLife: { name: 'N-desmethylsertraline', halfLife: 83 },
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteLife).toBe(83)
    })

    it('transforms metaboliteHalfLife.name to metaboliteName', () => {
      const input = {
        name: 'Zoloft',
        metaboliteHalfLife: { name: 'N-desmethylsertraline', halfLife: 83 },
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteName).toBe('N-desmethylsertraline')
    })

    it('removes metaboliteHalfLife property after transformation', () => {
      const input = {
        name: 'Zoloft',
        metaboliteHalfLife: { name: 'N-desmethylsertraline', halfLife: 83 },
      }
      const result = transformImportedPrescription(input)
      expect((result as unknown as Record<string, unknown>).metaboliteHalfLife).toBeUndefined()
    })

    it('handles metaboliteHalfLife with only name (no halfLife)', () => {
      const input = {
        name: 'Drug',
        metaboliteHalfLife: { name: 'Metabolite' },
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteLife).toBeUndefined()
      expect(result.metaboliteName).toBe('Metabolite')
    })

    it('handles metaboliteHalfLife with only halfLife (no name)', () => {
      const input = {
        name: 'Drug',
        metaboliteHalfLife: { halfLife: 50 },
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteLife).toBe(50)
      expect(result.metaboliteName).toBeUndefined()
    })

    it('handles empty metaboliteHalfLife object', () => {
      const input = {
        name: 'Drug',
        metaboliteHalfLife: {},
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteLife).toBeUndefined()
      expect(result.metaboliteName).toBeUndefined()
      expect((result as unknown as Record<string, unknown>).metaboliteHalfLife).toBeUndefined()
    })
  })

  describe('backward compatibility (flat format)', () => {
    it('preserves existing metaboliteLife when no nested object', () => {
      const input = {
        name: 'Drug',
        metaboliteLife: 50,
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteLife).toBe(50)
    })

    it('preserves existing metaboliteName when no nested object', () => {
      const input = {
        name: 'Drug',
        metaboliteName: 'My Metabolite',
      }
      const result = transformImportedPrescription(input)
      expect(result.metaboliteName).toBe('My Metabolite')
    })

    it('passes through prescription with no metabolite data unchanged', () => {
      const input = {
        name: 'Simple Drug',
        dose: 500,
        frequency: 'bid',
        times: ['09:00', '21:00'],
        halfLife: 6,
        peak: 2,
        uptake: 1.5,
      }
      const result = transformImportedPrescription(input)
      expect(result.name).toBe('Simple Drug')
      expect(result.dose).toBe(500)
      expect(result.metaboliteLife).toBeUndefined()
      expect(result.metaboliteName).toBeUndefined()
    })
  })

  describe('string-to-number coercion', () => {
    it('coerces string dose to number', () => {
      const input = {
        name: 'Drug',
        dose: '5' as unknown,
      }
      const result = transformImportedPrescription(input)
      expect(result.dose).toBe(5)
      expect(typeof result.dose).toBe('number')
    })

    it('coerces string halfLife to number', () => {
      const input = {
        name: 'Drug',
        halfLife: '26' as unknown,
      }
      const result = transformImportedPrescription(input)
      expect(result.halfLife).toBe(26)
      expect(typeof result.halfLife).toBe('number')
    })

    it('coerces string peak to number', () => {
      const input = {
        name: 'Drug',
        peak: '3.75' as unknown,
      }
      const result = transformImportedPrescription(input)
      expect(result.peak).toBe(3.75)
    })

    it('coerces string uptake to number', () => {
      const input = {
        name: 'Drug',
        uptake: '6.5' as unknown,
      }
      const result = transformImportedPrescription(input)
      expect(result.uptake).toBe(6.5)
    })

    it('does not coerce non-numeric strings', () => {
      const input = {
        name: 'Drug',
        dose: 'abc' as unknown,
      }
      const result = transformImportedPrescription(input)
      // Should remain as the original string (validation will catch it later)
      expect(result.dose).toBe('abc')
    })

    it('preserves already-numeric fields', () => {
      const input = {
        name: 'Drug',
        dose: 500,
        halfLife: 6,
      }
      const result = transformImportedPrescription(input)
      expect(result.dose).toBe(500)
      expect(result.halfLife).toBe(6)
    })
  })

  describe('backward compatibility: metaboliteConversionFraction migration', () => {
    it('migrates metaboliteConversionFraction to relativeMetaboliteLevel when >= 0.1', () => {
      const input = {
        name: 'Drug',
        metaboliteConversionFraction: 0.8,
      }
      const result = transformImportedPrescription(input)
      expect(result.relativeMetaboliteLevel).toBe(0.8)
      expect((result as unknown as Record<string, unknown>).metaboliteConversionFraction).toBeUndefined()
    })

    it('does not migrate metaboliteConversionFraction when < 0.1', () => {
      const input = {
        name: 'Drug',
        metaboliteConversionFraction: 0.05,
      }
      const result = transformImportedPrescription(input)
      expect(result.relativeMetaboliteLevel).toBeUndefined()
      expect((result as unknown as Record<string, unknown>).metaboliteConversionFraction).toBeUndefined()
    })

    it('does not overwrite existing relativeMetaboliteLevel with old field', () => {
      const input = {
        name: 'Drug',
        metaboliteConversionFraction: 0.5,
        relativeMetaboliteLevel: 3.0,
      }
      const result = transformImportedPrescription(input)
      expect(result.relativeMetaboliteLevel).toBe(3.0)
    })

    it('removes old metaboliteConversionFraction even when not migrated', () => {
      const input = {
        name: 'Drug',
        metaboliteConversionFraction: 0.01,
      }
      const result = transformImportedPrescription(input)
      expect((result as unknown as Record<string, unknown>).metaboliteConversionFraction).toBeUndefined()
    })
  })

  describe('full Zoloft import scenario', () => {
    it('correctly transforms the Zoloft example from the bug report', () => {
      const zoloftImport = {
        name: 'Zoloft (sertraline)',
        dose: 50,
        frequency: 'qd',
        times: ['05:00'],
        halfLife: 26,
        peak: 6.5,
        uptake: 6.5,
        metaboliteHalfLife: {
          name: 'N-desmethylsertraline',
          halfLife: 83,
        },
      }
      const result = transformImportedPrescription(zoloftImport)
      expect(result.name).toBe('Zoloft (sertraline)')
      expect(result.dose).toBe(50)
      expect(result.frequency).toBe('qd')
      expect(result.times).toEqual(['05:00'])
      expect(result.halfLife).toBe(26)
      expect(result.peak).toBe(6.5)
      expect(result.uptake).toBe(6.5)
      expect(result.metaboliteLife).toBe(83)
      expect(result.metaboliteName).toBe('N-desmethylsertraline')
      expect((result as unknown as Record<string, unknown>).metaboliteHalfLife).toBeUndefined()
    })
  })
})
