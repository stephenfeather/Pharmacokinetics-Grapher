// ─── PK Summary Types ───

/** Types of pharmacokinetic milestone events */
export type PkEventType = 'dose' | 'absorption_end' | 'peak' | 'half_life' | 'next_dose'

/** A single pharmacokinetic milestone event in the timeline */
export interface PkMilestoneEvent {
  /** Type of pharmacokinetic event */
  eventType: PkEventType
  /** Clock time in HH:MM format (or with day indicator) */
  clockTime: string
  /** Elapsed time notation (e.g., "T+0h", "T+6h", "T+1.5h") */
  elapsedTime: string
  /** Raw hours from first dose for sorting */
  elapsedHours: number
  /** Human-readable event description */
  description: string
  /** Relative concentration 0-1, null for dose administration events */
  relativeConcentration: number | null
  /** Name of the prescription this event belongs to */
  prescriptionName: string
}

/** Summary data for a single prescription's milestone timeline */
export interface PkSummaryData {
  /** Prescription ID (if saved) */
  prescriptionId: string | undefined
  /** Prescription drug name */
  prescriptionName: string
  /** Ordered list of milestone events */
  events: PkMilestoneEvent[]
}
