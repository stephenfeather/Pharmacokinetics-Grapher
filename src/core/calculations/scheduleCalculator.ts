/**
 * Schedule Calculator
 *
 * Generates concentration curves for titration and taper schedules
 * with variable doses across steps. Builds on calculateConcentration()
 * from pkCalculator using the same accumulation strategy as multiDose.ts.
 */

import type { DosageSchedule } from '../models/dosageSchedule'
import type { TimeSeriesPoint } from '../models/prescription'
import { calculateConcentration, resetCalculationWarnings } from './pkCalculator'

// ─── Types ───

export interface DoseEvent {
  time: number
  dose: number
}

// ─── Internal Helpers ───

/**
 * Convert HH:MM time string to hours from midnight.
 * @param time - Time in HH:MM format (24-hour)
 * @returns Hours from midnight (0-24)
 */
function timeStringToHours(time: string): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  return hours + minutes / 60
}

// ─── Exported Functions ───

/**
 * Expand a DosageSchedule into individual dose administration events
 * with variable doses per step.
 *
 * For each step, generates dose events at the prescription's dosing times
 * across the step's duration in days, using that step's dose amount.
 *
 * @param schedule - Complete dosage schedule with steps and base prescription
 * @returns Sorted array of { time, dose } events in hours from simulation start
 */
export function expandScheduleDoses(schedule: DosageSchedule): DoseEvent[] {
  const events: DoseEvent[] = []
  const { times } = schedule.basePrescription

  let dayOffset = 0
  for (const step of schedule.steps) {
    for (let day = 0; day < step.durationDays; day++) {
      for (const timeStr of times) {
        const time = (dayOffset + day) * 24 + timeStringToHours(timeStr)
        events.push({ time, dose: step.dose })
      }
    }
    dayOffset += step.durationDays
  }

  return events.sort((a, b) => a.time - b.time)
}

/**
 * Calculate accumulated concentration for a variable-dose schedule.
 *
 * Similar to accumulateDoses() in multiDose.ts but handles changing dose
 * amounts across schedule steps. Each dose event contributes its own dose
 * amount to the total concentration at each timepoint.
 *
 * Strategy:
 * 1. Expand schedule into individual dose events with variable doses
 * 2. For each timepoint, sum raw contributions from all prior dose events
 * 3. Normalize final curve so peak = 1.0
 *
 * @param schedule - Complete dosage schedule
 * @param startHours - Simulation start time in hours
 * @param endHours - Simulation end time in hours
 * @param intervalMinutes - Time step resolution (default 15 min)
 * @returns Array of TimeSeriesPoint with normalized concentrations (peak = 1.0)
 */
export function accumulateScheduleDoses(
  schedule: DosageSchedule,
  startHours: number,
  endHours: number,
  intervalMinutes: number = 15,
): TimeSeriesPoint[] {
  resetCalculationWarnings()

  const events = expandScheduleDoses(schedule)
  const { halfLife, uptake, peak } = schedule.basePrescription

  const points: TimeSeriesPoint[] = []
  const steps = Math.ceil((endHours - startHours) * 60 / intervalMinutes)
  let maxConc = 0

  for (let i = 0; i <= steps; i++) {
    const time = startHours + i * intervalMinutes / 60
    let totalConc = 0

    for (const event of events) {
      if (event.time <= time) {
        const elapsed = time - event.time
        totalConc += calculateConcentration(
          elapsed,
          event.dose,
          halfLife,
          uptake,
          peak,
        )
      }
    }

    points.push({ time, concentration: Math.max(0, totalConc) })
    maxConc = Math.max(maxConc, totalConc)
  }

  // Normalize to peak = 1.0
  if (maxConc > 0) {
    for (const p of points) {
      p.concentration /= maxConc
    }
  }

  return points
}
