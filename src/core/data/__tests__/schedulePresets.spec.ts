import { describe, it, expect } from 'vitest'
import {
  SCHEDULE_PRESETS,
  getPresetById,
  getPresetsByCategory,
} from '../schedulePresets'
import { validateDosageSchedule } from '@/core/models/dosageSchedule'

describe('schedulePresets', () => {
  describe('SCHEDULE_PRESETS', () => {
    it('contains at least 2 presets', () => {
      expect(SCHEDULE_PRESETS.length).toBeGreaterThanOrEqual(2)
    })

    it('every preset has required fields', () => {
      for (const preset of SCHEDULE_PRESETS) {
        expect(preset.id).toBeTruthy()
        expect(preset.name).toBeTruthy()
        expect(preset.description).toBeTruthy()
        expect(preset.category).toBeTruthy()
        expect(preset.schedule).toBeDefined()
      }
    })

    it('every preset has a unique id', () => {
      const ids = SCHEDULE_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('every preset schedule passes validation', () => {
      for (const preset of SCHEDULE_PRESETS) {
        const scheduleWithId = { ...preset.schedule, id: `test-${preset.id}` }
        const result = validateDosageSchedule(scheduleWithId)
        expect(result.valid, `Preset "${preset.name}" failed validation: ${result.errors.join(', ')}`).toBe(true)
      }
    })

    it('every preset schedule has no undefined fields', () => {
      for (const preset of SCHEDULE_PRESETS) {
        const schedule = preset.schedule
        expect(schedule.name).toBeDefined()
        expect(schedule.direction).toBeDefined()
        expect(schedule.basePrescription).toBeDefined()
        expect(schedule.steps).toBeDefined()
        expect(schedule.totalDuration).toBeDefined()

        const rx = schedule.basePrescription
        expect(rx.name).toBeDefined()
        expect(rx.frequency).toBeDefined()
        expect(rx.times).toBeDefined()
        expect(rx.dose).toBeDefined()
        expect(rx.halfLife).toBeDefined()
        expect(rx.peak).toBeDefined()
        expect(rx.uptake).toBeDefined()
      }
    })

    it('every preset totalDuration matches sum of step durations', () => {
      for (const preset of SCHEDULE_PRESETS) {
        const sum = preset.schedule.steps.reduce((acc, s) => acc + s.durationDays, 0)
        expect(sum, `Preset "${preset.name}" totalDuration mismatch`).toBe(preset.schedule.totalDuration)
      }
    })

    it('contains at least one titration preset', () => {
      expect(SCHEDULE_PRESETS.some(p => p.schedule.direction === 'titration')).toBe(true)
    })

    it('contains at least one taper preset', () => {
      expect(SCHEDULE_PRESETS.some(p => p.schedule.direction === 'taper')).toBe(true)
    })
  })

  describe('getPresetById', () => {
    it('returns the correct preset for a known id', () => {
      const first = SCHEDULE_PRESETS[0]!
      const result = getPresetById(first.id)
      expect(result).toBeDefined()
      expect(result!.id).toBe(first.id)
      expect(result!.name).toBe(first.name)
    })

    it('returns undefined for unknown id', () => {
      expect(getPresetById('nonexistent-id')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(getPresetById('')).toBeUndefined()
    })
  })

  describe('getPresetsByCategory', () => {
    it('returns presets matching the given category', () => {
      const categories = [...new Set(SCHEDULE_PRESETS.map(p => p.category))]
      for (const cat of categories) {
        const results = getPresetsByCategory(cat)
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
          expect(r.category).toBe(cat)
        }
      }
    })

    it('returns empty array for unknown category', () => {
      expect(getPresetsByCategory('nonexistent')).toEqual([])
    })
  })
})
