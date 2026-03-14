import { describe, it, expect, beforeEach } from 'vitest'

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
  getAllSchedules,
  getSchedule,
  saveSchedule,
  updateSchedule,
  deleteSchedule,
  duplicateSchedule,
  clearAllSchedules,
  exportSchedulesAsJson,
} from '../scheduleStorage'
import type { DosageSchedule } from '../../models/dosageSchedule'
import type { Prescription } from '../../models/prescription'

function makeBasePrescription(): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 50,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
  }
}

function makeSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
  return {
    name: 'Test Titration',
    direction: 'titration',
    basePrescription: makeBasePrescription(),
    steps: [
      { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
      { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
    ],
    totalDuration: 14,
    ...overrides,
  }
}

describe('scheduleStorage', () => {
  beforeEach(() => {
    delete mockStorage['pk-grapher-schedules']
  })

  // ─── Read Operations ───

  describe('getAllSchedules', () => {
    it('returns empty array when storage is empty', () => {
      expect(getAllSchedules()).toEqual([])
    })

    it('returns stored schedules', () => {
      const schedule = makeSchedule({ id: 'sched-1' })
      mockStorage['pk-grapher-schedules'] = JSON.stringify([schedule])
      const result = getAllSchedules()
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('Test Titration')
    })

    it('returns empty array on corrupted data', () => {
      mockStorage['pk-grapher-schedules'] = '{invalid json'
      expect(getAllSchedules()).toEqual([])
    })
  })

  describe('getSchedule', () => {
    it('returns matching schedule by id', () => {
      const schedule = makeSchedule({ id: 'sched-abc' })
      mockStorage['pk-grapher-schedules'] = JSON.stringify([schedule])
      const result = getSchedule('sched-abc')
      expect(result).toBeDefined()
      expect(result!.name).toBe('Test Titration')
    })

    it('returns undefined when not found', () => {
      expect(getSchedule('nonexistent')).toBeUndefined()
    })
  })

  // ─── Write Operations ───

  describe('saveSchedule', () => {
    it('saves schedule and assigns new id', () => {
      const schedule = makeSchedule()
      const saved = saveSchedule(schedule)
      expect(saved.id).toBeDefined()
      expect(saved.id).toMatch(/^sched-/)
      expect(saved.name).toBe('Test Titration')
    })

    it('saved schedule appears in getAllSchedules', () => {
      saveSchedule(makeSchedule())
      const all = getAllSchedules()
      expect(all).toHaveLength(1)
    })

    it('multiple saves accumulate', () => {
      saveSchedule(makeSchedule({ name: 'Schedule A' }))
      saveSchedule(makeSchedule({ name: 'Schedule B' }))
      const all = getAllSchedules()
      expect(all).toHaveLength(2)
    })

    it('generates unique IDs', () => {
      const a = saveSchedule(makeSchedule())
      const b = saveSchedule(makeSchedule())
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('updateSchedule', () => {
    it('updates an existing schedule', () => {
      const saved = saveSchedule(makeSchedule())
      const updated = { ...saved, name: 'Updated Name' }
      const result = updateSchedule(updated)
      expect(result).toBe(true)
      expect(getSchedule(saved.id!)!.name).toBe('Updated Name')
    })

    it('returns false if id is missing', () => {
      const schedule = makeSchedule()
      expect(updateSchedule(schedule)).toBe(false)
    })

    it('returns false if schedule not found', () => {
      const schedule = makeSchedule({ id: 'nonexistent' })
      expect(updateSchedule(schedule)).toBe(false)
    })
  })

  // ─── Delete and Duplicate ───

  describe('deleteSchedule', () => {
    it('deletes an existing schedule', () => {
      const saved = saveSchedule(makeSchedule())
      expect(deleteSchedule(saved.id!)).toBe(true)
      expect(getAllSchedules()).toHaveLength(0)
    })

    it('returns false if not found', () => {
      expect(deleteSchedule('nonexistent')).toBe(false)
    })

    it('does not affect other schedules', () => {
      const a = saveSchedule(makeSchedule({ name: 'A' }))
      saveSchedule(makeSchedule({ name: 'B' }))
      deleteSchedule(a.id!)
      const all = getAllSchedules()
      expect(all).toHaveLength(1)
      expect(all[0]!.name).toBe('B')
    })
  })

  describe('duplicateSchedule', () => {
    it('creates a copy with (copy) suffix', () => {
      const saved = saveSchedule(makeSchedule({ name: 'Original' }))
      const copy = duplicateSchedule(saved.id!)
      expect(copy).toBeDefined()
      expect(copy!.name).toBe('Original (copy)')
      expect(copy!.id).not.toBe(saved.id)
    })

    it('returns undefined if original not found', () => {
      expect(duplicateSchedule('nonexistent')).toBeUndefined()
    })

    it('duplicate appears in getAllSchedules', () => {
      const saved = saveSchedule(makeSchedule())
      duplicateSchedule(saved.id!)
      expect(getAllSchedules()).toHaveLength(2)
    })
  })

  // ─── Utility ───

  describe('clearAllSchedules', () => {
    it('removes all schedules', () => {
      saveSchedule(makeSchedule({ name: 'A' }))
      saveSchedule(makeSchedule({ name: 'B' }))
      clearAllSchedules()
      expect(getAllSchedules()).toEqual([])
    })

    it('is safe to call on empty storage', () => {
      clearAllSchedules()
      expect(getAllSchedules()).toEqual([])
    })
  })

  // ─── Export ───

  describe('exportSchedulesAsJson', () => {
    it('exports all schedules as valid JSON string', () => {
      saveSchedule(makeSchedule({ name: 'A' }))
      saveSchedule(makeSchedule({ name: 'B' }))
      const json = exportSchedulesAsJson()
      const parsed = JSON.parse(json) as DosageSchedule[]
      expect(parsed).toHaveLength(2)
      expect(parsed[0]!.name).toBe('A')
      expect(parsed[1]!.name).toBe('B')
    })

    it('exports empty array when no schedules exist', () => {
      const json = exportSchedulesAsJson()
      const parsed = JSON.parse(json) as DosageSchedule[]
      expect(parsed).toEqual([])
    })

    it('exports only selected schedules when ids provided', () => {
      const a = saveSchedule(makeSchedule({ name: 'A' }))
      saveSchedule(makeSchedule({ name: 'B' }))
      const c = saveSchedule(makeSchedule({ name: 'C' }))
      const json = exportSchedulesAsJson([a.id!, c.id!])
      const parsed = JSON.parse(json) as DosageSchedule[]
      expect(parsed).toHaveLength(2)
      expect(parsed[0]!.name).toBe('A')
      expect(parsed[1]!.name).toBe('C')
    })

    it('produces pretty-printed JSON', () => {
      saveSchedule(makeSchedule({ name: 'A' }))
      const json = exportSchedulesAsJson()
      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })

    it('round-trips: exported JSON can be parsed and re-saved', () => {
      const saved = saveSchedule(makeSchedule({ name: 'Round Trip' }))
      const json = exportSchedulesAsJson()
      clearAllSchedules()
      const parsed = JSON.parse(json) as DosageSchedule[]
      for (const schedule of parsed) {
        saveSchedule(schedule)
      }
      const all = getAllSchedules()
      expect(all).toHaveLength(1)
      expect(all[0]!.name).toBe('Round Trip')
      // ID should be new (saveSchedule generates new IDs)
      expect(all[0]!.id).not.toBe(saved.id)
    })
  })
})
