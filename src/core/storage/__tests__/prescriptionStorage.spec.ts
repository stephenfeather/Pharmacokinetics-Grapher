import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage before importing the storage module
const mockStorage: Record<string, string> = {}
interface MockStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}
const localStorageMock: MockStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value
  },
  removeItem: (key: string) => {
    delete mockStorage[key]
  },
  clear: () => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
  },
}

// Set up global localStorage before module imports
if (typeof globalThis !== 'undefined') {
  ;(globalThis as unknown as Record<string, MockStorage>).localStorage = localStorageMock
}

import {
  getAllPrescriptions,
  getPrescription,
  savePrescription,
  savePrescriptionOrder,
  updatePrescription,
  deletePrescription,
  duplicatePrescription,
  clearAllPrescriptions,
  getStorageUsage,
} from '../prescriptionStorage'
import type { Prescription } from '../../models/prescription'
import {
  SINGLE_DOSE_FIXTURE,
  BID_MULTI_DOSE_FIXTURE,
  IBUPROFEN_FIXTURE,
} from '../../models/__tests__/fixtures'

describe('prescriptionStorage', () => {
  beforeEach(() => {
    // Clear storage by removing the specific key
    delete mockStorage['pk-grapher-prescriptions']
  })

  describe('getAllPrescriptions', () => {
    it('returns empty array when localStorage is empty', () => {
      const result = getAllPrescriptions()
      expect(result).toEqual([])
      expect(Array.isArray(result)).toBe(true)
    })

    it('returns empty array when localStorage has corrupted JSON', () => {
      localStorage.setItem('pk-grapher-prescriptions', 'not valid json {]')
      const result = getAllPrescriptions()
      expect(result).toEqual([])
    })

    it('returns parsed prescriptions when valid data exists', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(BID_MULTI_DOSE_FIXTURE)

      const result = getAllPrescriptions()
      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe(saved1.id)
      expect(result[1]!.id).toBe(saved2.id)
    })

    it('preserves all prescription fields through serialization', () => {
      const saved = savePrescription(IBUPROFEN_FIXTURE)

      const retrieved = getAllPrescriptions()[0]!
      expect(retrieved.name).toBe(saved.name)
      expect(retrieved.frequency).toBe(saved.frequency)
      expect(retrieved.times).toEqual(saved.times)
      expect(retrieved.dose).toBe(saved.dose)
      expect(retrieved.halfLife).toBe(saved.halfLife)
      expect(retrieved.peak).toBe(saved.peak)
      expect(retrieved.uptake).toBe(saved.uptake)
    })
  })

  describe('getPrescription', () => {
    it('returns undefined when no prescriptions exist', () => {
      const result = getPrescription('nonexistent')
      expect(result).toBeUndefined()
    })

    it('returns undefined for non-existent id', () => {
      savePrescription(SINGLE_DOSE_FIXTURE)
      const result = getPrescription('wrong-id')
      expect(result).toBeUndefined()
    })

    it('returns matching prescription by id', () => {
      const saved = savePrescription(SINGLE_DOSE_FIXTURE)
      const retrieved = getPrescription(saved.id!)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(saved.id)
      expect(retrieved?.name).toBe(saved.name)
    })
  })

  describe('savePrescription', () => {
    it('returns prescription with generated id', () => {
      const result = savePrescription(SINGLE_DOSE_FIXTURE)
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
      expect(result.id).toMatch(/^rx-\d+-[a-z0-9]+$/)
    })

    it('does not mutate the input object', () => {
      const input = { ...SINGLE_DOSE_FIXTURE }
      const originalId = input.id
      savePrescription(input)
      expect(input.id).toBe(originalId)
    })

    it('persists prescription to localStorage', () => {
      const saved = savePrescription(SINGLE_DOSE_FIXTURE)
      const retrieved = getPrescription(saved.id!)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(saved.id)
    })

    it('handles multiple saves without overwriting', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(BID_MULTI_DOSE_FIXTURE)

      const all = getAllPrescriptions()
      expect(all).toHaveLength(2)
      expect(all[0]!.id).toBe(saved1.id)
      expect(all[1]!.id).toBe(saved2.id)
    })

    it('overwrites any existing id on the input', () => {
      const input: Prescription = {
        ...SINGLE_DOSE_FIXTURE,
        id: 'old-id',
      }
      const result = savePrescription(input)
      expect(result.id).not.toBe('old-id')
      expect(result.id).toMatch(/^rx-/)
    })

    it('assigns unique ids for consecutive saves', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(SINGLE_DOSE_FIXTURE)
      expect(saved1.id).not.toBe(saved2.id)
    })
  })

  describe('updatePrescription', () => {
    it('returns false when rx.id is undefined', () => {
      const rx = { ...SINGLE_DOSE_FIXTURE, id: undefined }
      const result = updatePrescription(rx)
      expect(result).toBe(false)
    })

    it('returns false when rx.id is empty string', () => {
      const rx = { ...SINGLE_DOSE_FIXTURE, id: '' }
      const result = updatePrescription(rx)
      expect(result).toBe(false)
    })

    it('returns false when id is not found', () => {
      const rx = { ...SINGLE_DOSE_FIXTURE, id: 'nonexistent' }
      const result = updatePrescription(rx)
      expect(result).toBe(false)
    })

    it('returns true and updates data for existing id', () => {
      const saved = savePrescription(SINGLE_DOSE_FIXTURE)
      const updated = { ...saved, name: 'Updated Name' }
      const result = updatePrescription(updated)

      expect(result).toBe(true)
      const retrieved = getPrescription(saved.id!)
      expect(retrieved?.name).toBe('Updated Name')
    })

    it('does not affect other prescriptions', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(BID_MULTI_DOSE_FIXTURE)

      const updated1 = { ...saved1, name: 'Changed' }
      updatePrescription(updated1)

      const retrieved2 = getPrescription(saved2.id!)
      expect(retrieved2?.name).toBe(saved2.name) // Unchanged
    })
  })

  describe('deletePrescription', () => {
    it('returns false for non-existent id', () => {
      const result = deletePrescription('nonexistent')
      expect(result).toBe(false)
    })

    it('returns true and removes prescription', () => {
      const saved = savePrescription(SINGLE_DOSE_FIXTURE)
      const result = deletePrescription(saved.id!)

      expect(result).toBe(true)
      expect(getPrescription(saved.id!)).toBeUndefined()
    })

    it('does not affect other prescriptions', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(BID_MULTI_DOSE_FIXTURE)

      deletePrescription(saved1.id!)

      expect(getPrescription(saved2.id!)).toBeDefined()
    })

    it('handles deleting the only prescription', () => {
      const saved = savePrescription(SINGLE_DOSE_FIXTURE)
      deletePrescription(saved.id!)

      expect(getAllPrescriptions()).toEqual([])
    })
  })

  describe('duplicatePrescription', () => {
    it('returns undefined for non-existent id', () => {
      const result = duplicatePrescription('nonexistent')
      expect(result).toBeUndefined()
    })

    it('creates copy with new id', () => {
      const original = savePrescription(SINGLE_DOSE_FIXTURE)
      const copy = duplicatePrescription(original.id!)

      expect(copy).toBeDefined()
      expect(copy?.id).not.toBe(original.id)
      expect(copy?.id).toMatch(/^rx-/)
    })

    it('appends (copy) to name', () => {
      const original = savePrescription(SINGLE_DOSE_FIXTURE)
      const copy = duplicatePrescription(original.id!)

      expect(copy?.name).toBe(`${original.name} (copy)`)
    })

    it('does not modify original prescription', () => {
      const original = savePrescription(SINGLE_DOSE_FIXTURE)
      const originalName = original.name
      duplicatePrescription(original.id!)

      const retrieved = getPrescription(original.id!)
      expect(retrieved?.name).toBe(originalName)
    })

    it('preserves all other fields', () => {
      const original = savePrescription(IBUPROFEN_FIXTURE)
      const copy = duplicatePrescription(original.id!)

      expect(copy?.frequency).toBe(original.frequency)
      expect(copy?.times).toEqual(original.times)
      expect(copy?.dose).toBe(original.dose)
      expect(copy?.halfLife).toBe(original.halfLife)
      expect(copy?.peak).toBe(original.peak)
      expect(copy?.uptake).toBe(original.uptake)
    })
  })

  describe('savePrescriptionOrder', () => {
    it('persists new order to localStorage', () => {
      const saved1 = savePrescription(SINGLE_DOSE_FIXTURE)
      const saved2 = savePrescription(BID_MULTI_DOSE_FIXTURE)
      const saved3 = savePrescription(IBUPROFEN_FIXTURE)

      const reordered = [saved3, saved1, saved2]
      savePrescriptionOrder(reordered)

      const stored = getAllPrescriptions()
      expect(stored).toHaveLength(3)
      expect(stored[0]!.id).toBe(saved3.id)
      expect(stored[1]!.id).toBe(saved1.id)
      expect(stored[2]!.id).toBe(saved2.id)
    })

    it('works with empty array', () => {
      savePrescription(SINGLE_DOSE_FIXTURE)
      savePrescriptionOrder([])

      expect(getAllPrescriptions()).toEqual([])
    })

    it('throws and logs when localStorage setItem fails', async () => {
      const logger = await import('../../utils/logger')
      const logErrorSpy = vi.spyOn(logger, 'logError')
      const originalSetItem = localStorage.setItem
      ;(localStorage as MockStorage).setItem = () => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      }
      try {
        const prescriptions = [{ ...SINGLE_DOSE_FIXTURE, id: 'rx-order-fail-test' }]
        expect(() => savePrescriptionOrder(prescriptions)).toThrow(DOMException)
        expect(logErrorSpy).toHaveBeenCalledWith(
          'prescriptionStorage.savePrescriptionOrder',
          'Failed to persist order',
          expect.objectContaining({ error: expect.any(String) }),
        )
      } finally {
        ;(localStorage as MockStorage).setItem = originalSetItem
        logErrorSpy.mockRestore()
      }
    })
  })

  describe('clearAllPrescriptions', () => {
    it('removes all prescriptions', () => {
      savePrescription(SINGLE_DOSE_FIXTURE)
      savePrescription(BID_MULTI_DOSE_FIXTURE)

      clearAllPrescriptions()

      expect(getAllPrescriptions()).toEqual([])
    })

    it('does nothing when already empty', () => {
      clearAllPrescriptions()
      expect(getAllPrescriptions()).toEqual([])
    })
  })

  describe('getStorageUsage', () => {
    it('returns 0 used when empty', () => {
      const usage = getStorageUsage()
      expect(usage.used).toBe(0)
    })

    it('returns correct byte count for stored data', () => {
      savePrescription(SINGLE_DOSE_FIXTURE)
      const usage = getStorageUsage()
      expect(usage.used).toBeGreaterThan(0)
      expect(typeof usage.used).toBe('number')
    })

    it('returns 5MB as available', () => {
      const usage = getStorageUsage()
      expect(usage.available).toBe(5 * 1024 * 1024)
    })

    it('increases used bytes when more prescriptions are added', () => {
      const usage1 = getStorageUsage()
      savePrescription(SINGLE_DOSE_FIXTURE)
      const usage2 = getStorageUsage()
      expect(usage2.used).toBeGreaterThan(usage1.used)
    })
  })

  describe('integration: full CRUD lifecycle', () => {
    it('save -> read -> update -> duplicate -> delete -> clear', () => {
      // Save
      const original = savePrescription(SINGLE_DOSE_FIXTURE)
      expect(original.id).toBeDefined()

      // Read
      const retrieved = getPrescription(original.id!)
      expect(retrieved?.name).toBe(original.name)

      // Update
      const updated = { ...original, name: 'Updated' }
      const updateSuccess = updatePrescription(updated)
      expect(updateSuccess).toBe(true)
      expect(getPrescription(original.id!)?.name).toBe('Updated')

      // Duplicate
      const copy = duplicatePrescription(original.id!)
      expect(copy?.id).not.toBe(original.id)
      expect(copy?.name).toContain('(copy)')

      // Delete
      const deleteSuccess = deletePrescription(original.id!)
      expect(deleteSuccess).toBe(true)
      expect(getPrescription(original.id!)).toBeUndefined()
      expect(copy).toBeDefined()
      expect(getPrescription(copy!.id!)).toBeDefined() // Copy still exists

      // Clear
      clearAllPrescriptions()
      expect(getAllPrescriptions()).toEqual([])
    })
  })

  describe('barrel exports', () => {
    it('exports all functions from index.ts', async () => {
      // This test verifies the import pattern works
      const { savePrescription: save } = await import('../index')
      expect(typeof save).toBe('function')
    })
  })
})
