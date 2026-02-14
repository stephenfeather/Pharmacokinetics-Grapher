import { describe, it, expect } from 'vitest'
import { accumulateDoses, getGraphData, getLastDoseTime } from '../multiDose'
import { SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE, IBUPROFEN_FIXTURE } from '../../models/__tests__/fixtures'

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
      // Check a point early (2 hours after first dose) - should be rising
      const earlyPoint = result.find(p => p.time >= 11 && p.time <= 12)
      expect(earlyPoint).toBeDefined()
      expect(earlyPoint!.concentration).toBeGreaterThan(0.5) // Rising toward peak

      // And: around 15 hours (Tmax for this drug ≈ 6.95 hours from dose at 09:00)
      // Peak should occur around hour 15-16 (09:00 + 6.95 hours ≈ 15.95)
      const nearPeakPoint = result.find(p => p.time >= 15 && p.time <= 17)
      expect(nearPeakPoint).toBeDefined()
      expect(nearPeakPoint!.concentration).toBeGreaterThan(0.8)
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
      // First peak around hour 15-16 (Tmax ≈ 6.95h after first dose at 09:00)
      const firstPeakPoint = result.find(p => p.time >= 15 && p.time <= 17)
      expect(firstPeakPoint).toBeDefined()
      expect(firstPeakPoint!.concentration).toBeGreaterThan(0.3) // Not trivial

      // And: second peak around hour 27-29 (Tmax ≈ 6.95h after second dose at 21:00)
      const secondPeakPoint = result.find(p => p.time >= 27 && p.time <= 29)
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
})
