import { describe, it, expect } from 'vitest'
import {
  hoursToClockTime,
  calculateClockTickStep,
  parseTimeString,
  getDayNumber,
  formatTimeWithDay,
} from '../timeFormat'

describe('hoursToClockTime', () => {
  it('converts 0 hours from 09:00 to 09:00', () => {
    expect(hoursToClockTime(0, '09:00')).toBe('09:00')
  })

  it('converts 3 hours from 09:00 to 12:00', () => {
    expect(hoursToClockTime(3, '09:00')).toBe('12:00')
  })

  it('converts 12 hours from 09:00 to 21:00', () => {
    expect(hoursToClockTime(12, '09:00')).toBe('21:00')
  })

  it('wraps past midnight correctly (15 hours from 09:00 = 00:00 next day)', () => {
    expect(hoursToClockTime(15, '09:00')).toBe('00:00')
  })

  it('wraps to second day correctly (27 hours from 09:00 = 12:00)', () => {
    expect(hoursToClockTime(27, '09:00')).toBe('12:00')
  })

  it('wraps to third day correctly (51 hours from 09:00 = 12:00 day 3)', () => {
    expect(hoursToClockTime(51, '09:00')).toBe('12:00')
  })

  it('handles fractional hours (2.5 hours from 09:00 = 11:30)', () => {
    expect(hoursToClockTime(2.5, '09:00')).toBe('11:30')
  })

  it('handles reference time with minutes (2 hours from 09:30 = 11:30)', () => {
    expect(hoursToClockTime(2, '09:30')).toBe('11:30')
  })

  it('pads single-digit hours with leading zero', () => {
    expect(hoursToClockTime(0, '05:00')).toBe('05:00')
  })

  it('pads single-digit minutes with leading zero', () => {
    expect(hoursToClockTime(0.5, '09:00')).toBe('09:30')
  })

  it('handles zero reference time correctly', () => {
    expect(hoursToClockTime(0, '00:00')).toBe('00:00')
  })

  it('handles 23:59 reference time correctly', () => {
    expect(hoursToClockTime(0.016667, '23:59')).toBe('00:00') // ~1 minute
  })

  it('handles negative minutes (rounds to floor)', () => {
    const result = hoursToClockTime(0.25, '00:00')
    expect(result).toBe('00:15')
  })
})

describe('calculateClockTickStep', () => {
  it('returns 1 for 12-hour range', () => {
    expect(calculateClockTickStep(0, 12)).toBe(1)
  })

  it('returns 1 for ranges <= 12 hours', () => {
    expect(calculateClockTickStep(0, 6)).toBe(1)
    expect(calculateClockTickStep(12, 23)).toBe(1)
  })

  it('returns 2 for 24-hour range', () => {
    expect(calculateClockTickStep(0, 24)).toBe(2)
  })

  it('returns 2 for ranges <= 24 hours', () => {
    expect(calculateClockTickStep(0, 13)).toBe(2)
    expect(calculateClockTickStep(0, 24)).toBe(2)
  })

  it('returns 4 for 48-hour range', () => {
    expect(calculateClockTickStep(0, 48)).toBe(4)
  })

  it('returns 4 for ranges <= 72 hours', () => {
    expect(calculateClockTickStep(0, 72)).toBe(4)
    expect(calculateClockTickStep(0, 50)).toBe(4)
  })

  it('returns 6 for 96-hour range', () => {
    expect(calculateClockTickStep(0, 96)).toBe(6)
  })

  it('returns 6 for ranges <= 168 hours', () => {
    expect(calculateClockTickStep(0, 168)).toBe(6)
    expect(calculateClockTickStep(0, 100)).toBe(6)
  })

  it('returns 12 for week+ ranges', () => {
    expect(calculateClockTickStep(0, 200)).toBe(12)
    expect(calculateClockTickStep(0, 500)).toBe(12)
  })

  it('works with non-zero start hours', () => {
    expect(calculateClockTickStep(24, 36)).toBe(1) // 12-hour range
    expect(calculateClockTickStep(24, 48)).toBe(2) // 24-hour range
  })
})

describe('parseTimeString', () => {
  it('parses 09:00 to [9, 0]', () => {
    expect(parseTimeString('09:00')).toEqual([9, 0])
  })

  it('parses 23:59 to [23, 59]', () => {
    expect(parseTimeString('23:59')).toEqual([23, 59])
  })

  it('parses 00:00 to [0, 0]', () => {
    expect(parseTimeString('00:00')).toEqual([0, 0])
  })

  it('parses 12:30 to [12, 30]', () => {
    expect(parseTimeString('12:30')).toEqual([12, 30])
  })
})

describe('getDayNumber', () => {
  it('returns 1 for 0 hours', () => {
    expect(getDayNumber(0)).toBe(1)
  })

  it('returns 1 for 12 hours', () => {
    expect(getDayNumber(12)).toBe(1)
  })

  it('returns 1 for 23 hours', () => {
    expect(getDayNumber(23)).toBe(1)
  })

  it('returns 2 for 24 hours', () => {
    expect(getDayNumber(24)).toBe(2)
  })

  it('returns 2 for 36 hours', () => {
    expect(getDayNumber(36)).toBe(2)
  })

  it('returns 3 for 48 hours', () => {
    expect(getDayNumber(48)).toBe(3)
  })

  it('returns 3 for 72 hours', () => {
    expect(getDayNumber(72)).toBe(4)
  })
})

describe('formatTimeWithDay', () => {
  it('returns clock time without day for first 24 hours', () => {
    expect(formatTimeWithDay(0, '09:00')).toBe('09:00')
    expect(formatTimeWithDay(12, '09:00')).toBe('21:00')
    expect(formatTimeWithDay(23, '09:00')).toBe('08:00')
  })

  it('returns clock time with Day 2 indicator at 24 hours', () => {
    expect(formatTimeWithDay(24, '09:00')).toBe('09:00 (Day 2)')
  })

  it('returns clock time with Day 2 indicator at 36 hours', () => {
    expect(formatTimeWithDay(36, '09:00')).toBe('21:00 (Day 2)')
  })

  it('returns clock time with Day 3 indicator at 48 hours', () => {
    expect(formatTimeWithDay(48, '09:00')).toBe('09:00 (Day 3)')
  })

  it('returns clock time with Day 4 indicator at 72 hours', () => {
    expect(formatTimeWithDay(72, '09:00')).toBe('09:00 (Day 4)')
  })
})
