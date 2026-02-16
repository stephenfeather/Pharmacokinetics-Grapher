// ─── Type Definitions ───

export type FrequencyLabel =
  | 'once'
  | 'qd'
  | 'bid'
  | 'tid'
  | 'qid'
  | 'q6h'
  | 'q8h'
  | 'q12h'
  | 'custom'

export type DurationUnit = 'days' | 'hours'

export interface Prescription {
  id?: string
  name: string
  frequency: FrequencyLabel
  times: string[]
  dose: number
  halfLife: number
  metaboliteLife?: number
  metaboliteConversionFraction?: number
  metaboliteName?: string
  peak: number
  uptake: number
  duration?: number
  durationUnit?: DurationUnit
}

export interface TimeSeriesPoint {
  /** Time in hours from start */
  time: number
  /** Normalized relative concentration (0-1 scale, peak = 1.0) */
  concentration: number
}

export interface GraphDataset {
  label: string
  data: TimeSeriesPoint[]
  color?: string
  isMetabolite?: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── Constants ───

export const FREQUENCY_MAP: Record<FrequencyLabel, number | null> = {
  once: 1,
  qd: 1,
  bid: 2,
  tid: 3,
  qid: 4,
  q6h: 4,
  q8h: 3,
  q12h: 2,
  custom: null,
}

export const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  dose: {
    required: true,
    min: 0.001,
    max: 10000,
  },
  frequency: {
    required: true,
    allowedValues: [
      'once',
      'qd',
      'bid',
      'tid',
      'qid',
      'q6h',
      'q8h',
      'q12h',
      'custom',
    ] as const,
  },
  times: {
    required: true,
    format: 'HH:MM',
    minLength: 1,
    mustMatchFrequency: true,
  },
  halfLife: {
    required: true,
    min: 0.1,
    max: 240,
  },
  peak: {
    required: true,
    min: 0.1,
    max: 48,
  },
  uptake: {
    required: true,
    min: 0.1,
    max: 24,
  },
  metaboliteLife: {
    required: false,
    min: 0.1,
    max: 1000,
  },
  metaboliteConversionFraction: {
    required: false,
    min: 0.0,
    max: 1.0,
  },
  metaboliteName: {
    required: false,
    maxLength: 100,
  },
  duration: {
    required: false,
    min: 0.1,
    maxDays: 365,
    maxHours: 8760,
  },
} as const

/**
 * Tolerance for comparing ka and ke rate constants.
 * When |ka - ke| < KA_KE_TOLERANCE, the fallback formula should be used.
 * Shared between validation (warning) and calculation engine (formula switch).
 */
export const KA_KE_TOLERANCE = 0.001

// ─── Validation Helpers ───

/** Regex for valid HH:MM 24-hour time format */
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function validateName(name: string): string[] {
  const errors: string[] = []

  if (typeof name !== 'string') {
    errors.push('Name is required and must be a string')
    return errors
  }

  const trimmed = name.trim()

  if (trimmed.length < VALIDATION_RULES.name.minLength) {
    errors.push('Name must not be empty')
  } else if (trimmed.length > VALIDATION_RULES.name.maxLength) {
    errors.push(
      `Name must be ${VALIDATION_RULES.name.maxLength} characters or fewer`,
    )
  }

  return errors
}

function validateDose(dose: number): string[] {
  const errors: string[] = []

  if (typeof dose !== 'number' || isNaN(dose)) {
    errors.push('Dose is required and must be a number')
    return errors
  }

  if (dose < VALIDATION_RULES.dose.min) {
    errors.push(`Dose must be at least ${VALIDATION_RULES.dose.min}`)
  } else if (dose > VALIDATION_RULES.dose.max) {
    errors.push(
      `Dose must be at most ${VALIDATION_RULES.dose.max.toLocaleString()}`,
    )
  }

  return errors
}

function validateFrequency(frequency: string): string[] {
  const errors: string[] = []
  const allowed = VALIDATION_RULES.frequency.allowedValues as readonly string[]

  if (!allowed.includes(frequency)) {
    errors.push(
      `Frequency must be one of: ${allowed.join(', ')}`,
    )
  }

  return errors
}

