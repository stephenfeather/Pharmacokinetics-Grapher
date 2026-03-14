import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HelpTooltip from '../HelpTooltip.vue'

function mountTooltip(text: string = 'Test tooltip text') {
  return mount(HelpTooltip, {
    props: { text },
  })
}

describe('HelpTooltip', () => {
  describe('rendering', () => {
    it('renders a help button with ? label', () => {
      const wrapper = mountTooltip()
      const btn = wrapper.find('.help-icon')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('?')
    })

    it('renders tooltip content with provided text', () => {
      const wrapper = mountTooltip('Gradual dose increase')
      const content = wrapper.find('.tooltip-content')
      expect(content.exists()).toBe(true)
      expect(content.text()).toBe('Gradual dose increase')
    })

    it('renders different text for different props', () => {
      const wrapper = mountTooltip('Custom help text here')
      expect(wrapper.find('.tooltip-content').text()).toBe('Custom help text here')
    })
  })

  describe('accessibility', () => {
    it('has aria-label on help button', () => {
      const wrapper = mountTooltip()
      const btn = wrapper.find('.help-icon')
      expect(btn.attributes('aria-label')).toBe('Help')
    })

    it('button is type="button" to prevent form submission', () => {
      const wrapper = mountTooltip()
      const btn = wrapper.find('.help-icon')
      expect(btn.attributes('type')).toBe('button')
    })

    it('tooltip content has role="tooltip"', () => {
      const wrapper = mountTooltip()
      const content = wrapper.find('.tooltip-content')
      expect(content.attributes('role')).toBe('tooltip')
    })

    it('button references tooltip via aria-describedby', () => {
      const wrapper = mountTooltip()
      const btn = wrapper.find('.help-icon')
      const tooltipId = wrapper.find('.tooltip-content').attributes('id')
      expect(tooltipId).toBeDefined()
      expect(btn.attributes('aria-describedby')).toBe(tooltipId)
    })
  })
})
