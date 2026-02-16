import { describe, it, expect } from 'vitest'
import { calculateMilestones, generateSummaryData, formatElapsedTime } from '../pkMilestones'
import { SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE, IBUPROFEN_FIXTURE } from '../../models/__tests__/fixtures'

describe('formatElapsedTime', () => {
  it('formats zero hours', () => {
    expect(formatElapsedTime(0)).toBe('T+0h')
  })

  it('formats integer hours', () => {
    expect(formatElapsedTime(6)).toBe('T+6h')
    expect(formatElapsedTime(12)).toBe('T+12h')
  })

  it('formats fractional hours with one decimal', () => {
    expect(formatElapsedTime(1.5)).toBe('T+1.5h')
    expect(formatElapsedTime(0.5)).toBe('T+0.5h')
  })
})

describe('calculateMilestones', () => {
  describe('single dose (once daily)', () => {
    it('generates dose, absorption, peak, and half-life events', () => {
      // SINGLE_DOSE_FIXTURE: once at 09:00, halfLife=6, peak=2, uptake=1.5
      const events = calculateMilestones(SINGLE_DOSE_FIXTURE, 0, 48, '00:00')

      expect(events.length).toBeGreaterThan(0)

      // Should have a dose event
      const doseEvents = events.filter((e) => e.eventType === 'dose')
      expect(doseEvents.length).toBeGreaterThanOrEqual(1)
      expect(doseEvents[0]!.description).toContain('500mg')
      expect(doseEvents[0]!.relativeConcentration).toBeNull()

      // Should have an absorption end event
      const absorptionEvents = events.filter((e) => e.eventType === 'absorption_end')
      expect(absorptionEvents.length).toBeGreaterThanOrEqual(1)
      // absorption end at 09:00 + 1.5h = 10:30
      expect(absorptionEvents[0]!.elapsedHours).toBeCloseTo(10.5, 1)

      // Should have a peak event
      const peakEvents = events.filter((e) => e.eventType === 'peak')
      expect(peakEvents.length).toBeGreaterThanOrEqual(1)
      // peak at 09:00 + 2h = 11:00
      expect(peakEvents[0]!.elapsedHours).toBeCloseTo(11, 1)
      expect(peakEvents[0]!.relativeConcentration).toBe(1.0)

      // Should have half-life decay events
      const halfLifeEvents = events.filter((e) => e.eventType === 'half_life')
      expect(halfLifeEvents.length).toBeGreaterThanOrEqual(1)
    })

    it('half-life milestones show correct decay percentages', () => {
      const events = calculateMilestones(SINGLE_DOSE_FIXTURE, 0, 48, '00:00')

      // Filter half-life events from the first dose only (between dose at 9h and next dose at 33h)
      const firstDoseHalfLifes = events.filter(
        (e) => e.eventType === 'half_life' && e.elapsedHours > 9 && e.elapsedHours < 33
      )

      // First half-life: 50% at 11+6=17h
      expect(firstDoseHalfLifes[0]!.relativeConcentration).toBeCloseTo(0.5, 5)
      expect(firstDoseHalfLifes[0]!.description).toContain('50%')

      // Second half-life: 25% at 11+12=23h
      expect(firstDoseHalfLifes[1]!.relativeConcentration).toBeCloseTo(0.25, 5)
      expect(firstDoseHalfLifes[1]!.description).toContain('25%')

      // Third half-life: 12.5% at 11+18=29h
      expect(firstDoseHalfLifes[2]!.relativeConcentration).toBeCloseTo(0.125, 5)
      expect(firstDoseHalfLifes[2]!.description).toContain('12.5%')

      // Fourth would be at 35h which is past next dose at 33h, so only 3
      expect(firstDoseHalfLifes.length).toBe(3)
    })

    it('stops decay milestones below 5% of peak', () => {
      const events = calculateMilestones(SINGLE_DOSE_FIXTURE, 0, 200, '00:00')
      const halfLifeEvents = events.filter((e) => e.eventType === 'half_life')

      // Every half-life event should have >= 5% concentration
      // (the engine stops generating when it drops below 5%)
      for (const e of halfLifeEvents) {
        expect(e.relativeConcentration!).toBeGreaterThanOrEqual(0.05)
      }

      // No event should have concentration below the 5% threshold
      const belowThreshold = halfLifeEvents.filter((e) => e.relativeConcentration! < 0.05)
      expect(belowThreshold.length).toBe(0)
    })

    it('no next_dose events for once-daily within a single day', () => {
      // Only simulate 24 hours — single dose, no repeat in that window
      const events = calculateMilestones(SINGLE_DOSE_FIXTURE, 0, 24, '00:00')
      const nextDoseEvents = events.filter((e) => e.eventType === 'next_dose')
      // expandDoseTimes for numDays=2 will generate dose at day 0 and day 1
      // But the 2nd dose at hour 33 is beyond endHours=24, so no next_dose event
      expect(nextDoseEvents.length).toBe(0)
    })
  })

  describe('multi-dose (BID)', () => {
    it('generates events for multiple doses', () => {
      // BID: 09:00 and 21:00, halfLife=6
      const events = calculateMilestones(BID_MULTI_DOSE_FIXTURE, 0, 48, '00:00')

      const doseEvents = events.filter((e) => e.eventType === 'dose')
      // Over 48 hours with bid: 4 doses (day0: 09:00, 21:00; day1: 09:00, 21:00)
      expect(doseEvents.length).toBeGreaterThanOrEqual(2)
    })

    it('stops half-life milestones when next dose arrives', () => {
      // BID at 09:00 and 21:00 with halfLife=6
      // After first dose peak at 11:00, half-life milestones at 17:00 (50%), 23:00 (25%)
      // But next dose at 21:00 should cut off the 23:00 milestone
      const events = calculateMilestones(BID_MULTI_DOSE_FIXTURE, 0, 48, '00:00')

      // Find half-life events between first dose (9) and second dose (21)
      const firstDoseHalfLifes = events.filter(
        (e) => e.eventType === 'half_life' && e.elapsedHours > 9 && e.elapsedHours < 21
      )
      // Only 1 half-life at 17:00 (50%) should fit; 23:00 (25%) would be past next dose at 21:00
      expect(firstDoseHalfLifes.length).toBe(1)
      expect(firstDoseHalfLifes[0]!.relativeConcentration).toBeCloseTo(0.5, 5)
    })
  })

  describe('ibuprofen TID schedule', () => {
    it('generates events for TID dosing', () => {
      // IBUPROFEN_FIXTURE: tid at 08:00, 14:00, 20:00, halfLife=2
      const events = calculateMilestones(IBUPROFEN_FIXTURE, 0, 24, '00:00')

      const doseEvents = events.filter((e) => e.eventType === 'dose')
      expect(doseEvents.length).toBeGreaterThanOrEqual(3) // At least 3 doses in 24h

      // With halfLife=2 and 6h between doses, should get some half-life events
      const halfLifeEvents = events.filter((e) => e.eventType === 'half_life')
      expect(halfLifeEvents.length).toBeGreaterThan(0)
    })
  })

  describe('events are sorted by time', () => {
    it('events are in chronological order', () => {
      const events = calculateMilestones(BID_MULTI_DOSE_FIXTURE, 0, 48, '00:00')

      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.elapsedHours).toBeGreaterThanOrEqual(events[i - 1]!.elapsedHours)
      }
    })
  })

  describe('clock time formatting', () => {
    it('uses firstDoseTime as reference for clock times', () => {
      const events = calculateMilestones(SINGLE_DOSE_FIXTURE, 0, 48, '09:00')

      // The dose event should show a clock time
      const doseEvent = events.find((e) => e.eventType === 'dose')
      expect(doseEvent).toBeDefined()
      expect(doseEvent!.clockTime).toBeDefined()
      expect(doseEvent!.clockTime.length).toBeGreaterThan(0)
    })
  })
})