function validateTimes(times: string[], frequency: FrequencyLabel): string[] {
  const errors: string[] = []

  if (!Array.isArray(times)) {
    errors.push('Times must be an array')
    return errors
  }

  if (times.length < VALIDATION_RULES.times.minLength) {
    errors.push('At least one dosing time is required')
    return errors
  }

  // Validate each time entry format
  for (const t of times) {
    if (!TIME_FORMAT_REGEX.test(t)) {
      errors.push(
        `Time '${t}' is not valid HH:MM 24-hour format`,
      )
    }
  }

  // Check frequency-to-count matching (only for non-custom frequencies)
  const expectedCount = FREQUENCY_MAP[frequency]
  if (expectedCount !== null && times.length !== expectedCount) {
    errors.push(
      `Frequency '${frequency}' requires exactly ${expectedCount} dosing time(s), but ${times.length} provided`,
    )
  }

  return errors
}

function validateHalfLife(halfLife: number): string[] {
  const errors: string[] = []

  if (typeof halfLife !== 'number' || isNaN(halfLife)) {
    errors.push('Half-life is required and must be a number')
    return errors
  }

  if (halfLife < VALIDATION_RULES.halfLife.min) {
    errors.push(
      `Half-life must be at least ${VALIDATION_RULES.halfLife.min} hours`,
    )
  } else if (halfLife > VALIDATION_RULES.halfLife.max) {
    errors.push(
      `Half-life must be at most ${VALIDATION_RULES.halfLife.max} hours`,
    )
  }

  return errors
}

function validatePeak(peak: number): string[] {
  const errors: string[] = []

  if (typeof peak !== 'number' || isNaN(peak)) {
    errors.push('Peak time (Tmax) is required and must be a number')
    return errors
  }

  if (peak < VALIDATION_RULES.peak.min) {
    errors.push(
      `Peak time must be at least ${VALIDATION_RULES.peak.min} hours`,
    )
  } else if (peak > VALIDATION_RULES.peak.max) {
    errors.push(
      `Peak time must be at most ${VALIDATION_RULES.peak.max} hours`,
    )
  }

  return errors
}

function validateUptake(uptake: number): string[] {
  const errors: string[] = []

  if (typeof uptake !== 'number' || isNaN(uptake)) {
    errors.push('Uptake time is required and must be a number')
    return errors
  }

  if (uptake < VALIDATION_RULES.uptake.min) {
    errors.push(
      `Uptake time must be at least ${VALIDATION_RULES.uptake.min} hours`,
    )
  } else if (uptake > VALIDATION_RULES.uptake.max) {
    errors.push(
      `Uptake time must be at most ${VALIDATION_RULES.uptake.max} hours`,
    )
  }

  return errors
}

function validateMetaboliteLife(
  metaboliteLife: number | undefined,
): string[] {
  const errors: string[] = []

  if (metaboliteLife === undefined || metaboliteLife === null) {
    return errors
  }

  if (typeof metaboliteLife !== 'number' || isNaN(metaboliteLife)) {
    errors.push('Metabolite half-life must be a number when provided')
    return errors
  }

  if (metaboliteLife < VALIDATION_RULES.metaboliteLife.min) {
    errors.push(
      `Metabolite half-life must be at least ${VALIDATION_RULES.metaboliteLife.min} hours`,
    )
  } else if (metaboliteLife > VALIDATION_RULES.metaboliteLife.max) {
    errors.push(
      `Metabolite half-life must be at most ${VALIDATION_RULES.metaboliteLife.max.toLocaleString()} hours`,
    )
  }

  return errors
}

function validateMetaboliteConversionFraction(
  fm: number | undefined,
): string[] {
  const errors: string[] = []

  if (fm === undefined || fm === null) {
    return errors
  }

  if (typeof fm !== 'number' || isNaN(fm)) {
    errors.push('Metabolite conversion fraction must be a number when provided')
    return errors
  }

  if (fm < VALIDATION_RULES.metaboliteConversionFraction.min) {
    errors.push(
      `Metabolite conversion fraction must be at least ${VALIDATION_RULES.metaboliteConversionFraction.min}`,
    )
  } else if (fm > VALIDATION_RULES.metaboliteConversionFraction.max) {
    errors.push(
      `Metabolite conversion fraction must be at most ${VALIDATION_RULES.metaboliteConversionFraction.max}`,
    )
  }

  return errors
}

function validateMetaboliteName(
  metaboliteName: string | undefined,
): string[] {
  const errors: string[] = []

  if (metaboliteName === undefined || metaboliteName === null) {
    return errors
  }

  if (typeof metaboliteName !== 'string') {
    errors.push('Metabolite name must be a string when provided')
    return errors
  }

  if (metaboliteName.length > VALIDATION_RULES.metaboliteName.maxLength) {
    errors.push(
      `Metabolite name must be ${VALIDATION_RULES.metaboliteName.maxLength} characters or fewer`,
    )
  }

  return errors
}

