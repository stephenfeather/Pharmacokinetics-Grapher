/**
 * Multi-Dose Pharmacokinetic Accumulation
 *
 * Implements concentration calculations for repeated dosing schedules.
 * Core strategy:
 * 1. For each scheduled dose, call calculateConcentration() to get raw (unnormalized) contribution
 * 2. Sum all contributions at each timepoint
 * 3. Normalize final curve so peak = 1.0
 */

import type { Prescription, TimeSeriesPoint, GraphDataset } from '../models/prescription'
import { calculateConcentration } from './pkCalculator'

/**
 * Convert HH:MM time string to hours from midnight
 * @param time - Time in HH:MM format (24-hour)
 * @returns Hours from midnight (0-24)
 */
function timeStringToHours(time: string): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  return hours + minutes / 60
}

/**
 * Generate dose administration times for a multi-day simulation
 * @param times - Array of HH:MM strings representing daily dosing times
 * @param numDays - Number of days to expand across
 * @returns Sorted array of dose times in hours from simulation start
 */
function expandDoseTimes(times: string[], numDays: number): number[] {
  const doseTimes: number[] = []
  for (let day = 0; day < numDays; day++) {
    for (const t of times) {
      doseTimes.push(day * 24 + timeStringToHours(t))
    }
  }
  return doseTimes.sort((a, b) => a - b)
}

/**
 * Calculate accumulated drug concentration over time from repeated doses
 *
 * Strategy:
 * 1. Expand prescription times across simulation window
 * 2. For each timepoint in the simulation, sum raw contributions from all prior doses
 * 3. Normalize final curve so peak = 1.0
 *
 * @param prescription - Prescription with dose, frequency, times, halfLife, uptake
 * @param startHours - Simulation start time in hours from midnight
 * @param endHours - Simulation end time in hours from midnight
 * @param intervalMinutes - Time step resolution (default 15 min)
 * @returns Array of TimeSeriesPoint with normalized concentrations (peak = 1.0)
 */
export function accumulateDoses(
  prescription: Prescription,
  startHours: number,
  endHours: number,
  intervalMinutes: number = 15,
): TimeSeriesPoint[] {
  // Expand prescription times across simulation window
  const numDays = Math.ceil(endHours / 24) + 1
  const doseTimes = expandDoseTimes(prescription.times, numDays)

  // Generate timepoints for simulation
  const points: TimeSeriesPoint[] = []
  const steps = Math.ceil((endHours - startHours) * 60 / intervalMinutes)
  let maxConc = 0

  // For each timepoint, sum contributions from all prior doses
  for (let i = 0; i <= steps; i++) {
    const time = startHours + i * intervalMinutes / 60
    let totalConc = 0

    // Sum raw (unnormalized) contributions from each dose
    for (const doseTime of doseTimes) {
      if (doseTime <= time) {
        const elapsed = time - doseTime
        totalConc += calculateConcentration(
          elapsed,
          prescription.dose,
          prescription.halfLife,
          prescription.uptake,
        )
      }
    }

    // Store point and track maximum
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

/**
 * Format multiple prescriptions into graph-ready datasets
 *
 * Transforms an array of prescriptions into GraphDataset[] with:
 * - Calculated concentration curves via accumulateDoses()
 * - Assigned colors from predefined palette
 * - Labels formatted as "name (frequency)"
 *
 * @param prescriptions - Array of prescriptions to visualize
 * @param startHours - Simulation start time in hours
 * @param endHours - Simulation end time in hours
 * @returns Array of GraphDataset ready for Chart.js rendering
 */
export function getGraphData(
  prescriptions: Prescription[],
  startHours: number,
  endHours: number,
): GraphDataset[] {
  return prescriptions.map((rx) => ({
    label: `${rx.name} ${rx.dose}mg (${rx.frequency})`,
    data: accumulateDoses(rx, startHours, endHours),
  }))
}
