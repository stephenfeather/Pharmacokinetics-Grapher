import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sanitizeForFilename, generateFilename, downloadImage } from '../imageExport'

describe('imageExport', () => {
  // ---- sanitizeForFilename ----

  describe('sanitizeForFilename', () => {
    it('converts to lowercase', () => {
      expect(sanitizeForFilename('Ibuprofen')).toBe('ibuprofen')
    })

    it('replaces spaces with hyphens', () => {
      expect(sanitizeForFilename('Test Drug')).toBe('test-drug')
    })

    it('replaces non-alphanumeric characters with hyphens', () => {
      expect(sanitizeForFilename('Drug (500mg)')).toBe('drug-500mg')
    })

    it('collapses consecutive hyphens', () => {
      expect(sanitizeForFilename('Drug---Name')).toBe('drug-name')
    })

    it('trims leading and trailing hyphens', () => {
      expect(sanitizeForFilename('--Drug--')).toBe('drug')
    })

    it('handles empty string', () => {
      expect(sanitizeForFilename('')).toBe('')
    })

    it('handles string with only special characters', () => {
      expect(sanitizeForFilename('---')).toBe('')
    })

    it('preserves numbers', () => {
      expect(sanitizeForFilename('Drug123')).toBe('drug123')
    })
  })

  // ---- generateFilename ----

  describe('generateFilename', () => {
    const fixedDate = new Date(2026, 1, 14, 14, 30, 22) // 2026-02-14 14:30:22

    it('generates filename with single drug name', () => {
      const result = generateFilename(['Ibuprofen'], 'png', fixedDate)
      expect(result).toBe('pk-graph-ibuprofen-20260214-143022.png')
    })

    it('generates filename with multiple drug names', () => {
      const result = generateFilename(['Ibuprofen', 'Acetaminophen'], 'png', fixedDate)
      expect(result).toBe('pk-graph-ibuprofen-acetaminophen-20260214-143022.png')
    })

    it('generates filename without drug names', () => {
      const result = generateFilename([], 'png', fixedDate)
      expect(result).toBe('pk-graph-20260214-143022.png')
    })

    it('generates filename with default empty array', () => {
      const result = generateFilename(undefined, 'png', fixedDate)
      expect(result).toBe('pk-graph-20260214-143022.png')
    })

    it('uses png format by default', () => {
      const result = generateFilename(['Drug'], undefined, fixedDate)
      expect(result).toBe('pk-graph-drug-20260214-143022.png')
    })

    it('supports jpeg format', () => {
      const result = generateFilename(['Drug'], 'jpeg', fixedDate)
      expect(result).toBe('pk-graph-drug-20260214-143022.jpeg')
    })

    it('sanitizes drug names in filename', () => {
      const result = generateFilename(['Drug (500mg)'], 'png', fixedDate)
      expect(result).toBe('pk-graph-drug-500mg-20260214-143022.png')
    })

    it('truncates very long combined names to 80 chars', () => {
      const longNames = Array.from({ length: 20 }, (_, i) => `VeryLongDrugName${i}`)
      const result = generateFilename(longNames, 'png', fixedDate)
      // Names part should be truncated
      expect(result.length).toBeLessThan(120) // pk-graph- + 80 chars max + -timestamp.png
    })

    it('filters out empty names after sanitization', () => {
      const result = generateFilename(['---', 'Ibuprofen'], 'png', fixedDate)
      expect(result).toBe('pk-graph-ibuprofen-20260214-143022.png')
    })
  })

  // ---- downloadImage ----

  describe('downloadImage', () => {
    let clickSpy: ReturnType<typeof vi.fn>
    let appendChildSpy: ReturnType<typeof vi.spyOn>
    let removeChildSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      clickSpy = vi.fn()
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

      // Mock createElement to capture click
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = {
          tagName: tag.toUpperCase(),
          href: '',
          download: '',
          click: clickSpy,
          style: {},
        }
        return el as unknown as HTMLElement
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('returns true and triggers download for valid data URL', () => {
      const result = downloadImage('data:image/png;base64,abc123', 'test.png')
      expect(result).toBe(true)
      expect(clickSpy).toHaveBeenCalledOnce()
    })

    it('creates an anchor element with correct href and download attributes', () => {
      const dataUrl = 'data:image/png;base64,abc123'
      downloadImage(dataUrl, 'my-graph.png')

      const createCall = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0]?.value
      expect(createCall.href).toBe(dataUrl)
      expect(createCall.download).toBe('my-graph.png')
    })

    it('appends and removes the anchor from document.body', () => {
      downloadImage('data:image/png;base64,abc123', 'test.png')
      expect(appendChildSpy).toHaveBeenCalledOnce()
      expect(removeChildSpy).toHaveBeenCalledOnce()
    })

    it('returns false for empty string', () => {
      const result = downloadImage('', 'test.png')
      expect(result).toBe(false)
      expect(clickSpy).not.toHaveBeenCalled()
    })

    it('returns false for non-data URL string', () => {
      const result = downloadImage('https://example.com/image.png', 'test.png')
      expect(result).toBe(false)
      expect(clickSpy).not.toHaveBeenCalled()
    })

    it('returns false for undefined-like input', () => {
      const result = downloadImage(null as unknown as string, 'test.png')
      expect(result).toBe(false)
    })
  })
})