function validateDuration(
  duration: number | undefined,
  durationUnit: DurationUnit | undefined,
): string[] {
  const errors: string[] = []

  // If neither field is provided, validation passes
  if (
    (duration === undefined || duration === null) &&
    (durationUnit === undefined || durationUnit === null)
  ) {
    return errors
  }

  // Cross-field validation: both must be provided together
  if (
    (duration !== undefined && duration !== null) &&
    (durationUnit === undefined || durationUnit === null)
  ) {
    errors.push('Duration unit must be provided when duration is set')
    return errors
  }

  if (
    (durationUnit !== undefined && durationUnit !== null) &&
    (duration === undefined || duration === null)
  ) {
    errors.push('Duration value must be provided when duration unit is set')
    return errors
  }

  // If we get here, both duration and durationUnit are defined
  if (typeof duration !== 'number' || isNaN(duration)) {
    errors.push('Duration must be a number when provided')
    return errors
  }

  if (duration < VALIDATION_RULES.duration.min) {
    errors.push(
      `Duration must be at least ${VALIDATION_RULES.duration.min}`,
    )
  }

  // Unit-specific max validation
  if (durationUnit === 'days') {
    if (duration > VALIDATION_RULES.duration.maxDays) {
      errors.push(
        `Duration in days must be at most ${VALIDATION_RULES.duration.maxDays}`,
      )
    }
  } else if (durationUnit === 'hours') {
    if (duration > VALIDATION_RULES.duration.maxHours) {
      errors.push(
        `Duration in hours must be at most ${VALIDATION_RULES.duration.maxHours}`,
      )
    }
  } else {
    errors.push(`Duration unit must be 'days' or 'hours'`)
  }

  return errors
}

function checkCrossFieldWarnings(rx: Prescription): string[] {
  const warnings: string[] = []

  // Check for partial metabolite data (one field provided, other missing)
  const hasMetaboliteLife =
    rx.metaboliteLife !== undefined && rx.metaboliteLife !== null
  const hasMetaboliteConversionFraction =
    rx.metaboliteConversionFraction !== undefined &&
    rx.metaboliteConversionFraction !== null

  if (hasMetaboliteLife && !hasMetaboliteConversionFraction) {
    warnings.push(
      'Metabolite half-life provided but conversion fraction missing. Both are required for metabolite visualization.',
    )
  } else if (!hasMetaboliteLife && hasMetaboliteConversionFraction) {
    warnings.push(
      'Metabolite conversion fraction provided but half-life missing. Both are required for metabolite visualization.',
    )
  }

  // Only check uptake/halfLife cross-field conditions when individual fields are valid numbers in range
  if (
    typeof rx.uptake !== 'number' ||
    isNaN(rx.uptake) ||
    rx.uptake < VALIDATION_RULES.uptake.min ||
    rx.uptake > VALIDATION_RULES.uptake.max ||
    typeof rx.halfLife !== 'number' ||
    isNaN(rx.halfLife) ||
    rx.halfLife < VALIDATION_RULES.halfLife.min ||
    rx.halfLife > VALIDATION_RULES.halfLife.max
  ) {
    return warnings
  }

  const ka = 0.693 / rx.uptake
  const ke = 0.693 / rx.halfLife

  if (rx.uptake >= rx.halfLife) {
    warnings.push(
      `Uptake time (${rx.uptake}h) is greater than or equal to half-life (${rx.halfLife}h). This indicates atypical absorption kinetics.`,
    )
  }

  if (Math.abs(ka - ke) < KA_KE_TOLERANCE) {
    warnings.push(
      'Uptake time and half-life produce nearly equal rate constants (ka ≈ ke). The fallback formula will be used for calculations.',
    )
  }

  return warnings
}

// ─── Main Validation Function ───

export function validatePrescription(rx: Prescription): ValidationResult {
  const errors: string[] = [
    ...validateName(rx.name),
    ...validateDose(rx.dose),
    ...validateFrequency(rx.frequency),
    ...validateTimes(rx.times, rx.frequency),
    ...validateHalfLife(rx.halfLife),
    ...validatePeak(rx.peak),
    ...validateUptake(rx.uptake),
    ...validateMetaboliteLife(rx.metaboliteLife),
    ...validateMetaboliteConversionFraction(rx.metaboliteConversionFraction),
    ...validateMetaboliteName(rx.metaboliteName),
    ...validateDuration(rx.duration, rx.durationUnit),
  ]

  const warnings = checkCrossFieldWarnings(rx)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
