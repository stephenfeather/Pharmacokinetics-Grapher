// ---- Image Export Utilities ----

/**
 * Sanitize a string for use in a filename.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function sanitizeForFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate a timestamped filename for graph export.
 *
 * @param drugNames - Array of drug names from the graph datasets
 * @param format - Image format extension (default: 'png')
 * @param now - Optional Date for testing (default: new Date())
 * @returns Filename string like "pk-graph-ibuprofen-20260214-143022.png"
 */
export function generateFilename(
  drugNames: string[] = [],
  format: string = 'png',
  now: Date = new Date(),
): string {
  const timestamp = formatTimestamp(now)
  const namesPart = drugNames
    .map(sanitizeForFilename)
    .filter((n) => n.length > 0)
    .join('-')

  // Truncate combined names to keep filename reasonable (max 80 chars for names portion)
  const truncatedNames = namesPart.length > 80 ? namesPart.slice(0, 80) : namesPart

  const middle = truncatedNames.length > 0 ? `-${truncatedNames}` : ''
  return `pk-graph${middle}-${timestamp}.${format}`
}

/**
 * Format a Date as YYYYMMDD-HHmmss for filenames.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}${mo}${d}-${h}${mi}${s}`
}

/**
 * Trigger a browser file download from a data URL.
 *
 * Creates a temporary <a> element with the download attribute,
 * clicks it programmatically, and removes it.
 *
 * @param dataUrl - The data URL string (e.g., from canvas.toDataURL or Chart.toBase64Image)
 * @param filename - The filename for the downloaded file
 * @returns true if download was triggered, false if dataUrl was invalid
 */
export function downloadImage(dataUrl: string, filename: string): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return false
  }

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}
