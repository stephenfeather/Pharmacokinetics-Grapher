import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LOG_PREFIX, formatLogMessage, logWarn, logError } from '../logger'

describe('formatLogMessage', () => {
  it('formats with prefix, source, and message', () => {
    expect(formatLogMessage('myModule', 'something broke')).toBe(
      '[PK-Grapher] myModule: something broke',
    )
  })

  it('includes the LOG_PREFIX constant', () => {
    const result = formatLogMessage('src', 'msg')
    expect(result.startsWith(LOG_PREFIX)).toBe(true)
  })
})

describe('logWarn', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('calls console.warn with formatted message', () => {
    logWarn('storage', 'item not found')
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith('[PK-Grapher] storage: item not found')
  })

  it('passes context as second argument when provided', () => {
    const ctx = { id: 'rx-123', reason: 'missing' }
    logWarn('storage', 'item not found', ctx)
    expect(warnSpy).toHaveBeenCalledWith('[PK-Grapher] storage: item not found', ctx)
  })

  it('omits second argument when context is undefined', () => {
    logWarn('calc', 'fallback used')
    expect(warnSpy).toHaveBeenCalledWith('[PK-Grapher] calc: fallback used')
    // Should be called with exactly 1 argument (no trailing undefined)
    expect(warnSpy.mock.calls[0]).toHaveLength(1)
  })
})

describe('logError', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('calls console.error with formatted message', () => {
    logError('storage', 'parse failed')
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith('[PK-Grapher] storage: parse failed')
  })

  it('passes context as second argument when provided', () => {
    const ctx = { rawData: '{bad json' }
    logError('storage', 'parse failed', ctx)
    expect(errorSpy).toHaveBeenCalledWith('[PK-Grapher] storage: parse failed', ctx)
  })

  it('omits second argument when context is undefined', () => {
    logError('export', 'download failed')
    expect(errorSpy.mock.calls[0]).toHaveLength(1)
  })

  it('handles empty context object', () => {
    logError('test', 'error occurred', {})
    expect(errorSpy).toHaveBeenCalledWith('[PK-Grapher] test: error occurred', {})
  })
})

describe('LOG_PREFIX', () => {
  it('is the expected prefix string', () => {
    expect(LOG_PREFIX).toBe('[PK-Grapher]')
  })
})
