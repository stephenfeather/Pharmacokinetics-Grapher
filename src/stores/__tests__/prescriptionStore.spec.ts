import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Prescription } from '@/core/models/prescription'
import { usePrescriptionStore } from '../prescriptionStore'

vi.mock('@/core/storage/prescriptionStorage', () => ({
  getAllPrescriptions: vi.fn(() => []),
  savePrescription: vi.fn((rx: Prescription) => ({ ...rx, id: 'rx-new-123' })),
  updatePrescription: vi.fn(() => true),
  deletePrescription: vi.fn(() => true),
  duplicatePrescription: vi.fn((id: string) => ({ id: `${id}-copy`, name: 'Copy' })),
  savePrescriptionOrder: vi.fn(),
  exportPrescriptionsAsJson: vi.fn(() => '[]'),
  clearAllPrescriptions: vi.fn(),
}))

import {
  getAllPrescriptions,
  deletePrescription,
  duplicatePrescription,
  savePrescriptionOrder,
  exportPrescriptionsAsJson,
  clearAllPrescriptions,
} from '@/core/storage/prescriptionStorage'

const mockGetAll = vi.mocked(getAllPrescriptions)
const mockDelete = vi.mocked(deletePrescription)
const mockDuplicate = vi.mocked(duplicatePrescription)
const mockSaveOrder = vi.mocked(savePrescriptionOrder)
const mockClear = vi.mocked(clearAllPrescriptions)

describe('prescriptionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty prescriptions and isLoaded false', () => {
    const store = usePrescriptionStore()
    expect(store.prescriptions).toEqual([])
    expect(store.isLoaded).toBe(false)
    expect(store.isEmpty).toBe(true)
    expect(store.count).toBe(0)
  })

  it('load() populates prescriptions from storage', () => {
    const mockData: Prescription[] = [
      { id: 'rx-1', name: 'Test Drug', dose: 500, frequency: 'bid', times: ['09:00', '21:00'], halfLife: 6, peak: 2, uptake: 1.5 },
    ]
    mockGetAll.mockReturnValue(mockData)

    const store = usePrescriptionStore()
    store.load()

    expect(store.prescriptions).toHaveLength(1)
    expect(store.isLoaded).toBe(true)
    expect(store.isEmpty).toBe(false)
    expect(store.count).toBe(1)
  })

  it('save() calls storage and refreshes state', () => {
    const store = usePrescriptionStore()
    const rx: Prescription = { name: 'New Drug', dose: 500, frequency: 'bid', times: ['09:00', '21:00'], halfLife: 6, peak: 2, uptake: 1.5 }

    const saved = store.save(rx)

    expect(saved.id).toBe('rx-new-123')
    expect(mockGetAll).toHaveBeenCalled()
  })

  it('update() calls storage and refreshes on success', () => {
    const store = usePrescriptionStore()
    const rx: Prescription = { id: 'rx-1', name: 'Updated', dose: 500, frequency: 'bid', times: ['09:00'], halfLife: 6, peak: 2, uptake: 1.5 }

    const success = store.update(rx)

    expect(success).toBe(true)
    expect(mockGetAll).toHaveBeenCalled()
  })

  it('remove() calls storage and refreshes on success', () => {
    const store = usePrescriptionStore()
    const success = store.remove('rx-1')

    expect(success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('rx-1')
    expect(mockGetAll).toHaveBeenCalled()
  })

  it('remove() does not refresh when delete fails', () => {
    mockDelete.mockReturnValueOnce(false)
    const store = usePrescriptionStore()

    const success = store.remove('nonexistent')

    expect(success).toBe(false)
  })

  it('duplicate() calls storage and refreshes on success', () => {
    const store = usePrescriptionStore()
    const copy = store.duplicate('rx-1')

    expect(copy).toBeDefined()
    expect(mockDuplicate).toHaveBeenCalledWith('rx-1')
  })

  it('duplicate() returns undefined when not found', () => {
    mockDuplicate.mockReturnValueOnce(undefined)
    const store = usePrescriptionStore()

    const copy = store.duplicate('nonexistent')

    expect(copy).toBeUndefined()
  })

  it('reorder() persists new order and updates state', () => {
    const newOrder: Prescription[] = [
      { id: 'rx-2', name: 'Second', dose: 500, frequency: 'bid', times: ['09:00'], halfLife: 6, peak: 2, uptake: 1.5 },
      { id: 'rx-1', name: 'First', dose: 250, frequency: 'qd', times: ['09:00'], halfLife: 4, peak: 1, uptake: 1 },
    ]
    const store = usePrescriptionStore()

    store.reorder(newOrder)

    expect(mockSaveOrder).toHaveBeenCalledWith(newOrder)
    expect(store.prescriptions).toEqual(newOrder)
  })

  it('exportJson() delegates to storage', () => {
    const mockExport = vi.mocked(exportPrescriptionsAsJson)
    const store = usePrescriptionStore()
    store.exportJson()
    store.exportJson(['rx-1'])

    expect(mockExport).toHaveBeenCalledTimes(2)
  })

  it('clear() removes all prescriptions', () => {
    const store = usePrescriptionStore()
    store.clear()

    expect(mockClear).toHaveBeenCalled()
    expect(store.prescriptions).toEqual([])
  })

  it('getById returns matching prescription', () => {
    const mockData: Prescription[] = [
      { id: 'rx-1', name: 'Drug A', dose: 500, frequency: 'bid', times: ['09:00'], halfLife: 6, peak: 2, uptake: 1.5 },
      { id: 'rx-2', name: 'Drug B', dose: 250, frequency: 'qd', times: ['09:00'], halfLife: 4, peak: 1, uptake: 1 },
    ]
    mockGetAll.mockReturnValue(mockData)

    const store = usePrescriptionStore()
    store.load()

    expect(store.getById('rx-1')?.name).toBe('Drug A')
    expect(store.getById('nonexistent')).toBeUndefined()
  })
})
