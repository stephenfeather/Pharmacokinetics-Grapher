/**
 * Time formatting utilities for converting between hours offset and clock times.
 * Used for displaying clock time (HH:MM) on graph X-axis instead of hours.
 */

/**
 * Convert hours offset to clock time string
 * @param hoursOffset - Hours from reference (can be > 24 for multi-day simulations)
 * @param referenceTime - Reference time in HH:MM format (e.g., "09:00")
 * @returns Clock time string in HH:MM format (wraps around 24-hour clock)
 */
export function hoursToClockTime(hoursOffset: number, referenceTime: string): string {
  const [refHours, refMinutes] = referenceTime.split(':').map(Number)
  const refH = refHours ?? 0
  const refM = refMinutes ?? 0
  const totalMinutes = (refH * 60 + refM) + (hoursOffset * 60)

  // Wrap around 24-hour clock for multi-day simulations
  const wrappedMinutes = Math.floor(totalMinutes % (24 * 60))
  const hours = Math.floor(wrappedMinutes / 60)
  const mins = wrappedMinutes % 60

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Determine appropriate tick step for clock time mode based on time range
 * Returns step in hours that aligns well with clock display and readability
 * @param startHours - Start of time range in hours
 * @param endHours - End of time range in hours
 * @returns Step size in hours between X-axis ticks
 */
export function calculateClockTickStep(startHours: number, endHours: number): number {
  const range = endHours - startHours
  if (range <= 12) return 1 // Every hour for short ranges
  if (range <= 24) return 2 // Every 2 hours
  if (range <= 72) return 4 // Every 4 hours
  if (range <= 168) return 6 // Every 6 hours for week ranges
  return 12 // Every 12 hours for week+ ranges
}

/**
 * Extract hour and minute components from HH:MM format string
 * @param timeString - Time string in HH:MM format
 * @returns Tuple of [hours, minutes]
 */
export function parseTimeString(timeString: string): [number, number] {
  const [hours, minutes] = timeString.split(':').map(Number)
  return [hours || 0, minutes || 0]
}

/**
 * Get day number from hours offset (1-indexed)
 * @param hoursOffset - Hours from start
 * @returns Day number (1 for first day, 2 for second day, etc.)
 */
export function getDayNumber(hoursOffset: number): number {
  return Math.floor(hoursOffset / 24) + 1
}

/**
 * Format time with day indicator for multi-day ranges
 * @param hoursOffset - Hours from reference
 * @param referenceTime - Reference time in HH:MM format
 * @returns String like "09:00" (same day) or "09:00 (Day 2)" (multi-day)
 */
export function formatTimeWithDay(hoursOffset: number, referenceTime: string): string {
  const clockTime = hoursToClockTime(hoursOffset, referenceTime)
  const dayNum = getDayNumber(hoursOffset)
  return dayNum > 1 ? `${clockTime} (Day ${dayNum})` : clockTime
}
