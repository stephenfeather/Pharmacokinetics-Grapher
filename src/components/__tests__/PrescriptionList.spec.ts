import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Prescription } from '@/core/models/prescription'
import PrescriptionList from '../PrescriptionList.vue'
import { MOCK_PRESCRIPTIONS } from './prescriptionListFixtures'

// Mock storage module
vi.mock('@/core/storage/prescriptionStorage', () => ({
  getAllPrescriptions: vi.fn(() => []),
  deletePrescription: vi.fn(() => true),
  duplicatePrescription: vi.fn(),
}))

import {
  getAllPrescriptions,
  deletePrescription,
  duplicatePrescription,
} from '@/core/storage/prescriptionStorage'

const mockGetAll = vi.mocked(getAllPrescriptions)
const mockDelete = vi.mocked(deletePrescription)
const mockDuplicate = vi.mocked(duplicatePrescription)

describe('PrescriptionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('renders empty state message when no prescriptions', () => {
      mockGetAll.mockReturnValueOnce([])
      const wrapper = mount(PrescriptionList)

      const emptyMessage = wrapper.find('[data-testid="empty-message"]')
      expect(emptyMessage.exists()).toBe(true)
      expect(emptyMessage.text()).toContain('No prescriptions')
    })

    it('does not render list when empty', () => {
      mockGetAll.mockReturnValueOnce([])
      const wrapper = mount(PrescriptionList)

      const list = wrapper.find('ul')
      expect(list.exists()).toBe(false)
    })
  })

  describe('list rendering', () => {
    it('renders list with correct number of items', () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS as Prescription[])
      const wrapper = mount(PrescriptionList)

      const items = wrapper.findAll('li')
      expect(items).toHaveLength(3)
    })

    it('displays prescription details correctly', () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      const item = wrapper.find('li')
      expect(item.text()).toContain('Ibuprofen')
      expect(item.text()).toContain('tid')
      expect(item.text()).toContain('400')
      expect(item.text()).toContain('2')
    })

    it('renders all prescriptions with their details', () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS as Prescription[])
      const wrapper = mount(PrescriptionList)

      const text = wrapper.text()
      expect(text).toContain('Ibuprofen')
      expect(text).toContain('Amoxicillin')
      expect(text).toContain('Metformin')
    })
  })

  describe('view action', () => {
    it('emits view event with prescription data', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="view-btn-rx-test-001"]').trigger('click')

      expect(wrapper.emitted('view')).toBeTruthy()
      expect(wrapper.emitted('view')![0]).toEqual([MOCK_PRESCRIPTIONS[0]])
    })
  })

  describe('edit action', () => {
    it('emits edit event with prescription data', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="edit-btn-rx-test-001"]').trigger('click')

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')![0]).toEqual([MOCK_PRESCRIPTIONS[0]])
    })
  })

  describe('delete action', () => {
    it('shows confirmation before deleting', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="delete-btn-rx-test-001"]').trigger('click')

      expect(confirmSpy).toHaveBeenCalledWith('Delete this prescription?')
      confirmSpy.mockRestore()
    })

    it('deletes prescription when user confirms', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      mockGetAll.mockReturnValueOnce([])
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="delete-btn-rx-test-001"]').trigger('click')

      expect(mockDelete).toHaveBeenCalledWith('rx-test-001')
    })

    it('does not delete when user cancels', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="delete-btn-rx-test-001"]').trigger('click')

      expect(mockDelete).not.toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('duplicate action', () => {
    it('duplicates prescription when clicked', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      mockDuplicate.mockReturnValueOnce(MOCK_PRESCRIPTIONS[0] as Prescription)
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="duplicate-btn-rx-test-001"]').trigger('click')

      expect(mockDuplicate).toHaveBeenCalledWith('rx-test-001')
    })

    it('refreshes list after duplication', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      mockDuplicate.mockReturnValueOnce(MOCK_PRESCRIPTIONS[0] as Prescription)
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="duplicate-btn-rx-test-001"]').trigger('click')

      // Verify refresh was called by checking getAllPrescriptions was called again
      expect(mockGetAll).toHaveBeenCalledTimes(2)
    })
  })

  describe('compare mode toggle', () => {
    it('renders compare mode button', () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS as Prescription[])
      const wrapper = mount(PrescriptionList)

      const button = wrapper.find('[data-testid="compare-toggle"]')
      expect(button.exists()).toBe(true)
    })

    it('toggles compare mode on button click', async () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS as Prescription[])
      const wrapper = mount(PrescriptionList)

      const button = wrapper.find('[data-testid="compare-toggle"]')
      expect(button.text()).toContain('Compare Mode')

      await button.trigger('click')
      expect(button.text()).toContain('Exit Compare')
    })
  })

  describe('compare selection', () => {
    it('shows checkboxes in compare mode', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      let checkbox = wrapper.find('[data-testid="compare-checkbox-rx-test-001"]')
      expect(checkbox.exists()).toBe(false)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')

      checkbox = wrapper.find('[data-testid="compare-checkbox-rx-test-001"]')
      expect(checkbox.exists()).toBe(true)
    })

    it('adds item to selection when checkbox checked', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')

      const count = wrapper.find('[data-testid="selected-count"]')
      expect(count.text()).toContain('1')
    })

    it('removes item from selection when checkbox unchecked', async () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS.slice(0, 2) as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')

      // Select two items
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-002"]').trigger('change')

      let count = wrapper.find('[data-testid="selected-count"]')
      expect(count.text()).toContain('2')

      // Deselect one item
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')

      count = wrapper.find('[data-testid="selected-count"]')
      expect(count.text()).toContain('1')
    })

    it('tracks multiple selections', async () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS.slice(0, 2) as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-002"]').trigger('change')

      const count = wrapper.find('[data-testid="selected-count"]')
      expect(count.text()).toContain('2')
    })
  })

  describe('compare submission', () => {
    it('emits compare event with selected prescriptions', async () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS.slice(0, 2) as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-002"]').trigger('change')

      const compareSubmit = wrapper.find('[data-testid="compare-submit"]')
      if (compareSubmit.exists()) {
        await compareSubmit.trigger('click')
      }

      const compareEmitted = wrapper.emitted('compare')
      expect(compareEmitted).toBeTruthy()

       
      const emitted = compareEmitted![0]![0] as Prescription[]
      expect(emitted).toHaveLength(2)
      expect(emitted.map((p) => p.name)).toContain('Ibuprofen')
      expect(emitted.map((p) => p.name)).toContain('Amoxicillin')
    })

    it('hides compare bar when no items selected', async () => {
      mockGetAll.mockReturnValueOnce(MOCK_PRESCRIPTIONS as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')

      const compareBar = wrapper.find('[data-testid="compare-bar"]')
      expect(compareBar.exists()).toBe(false)
    })

    it('shows compare bar when items selected', async () => {
      mockGetAll.mockReturnValueOnce([MOCK_PRESCRIPTIONS[0]] as Prescription[])
      const wrapper = mount(PrescriptionList)

      await wrapper.find('[data-testid="compare-toggle"]').trigger('click')
      await wrapper.find('[data-testid="compare-checkbox-rx-test-001"]').trigger('change')

      const compareBar = wrapper.find('[data-testid="compare-bar"]')
      expect(compareBar.exists()).toBe(true)
    })
  })
})
