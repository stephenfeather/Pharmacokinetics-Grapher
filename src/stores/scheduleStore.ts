import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DosageSchedule } from '@/core/models/dosageSchedule'
import {
  getAllSchedules,
  saveSchedule as storageSave,
  updateSchedule as storageUpdate,
  deleteSchedule as storageDelete,
  duplicateSchedule as storageDuplicate,
  exportSchedulesAsJson,
  clearAllSchedules as storageClear,
} from '@/core/storage/scheduleStorage'

export const useScheduleStore = defineStore('schedules', () => {
  const schedules = ref<DosageSchedule[]>([])
  const isLoaded = ref(false)

  const count = computed(() => schedules.value.length)
  const isEmpty = computed(() => schedules.value.length === 0)
  const getById = computed(() => (id: string) =>
    schedules.value.find((s) => s.id === id),
  )

  function load() {
    schedules.value = getAllSchedules()
    isLoaded.value = true
  }

  function save(schedule: DosageSchedule): DosageSchedule {
    const saved = storageSave(schedule)
    schedules.value = getAllSchedules()
    return saved
  }

  function update(schedule: DosageSchedule): boolean {
    const success = storageUpdate(schedule)
    if (success) {
      schedules.value = getAllSchedules()
    }
    return success
  }

  function remove(id: string): boolean {
    const success = storageDelete(id)
    if (success) {
      schedules.value = getAllSchedules()
    }
    return success
  }

  function duplicate(id: string): DosageSchedule | undefined {
    const copy = storageDuplicate(id)
    if (copy) {
      schedules.value = getAllSchedules()
    }
    return copy
  }

  function exportJson(ids?: string[]): string {
    return exportSchedulesAsJson(ids)
  }

  function clear(): void {
    storageClear()
    schedules.value = []
  }

  return {
    schedules,
    isLoaded,
    count,
    isEmpty,
    getById,
    load,
    save,
    update,
    remove,
    duplicate,
    exportJson,
    clear,
  }
})
