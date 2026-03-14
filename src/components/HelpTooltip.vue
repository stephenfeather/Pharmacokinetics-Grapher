<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string }>()

const tooltipId = computed(() => `tooltip-${props.text.replace(/\s+/g, '-').slice(0, 20).toLowerCase()}`)
</script>

<template>
  <span class="help-tooltip">
    <button
      type="button"
      aria-label="Help"
      :aria-describedby="tooltipId"
      class="help-icon"
    >?</button>
    <span
      :id="tooltipId"
      class="tooltip-content"
      role="tooltip"
    >{{ text }}</span>
  </span>
</template>

<style scoped>
.help-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #9ca3af;
  background: transparent;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: help;
  padding: 0;
  line-height: 1;
}

.help-icon:hover,
.help-icon:focus {
  border-color: #3b82f6;
  color: #3b82f6;
  outline: none;
}

.tooltip-content {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: #f9fafb;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 400;
  white-space: nowrap;
  max-width: 280px;
  white-space: normal;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.help-icon:hover + .tooltip-content,
.help-icon:focus + .tooltip-content {
  display: block;
}

/* Arrow */
.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1f2937;
}

@media (max-width: 600px) {
  .tooltip-content {
    max-width: 200px;
    font-size: 0.75rem;
  }
}
</style>
