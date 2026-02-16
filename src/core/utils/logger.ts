/**
 * Lightweight console logger with structured context.
 *
 * Wraps console.warn / console.error with a [PK-Grapher] prefix
 * so messages are easy to filter in DevTools. The optional `context`
 * object renders as an expandable object in the browser console.
 */

export const LOG_PREFIX = '[PK-Grapher]'

/**
 * Format a log message with prefix and source.
 * @param source - Module or function name (e.g. "prescriptionStorage.save")
 * @param message - Human-readable description of what happened
 * @returns Formatted string like "[PK-Grapher] prescriptionStorage.save: something failed"
 */
export function formatLogMessage(source: string, message: string): string {
  return `${LOG_PREFIX} ${source}: ${message}`
}

/**
 * Log a warning to the console.
 * @param source - Module or function name
 * @param message - Warning description
 * @param context - Optional structured data (renders as expandable object in DevTools)
 */
export function logWarn(source: string, message: string, context?: Record<string, unknown>): void {
  const formatted = formatLogMessage(source, message)
  if (context !== undefined) {
    console.warn(formatted, context)
  } else {
    console.warn(formatted)
  }
}

/**
 * Log an error to the console.
 * @param source - Module or function name
 * @param message - Error description
 * @param context - Optional structured data (renders as expandable object in DevTools)
 */
export function logError(source: string, message: string, context?: Record<string, unknown>): void {
  const formatted = formatLogMessage(source, message)
  if (context !== undefined) {
    console.error(formatted, context)
  } else {
    console.error(formatted)
  }
}
