import { jsPDF } from 'jspdf'
import type { Prescription } from '../models/prescription'
import type { PkSummaryData } from '../models/pkSummary'
import { sanitizeForFilename } from './imageExport'
import { logError } from '../utils/logger'

export interface PdfExportData {
  drugNames: string[]
  prescriptions: Prescription[]
  summaryData: PkSummaryData[]
  chartImageDataUrl: string
  timeframeLabel: string
}

/**
 * Generate a PDF report containing PK graph, summary table, and prescription details.
 */
export function generatePdfReport(data: PdfExportData): Blob | null {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let yPos = margin

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Pharmacokinetic Report', margin, yPos)
    yPos += 8

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(data.drugNames.join(', '), margin, yPos)
    yPos += 6

    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos)
    doc.setTextColor(0)
    yPos += 10

    // Disclaimer
    doc.setFontSize(9)
    doc.setTextColor(150, 100, 0)
    doc.text('Educational purposes only. Not for medical decisions.', margin, yPos)
    doc.setTextColor(0)
    yPos += 8

    // Graph image
    if (data.chartImageDataUrl && data.chartImageDataUrl.startsWith('data:')) {
      const imgWidth = pageWidth - margin * 2
      const imgHeight = imgWidth * 0.5
      doc.addImage(data.chartImageDataUrl, 'PNG', margin, yPos, imgWidth, imgHeight)
      yPos += imgHeight + 5

      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Timeframe: ${data.timeframeLabel}`, margin, yPos)
      doc.setTextColor(0)
      yPos += 10
    }

    // Prescription details
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Prescription Details', margin, yPos)
    yPos += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const rx of data.prescriptions) {
      if (yPos > 260) {
        doc.addPage()
        yPos = margin
      }

      doc.setFont('helvetica', 'bold')
      doc.text(rx.name, margin, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')

      const details = [
        `Dose: ${rx.dose} mg`,
        `Frequency: ${rx.frequency.toUpperCase()} (${rx.times.join(', ')})`,
        `Half-life: ${rx.halfLife} hours`,
        `Uptake: ${rx.uptake} hours`,
        `Peak (Tmax): ${rx.peak} hours`,
      ]

      if (rx.metaboliteLife && rx.relativeMetaboliteLevel) {
        details.push(`Metabolite half-life: ${rx.metaboliteLife} hours`)
        details.push(`Relative metabolite level: ${rx.relativeMetaboliteLevel}`)
      }

      for (const line of details) {
        doc.text(`  ${line}`, margin, yPos)
        yPos += 4.5
      }
      yPos += 3
    }

    // PK Summary Table
    if (data.summaryData.length > 0) {
      if (yPos > 200) {
        doc.addPage()
        yPos = margin
      }

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('PK Milestone Timeline', margin, yPos)
      yPos += 7

      for (const summary of data.summaryData) {
        if (yPos > 250) {
          doc.addPage()
          yPos = margin
        }

        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(summary.prescriptionName, margin, yPos)
        yPos += 5

        // Table header
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        const colWidths = [25, 20, 25, 70, 25]
        const headers = ['Clock Time', 'Elapsed', 'Event', 'Description', 'Level']
        let xPos = margin
        for (let i = 0; i < headers.length; i++) {
          doc.text(headers[i]!, xPos, yPos)
          xPos += colWidths[i]!
        }
        yPos += 4

        doc.setDrawColor(200)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 3

        // Table rows (limit to 15 events per drug)
        doc.setFont('helvetica', 'normal')
        for (const event of summary.events.slice(0, 15)) {
          if (yPos > 275) {
            doc.addPage()
            yPos = margin
          }

          xPos = margin
          doc.text(event.clockTime, xPos, yPos)
          xPos += colWidths[0]!
          doc.text(event.elapsedTime, xPos, yPos)
          xPos += colWidths[1]!
          doc.text(eventTypeLabel(event.eventType), xPos, yPos)
          xPos += colWidths[2]!
          const desc =
            event.description.length > 45
              ? event.description.slice(0, 42) + '...'
              : event.description
          doc.text(desc, xPos, yPos)
          xPos += colWidths[3]!
          const concStr =
            event.relativeConcentration !== null
              ? `${(event.relativeConcentration * 100).toFixed(1)}%`
              : '—'
          doc.text(concStr, xPos, yPos)
          yPos += 4
        }
        yPos += 5
      }
    }

    return doc.output('blob') as Blob
  } catch (error) {
    logError('pdfExport.generatePdfReport', 'Failed to generate PDF', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    dose: 'Dose',
    absorption_end: 'Absorption',
    peak: 'Peak',
    half_life: 'Decay',
    next_dose: 'Next Dose',
  }
  return labels[eventType] || ''
}

/**
 * Generate filename for PDF export.
 */
export function generatePdfFilename(
  drugNames: string[] = [],
  now: Date = new Date(),
): string {
  const timestamp = formatTimestamp(now)
  const namesPart = drugNames
    .map(sanitizeForFilename)
    .filter((n) => n.length > 0)
    .join('-')
  const truncatedNames = namesPart.length > 60 ? namesPart.slice(0, 60) : namesPart
  const middle = truncatedNames.length > 0 ? `-${truncatedNames}` : ''
  return `pk-report${middle}-${timestamp}.pdf`
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${y}${mo}${d}-${h}${mi}`
}

/**
 * Trigger PDF download in browser.
 */
export function downloadPdf(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    logError('pdfExport.downloadPdf', 'Failed to download PDF', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
