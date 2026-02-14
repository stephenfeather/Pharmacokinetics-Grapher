import { describe, it, expect } from 'vitest'
import {
  ABSORPTION_CONSTANT,
  calculateConcentration,
  getPeakTime,
} from '../pkCalculator'
import {
  SINGLE_DOSE_FIXTURE,
  BID_MULTI_DOSE_FIXTURE,
  KA_APPROX_KE_FIXTURE,
  MIN_BOUNDARY_FIXTURE,
  MAX_BOUNDARY_FIXTURE,
  IBUPROFEN_FIXTURE,
} from '../../models/__tests__/fixtures'

describe('PK Calculator', () => {
  // ─── Phase 1: ABSORPTION_CONSTANT ───

  describe('ABSORPTION_CONSTANT', () => {
    it('equals Math.LN2 exactly', () => {
      expect(ABSORPTION_CONSTANT).toBe(Math.LN2)
    })

    it('is approximately 0.6931', () => {
      expect(ABSORPTION_CONSTANT).toBeCloseTo(0.6931, 4)
    })
  })

  // ─── Phase 2: calculateConcentration - Standard Formula ───

  describe('calculateConcentration - standard formula', () => {
    const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE

    // --- Basic behavior ---
    it('returns 0 at time=0', () => {
      expect(calculateConcentration(0, dose, halfLife, uptake)).toBe(0)
    })

    it('returns positive value at small positive time (t=0.5)', () => {
      const result = calculateConcentration(0.5, dose, halfLife, uptake)
      expect(result).toBeGreaterThan(0)
    })

    it('returns peak value at Tmax (SINGLE_DOSE: t=4, expect ~314.98)', () => {
      const result = calculateConcentration(4, dose, halfLife, uptake)
      expect(result).toBeCloseTo(314.980262, 1)
    })

    it('returns decreasing value after Tmax (t=6 < peak at t=4)', () => {
      const atPeak = calculateConcentration(4, dose, halfLife, uptake)
      const afterPeak = calculateConcentration(6, dose, halfLife, uptake)
      expect(afterPeak).toBeLessThan(atPeak)
    })

    it('approaches 0 for very large time (t=48, SINGLE_DOSE)', () => {
      const result = calculateConcentration(48, dose, halfLife, uptake)
      expect(result).toBeCloseTo(2.604167, 1)
      expect(result).toBeLessThan(5)
    })

    // --- Golden value verification (SINGLE_DOSE_FIXTURE) ---
    it('matches golden value at t=0.5 (~100.116)', () => {
      const result = calculateConcentration(0.5, dose, halfLife, uptake)
      expect(result).toBeCloseTo(100.115858, 1)
    })

    it('matches golden value at t=1.0 (~173.959)', () => {
      const result = calculateConcentration(1.0, dose, halfLife, uptake)
      expect(result).toBeCloseTo(173.958795, 1)
    })

    it('matches analytical value at t=6.0 (500*7/12 = 291.667)', () => {
      // Exact: exp(-ke*6)=1/2, exp(-ka*6)=1/16
      // C(6) = 500 * (4/3) * (1/2 - 1/16) = 500 * (4/3) * (7/16) = 500 * 7/12
      const result = calculateConcentration(6, dose, halfLife, uptake)
      expect(result).toBeCloseTo(500 * 7 / 12, 6)
    })

    it('matches analytical value at t=12.0 (500*21/64 = 164.0625)', () => {
      // Exact: exp(-ke*12)=1/4, exp(-ka*12)=1/256
      // C(12) = 500 * (4/3) * (1/4 - 1/256) = 500 * (4/3) * (63/256) = 500 * 63/192 = 500 * 21/64
      const result = calculateConcentration(12, dose, halfLife, uptake)
      expect(result).toBeCloseTo(500 * 21 / 64, 6)
    })

    // --- IBUPROFEN_FIXTURE golden values ---
    it('matches IBUPROFEN golden value at Tmax=4/3 (~251.984)', () => {
      const { dose: ibDose, halfLife: ibHL, uptake: ibUp } = IBUPROFEN_FIXTURE
      const result = calculateConcentration(4 / 3, ibDose, ibHL, ibUp)
      expect(result).toBeCloseTo(251.984210, 1)
    })

    it('matches IBUPROFEN golden value at t=2.0 (~233.333)', () => {
      const { dose: ibDose, halfLife: ibHL, uptake: ibUp } = IBUPROFEN_FIXTURE
      const result = calculateConcentration(2.0, ibDose, ibHL, ibUp)
      expect(result).toBeCloseTo(233.333333, 1)
    })

    it('matches IBUPROFEN golden value at t=6.0 (~66.536)', () => {
      const { dose: ibDose, halfLife: ibHL, uptake: ibUp } = IBUPROFEN_FIXTURE
      const result = calculateConcentration(6.0, ibDose, ibHL, ibUp)
      expect(result).toBeCloseTo(66.536458, 1)
    })

    // --- MAX_BOUNDARY_FIXTURE ---
    it('handles very long half-life (MAX_BOUNDARY at Tmax=88.58, expect ~7742.637)', () => {
      const { dose: mDose, halfLife: mHL, uptake: mUp } = MAX_BOUNDARY_FIXTURE
      const result = calculateConcentration(88.58, mDose, mHL, mUp)
      expect(result).toBeCloseTo(7742.636827, 0)
    })

    it('handles very large dose (MAX_BOUNDARY at t=24, expect ~4811.478)', () => {
      const { dose: mDose, halfLife: mHL, uptake: mUp } = MAX_BOUNDARY_FIXTURE
      const result = calculateConcentration(24, mDose, mHL, mUp)
      expect(result).toBeCloseTo(4811.477684, 0)
    })

    it('raw concentration can exceed 1.0 (not normalized)', () => {
      const result = calculateConcentration(4, dose, halfLife, uptake)
      expect(result).toBeGreaterThan(1.0)
    })
  })

  // ─── Phase 3: calculateConcentration - Edge Cases ───

  describe('calculateConcentration - edge cases', () => {
    // --- Zero/negative dose ---
    it('returns 0 when dose is 0', () => {
      expect(calculateConcentration(2, 0, 6, 1.5)).toBe(0)
    })

    it('returns 0 when dose is negative', () => {
      expect(calculateConcentration(2, -100, 6, 1.5)).toBe(0)
    })

    // --- Negative/zero time ---
    it('returns 0 for negative time (t=-1)', () => {
      expect(calculateConcentration(-1, 500, 6, 1.5)).toBe(0)
    })

    it('returns 0 for time=0', () => {
      expect(calculateConcentration(0, 500, 6, 1.5)).toBe(0)
    })

    // --- Fallback formula (ka ~ ke) ---
    it('uses fallback when uptake equals halfLife (KA_APPROX_KE_FIXTURE)', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      // ka = ke exactly, so fallback should be used
      const ka = Math.LN2 / uptake
      const ke = Math.LN2 / halfLife
      expect(Math.abs(ka - ke)).toBeLessThan(0.001) // confirms fallback triggers
      const result = calculateConcentration(4, dose, halfLife, uptake)
      expect(result).toBeGreaterThan(0)
      expect(Number.isFinite(result)).toBe(true)
    })

    it('fallback matches golden value at t=1.0 (~36.429)', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const result = calculateConcentration(1.0, dose, halfLife, uptake)
      expect(result).toBeCloseTo(36.429061, 1)
    })

    it('fallback matches golden value at t=4.0 (~86.643)', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const result = calculateConcentration(4.0, dose, halfLife, uptake)
      expect(result).toBeCloseTo(86.643398, 1)
    })

    it('fallback peak matches 250/e (~91.970) at Tmax=1/ke', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const ke = Math.LN2 / halfLife
      const tmax = 1 / ke
      const result = calculateConcentration(tmax, dose, halfLife, uptake)
      // For ka=ke fallback: C(tmax) = Dose * ka * (1/ke) * e^(-1) = Dose/e (since ka=ke)
      expect(result).toBeCloseTo(250 / Math.E, 1)
    })

    it('fallback curve is smooth (no discontinuity near tolerance boundary)', () => {
      // halfLife=6, find uptake values that straddle the KA_KE_TOLERANCE boundary
      const halfLife = 6
      const uptakeStandard = 5.94 // |ka-ke| ~ 0.00117, uses standard
      const uptakeFallback = 5.95 // |ka-ke| ~ 0.00097, uses fallback
      const t = 3
      const cStandard = calculateConcentration(t, 500, halfLife, uptakeStandard)
      const cFallback = calculateConcentration(t, 500, halfLife, uptakeFallback)
      // Both should produce similar values (continuity)
      expect(Math.abs(cStandard - cFallback)).toBeLessThan(1.0)
    })

    it('fallback returns 0 at t=0', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      expect(calculateConcentration(0, dose, halfLife, uptake)).toBe(0)
    })

    // --- MIN_BOUNDARY_FIXTURE (very small dose, ka=ke) ---
    it('handles very small dose with ka=ke (MIN_BOUNDARY at t=0.1, expect ~0.000347)', () => {
      const { dose, halfLife, uptake } = MIN_BOUNDARY_FIXTURE
      const result = calculateConcentration(0.1, dose, halfLife, uptake)
      expect(result).toBeCloseTo(0.0003465736, 6)
    })

    it('MIN_BOUNDARY concentration approaches 0 at t=1.0', () => {
      const { dose, halfLife, uptake } = MIN_BOUNDARY_FIXTURE
      const result = calculateConcentration(1.0, dose, halfLife, uptake)
      expect(result).toBeCloseTo(0.0000067690, 8)
      expect(result).toBeLessThan(0.0001)
    })

    // --- Very large time ---
    it('returns near-zero for very large time (t=1000, SINGLE_DOSE)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const result = calculateConcentration(1000, dose, halfLife, uptake)
      expect(result).toBeCloseTo(0, 10)
    })

    // --- Clamp to zero ---
    it('never returns negative values', () => {
      // Test across many parameter combinations
      const testCases = [
        { t: 0.001, dose: 500, hl: 6, up: 1.5 },
        { t: 100, dose: 500, hl: 6, up: 1.5 },
        { t: 1000, dose: 0.001, hl: 0.1, up: 0.1 },
        { t: 0.01, dose: 10000, hl: 240, up: 24 },
        { t: 50, dose: 250, hl: 4, up: 4 },
      ]
      for (const { t, dose, hl, up } of testCases) {
        const result = calculateConcentration(t, dose, hl, up)
        expect(result).toBeGreaterThanOrEqual(0)
      }
    })

    // --- Output is raw (not normalized) ---
    it('can return values greater than 1.0 (raw concentration)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const result = calculateConcentration(4, dose, halfLife, uptake)
      expect(result).toBeGreaterThan(100)
    })
  })

  // ─── Phase 4: getPeakTime ───

  describe('getPeakTime', () => {
    // --- Standard formula ---
    it('returns exactly 4.0 for SINGLE_DOSE_FIXTURE (hl=6, uptake=1.5)', () => {
      const { halfLife, uptake } = SINGLE_DOSE_FIXTURE
      // Tmax = ln(ka/ke) / (ka-ke) = ln(4) / (3*LN2/6 - LN2/6) = 2*LN2 / (LN2/3) = 6*2/3 = 4
      const result = getPeakTime(halfLife, uptake)
      expect(result).toBeCloseTo(4.0, 10)
    })

    it('returns exactly 4/3 for IBUPROFEN_FIXTURE (hl=2, uptake=0.5)', () => {
      const { halfLife, uptake } = IBUPROFEN_FIXTURE
      const result = getPeakTime(halfLife, uptake)
      expect(result).toBeCloseTo(4 / 3, 10)
    })

    it('returns ~88.585 for MAX_BOUNDARY_FIXTURE (hl=240, uptake=24)', () => {
      const { halfLife, uptake } = MAX_BOUNDARY_FIXTURE
      const result = getPeakTime(halfLife, uptake)
      expect(result).toBeCloseTo(88.584749, 1)
    })

    // --- Fallback (ka ~ ke) ---
    it('returns 1/ke when uptake equals halfLife (KA_APPROX_KE: 4/LN2 ~ 5.771)', () => {
      const { halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const ke = Math.LN2 / halfLife
      const result = getPeakTime(halfLife, uptake)
      expect(result).toBeCloseTo(1 / ke, 6)
    })

    it('returns 1/ke for MIN_BOUNDARY_FIXTURE (0.1/LN2 ~ 0.144)', () => {
      const { halfLife, uptake } = MIN_BOUNDARY_FIXTURE
      const ke = Math.LN2 / halfLife
      const result = getPeakTime(halfLife, uptake)
      expect(result).toBeCloseTo(1 / ke, 6)
    })

    // --- Edge case: ka <= ke ---
    it('returns 0 when uptake > halfLife (ka < ke)', () => {
      // uptake=10, halfLife=2 => ka=LN2/10, ke=LN2/2 => ka < ke
      const result = getPeakTime(2, 10)
      expect(result).toBe(0)
    })

    it('returns 0 when uptake is much larger than halfLife', () => {
      const result = getPeakTime(0.5, 100)
      expect(result).toBe(0)
    })

    // --- Consistency check ---
    it('peak time is where concentration is maximized', () => {
      const { halfLife, uptake, dose } = SINGLE_DOSE_FIXTURE
      const tmax = getPeakTime(halfLife, uptake)
      const cAtPeak = calculateConcentration(tmax, dose, halfLife, uptake)
      const cBefore = calculateConcentration(tmax - 0.01, dose, halfLife, uptake)
      const cAfter = calculateConcentration(tmax + 0.01, dose, halfLife, uptake)
      expect(cAtPeak).toBeGreaterThan(cBefore)
      expect(cAtPeak).toBeGreaterThan(cAfter)
    })
  })

  // ─── Phase 5: Reference Fixture Regression Tests ───

  describe('reference fixture tests', () => {
    // --- SINGLE_DOSE_FIXTURE ---
    it('SINGLE_DOSE: concentration is 0 at t=0', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      expect(calculateConcentration(0, dose, halfLife, uptake)).toBe(0)
    })

    it('SINGLE_DOSE: peak at t=4 matches golden value (~314.98)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const result = calculateConcentration(4, dose, halfLife, uptake)
      expect(result).toBeCloseTo(314.980262, 1)
    })

    it('SINGLE_DOSE: decays after peak (t=6 < peak)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const peak = calculateConcentration(4, dose, halfLife, uptake)
      const later = calculateConcentration(6, dose, halfLife, uptake)
      expect(later).toBeLessThan(peak)
    })

    it('SINGLE_DOSE: approaches zero at t=48 (~2.604)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const result = calculateConcentration(48, dose, halfLife, uptake)
      expect(result).toBeCloseTo(2.604167, 1)
    })

    // --- BID_MULTI_DOSE_FIXTURE (same PK params as SINGLE_DOSE) ---
    it('BID_MULTI_DOSE: single-dose curve matches SINGLE_DOSE (same PK params)', () => {
      const sd = SINGLE_DOSE_FIXTURE
      const bd = BID_MULTI_DOSE_FIXTURE
      // Same dose, halfLife, uptake -- single-dose calculations should be identical
      const times = [0.5, 1, 2, 4, 6, 12, 24]
      for (const t of times) {
        const cSingle = calculateConcentration(t, sd.dose, sd.halfLife, sd.uptake)
        const cBid = calculateConcentration(t, bd.dose, bd.halfLife, bd.uptake)
        expect(cBid).toBeCloseTo(cSingle, 10)
      }
    })

    // --- KA_APPROX_KE_FIXTURE (fallback) ---
    it('KA_APPROX_KE: uses fallback formula (ka=ke exactly)', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const ka = Math.LN2 / uptake
      const ke = Math.LN2 / halfLife
      expect(ka).toBe(ke) // Exactly equal
      const result = calculateConcentration(6, dose, halfLife, uptake)
      expect(result).toBeCloseTo(91.899201, 1)
    })

    it('KA_APPROX_KE: peak matches 250/e at Tmax=1/ke', () => {
      const { dose, halfLife, uptake } = KA_APPROX_KE_FIXTURE
      const ke = Math.LN2 / halfLife
      const tmax = 1 / ke
      const result = calculateConcentration(tmax, dose, halfLife, uptake)
      expect(result).toBeCloseTo(dose / Math.E, 1)
    })

    // --- IBUPROFEN_FIXTURE ---
    it('IBUPROFEN: peak matches golden value at Tmax=4/3', () => {
      const { dose, halfLife, uptake } = IBUPROFEN_FIXTURE
      const tmax = getPeakTime(halfLife, uptake)
      expect(tmax).toBeCloseTo(4 / 3, 10)
      const result = calculateConcentration(tmax, dose, halfLife, uptake)
      expect(result).toBeCloseTo(251.984210, 1)
    })

    // --- MIN/MAX BOUNDARY ---
    it('MIN_BOUNDARY: produces finite non-negative values', () => {
      const { dose, halfLife, uptake } = MIN_BOUNDARY_FIXTURE
      const times = [0.01, 0.05, 0.1, 0.5, 1.0]
      for (const t of times) {
        const result = calculateConcentration(t, dose, halfLife, uptake)
        expect(Number.isFinite(result)).toBe(true)
        expect(result).toBeGreaterThanOrEqual(0)
      }
    })

    it('MAX_BOUNDARY: produces expected concentration at Tmax', () => {
      const { dose, halfLife, uptake } = MAX_BOUNDARY_FIXTURE
      const tmax = getPeakTime(halfLife, uptake)
      expect(tmax).toBeCloseTo(88.584749, 1)
      const result = calculateConcentration(tmax, dose, halfLife, uptake)
      expect(result).toBeCloseTo(7742.636827, 0)
    })
  })

  // ─── Phase 6: Mathematical Properties ───

  describe('mathematical properties', () => {
    it('concentration is monotonically increasing before Tmax (standard formula)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const tmax = getPeakTime(halfLife, uptake) // 4.0
      let cPrev = calculateConcentration(tmax / 40, dose, halfLife, uptake)
      for (let i = 2; i <= 40; i++) {
        const t = i * (tmax / 40)
        const cCurr = calculateConcentration(t, dose, halfLife, uptake)
        expect(cCurr).toBeGreaterThanOrEqual(cPrev)
        cPrev = cCurr
      }
    })

    it('concentration is monotonically decreasing after Tmax (standard formula)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const tmax = getPeakTime(halfLife, uptake)
      let cPrev = calculateConcentration(tmax + 1.0, dose, halfLife, uptake)
      for (let i = 2; i <= 40; i++) {
        const t = tmax + i * 1.0
        const cCurr = calculateConcentration(t, dose, halfLife, uptake)
        expect(cCurr).toBeLessThanOrEqual(cPrev)
        cPrev = cCurr
      }
    })

    it('concentration is always non-negative for valid inputs', () => {
      const fixtures = [
        SINGLE_DOSE_FIXTURE,
        IBUPROFEN_FIXTURE,
        KA_APPROX_KE_FIXTURE,
        MIN_BOUNDARY_FIXTURE,
        MAX_BOUNDARY_FIXTURE,
      ]
      for (const { dose, halfLife, uptake } of fixtures) {
        const times = [0, 0.01, 0.1, 1, 5, 10, 50, 100, 500]
        for (const t of times) {
          const result = calculateConcentration(t, dose, halfLife, uptake)
          expect(result).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('concentration at Tmax > concentration at any other time (for standard formula)', () => {
      const { dose, halfLife, uptake } = SINGLE_DOSE_FIXTURE
      const tmax = getPeakTime(halfLife, uptake)
      const cPeak = calculateConcentration(tmax, dose, halfLife, uptake)
      // Check many other time points
      const otherTimes = [0.1, 0.5, 1, 2, 3, 3.5, 3.9, 4.1, 4.5, 5, 6, 8, 12, 24, 48]
      for (const t of otherTimes) {
        const c = calculateConcentration(t, dose, halfLife, uptake)
        expect(cPeak).toBeGreaterThanOrEqual(c)
      }
    })

    it('doubling dose doubles concentration at any time (linearity)', () => {
      const times = [0.5, 1, 2, 4, 6, 12]
      for (const t of times) {
        const c1 = calculateConcentration(t, 500, 6, 1.5)
        const c2 = calculateConcentration(t, 1000, 6, 1.5)
        expect(c2).toBeCloseTo(2 * c1, 6)
      }
    })
  })

  // ─── Phase 7: Barrel Exports ───

  describe('barrel exports', () => {
    // These tests import from the barrel (index.ts) to verify re-exports
    // The import at the top of this file uses '../pkCalculator' directly,
    // so we do dynamic imports here to test the barrel.
    it('exports calculateConcentration as a function', async () => {
      const barrel = await import('../../calculations/index')
      expect(typeof barrel.calculateConcentration).toBe('function')
    })

    it('exports getPeakTime as a function', async () => {
      const barrel = await import('../../calculations/index')
      expect(typeof barrel.getPeakTime).toBe('function')
    })

    it('exports ABSORPTION_CONSTANT as a number', async () => {
      const barrel = await import('../../calculations/index')
      expect(typeof barrel.ABSORPTION_CONSTANT).toBe('number')
      expect(barrel.ABSORPTION_CONSTANT).toBe(Math.LN2)
    })
  })
})
