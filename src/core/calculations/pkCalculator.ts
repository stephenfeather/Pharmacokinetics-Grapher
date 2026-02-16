/**
 * Pharmacokinetic Calculator
 *
 * One-compartment first-order absorption model for single-dose
 * concentration curves. Provides calculateConcentration() and getPeakTime()
 * as pure functions with no UI dependencies.
 */

import { KA_KE_TOLERANCE } from '@/core/models/prescription'
import { logWarn } from '@/core/utils/logger'

// ─── Warning Deduplication ───

/**
 * Tracks which calculation warnings have already been emitted this cycle.
 * Prevents log flooding when calculateConcentration is called in tight loops
 * (e.g. thousands of timepoints per accumulateDoses call).
 * Call resetCalculationWarnings() at the start of each accumulation cycle.
 */
const emittedWarnings = new Set<string>()

/**
 * Reset the warning deduplication set.
 * Should be called at the start of each accumulateDoses / accumulateMetaboliteDoses cycle.
 */
export function resetCalculationWarnings(): void {
  emittedWarnings.clear()
}

// ─── Constants ───

/**
 * Natural logarithm of 2.
 * Used to convert half-life/uptake to rate constants:
 *   ka = ABSORPTION_CONSTANT / uptake
 *   ke = ABSORPTION_CONSTANT / halfLife
 */
export const ABSORPTION_CONSTANT = Math.LN2

// ─── Internal Helpers ───

/**
 * Compute absorption rate constant from uptake time.
 * @param uptake - Absorption time in hours (must be > 0)
 * @returns ka in hr^-1
 */
function computeKa(uptake: number): number {
  return ABSORPTION_CONSTANT / uptake
}

/**
 * Compute elimination rate constant from half-life.
 * @param halfLife - Elimination half-life in hours (must be > 0)
 * @returns ke in hr^-1
 */
function computeKe(halfLife: number): number {
  return ABSORPTION_CONSTANT / halfLife
}

// ─── Exported Functions ───

/**
 * Derive absorption rate constant (ka) from desired peak time (Tmax)
 * and elimination rate constant (ke).
 *
 * Solves: Tmax = ln(ka/ke) / (ka - ke) for ka
 * Uses bisection method for guaranteed convergence.
 *
 * The relationship is monotonic: higher ka → lower Tmax (faster absorption → earlier peak).
 * When ka = ke, Tmax = 1/ke (L'Hôpital limit).
 *
 * @param tmax - Desired time of peak concentration in hours (> 0)
 * @param ke - Elimination rate constant in hr^-1 (> 0)
 * @returns ka in hr^-1 that produces the desired Tmax
 */
export function deriveKaFromTmax(tmax: number, ke: number): number {
  if (tmax <= 0) return ke * 100 // Near-instant absorption

  const computeTmaxFromKa = (ka: number): number => {
    if (Math.abs(ka - ke) < 1e-12) return 1 / ke
    return Math.log(ka / ke) / (ka - ke)
  }

  // Critical tmax: when ka = ke, tmax = 1/ke
  const criticalTmax = 1 / ke

  // If tmax ≈ 1/ke, ka ≈ ke
  if (Math.abs(tmax - criticalTmax) < 1e-10) {
    return ke
  }

  let lo: number, hi: number

  if (tmax < criticalTmax) {
    // Need ka > ke (typical: fast absorption → early peak)
    lo = ke * 1.001
    hi = ke * 1000
    while (computeTmaxFromKa(hi) > tmax && hi < 1e10) {
      hi *= 10
    }
  } else {
    // Need ka < ke (slow absorption → late peak)
    lo = ke * 1e-6
    hi = ke * 0.999
  }

  // Bisection: higher ka → lower tmax (monotonic in both regions)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const midTmax = computeTmaxFromKa(mid)

    if (Math.abs(midTmax - tmax) < 1e-10) return mid

    if (midTmax > tmax) {
      lo = mid // Need higher ka to reduce tmax
    } else {
      hi = mid // Need lower ka to increase tmax
    }
  }

  return (lo + hi) / 2
}

/**
 * Calculate drug concentration at a given time using one-compartment
 * first-order absorption model.
 *
 * Standard formula: C(t) = Dose * [ka/(ka-ke)] * (e^(-ke*t) - e^(-ka*t))
 * Fallback (|ka-ke| < KA_KE_TOLERANCE): C(t) = Dose * ka * t * e^(-ke*t)
 *
 * When `peak` (Tmax) is provided, ka is derived from it to ensure the
 * concentration peak occurs at the user-specified time. Otherwise ka is
 * derived from `uptake` (absorption half-life).
 *
 * @param time - Time in hours since dose administration
 * @param dose - Dose amount in arbitrary units
 * @param halfLife - Elimination half-life in hours (> 0)
 * @param uptake - Absorption time in hours (> 0); used to derive ka when peak is not provided
 * @param peak - Optional: desired Tmax in hours; when provided, overrides uptake for ka derivation
 * @returns Raw relative concentration (not normalized, can be > 1.0)
 */
