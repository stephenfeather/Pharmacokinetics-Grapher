/**
 * PK Milestone Calculation
 *
 * Pure functions to compute pharmacokinetic milestone events from prescription data.
 * Generates timeline events: dose administration, absorption end, peak, half-life decay,
 * and next dose indicators.
 */

import type { Prescription } from '../models/prescription'
import type { PkMilestoneEvent, PkSummaryData } from '../models/pkSummary'
import { expandDoseTimes } from './multiDose'
import { formatTimeWithDay } from '../utils/timeFormat'

/**
 * Format elapsed hours as "T+Xh" notation
 * @param hours - Hours elapsed since dose administration
 * @returns Formatted string like "T+0h", "T+6h", "T+1.5h"
 */
export function formatElapsedTime(hours: number): string {
  if (hours === 0) return 'T+0h'
  // Use 1 decimal for non-integer hours, otherwise integer
  const formatted = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1)
  return `T+${formatted}h`
}

/**
 * Calculate milestone events for a single prescription
 *
 * For each dose, generates:
 * 1. Dose administration (T+0h)
 * 2. Absorption phase ends (T+uptake hours)
 * 3. Peak concentration at T+peak hours (Cmax = 100%)
 * 4. Half-life decay milestones (50%, 25%, 12.5%, ...) until <5% or next dose
 *
 * @param prescription - Prescription with dose times and PK parameters
 * @param startHours - Simulation start in hours from midnight
 * @param endHours - Simulation end in hours from midnight
 * @returns Sorted array of milestone events
 */
