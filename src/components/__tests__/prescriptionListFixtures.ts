import type { Prescription } from '@/core/models/prescription'

export const MOCK_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx-test-001',
    name: 'Ibuprofen',
    frequency: 'tid',
    times: ['08:00', '14:00', '20:00'],
    dose: 400,
    halfLife: 2,
    peak: 1.5,
    uptake: 0.5,
  },
  {
    id: 'rx-test-002',
    name: 'Amoxicillin',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 500,
    halfLife: 1.5,
    peak: 1,
    uptake: 0.5,
  },
  {
    id: 'rx-test-003',
    name: 'Metformin',
    frequency: 'bid',
    times: ['08:00', '20:00'],
    dose: 850,
    halfLife: 6.2,
    peak: 2.5,
    uptake: 1,
  },
]
