/**
 * Prescription Storage Module
 *
 * Persists Prescription objects to browser localStorage with CRUD operations.
 * No runtime dependencies beyond the browser localStorage API.
 *
 * All functions are pure (no side effects beyond localStorage).
 * Storage key: 'pk-grapher-prescriptions'
 * Format: JSON-serialized array of Prescription objects
 */

import type { Prescription } from '../models/prescription'
import { logError, logWarn } from '../utils/logger'

// ─── Constants ───

const STORAGE_KEY = 'pk-grapher-prescriptions'

// ─── Helpers ───

/**
 * Generate a unique ID for a new prescription.
 * Format: rx-{timestamp}-{random}
 * Sufficiently unique for client-side-only application.
 * @internal Not exported
 */
function generateId(): string {
  return `rx-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Get all prescriptions from storage.
 * Returns empty array if storage is empty or corrupted.
 * @returns Array of stored prescriptions (may be empty)
 */
export function getAllPrescriptions(): Prescription[] {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as Prescription[]
  } catch {
    logError('prescriptionStorage.getAllPrescriptions', 'Failed to parse prescriptions from localStorage', {
      rawDataLength: data.length,
      rawDataPreview: data.slice(0, 200),
    })
    return []
  }
}

/**
 * Get a specific prescription by ID.
 * @param id - Prescription ID to look up
 * @returns Matching prescription or undefined if not found
 */
export function getPrescription(id: string): Prescription | undefined {
  return getAllPrescriptions().find(rx => rx.id === id)
}

// ─── Write Operations ───

/**
 * Save a new prescription to storage.
 * Assigns a new generated ID regardless of input.
 * @param rx - Prescription data (id field will be overwritten)
 * @returns Stored prescription with generated id
 */
export function savePrescription(rx: Prescription): Prescription {
  const prescriptions = getAllPrescriptions()
  const newRx = { ...rx, id: generateId() }
  prescriptions.push(newRx)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prescriptions))
  } catch (e) {
    logError('prescriptionStorage.savePrescription', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      prescriptionCount: prescriptions.length,
    })
    throw e
  }
  return newRx
}

/**
 * Update an existing prescription in storage.
 * @param rx - Prescription with id field set
 * @returns true if updated, false if id missing or not found
 */
export function updatePrescription(rx: Prescription): boolean {
  if (!rx.id) {
    logWarn('prescriptionStorage.updatePrescription', 'Called with missing id')
    return false
  }
  const prescriptions = getAllPrescriptions()
  const index = prescriptions.findIndex(p => p.id === rx.id)
  if (index === -1) {
    logWarn('prescriptionStorage.updatePrescription', 'Prescription not found', { id: rx.id })
    return false
  }
  prescriptions[index] = rx
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prescriptions))
  } catch (e) {
    logError('prescriptionStorage.updatePrescription', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      id: rx.id,
    })
    throw e
  }
  return true
}

// ─── Delete and Duplicate Operations ───

/**
 * Delete a prescription from storage by ID.
 * @param id - Prescription ID to delete
 * @returns true if deleted, false if not found
 */
export function deletePrescription(id: string): boolean {
  const prescriptions = getAllPrescriptions()
  const filtered = prescriptions.filter(rx => rx.id !== id)
  if (filtered.length === prescriptions.length) {
    logWarn('prescriptionStorage.deletePrescription', 'Prescription not found', { id })
    return false
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (e) {
    logError('prescriptionStorage.deletePrescription', 'Failed to write to localStorage', {
      error: e instanceof Error ? e.message : String(e),
      id,
    })
    throw e
  }
  return true
}

/**
 * Create a duplicate of a prescription with a new ID.
 * Appends " (copy)" to the name.
 * @param id - ID of prescription to duplicate
 * @returns New duplicate prescription with generated id, or undefined if not found
 */
export function duplicatePrescription(id: string): Prescription | undefined {
  const original = getPrescription(id)
  if (!original) return undefined
  const { id: _, ...data } = original
  return savePrescription({
    ...data,
    name: `${data.name} (copy)`,
  } as Prescription)
}

// ─── Utility Functions ───

/**
 * Clear all prescriptions from storage.
 * Removes the storage key entirely.
 */
export function clearAllPrescriptions(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Get storage usage information.
 * @returns Object with used bytes and available bytes estimate
 */
export function getStorageUsage(): { used: number; available: number } {
  const data = localStorage.getItem(STORAGE_KEY) || ''
  return {
    used: data.length * 2, // JS strings are UTF-16 (2 bytes per char)
    available: 5 * 1024 * 1024, // ~5MB estimate
  }
}
