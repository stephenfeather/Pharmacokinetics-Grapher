import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import { useScheduleStore } from '../scheduleStore'

vi.mock('@/core/storage/scheduleStorage', () => ({
  getAllSchedules: vi.fn(() => []),
  saveSchedule: vi.fn((s: DosageSchedule) => ({ ...s, id: 'sched-new-123' })),
  updateSchedule: vi.fn(() => true),
  deleteSchedule: vi.fn(() => true),
  duplicateSchedule: vi.fn((id: string) => ({ id: `${id}-copy`, name: 'Copy' })),
  exportSchedulesAsJson: vi.fn(() => '[]'),
  clearAllSchedules: vi.fn(),
}))

import {
  getAllSchedules,
  deleteSchedule,
  duplicateSchedule,
  clearAllSchedules,
} from '@/core/storage/scheduleStorage'

const mockGetAll = vi.mocked(getAllSchedules)
const mockDelete = vi.mocked(deleteSchedule)
const mockDuplicate = vi.mocked(duplicateSchedule)
const mockClear = vi.mocked(clearAllSchedules)

describe('scheduleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty schedules and isLoaded false', () => {
    const store = useScheduleStore()
    expect(store.schedules).toEqual([])
    expect(store.isLoaded).toBe(false)
    expect(store.isEmpty).toBe(true)
    expect(store.count).toBe(0)
  })

  it('load() populates schedules from storage', () => {
    const mockData = [{ id: 'sched-1', name: 'Test Schedule' }] as DosageSchedule[]
    mockGetAll.mockReturnValue(mockData)

    const store = useScheduleStore()
    store.load()

    expect(store.schedules).toHaveLength(1)
    expect(store.isLoaded).toBe(true)
    expect(store.count).toBe(1)
  })

  it('save() calls storage and refreshes state', () => {
    const store = useScheduleStore()
    const schedule = { name: 'New Schedule' } as DosageSchedule

    const saved = store.save(schedule)

    expect(saved.id).toBe('sched-new-123')
    expect(mockGetAll).toHaveBeenCalled()
  })

  it('update() calls storage and refreshes on success', () => {
    const store = useScheduleStore()
    const success = store.update({ id: 'sched-1', name: 'Updated' } as DosageSchedule)

    expect(success).toBe(true)
    expect(mockGetAll).toHaveBeenCalled()
  })

  it('remove() calls storage and refreshes on success', () => {
    const store = useScheduleStore()
    const success = store.remove('sched-1')

    expect(success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('sched-1')
  })

  it('remove() does not refresh when delete fails', () => {
    mockDelete.mockReturnValueOnce(false)
    const store = useScheduleStore()
    const success = store.remove('nonexistent')

    expect(success).toBe(false)
  })

  it('duplicate() calls storage and refreshes on success', () => {
    const store = useScheduleStore()
    const copy = store.duplicate('sched-1')

    expect(copy).toBeDefined()
    expect(mockDuplicate).toHaveBeenCalledWith('sched-1')
  })

  it('clear() removes all schedules', () => {
    const store = useScheduleStore()
    store.clear()

    expect(mockClear).toHaveBeenCalled()
    expect(store.schedules).toEqual([])
  })

  it('getById returns matching schedule', () => {
    const mockData = [
      { id: 'sched-1', name: 'Schedule A' },
      { id: 'sched-2', name: 'Schedule B' },
    ] as DosageSchedule[]
    mockGetAll.mockReturnValue(mockData)

    const store = useScheduleStore()
    store.load()

    expect(store.getById('sched-1')?.name).toBe('Schedule A')
    expect(store.getById('nonexistent')).toBeUndefined()
  })
})
