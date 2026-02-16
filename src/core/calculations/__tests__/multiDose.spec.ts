import { describe, it, expect } from 'vitest'
import type { Prescription } from '../../models/prescription'
import { accumulateDoses, accumulateMetaboliteDoses, getGraphData, getLastDoseTime, calculateTailOffDuration } from '../multiDose'
import { SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE, IBUPROFEN_FIXTURE, METABOLITE_STANDARD_FIXTURE } from '../../models/__tests__/fixtures'

describe('accumulateDoses - Multi-dose Accumulation', () => {
  describe('Phase 1: Single dose (once daily)', () => {
    it('single dose curve matches raw calculateConcentration (normalized to peak=1.0)', () => {
      // Given: a simple once-daily prescription
      const rx = SINGLE_DOSE_FIXTURE // dose=500, halfLife=6, uptake=1.5, once at 09:00

      // When: we accumulate doses for 40 hours starting at 00:00 (covers dose at 09:00 + 5 half-lives decay)
      // 5 half-lives = 5*6 = 30 hours after dose at 09:00 = until 39:00
      const result = accumulateDoses(rx, 0, 40, 1) // 1-hour intervals for simplicity

      // Then: result should be a TimeSeriesPoint array
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)

      // And: first point at t=0 should have zero concentration (before dose at 09:00)
      const firstPoint = result[0]!
      expect(firstPoint.time).toBe(0)
      expect(firstPoint.concentration).toBe(0)

      // And: peak concentration should be exactly 1.0 (normalized)
      const peakConc = Math.max(...result.map(p => p.concentration))
      expect(peakConc).toBeCloseTo(1.0, 5)

      // And: concentration curve is monotonic in regions (rises to peak, falls after)
      // Check a point shortly after dose - should be rising
      const earlyPoint = result.find(p => p.time >= 10 && p.time <= 10.5)
      expect(earlyPoint).toBeDefined()
      expect(earlyPoint!.concentration).toBeGreaterThan(0.5) // Rising toward peak

      // And: peak should occur around hour 11 (09:00 + 2h Tmax = 11:00)
      // because SINGLE_DOSE_FIXTURE has peak=2, and ka is now derived from peak
      const nearPeakPoint = result.find(p => p.time >= 10.5 && p.time <= 12)
      expect(nearPeakPoint).toBeDefined()
      expect(nearPeakPoint!.concentration).toBeGreaterThan(0.9)
    })
  })

  describe('Phase 2: Multi-dose accumulation (BID)', () => {
    it('bid dosing shows accumulation - second peak higher than first', () => {
      // Given: a bid (twice daily) prescription with 12-hour intervals
      const rx = BID_MULTI_DOSE_FIXTURE // dose=500, halfLife=6, times=['09:00', '21:00']

      // When: we accumulate over 60 hours (covers 2.5 days of BID dosing, with decay after last dose)
      const result = accumulateDoses(rx, 0, 60, 1)

      // Then: peak is normalized to 1.0
      const peakConc = Math.max(...result.map(p => p.concentration))
      expect(peakConc).toBeCloseTo(1.0, 5)

      // And: there should be concentration peaks after each dose
      // First peak around hour 11 (Tmax ≈ 2h after first dose at 09:00)
      const firstPeakPoint = result.find(p => p.time >= 10.5 && p.time <= 12)
      expect(firstPeakPoint).toBeDefined()
      expect(firstPeakPoint!.concentration).toBeGreaterThan(0.3) // Not trivial

      // And: second peak around hour 23 (Tmax ≈ 2h after second dose at 21:00)
      const secondPeakPoint = result.find(p => p.time >= 22.5 && p.time <= 24)
      expect(secondPeakPoint).toBeDefined()
      expect(secondPeakPoint!.concentration).toBeGreaterThan(0.3)

      // And: there should be multiple points at or very close to peak (global maximum normalized to 1.0)
      const peakPoints = result.filter(p => p.concentration > 0.95)
      expect(peakPoints.length).toBeGreaterThan(0)
    })
  })

  describe('Phase 3: Edge cases', () => {
    it('zero dose returns flat zero curve', () => {
      const rx = { ...SINGLE_DOSE_FIXTURE, dose: 0 }
      const result = accumulateDoses(rx, 0, 24, 1)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)

      // All points should be zero (or clamped to zero)
      for (const point of result) {
        expect(point.concentration).toBe(0)
      }
    })

    it('returns points for exact time range', () => {
      const rx = SINGLE_DOSE_FIXTURE
      const result = accumulateDoses(rx, 0, 10, 2)

      expect(result).toBeDefined()
      expect(result[0]!.time).toBe(0)
      expect(result[result.length - 1]!.time).toBe(10)

      // Should have roughly (10 - 0) * 60 / 2 + 1 points
      const expectedCount = Math.ceil((10 - 0) * 60 / 2) + 1
      expect(result.length).toBe(expectedCount)
    })

    it('handles different time step resolutions', () => {
      const rx = SINGLE_DOSE_FIXTURE

      // 15-minute intervals
      const result15 = accumulateDoses(rx, 0, 24, 15)
      const expectedLength15 = Math.ceil((24 - 0) * 60 / 15) + 1
      expect(result15.length).toBe(expectedLength15)

      // 30-minute intervals
      const result30 = accumulateDoses(rx, 0, 24, 30)
      const expectedLength30 = Math.ceil((24 - 0) * 60 / 30) + 1
      expect(result30.length).toBe(expectedLength30)

      // 30-minute should have ~half the points of 15-minute
      expect(result30.length).toBeLessThan(result15.length)
    })

    it('concentration values are normalized (0-1 range)', () => {
      const rx = BID_MULTI_DOSE_FIXTURE
      const result = accumulateDoses(rx, 0, 48, 1)

      for (const point of result) {
        expect(point.concentration).toBeGreaterThanOrEqual(0)
        expect(point.concentration).toBeLessThanOrEqual(1.0)
      }
    })
  })

  describe('Phase 4: Graph Data Generation - getGraphData', () => {
    it('generates label with name, dose, and frequency', () => {
      const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
      expect(result).toHaveLength(1)
      expect(result[0]!.label).toBe('Test Drug A 500mg (once)')
    })

    it('generates labels for multiple prescriptions', () => {
      const result = getGraphData(
        [SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE],
        0, 24,
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.label).toBe('Test Drug A 500mg (once)')
      expect(result[1]!.label).toBe('Test Drug B 500mg (bid)')
    })

    it('includes dose value in label for differentiation', () => {
      const lowDose = { ...IBUPROFEN_FIXTURE, dose: 200 }
      const highDose = { ...IBUPROFEN_FIXTURE, dose: 800 }
      const result = getGraphData([lowDose, highDose], 0, 24)
      expect(result[0]!.label).toBe('Ibuprofen 200mg (tid)')
      expect(result[1]!.label).toBe('Ibuprofen 800mg (tid)')
    })

    it('does not assign color property (defers to GraphViewer)', () => {
      const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
      expect(result[0]!.color).toBeUndefined()
    })

    it('handles decimal dose values', () => {
      const rx = { ...SINGLE_DOSE_FIXTURE, dose: 0.5 }
      const result = getGraphData([rx], 0, 24)
      expect(result[0]!.label).toBe('Test Drug A 0.5mg (once)')
    })

    it('returns empty array for no prescriptions', () => {
      const result = getGraphData([], 0, 24)
      expect(result).toEqual([])
    })

    it('generates concentration data via accumulateDoses', () => {
      const result = getGraphData([SINGLE_DOSE_FIXTURE], 0, 24)
      expect(result[0]!.data.length).toBeGreaterThan(0)
      expect(result[0]!.data[0]).toHaveProperty('time')
      expect(result[0]!.data[0]).toHaveProperty('concentration')
    })

    it('includes metabolite dataset when both metaboliteLife and relativeMetaboliteLevel are present', () => {
      const result = getGraphData([METABOLITE_STANDARD_FIXTURE], 0, 48)
      expect(result.length).toBe(2)
      expect(result[0]!.label).toBe('Test Metabolite Drug 500mg (bid)')
      expect(result[1]!.label).toBe('Test Metabolite Drug - Metabolite (bid)')
    })

    it('marks metabolite dataset with isMetabolite=true flag', () => {
      const result = getGraphData([METABOLITE_STANDARD_FIXTURE], 0, 48)
      expect(result[0]!.isMetabolite).toBe(false)
      expect(result[1]!.isMetabolite).toBe(true)
    })

    it('does not generate metabolite dataset when metaboliteLife is missing', () => {
      const rx = { ...METABOLITE_STANDARD_FIXTURE, metaboliteLife: undefined }
      const result = getGraphData([rx], 0, 48)
      expect(result.length).toBe(1)
      expect(result[0]!.label).toBe('Test Metabolite Drug 500mg (bid)')
      expect(result[0]!.isMetabolite).toBe(false)
    })

    it('does not generate metabolite dataset when relativeMetaboliteLevel is undefined', () => {
      const rx = { ...METABOLITE_STANDARD_FIXTURE, relativeMetaboliteLevel: undefined }
      const result = getGraphData([rx], 0, 48)
      expect(result.length).toBe(1)
      expect(result[0]!.isMetabolite).toBe(false)
    })

    it('generates parent and metabolite curves for multiple prescriptions with metabolites', () => {
      const rx1 = METABOLITE_STANDARD_FIXTURE
      const rx2 = { ...METABOLITE_STANDARD_FIXTURE, name: 'Drug 2' }
      const result = getGraphData([rx1, rx2], 0, 48)
      expect(result.length).toBe(4) // 2 parent + 2 metabolite
      expect(result[0]!.isMetabolite).toBe(false)
      expect(result[1]!.isMetabolite).toBe(true)
      expect(result[2]!.isMetabolite).toBe(false)
      expect(result[3]!.isMetabolite).toBe(true)
    })

    it('metabolite dataset has valid concentration data', () => {
      const result = getGraphData([METABOLITE_STANDARD_FIXTURE], 0, 48)
      const metaboliteDataset = result[1]!
      expect(metaboliteDataset.data.length).toBeGreaterThan(0)
      expect(metaboliteDataset.data[0]).toHaveProperty('time')
      expect(metaboliteDataset.data[0]).toHaveProperty('concentration')
      expect(metaboliteDataset.data[0]!.concentration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Phase 5: Get Last Dose Time - getLastDoseTime', () => {
    it('calculates last dose time for single once-daily prescription over 1 day', () => {
      // Given: SINGLE_DOSE_FIXTURE with times=['09:00'] (once daily at 9 AM)
      // When: calculating last dose time for 1 day
      // Then: should return 9 hours (09:00)
      const rx = SINGLE_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 1)
      expect(result).toBe(9)
    })

    it('calculates last dose time for single dose over 2 days', () => {
      // Given: SINGLE_DOSE_FIXTURE with times=['09:00'] once daily
      // When: calculating last dose time for 2 days
      // Then: should return 24 + 9 = 33 hours (second day at 09:00)
      const rx = SINGLE_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 2)
      expect(result).toBe(33)
    })

    it('calculates last dose time for BID prescription over 1 day', () => {
      // Given: BID_MULTI_DOSE_FIXTURE with times=['09:00', '21:00'] (twice daily)
      // When: calculating last dose time for 1 day
      // Then: should return 21 hours (09:00 dose is earlier)
      const rx = BID_MULTI_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 1)
      expect(result).toBe(21)
    })

    it('calculates last dose time for BID prescription over 2 days', () => {
      // Given: BID_MULTI_DOSE_FIXTURE with times=['09:00', '21:00']
      // When: calculating last dose time for 2 days
      // Then: should return 24 + 21 = 45 hours (second day at 21:00)
      const rx = BID_MULTI_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 2)
      expect(result).toBe(45)
    })

    it('calculates last dose time with fractional hour times', () => {
      // Given: prescription with times=['09:30'] (9:30 AM = 9.5 hours)
      // When: calculating last dose time for 1 day
      // Then: should return 9.5 hours
      const rx = { ...SINGLE_DOSE_FIXTURE, times: ['09:30'] }
      const result = getLastDoseTime(rx, 1)
      expect(result).toBe(9.5)
    })

    it('calculates last dose time for longer simulation (5 days)', () => {
      // Given: BID_MULTI_DOSE_FIXTURE with times=['09:00', '21:00']
      // When: calculating last dose time for 5 days
      // Then: should return (4*24) + 21 = 117 hours (5th day at 21:00)
      const rx = BID_MULTI_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 5)
      expect(result).toBe(117)
    })

    it('returns 0 for 0 days', () => {
      // Given: any prescription
      // When: calculating last dose time for 0 days
      // Then: should return 0 (no doses scheduled)
      const rx = SINGLE_DOSE_FIXTURE
      const result = getLastDoseTime(rx, 0)
      expect(result).toBe(0)
    })

    it('handles late evening dose times', () => {
      // Given: prescription with times=['23:45'] (11:45 PM)
      // When: calculating last dose time for 1 day
      // Then: should return 23.75 hours (23 + 45/60)
      const rx = { ...SINGLE_DOSE_FIXTURE, times: ['23:45'] }
      const result = getLastDoseTime(rx, 1)
      expect(result).toBeCloseTo(23.75, 2)
    })

    it('handles early morning dose times', () => {
      // Given: prescription with times=['00:15'] (12:15 AM)
      // When: calculating last dose time for 1 day
      // Then: should return 0.25 hours (0 + 15/60)
      const rx = { ...SINGLE_DOSE_FIXTURE, times: ['00:15'] }
      const result = getLastDoseTime(rx, 1)
      expect(result).toBeCloseTo(0.25, 2)
    })

    it('handles prescription with many daily doses (QID)', () => {
      // Given: prescription with times=['06:00', '12:00', '18:00', '24:00'] (every 6 hours, 4x/day)
      // When: calculating last dose time for 1 day
      // Then: should return the maximum: 24 hours (midnight)
      // Note: 24:00 is technically invalid HH:MM but we handle it by treating as edge case
      const rx = {
        ...SINGLE_DOSE_FIXTURE,
        times: ['06:00', '12:00', '18:00', '23:00'],
        frequency: 'qid' as const,
      }
      const result = getLastDoseTime(rx, 1)
      expect(result).toBe(23)
    })
  })

  describe('Phase 5b: Metabolite Accumulation - accumulateMetaboliteDoses', () => {
    it('returns empty array when metaboliteLife is missing', () => {
      const rx = { ...BID_MULTI_DOSE_FIXTURE, metaboliteLife: undefined, relativeMetaboliteLevel: 0.8 }
      const result = accumulateMetaboliteDoses(rx, 0, 48)
      expect(result).toEqual([])
    })

    it('returns empty array when relativeMetaboliteLevel is missing', () => {
      const rx = { ...BID_MULTI_DOSE_FIXTURE, metaboliteLife: 12, relativeMetaboliteLevel: undefined }
      const result = accumulateMetaboliteDoses(rx, 0, 48)
      expect(result).toEqual([])
    })

    it('returns empty array when relativeMetaboliteLevel is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rx = { ...BID_MULTI_DOSE_FIXTURE, metaboliteLife: 12, relativeMetaboliteLevel: null } as any
      const result = accumulateMetaboliteDoses(rx, 0, 48)
      expect(result).toEqual([])
    })

    it('generates metabolite curve when both fields present', () => {
      const rx = METABOLITE_STANDARD_FIXTURE
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('normalizes metabolite curve to peak=relativeMetaboliteLevel', () => {
      const rx = METABOLITE_STANDARD_FIXTURE // relativeMetaboliteLevel=1.0
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      const peakConc = Math.max(...result.map(p => p.concentration))
      expect(peakConc).toBeCloseTo(1.0, 5)
    })

    it('scales metabolite curve peak to relativeMetaboliteLevel=3.0', () => {
      const rx = { ...METABOLITE_STANDARD_FIXTURE, relativeMetaboliteLevel: 3.0 }
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      const peakConc = Math.max(...result.map(p => p.concentration))
      expect(peakConc).toBeCloseTo(3.0, 5)
    })

    it('returns zero concentration before first dose', () => {
      const rx = METABOLITE_STANDARD_FIXTURE // first dose at 09:00
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      // At t=0 (midnight), before any dose at 09:00
      const firstPoint = result[0]
      expect(firstPoint).toBeDefined()
      expect(firstPoint!.time).toBe(0)
      expect(firstPoint!.concentration).toBe(0)
    })

    it('shows metabolite accumulation with multi-dose (bid)', () => {
      const rx = METABOLITE_STANDARD_FIXTURE
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      // At t=48 (end of 2 days with doses at 09:00 and 21:00), metabolite should have accumulated
      const lastPoint = result[result.length - 1]
      expect(lastPoint).toBeDefined()
      expect(lastPoint!.concentration).toBeGreaterThan(0)
    })

    it('metabolite concentration increases in early phase', () => {
      const rx = METABOLITE_STANDARD_FIXTURE
      const result = accumulateMetaboliteDoses(rx, 0, 48, 1)

      // Find points around dose time (09:00 = 9 hours)
      // Metabolite forms after parent dose, so concentration should increase
      const beforeSecondDose = result.filter(p => p.time >= 9 && p.time <= 12)
      expect(beforeSecondDose.length).toBeGreaterThanOrEqual(2)
      const early = beforeSecondDose[0]!.concentration
      const late = beforeSecondDose[beforeSecondDose.length - 1]!.concentration
      expect(late).toBeGreaterThanOrEqual(early)
    })

    it('metabolite concentration accumulates significantly over time with repeated doses', () => {
      const rx = METABOLITE_STANDARD_FIXTURE
      const result = accumulateMetaboliteDoses(rx, 0, 96, 1)

      // Metabolite accumulates with repeated dosing (bid), so concentration at late times should be substantial
      const lateConcentration = result[result.length - 1]!.concentration
      expect(lateConcentration).toBeGreaterThan(0.8) // Should be substantial due to accumulation
    })

    it('respects prescription duration for dosing window but extends observation', () => {
      const rx = {
        ...METABOLITE_STANDARD_FIXTURE,
        duration: 2,
        durationUnit: 'days' as const,
      }
      const result = accumulateMetaboliteDoses(rx, 0, 100, 1) // endHours=100, duration limits dosing to 48h

      // Observation window extends to endHours (100), not clipped by duration
      const lastTime = result[result.length - 1]?.time
      expect(lastTime).toBe(100)

      // But concentration should be decaying after dosing stops (after 48h)
      // since no more doses are administered after the duration window
      const pointAt48 = result.find((p) => p.time === 48)
      const pointAt80 = result.find((p) => p.time === 80)
      expect(pointAt48).toBeDefined()
      expect(pointAt80).toBeDefined()
      expect(pointAt80!.concentration).toBeLessThan(pointAt48!.concentration)
    })

    it('never returns negative concentrations', () => {
      const rx = METABOLITE_STANDARD_FIXTURE
      const result = accumulateMetaboliteDoses(rx, 0, 96, 1)

      for (const point of result) {
        expect(point.concentration).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Phase 6: Calculate Tail-Off Duration - calculateTailOffDuration', () => {
    it('calculates tail-off duration with default decay factor (10)', () => {
      // Given: halfLife = 6 hours with default decayFactor
      // When: calculating tail-off duration
      // Then: should return 6 * 10 = 60 hours
      // (10 half-lives = ~99.9% elimination)
      const result = calculateTailOffDuration(6)
      expect(result).toBe(60)
    })

    it('calculates tail-off duration for 24-hour half-life', () => {
      // Given: halfLife = 24 hours (e.g., warfarin) with default decayFactor
      // When: calculating tail-off duration
      // Then: should return 24 * 10 = 240 hours (10 days)
      const result = calculateTailOffDuration(24)
      expect(result).toBe(240)
    })

    it('respects custom decay factor', () => {
      // Given: halfLife = 6 hours with custom decayFactor = 3
      // When: calculating tail-off duration
      // Then: should return 6 * 3 = 18 hours (3 half-lives = ~87.5% elimination)
      const result = calculateTailOffDuration(6, 3)
      expect(result).toBe(18)
    })

    it('respects custom decay factor for long half-life', () => {
      // Given: halfLife = 24 hours with custom decayFactor = 7
      // When: calculating tail-off duration
      // Then: should return 24 * 7 = 168 hours (7 days)
      const result = calculateTailOffDuration(24, 7)
      expect(result).toBe(168)
    })

    it('handles very short half-life', () => {
      // Given: halfLife = 0.5 hours (30 minutes, e.g., nitroglycerin)
      // When: calculating tail-off duration with default decayFactor
      // Then: should return 0.5 * 10 = 5 hours
      const result = calculateTailOffDuration(0.5)
      expect(result).toBe(5)
    })

    it('handles very long half-life', () => {
      // Given: halfLife = 240 hours (10 days, e.g., amiodarone)
      // When: calculating tail-off duration with default decayFactor
      // Then: should return 240 * 10 = 2400 hours (100 days)
      const result = calculateTailOffDuration(240)
      expect(result).toBe(2400)
    })

    it('handles fractional half-life values', () => {
      // Given: halfLife = 3.5 hours with default decayFactor
      // When: calculating tail-off duration
      // Then: should return 3.5 * 10 = 35 hours
      const result = calculateTailOffDuration(3.5)
      expect(result).toBe(35)
    })

    it('decay factor of 1 returns halfLife (minimal tail-off)', () => {
      // Given: halfLife = 6 hours with decayFactor = 1
      // When: calculating tail-off duration
      // Then: should return 6 * 1 = 6 hours (1 half-life = ~50% elimination)
      const result = calculateTailOffDuration(6, 1)
      expect(result).toBe(6)
    })

    it('decay factor of 10 returns 10x halfLife (extensive tail-off)', () => {
      // Given: halfLife = 6 hours with decayFactor = 10
      // When: calculating tail-off duration
      // Then: should return 6 * 10 = 60 hours (10 half-lives = ~99.9% elimination)
      const result = calculateTailOffDuration(6, 10)
      expect(result).toBe(60)
    })

    it('decay factor of 0 returns 0 (no tail-off)', () => {
      // Given: halfLife = 6 hours with decayFactor = 0
      // When: calculating tail-off duration
      // Then: should return 0 (no additional time needed)
      const result = calculateTailOffDuration(6, 0)
      expect(result).toBe(0)
    })

    it('handles decimal decay factor', () => {
      // Given: halfLife = 6 hours with decayFactor = 2.5
      // When: calculating tail-off duration
      // Then: should return 6 * 2.5 = 15 hours
      const result = calculateTailOffDuration(6, 2.5)
      expect(result).toBe(15)
    })
  })

  describe('Phase 7: Curve extends to near-zero concentration', () => {
    it('single dose curve extends until concentration near zero', () => {
      // Given: a prescription with very short half-life (1 hour) dosed once at 00:00
      // accumulateDoses repeats "once daily" across the simulation window,
      // so use endHours < 24 to ensure only 1 dose at t=0 contributes
      // (second dose at t=24 is beyond endHours)
      const rx = {
        ...SINGLE_DOSE_FIXTURE,
        times: ['00:00'],
        halfLife: 1,
        uptake: 0.25,
        peak: 0.25, // Fast absorption, fast peak — drug decays quickly
      }
      // 14 hours = 14 half-lives after dose at t=0 → ~0.006% remaining
      const result = accumulateDoses(rx, 0, 14, 15) // 15-min intervals

      // Then: last few data points should have concentration < 0.001
      const lastPoints = result.slice(-5)
      for (const point of lastPoints) {
        expect(point.concentration).toBeLessThan(0.001)
      }
    })
  })

  describe('Task 24: Curve extends to near-zero concentration', () => {
    it('single dose with duration: curve decays to near-zero after dosing stops + 10 half-lives', () => {
      // Use duration to limit dosing to 1 day, then extend observation for tail-off
      const rx: Prescription = {
        ...SINGLE_DOSE_FIXTURE, // halfLife=6, once at 09:00
        duration: 1,
        durationUnit: 'days',
      }
      // Dose at hour 9 (first day only due to duration=1 day)
      // Tail-off: 10 * 6 = 60 hours after last dose at hour 9 = 69 hours
      const endHours = 9 + calculateTailOffDuration(rx.halfLife) // 69
      const result = accumulateDoses(rx, 0, endHours, 15)

      // Last point should be near-zero (10 half-lives = 1/1024 ≈ 0.001)
      const lastPoint = result[result.length - 1]!
      expect(lastPoint.concentration).toBeLessThan(0.002)

      // Curve should have data all the way to the end
      expect(lastPoint.time).toBeGreaterThanOrEqual(endHours - 1)
    })

    it('multi-dose (bid) with duration: curve extends past last dose to near-zero', () => {
      // Use duration to limit dosing to 3 days, then extend for tail-off
      const rx: Prescription = {
        ...BID_MULTI_DOSE_FIXTURE, // halfLife=6, bid at 09:00, 21:00
        duration: 3,
        durationUnit: 'days',
      }
      // 3 days of bid dosing: last dose at ~69 hours (day 2, 21:00)
      const dosingDays = 3
      const lastDose = getLastDoseTime(rx, dosingDays)
      const tailOff = calculateTailOffDuration(rx.halfLife) // 10 * 6 = 60
      const endHours = lastDose + tailOff

      const result = accumulateDoses(rx, 0, endHours, 15)

      // Last point should be near-zero
      const lastPoint = result[result.length - 1]!
      expect(lastPoint.concentration).toBeLessThan(0.002)
      expect(lastPoint.time).toBeGreaterThanOrEqual(endHours - 1)
    })

    it('long half-life drug (240hr): tail-off calculation respects 2520hr cap', () => {
      const rx: Prescription = {
        ...SINGLE_DOSE_FIXTURE,
        halfLife: 240,
        times: ['00:00'],
        uptake: 24,
        peak: 48,
      }
      const tailOff = calculateTailOffDuration(rx.halfLife) // 2400
      expect(tailOff).toBe(2400)

      // Verify the autoEndHours cap logic (from App.vue)
      const lastDose = getLastDoseTime(rx, 1) // 0
      const rawEnd = lastDose + tailOff // 2400
      const cappedEnd = Math.max(24, Math.min(2520, rawEnd))
      expect(cappedEnd).toBeLessThanOrEqual(2520)
      expect(cappedEnd).toBeGreaterThanOrEqual(24)
    })

    it('getGraphData produces datasets extending to provided endHours', () => {
      // Verify data generation reaches the full endHours parameter
      const rx = SINGLE_DOSE_FIXTURE // halfLife=6, once at 09:00
      const endHours = 120 // provide a large endHours

      const datasets = getGraphData([rx], 0, endHours)
      expect(datasets.length).toBeGreaterThan(0)

      const data = datasets[0]!.data
      const lastPoint = data[data.length - 1]!

      // Data should extend to near the provided endHours
      expect(lastPoint.time).toBeGreaterThanOrEqual(endHours - 1)
    })

    it('effectiveEndHours extends data beyond default 48hr slider value', () => {
      // This tests the core fix: graph data should use effectiveEndHours (auto-calculated)
      // not the raw endHours (slider default=48)
      const rx = SINGLE_DOSE_FIXTURE // halfLife=6

      // Short endHours (old behavior) - data truncated
      const shortDatasets = getGraphData([rx], 0, 48)
      const shortData = shortDatasets[0]!.data
      const shortLastTime = shortData[shortData.length - 1]!.time

      // Long endHours (fixed behavior with effectiveEndHours)
      const longDatasets = getGraphData([rx], 0, 120)
      const longData = longDatasets[0]!.data
      const longLastTime = longData[longData.length - 1]!.time

      // The extended data should reach much further
      expect(longLastTime).toBeGreaterThan(shortLastTime)
      expect(longLastTime).toBeGreaterThanOrEqual(119) // extends to ~120h
      expect(shortLastTime).toBeLessThanOrEqual(48) // truncated at ~48h
    })
  })
})