export function calculateConcentration(
  time: number,
  dose: number,
  halfLife: number,
  uptake: number,
  peak?: number,
): number {
  // Guard: zero or negative dose
  if (dose <= 0) return 0

  // Guard: negative or zero time (before dose administered)
  if (time <= 0) return 0

  const ke = computeKe(halfLife)
  const ka = peak !== undefined ? deriveKaFromTmax(peak, ke) : computeKa(uptake)

  let concentration: number

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    // Fallback formula: limit as ka -> ke
    if (!emittedWarnings.has('ka-ke-fallback')) {
      emittedWarnings.add('ka-ke-fallback')
      logWarn('pkCalculator.calculateConcentration', 'Using ka≈ke fallback formula (uptake ≈ halfLife)', {
        ka,
        ke,
        diff: Math.abs(ka - ke),
        halfLife,
        uptake,
      })
    }
    concentration = dose * ka * time * Math.exp(-ke * time)
  } else {
    // Standard one-compartment first-order absorption
    concentration = dose * (ka / (ka - ke)) * (Math.exp(-ke * time) - Math.exp(-ka * time))
  }

  // Clamp numerical artifacts to zero
  return Math.max(0, concentration)
}

/**
 * Calculate metabolite concentration at a given time using one-compartment
 * sequential metabolism model.
 *
 * Standard formula: C_metabolite(t) = Dose * fm * ke_parent / (ke_metabolite - ke_parent) *
 *                                     (e^(-ke_parent*t) - e^(-ke_metabolite*t))
 * Fallback (|ke_metabolite - ke_parent| < KA_KE_TOLERANCE):
 *   C_metabolite(t) = Dose * fm * ke_parent * t * e^(-ke_parent*t)
 *
 * @param time - Time in hours since parent dose administration
 * @param dose - Parent dose amount in arbitrary units
 * @param parentHalfLife - Parent drug elimination half-life in hours (> 0)
 * @param metaboliteHalfLife - Metabolite elimination half-life in hours (> 0)
 * @param fm - Metabolite conversion fraction (0 to 1); fraction of parent converted
 * @returns Raw relative metabolite concentration (not normalized, can be > 1.0)
 */
export function calculateMetaboliteConcentration(
  time: number,
  dose: number,
  parentHalfLife: number,
  metaboliteHalfLife: number,
  fm: number,
): number {
  // Guard: zero or negative dose
  if (dose <= 0) return 0

  // Guard: zero or negative conversion fraction
  if (fm <= 0) return 0

  // Guard: negative or zero time (before dose administered)
  if (time <= 0) return 0

  const ke_parent = computeKe(parentHalfLife)
  const ke_metabolite = computeKe(metaboliteHalfLife)

  let concentration: number

  if (Math.abs(ke_metabolite - ke_parent) < KA_KE_TOLERANCE) {
    // Fallback formula: limit as ke_metabolite -> ke_parent
    if (!emittedWarnings.has('metabolite-ke-fallback')) {
      emittedWarnings.add('metabolite-ke-fallback')
      logWarn('pkCalculator.calculateMetaboliteConcentration', 'Using ke≈ke fallback formula (metaboliteLife ≈ parentHalfLife)', {
        ke_parent,
        ke_metabolite,
        diff: Math.abs(ke_metabolite - ke_parent),
        parentHalfLife,
        metaboliteHalfLife,
      })
    }
    concentration = dose * fm * ke_parent * time * Math.exp(-ke_parent * time)
  } else {
    // Standard one-compartment sequential metabolism
    concentration = dose * fm * (ke_parent / (ke_metabolite - ke_parent)) *
                    (Math.exp(-ke_parent * time) - Math.exp(-ke_metabolite * time))
  }

  // Clamp numerical artifacts to zero
  return Math.max(0, concentration)
}

/**
 * Calculate the time of peak concentration (Tmax) for a single dose.
 *
 * Standard: Tmax = ln(ka/ke) / (ka - ke)
 * Fallback (ka ~ ke): Tmax = 1/ke
 * Edge case (ka <= ke): returns 0 per specification
 *
 * Note: Mathematically, Tmax is positive for all ka != ke (both ln(ka/ke)
 * and (ka-ke) share sign). Returning 0 for ka <= ke follows the spec's
 * stated API. Peak time is informational only and not used in concentration
 * calculations.
 *
 * @param halfLife - Elimination half-life in hours (> 0)
 * @param uptake - Absorption time in hours (> 0)
 * @returns Time in hours when peak concentration occurs
 */
export function getPeakTime(halfLife: number, uptake: number): number {
  const ka = computeKa(uptake)
  const ke = computeKe(halfLife)

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    return 1 / ke
  }

  if (ka <= ke) {
    return 0
  }

  return Math.log(ka / ke) / (ka - ke)
}