describe('generateSummaryData', () => {
  it('generates summary for a single prescription', () => {
    const result = generateSummaryData([SINGLE_DOSE_FIXTURE], 0, 48, '00:00')

    expect(result).toHaveLength(1)
    expect(result[0]!.prescriptionName).toBe('Test Drug A')
    expect(result[0]!.events.length).toBeGreaterThan(0)
  })

  it('generates summary for multiple prescriptions', () => {
    const result = generateSummaryData(
      [SINGLE_DOSE_FIXTURE, BID_MULTI_DOSE_FIXTURE],
      0,
      48,
      '00:00',
    )

    expect(result).toHaveLength(2)
    expect(result[0]!.prescriptionName).toBe('Test Drug A')
    expect(result[1]!.prescriptionName).toBe('Test Drug B')
  })

  it('returns empty array for no prescriptions', () => {
    const result = generateSummaryData([], 0, 48, '00:00')
    expect(result).toEqual([])
  })

  it('preserves prescription ID when present', () => {
    const rxWithId = { ...SINGLE_DOSE_FIXTURE, id: 'test-123' }
    const result = generateSummaryData([rxWithId], 0, 48, '00:00')
    expect(result[0]!.prescriptionId).toBe('test-123')
  })

  it('prescriptionId is undefined when not present', () => {
    const result = generateSummaryData([SINGLE_DOSE_FIXTURE], 0, 48, '00:00')
    expect(result[0]!.prescriptionId).toBeUndefined()
  })
})
