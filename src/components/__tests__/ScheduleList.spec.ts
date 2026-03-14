import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScheduleList from '../ScheduleList.vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import type { Prescription } from '@/core/models/prescription'

// Mock storage
const mockSchedules: DosageSchedule[] = []

vi.mock('@/core/storage/scheduleStorage', () => ({
  getAllSchedules: vi.fn(() => [...mockSchedules]),
  deleteSchedule: vi.fn((id: string) => {
    const idx = mockSchedules.findIndex(s => s.id === id)
    if (idx !== -1) mockSchedules.splice(idx, 1)
    return idx !== -1
  }),
  duplicateSchedule: vi.fn((id: string) => {
    const orig = mockSchedules.find(s => s.id === id)
    if (!orig) return undefined
    const copy = { ...orig, id: `${orig.id}-copy`, name: `${orig.name} (copy)` }
    mockSchedules.push(copy)
    return copy
  }),
}))

// Mock confirm
vi.stubGlobal('confirm', vi.fn(() => true))

function makeBasePrescription(): Prescription {
  return {
    name: 'Test Drug',
    frequency: 'bid',
    times: ['09:00', '21:00'],
    dose: 25,
    halfLife: 6,
    peak: 2,
    uptake: 1.5,
  }
}

function makeSchedule(overrides: Partial<DosageSchedule> = {}): DosageSchedule {
  return {
    id: `sched-${Math.random().toString(36).slice(2, 8)}`,
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

function mountList() {
  return mount(ScheduleList)
}

describe('ScheduleList', () => {
  beforeEach(() => {
    mockSchedules.length = 0
    vi.clearAllMocks()
  })

  // ─── Empty State ───

  describe('empty state', () => {
    it('shows empty message when no schedules', () => {
      const wrapper = mountList()
      expect(wrapper.find('[data-testid="empty-message"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('No schedules saved yet')
    })

    it('does not show list when empty', () => {
      const wrapper = mountList()
      expect(wrapper.find('.schedule-list').exists()).toBe(false)
    })
  })

  // ─── List Rendering ───

  describe('list rendering', () => {
    it('renders all saved schedules', () => {
      mockSchedules.push(
        makeSchedule({ name: 'Schedule A' }),
        makeSchedule({ name: 'Schedule B' }),
      )
      const wrapper = mountList()
      const items = wrapper.findAll('.schedule-item')
      expect(items).toHaveLength(2)
    })

    it('shows schedule name', () => {
      mockSchedules.push(makeSchedule({ name: 'My Titration' }))
      const wrapper = mountList()
      expect(wrapper.text()).toContain('My Titration')
    })

    it('shows direction badge', () => {
      mockSchedules.push(makeSchedule({ direction: 'titration' }))
      const wrapper = mountList()
      const badge = wrapper.find('.direction-badge')
      expect(badge.text()).toBe('Titration')
      expect(badge.classes()).toContain('titration')
    })

    it('shows taper badge for taper schedules', () => {
      mockSchedules.push(makeSchedule({ direction: 'taper' }))
      const wrapper = mountList()
      const badge = wrapper.find('.direction-badge')
      expect(badge.text()).toBe('Taper')
      expect(badge.classes()).toContain('taper')
    })

    it('shows step summary with doses and duration', () => {
      mockSchedules.push(makeSchedule())
      const wrapper = mountList()
      const summary = wrapper.find('.sched-summary')
      expect(summary.text()).toContain('25mg')
      expect(summary.text()).toContain('50mg')
      expect(summary.text()).toContain('14 days')
    })

    it('shows frequency badge', () => {
      mockSchedules.push(makeSchedule())
      const wrapper = mountList()
      expect(wrapper.find('.frequency-badge').text()).toBe('bid')
    })

    it('shows action buttons', () => {
      const schedule = makeSchedule()
      mockSchedules.push(schedule)
      const wrapper = mountList()
      expect(wrapper.find(`[data-testid="view-btn-${schedule.id}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="edit-btn-${schedule.id}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="duplicate-btn-${schedule.id}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="delete-btn-${schedule.id}"]`).exists()).toBe(true)
    })
  })

  // ─── Actions ───

  describe('actions', () => {
    it('emits view when view button clicked', async () => {
      const schedule = makeSchedule()
      mockSchedules.push(schedule)
      const wrapper = mountList()
      await wrapper.find(`[data-testid="view-btn-${schedule.id}"]`).trigger('click')
      const emitted = wrapper.emitted('view')
      expect(emitted).toBeTruthy()
      expect((emitted![0]![0] as DosageSchedule).name).toBe(schedule.name)
    })

    it('emits edit when edit button clicked', async () => {
      const schedule = makeSchedule()
      mockSchedules.push(schedule)
      const wrapper = mountList()
      await wrapper.find(`[data-testid="edit-btn-${schedule.id}"]`).trigger('click')
      const emitted = wrapper.emitted('edit')
      expect(emitted).toBeTruthy()
      expect((emitted![0]![0] as DosageSchedule).name).toBe(schedule.name)
    })

    it('deletes schedule when delete button clicked and confirmed', async () => {
      const schedule = makeSchedule()
      mockSchedules.push(schedule)
      const wrapper = mountList()
      await wrapper.find(`[data-testid="delete-btn-${schedule.id}"]`).trigger('click')
      expect(wrapper.find('.schedule-item').exists()).toBe(false)
      expect(wrapper.find('[data-testid="empty-message"]').exists()).toBe(true)
    })

    it('duplicates schedule when duplicate button clicked', async () => {
      const schedule = makeSchedule({ name: 'Original' })
      mockSchedules.push(schedule)
      const wrapper = mountList()
      await wrapper.find(`[data-testid="duplicate-btn-${schedule.id}"]`).trigger('click')
      const items = wrapper.findAll('.schedule-item')
      expect(items).toHaveLength(2)
    })
  })

  // ─── Step Summary Format ───

  describe('step summary formatting', () => {
    it('formats 3-step schedule correctly', () => {
      mockSchedules.push(makeSchedule({
        steps: [
          { stepNumber: 1, dose: 25, durationDays: 7, startDay: 0 },
          { stepNumber: 2, dose: 50, durationDays: 7, startDay: 7 },
          { stepNumber: 3, dose: 100, durationDays: 7, startDay: 14 },
        ],
        totalDuration: 21,
      }))
      const wrapper = mountList()
      const summary = wrapper.find('.sched-summary').text()
      expect(summary).toContain('25mg')
      expect(summary).toContain('50mg')
      expect(summary).toContain('100mg')
      expect(summary).toContain('21 days')
    })
  })
})
