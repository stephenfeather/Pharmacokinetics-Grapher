import type { Prescription } from '../prescription'

/** Simple single-dose reference case */
export const SINGLE_DOSE_FIXTURE: Prescription = {
  name: 'Test Drug A',
  frequency: 'once',
  times: ['09:00'],
  dose: 500,
  halfLife: 6,
  peak: 2,
  uptake: 1.5,
}

/** Multi-dose bid reference case for accumulation/steady-state testing */
export const BID_MULTI_DOSE_FIXTURE: Prescription = {
  name: 'Test Drug B',
  frequency: 'bid',
  times: ['09:00', '21:00'],
  dose: 500,
  halfLife: 6,
  peak: 2,
  uptake: 1.5,
}

/** Edge case: ka approximately equal to ke (uptake ~ halfLife) */
export const KA_APPROX_KE_FIXTURE: Prescription = {
  name: 'Test Drug C',
  frequency: 'bid',
  times: ['08:00', '20:00'],
  dose: 250,
  halfLife: 4,
  peak: 3.5,
  uptake: 4,
}

/** Edge case: minimum boundary values */
export const MIN_BOUNDARY_FIXTURE: Prescription = {
  name: 'X',
  frequency: 'once',
  times: ['00:00'],
  dose: 0.001,
  halfLife: 0.1,
  peak: 0.1,
  uptake: 0.1,
}

/** Edge case: maximum boundary values */
export const MAX_BOUNDARY_FIXTURE: Prescription = {
  name: 'A'.repeat(100),
  frequency: 'once',
  times: ['23:59'],
  dose: 10000,
  halfLife: 240,
  peak: 48,
  uptake: 24,
}

/** Typical ibuprofen-like drug for general testing */
export const IBUPROFEN_FIXTURE: Prescription = {
  name: 'Ibuprofen',
  frequency: 'tid',
  times: ['08:00', '14:00', '20:00'],
  dose: 400,
  halfLife: 2,
  peak: 1.5,
  uptake: 0.5,
}

/** Drug with active metabolite for metabolite graphing testing */
export const METABOLITE_STANDARD_FIXTURE: Prescription = {
  name: 'Test Metabolite Drug',
  frequency: 'bid',
  times: ['09:00', '21:00'],
  dose: 500,
  halfLife: 6,
  metaboliteLife: 12,
  metaboliteConversionFraction: 0.8,
  peak: 2,
  uptake: 1.5,
}
