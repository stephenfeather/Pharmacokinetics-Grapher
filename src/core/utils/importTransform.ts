/**
 * Import Transformation Utility
 *
 * Transforms externally-formatted prescription JSON into the internal
 * Prescription model format. Handles the nested metaboliteHalfLife object
 * structure used in external JSON files and maps it to flat properties.
 */

import type { Prescription } from '../models/prescription'

/**
 * Shape of the nested metaboliteHalfLife object in external JSON.
 */
interface ImportedMetaboliteHalfLife {
  name?: string
  halfLife?: number
}

/**
 * Transform an imported prescription from external JSON format to internal Prescription format.
 *
 * Handles:
 * - Nested `metaboliteHalfLife.halfLife` -> flat `metaboliteLife`
 * - Nested `metaboliteHalfLife.name` -> flat `metaboliteName`
 * - Removes the `metaboliteHalfLife` property after extraction
 * - Preserves existing flat fields if no nested object is present (backward compat)
 * - Coerces string numbers to actual numbers for numeric fields
 *
 * @param imported - Raw parsed JSON object for a single prescription
 * @returns Transformed object compatible with the Prescription interface
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformImportedPrescription(imported: Record<string, any>): Prescription {
  const result = { ...imported }

  // Transform nested metaboliteHalfLife to flat properties
  const metaboliteHalfLife = imported.metaboliteHalfLife as ImportedMetaboliteHalfLife | undefined
  if (metaboliteHalfLife && typeof metaboliteHalfLife === 'object') {
    if (metaboliteHalfLife.halfLife !== undefined) {
      result.metaboliteLife = metaboliteHalfLife.halfLife
    }
    if (metaboliteHalfLife.name !== undefined) {
      result.metaboliteName = metaboliteHalfLife.name
    }
    delete result.metaboliteHalfLife
  }

  // Coerce string numbers to actual numbers for common numeric fields
  const numericFields = ['dose', 'halfLife', 'peak', 'uptake', 'metaboliteLife', 'metaboliteConversionFraction', 'duration'] as const
  for (const field of numericFields) {
    if (typeof result[field] === 'string') {
      const parsed = Number(result[field])
      if (!isNaN(parsed)) {
        result[field] = parsed
      }
    }
  }

  return result as Prescription
}