export function calculateMilestones(
  prescription: Prescription,
  startHours: number,
  endHours: number,
): PkMilestoneEvent[] {
  const events: PkMilestoneEvent[] = []

  // Determine dosing window (duration limits when doses are given)
  let dosingEndHours = endHours
  if (prescription.duration !== undefined && prescription.durationUnit !== undefined) {
    const durationInHours =
      prescription.durationUnit === 'days'
        ? prescription.duration * 24
        : prescription.duration
    dosingEndHours = startHours + durationInHours
  }

  // Get all dose times within the dosing window
  const numDays = Math.ceil(dosingEndHours / 24) + 1
  const allDoseTimes = expandDoseTimes(prescription.times, numDays)
  const doseTimes = allDoseTimes.filter((t) => t >= startHours && t < dosingEndHours)

  if (doseTimes.length === 0) return events

  for (let i = 0; i < doseTimes.length; i++) {
    const doseTime = doseTimes[i]!
    const nextDoseTime = i + 1 < doseTimes.length ? doseTimes[i + 1]! : null
    const doseOffset = doseTime - startHours

    // 1. Dose administration
    events.push({
      eventType: 'dose',
      clockTime: formatTimeWithDay(doseTime, '00:00'),
      elapsedTime: formatElapsedTime(doseOffset),
      elapsedHours: doseTime,
      description: `Dose ${prescription.dose}mg administered — absorption begins`,
      relativeConcentration: null,
      prescriptionName: prescription.name,
    })

    // 2. Absorption phase ends
    const absorptionEndTime = doseTime + prescription.uptake
    if (absorptionEndTime <= endHours && (nextDoseTime === null || absorptionEndTime < nextDoseTime)) {
      events.push({
        eventType: 'absorption_end',
        clockTime: formatTimeWithDay(absorptionEndTime, '00:00'),
        elapsedTime: formatElapsedTime(absorptionEndTime - startHours),
        elapsedHours: absorptionEndTime,
        description: `Absorption phase complete (${prescription.uptake}h)`,
        relativeConcentration: null,
        prescriptionName: prescription.name,
      })
    }

    // 3. Peak concentration
    const peakTime = doseTime + prescription.peak
    if (peakTime <= endHours && (nextDoseTime === null || peakTime < nextDoseTime)) {
      events.push({
        eventType: 'peak',
        clockTime: formatTimeWithDay(peakTime, '00:00'),
        elapsedTime: formatElapsedTime(peakTime - startHours),
        elapsedHours: peakTime,
        description: `Peak concentration (Cmax) — Tmax ${prescription.peak}h`,
        relativeConcentration: 1.0,
        prescriptionName: prescription.name,
      })
    }

    // 4. Half-life decay milestones after peak
    let halfLifeCount = 1
    while (halfLifeCount <= 10) {
      const decayTime = peakTime + halfLifeCount * prescription.halfLife
      const remainingFraction = Math.pow(0.5, halfLifeCount)
      const percentRemaining = remainingFraction * 100

      // Stop if below 5% of peak
      if (percentRemaining < 5) break

      // Stop if past end of simulation
      if (decayTime > endHours) break

      // Stop if next dose arrives before this milestone
      if (nextDoseTime !== null && decayTime >= nextDoseTime) break

      events.push({
        eventType: 'half_life',
        clockTime: formatTimeWithDay(decayTime, '00:00'),
        elapsedTime: formatElapsedTime(decayTime - startHours),
        elapsedHours: decayTime,
        description: `${halfLifeCount} half-life${halfLifeCount > 1 ? 's' : ''} elapsed — ~${percentRemaining}% of peak`,
        relativeConcentration: remainingFraction,
        prescriptionName: prescription.name,
      })

      halfLifeCount++
    }

    // 5. Next dose indicator (if multi-dose)
    if (nextDoseTime !== null && nextDoseTime <= endHours) {
      // Calculate approximate remaining concentration at next dose time
      const timeSincePeak = nextDoseTime - peakTime
      const halfLivesElapsed = timeSincePeak / prescription.halfLife
      const remainingAtNextDose = timeSincePeak > 0 ? Math.pow(0.5, halfLivesElapsed) : 1.0

      events.push({
        eventType: 'next_dose',
        clockTime: formatTimeWithDay(nextDoseTime, '00:00'),
        elapsedTime: formatElapsedTime(nextDoseTime - startHours),
        elapsedHours: nextDoseTime,
        description: `Next dose due — ~${(remainingAtNextDose * 100).toFixed(1)}% of previous peak remaining`,
        relativeConcentration: remainingAtNextDose,
        prescriptionName: prescription.name,
      })
    }
  }

  // Sort by time
  events.sort((a, b) => a.elapsedHours - b.elapsedHours)

  // Deduplicate events at the same time (dose + next_dose overlap)
  // Keep dose events when they overlap with next_dose events at the same time
  const deduped: PkMilestoneEvent[] = []
  for (const event of events) {
    const existing = deduped.find(
      (e) => Math.abs(e.elapsedHours - event.elapsedHours) < 0.001 &&
        e.eventType === 'next_dose' && event.eventType === 'dose'
    )
    if (existing) {
      // Replace next_dose with dose event at same time
      const idx = deduped.indexOf(existing)
      deduped[idx] = event
    } else {
      const duplicate = deduped.find(
        (e) => Math.abs(e.elapsedHours - event.elapsedHours) < 0.001 &&
          e.eventType === 'dose' && event.eventType === 'next_dose'
      )
      if (!duplicate) {
        deduped.push(event)
      }
    }
  }

  return deduped
}

/**
 * Generate summary data for multiple prescriptions
 *
 * @param prescriptions - Array of prescriptions to summarize
 * @param startHours - Simulation start in hours from midnight
 * @param endHours - Simulation end in hours from midnight
 * @returns Array of PkSummaryData, one per prescription
 */
export function generateSummaryData(
  prescriptions: Prescription[],
  startHours: number,
  endHours: number,
): PkSummaryData[] {
  return prescriptions.map((rx) => ({
    prescriptionId: rx.id,
    prescriptionName: rx.name,
    events: calculateMilestones(rx, startHours, endHours),
  }))
}
