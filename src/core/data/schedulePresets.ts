import type { DosageSchedule } from '../models/dosageSchedule'

export type PresetCategory = 'antidepressant' | 'anxiolytic' | 'corticosteroid' | 'opioid' | 'custom'

export interface SchedulePreset {
  id: string
  name: string
  description: string
  category: PresetCategory
  schedule: Omit<DosageSchedule, 'id'>
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: 'sertraline-titration',
    name: 'Sertraline Titration',
    description: 'Standard SSRI titration from 25mg to 100mg over 4 weeks',
    category: 'antidepressant',
    schedule: {
      name: 'Sertraline Titration',
      direction: 'titration',
      basePrescription: {
        name: 'Sertraline',
        frequency: 'qd',
        times: ['09:00'],
        dose: 25,
        halfLife: 26,
        peak: 6,
        uptake: 2,
      },
      steps: [
        { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
        { stepNumber: 3, dose: 100, durationDays: 14, startDay: 14 },
      ],
      totalDuration: 28,
    },
  },
  {
    id: 'prednisone-taper',
    name: 'Prednisone Taper',
    description: 'Standard corticosteroid taper from 60mg over 15 days',
    category: 'corticosteroid',
    schedule: {
      name: 'Prednisone Taper',
      direction: 'taper',
      basePrescription: {
        name: 'Prednisone',
        frequency: 'qd',
        times: ['08:00'],
        dose: 60,
        halfLife: 3.5,
        peak: 1,
        uptake: 0.5,
      },
      steps: [
        { stepNumber: 1, dose: 60, durationDays: 3, startDay: 0 },
        { stepNumber: 2, dose: 40, durationDays: 3, startDay: 3 },
        { stepNumber: 3, dose: 20, durationDays: 3, startDay: 6 },
        { stepNumber: 4, dose: 10, durationDays: 3, startDay: 9 },
        { stepNumber: 5, dose: 5, durationDays: 3, startDay: 12 },
      ],
      totalDuration: 15,
    },
  },
  {
    id: 'escitalopram-titration',
    name: 'Escitalopram Titration',
    description: 'SSRI titration from 5mg to 20mg over 4 weeks',
    category: 'antidepressant',
    schedule: {
      name: 'Escitalopram Titration',
      direction: 'titration',
      basePrescription: {
        name: 'Escitalopram',
        frequency: 'qd',
        times: ['09:00'],
        dose: 5,
        halfLife: 30,
        peak: 5,
        uptake: 2,
      },
      steps: [
        { stepNumber: 1, dose: 5, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 10, durationDays: 7, startDay: 7 },
        { stepNumber: 3, dose: 20, durationDays: 14, startDay: 14 },
      ],
      totalDuration: 28,
    },
  },
  {
    id: 'venlafaxine-taper',
    name: 'Venlafaxine Taper',
    description: 'SNRI taper from 150mg to 37.5mg over 6 weeks',
    category: 'antidepressant',
    schedule: {
      name: 'Venlafaxine Taper',
      direction: 'taper',
      basePrescription: {
        name: 'Venlafaxine',
        frequency: 'qd',
        times: ['09:00'],
        dose: 150,
        halfLife: 5,
        peak: 6,
        uptake: 2,
      },
      steps: [
        { stepNumber: 1, dose: 150, durationDays: 14, startDay: 0 },
        { stepNumber: 2, dose: 75, durationDays: 14, startDay: 14 },
        { stepNumber: 3, dose: 37.5, durationDays: 14, startDay: 28 },
      ],
      totalDuration: 42,
    },
  },
  {
    id: 'lorazepam-taper',
    name: 'Lorazepam Taper',
    description: 'Benzodiazepine taper from 2mg over 4 weeks',
    category: 'anxiolytic',
    schedule: {
      name: 'Lorazepam Taper',
      direction: 'taper',
      basePrescription: {
        name: 'Lorazepam',
        frequency: 'bid',
        times: ['09:00', '21:00'],
        dose: 2,
        halfLife: 12,
        peak: 2,
        uptake: 1,
      },
      steps: [
        { stepNumber: 1, dose: 2, durationDays: 7, startDay: 0 },
        { stepNumber: 2, dose: 1.5, durationDays: 7, startDay: 7 },
        { stepNumber: 3, dose: 1, durationDays: 7, startDay: 14 },
        { stepNumber: 4, dose: 0.5, durationDays: 7, startDay: 21 },
      ],
      totalDuration: 28,
    },
  },
]

export function getPresetById(id: string): SchedulePreset | undefined {
  return SCHEDULE_PRESETS.find(p => p.id === id)
}

export function getPresetsByCategory(category: string): SchedulePreset[] {
  return SCHEDULE_PRESETS.filter(p => p.category === category)
}
