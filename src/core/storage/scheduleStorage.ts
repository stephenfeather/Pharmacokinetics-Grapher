/**
 * Schedule Storage Module
 *
 * Persists DosageSchedule objects to browser localStorage with CRUD operations.
 * Follows the same patterns as prescriptionStorage.ts.
 *
 * Storage key: 'pk-grapher-schedules'
 * Format: JSON-serialized array of DosageSchedule objects
 */

import type { DosageSchedule } from '../models/dosageSchedule'
import { logError, logWarn } from '../utils/logger'

// ─── Constants ───

const STORAGE_KEY = 'pk-grapher-schedules'

// ─── Helpers ───

/**
 * Generate a unique ID for a new schedule.
 * Format: sched-{timestamp}-{random}
 * @internal Not exported
 */
function generateId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// ─── Read Operations ───

/**
 * Get all schedules from storage.
 * Returns empty array if storage is empty or corrupted.
 */
export function getAllSchedules(): DosageSchedule[] {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as DosageSchedule[]
  } catch {
    logError('scheduleStorage.getAllSchedules', 'Failed to parse schedules from localStorage', {
      rawDataLength: data.length,
      rawDataPreview: data.slice(0, 200),
    })
    return []
  }
}

/**
 * Get a specific schedule by ID.
 * @param id - Schedule ID to look up
 * @returns Matching schedule or undefined if not found
 */
export function getSchedule(id: string): DosageSchedule | undefined {
  return getAllSchedules().find(s => s.id === id)
}

// ─── Write Operations ───

/**
 * Save a new schedule to storage.
 * Assigns a new generated ID regardless of input.
 * @param schedule - Schedule data (id field will be overwritten)
 * @returns Stored schedule with generated id
 */
export function saveSchedule(schedule: DosageSchedule): DosageSchedule {
  const schedules = getAllSchedules()
  const newSchedule = { ...schedule, id: generateId() }
  schedules.push(newSchedule)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  } catch (e) {
    logError('scheduleStorage.saveSchedule', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      scheduleCount: schedules.length,
    })
    throw e
  }
  return newSchedule
}

/**
 * Update an existing schedule in storage.
 * @param schedule - Schedule with id field set
 * @returns true if updated, false if id missing or not found
 */
export function updateSchedule(schedule: DosageSchedule): boolean {
  if (!schedule.id) {
    logWarn('scheduleStorage.updateSchedule', 'Called with missing id')
    return false
  }
  const schedules = getAllSchedules()
  const index = schedules.findIndex(s => s.id === schedule.id)
  if (index === -1) {
    logWarn('scheduleStorage.updateSchedule', 'Schedule not found', { id: schedule.id })
    return false
  }
  schedules[index] = schedule
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  } catch (e) {
    logError('scheduleStorage.updateSchedule', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      id: schedule.id,
    })
    throw e
  }
  return true
}

// ─── Delete and Duplicate Operations ───

/**
 * Delete a schedule from storage by ID.
 * @param id - Schedule ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteSchedule(id: string): boolean {
  const schedules = getAllSchedules()
  const filtered = schedules.filter(s => s.id !== id)
  if (filtered.length === schedules.length) {
    logWarn('scheduleStorage.deleteSchedule', 'Schedule not found', { id })
    return false
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (e) {
    logError('scheduleStorage.deleteSchedule', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      id,
    })
    throw e
  }
  return true
}

/**
 * Create a duplicate of a schedule with a new ID.
 * Appends " (copy)" to the name.
 * @param id - ID of schedule to duplicate
 * @returns New duplicate schedule with generated id, or undefined if not found
 */
export function duplicateSchedule(id: string): DosageSchedule | undefined {
  const original = getSchedule(id)
  if (!original) return undefined
  const { id: _, ...data } = original
  return saveSchedule({
    ...data,
    name: `${data.name} (copy)`,
  } as DosageSchedule)
}

// ─── Utility Functions ───

/**
 * Clear all schedules from storage.
 * Removes the storage key entirely.
 */
export function clearAllSchedules(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Export schedules as a pretty-printed JSON string.
 * @param ids - Optional array of schedule IDs to export. If omitted, exports all.
 * @returns Pretty-printed JSON string of the selected schedules
 */
export function exportSchedulesAsJson(ids?: string[]): string {
  const schedules = getAllSchedules()
  const toExport = ids
    ? schedules.filter(s => s.id && ids.includes(s.id))
    : schedules
  return JSON.stringify(toExport, null, 2)
}
