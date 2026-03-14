import type { Prescription } from './prescription'
import { validatePrescription } from './prescription'

// ─── Type Definitions ───

export type ScheduleDirection = 'titration' | 'taper'

export interface DoseStep {
  stepNumber: number
  dose: number
  durationDays: number
  startDay: number
}

export interface DosageSchedule {
  id?: string
  name: string
  direction: ScheduleDirection
  basePrescription: Prescription
  steps: DoseStep[]
  totalDuration: number
}

export interface ScheduleValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── Constants ───

const VALID_DIRECTIONS: ScheduleDirection[] = ['titration', 'taper']
const NAME_MAX_LENGTH = 100
const MIN_STEPS = 2

// ─── Utility Functions ───

/**
 * Recompute stepNumber (1-indexed) and startDay from step durations.
 * Returns a new array without mutating the original.
 */
export function computeStartDays(steps: DoseStep[]): DoseStep[] {
  let dayOffset = 0
  return steps.map((step, i) => {
    const result: DoseStep = {
      ...step,
      stepNumber: i + 1,
      startDay: dayOffset,
    }
    dayOffset += step.durationDays
    return result
  })
}

// ─── Validation ───

function validateScheduleName(name: string): string[] {
  const errors: string[] = []

  if (typeof name !== 'string') {
    errors.push('Schedule name is required and must be a string')
    return errors
  }

  const trimmed = name.trim()

  if (trimmed.length < 1) {
    errors.push('Schedule name must not be empty')
  } else if (trimmed.length > NAME_MAX_LENGTH) {
    errors.push(`Schedule name must be ${NAME_MAX_LENGTH} characters or fewer`)
  }

  return errors
}

function validateDirection(direction: string): string[] {
  const errors: string[] = []

  if (!VALID_DIRECTIONS.includes(direction as ScheduleDirection)) {
    errors.push(`Direction must be one of: ${VALID_DIRECTIONS.join(', ')}`)
  }

  return errors
}

function validateSteps(steps: DoseStep[]): string[] {
  const errors: string[] = []

  if (!Array.isArray(steps) || steps.length < MIN_STEPS) {
    errors.push(`At least ${MIN_STEPS} steps are required`)
    return errors
  }

  for (const step of steps) {
    if (typeof step.dose !== 'number' || step.dose <= 0) {
      errors.push(`Step ${step.stepNumber}: dose must be greater than 0`)
    }
    if (typeof step.durationDays !== 'number' || step.durationDays <= 0) {
      errors.push(`Step ${step.stepNumber}: duration must be at least 1 day`)
    }
  }

  return errors
}

function checkDoseMonotonicity(
  steps: DoseStep[],
  direction: ScheduleDirection,
): string[] {
  const warnings: string[] = []

  if (steps.length < 2) return warnings

  for (let i = 1; i < steps.length; i++) {
    const prevStep = steps[i - 1]!
    const currStep = steps[i]!
    const prev = prevStep.dose
    const curr = currStep.dose

    if (direction === 'titration' && curr < prev) {
      warnings.push(
        `Titration step ${currStep.stepNumber}: dose decrease from ${prev} to ${curr}. Titration schedules typically have increasing doses.`,
      )
    } else if (direction === 'taper' && curr > prev) {
      warnings.push(
        `Taper step ${currStep.stepNumber}: dose increase from ${prev} to ${curr}. Taper schedules typically have decreasing doses.`,
      )
    }
  }

  return warnings
}

/**
 * Validate a DosageSchedule object.
 * Checks name, direction, steps, and base prescription validity.
 */
export function validateDosageSchedule(
  schedule: DosageSchedule,
): ScheduleValidationResult {
  const errors: string[] = [
    ...validateScheduleName(schedule.name),
    ...validateDirection(schedule.direction),
    ...validateSteps(schedule.steps),
  ]

  // Validate the base prescription
  const rxResult = validatePrescription(schedule.basePrescription)
  if (!rxResult.valid) {
    errors.push(...rxResult.errors)
  }

  // Warnings
  const warnings: string[] = []

  if (VALID_DIRECTIONS.includes(schedule.direction as ScheduleDirection) && schedule.steps.length >= 2) {
    warnings.push(...checkDoseMonotonicity(schedule.steps, schedule.direction))
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
