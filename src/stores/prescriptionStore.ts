import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Prescription } from '@/core/models/prescription'
import {
  getAllPrescriptions,
  savePrescription as storageSave,
  updatePrescription as storageUpdate,
  deletePrescription as storageDelete,
  duplicatePrescription as storageDuplicate,
  savePrescriptionOrder as storageOrder,
  exportPrescriptionsAsJson,
  clearAllPrescriptions as storageClear,
} from '@/core/storage/prescriptionStorage'

export const usePrescriptionStore = defineStore('prescriptions', () => {
  const prescriptions = ref<Prescription[]>([])
  const isLoaded = ref(false)

  const count = computed(() => prescriptions.value.length)
  const isEmpty = computed(() => prescriptions.value.length === 0)
  const getById = computed(() => (id: string) =>
    prescriptions.value.find((rx) => rx.id === id),
  )

  function load() {
    prescriptions.value = getAllPrescriptions()
    isLoaded.value = true
  }

  function save(rx: Prescription): Prescription {
    const saved = storageSave(rx)
    prescriptions.value = getAllPrescriptions()
    return saved
  }

  function update(rx: Prescription): boolean {
    const success = storageUpdate(rx)
    if (success) {
      prescriptions.value = getAllPrescriptions()
    }
    return success
  }

  function remove(id: string): boolean {
    const success = storageDelete(id)
    if (success) {
      prescriptions.value = getAllPrescriptions()
    }
    return success
  }

  function duplicate(id: string): Prescription | undefined {
    const copy = storageDuplicate(id)
    if (copy) {
      prescriptions.value = getAllPrescriptions()
    }
    return copy
  }

  function reorder(newOrder: Prescription[]): void {
    storageOrder(newOrder)
    prescriptions.value = [...newOrder]
  }

  function exportJson(ids?: string[]): string {
    return exportPrescriptionsAsJson(ids)
  }

  function clear(): void {
    storageClear()
    prescriptions.value = []
  }

  return {
    prescriptions,
    isLoaded,
    count,
    isEmpty,
    getById,
    load,
    save,
    update,
    remove,
    duplicate,
    reorder,
    exportJson,
    clear,
  }
})
