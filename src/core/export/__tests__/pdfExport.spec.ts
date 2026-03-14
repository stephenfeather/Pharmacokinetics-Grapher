import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generatePdfReport, generatePdfFilename, downloadPdf, type PdfExportData } from '../pdfExport'

// Mock jsPDF
const mockDoc = {
  internal: { pageSize: { getWidth: () => 210 } },
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  text: vi.fn(),
  line: vi.fn(),
  addImage: vi.fn(),
  addPage: vi.fn(),
  output: vi.fn().mockReturnValue(new Blob(['pdf'], { type: 'application/pdf' })),
}

vi.mock('jspdf', () => {
  // Must use function keyword for constructor compatibility
  return {
    jsPDF: function () {
      return mockDoc
    },
  }
})

const validPdfData: PdfExportData = {
  drugNames: ['TestDrug'],
  prescriptions: [
    {
      id: 'test-1',
      name: 'TestDrug',
      dose: 500,
      frequency: 'bid',
      times: ['09:00', '21:00'],
      halfLife: 6,
      uptake: 1.5,
      peak: 2,
    },
  ],
  summaryData: [
    {
      prescriptionId: 'test-1',
      prescriptionName: 'TestDrug',
      events: [
        {
          eventType: 'dose',
          clockTime: '09:00',
          elapsedTime: 'T+0h',
          elapsedHours: 0,
          description: 'First dose administered',
          relativeConcentration: null,
          prescriptionName: 'TestDrug',
        },
      ],
    },
  ],
  chartImageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  timeframeLabel: '0–48 hours',
}

describe('pdfExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generatePdfFilename', () => {
    const fixedDate = new Date(2026, 2, 14, 10, 30) // 2026-03-14 10:30

    it('generates filename with drug names and timestamp', () => {
      const filename = generatePdfFilename(['Ibuprofen', 'Acetaminophen'], fixedDate)
      expect(filename).toBe('pk-report-ibuprofen-acetaminophen-20260314-1030.pdf')
    })

    it('generates filename without drug names', () => {
      const filename = generatePdfFilename([], fixedDate)
      expect(filename).toBe('pk-report-20260314-1030.pdf')
    })

    it('generates filename with default empty array', () => {
      const filename = generatePdfFilename(undefined, fixedDate)
      expect(filename).toBe('pk-report-20260314-1030.pdf')
    })

    it('truncates long combined drug names to 60 chars', () => {
      const longNames = [
        'VeryLongDrugName1',
        'VeryLongDrugName2',
        'VeryLongDrugName3',
        'VeryLongDrugName4',
      ]
      const filename = generatePdfFilename(longNames, fixedDate)
      // pk-report- + max 60 chars + -timestamp.pdf
      expect(filename.length).toBeLessThan(100)
    })

    it('sanitizes drug names', () => {
      const filename = generatePdfFilename(['Drug (500mg)'], fixedDate)
      expect(filename).toBe('pk-report-drug-500mg-20260314-1030.pdf')
    })

    it('filters out empty names after sanitization', () => {
      const filename = generatePdfFilename(['---', 'Ibuprofen'], fixedDate)
      expect(filename).toBe('pk-report-ibuprofen-20260314-1030.pdf')
    })
  })

  describe('generatePdfReport', () => {
    it('returns a Blob on success', () => {
      const result = generatePdfReport(validPdfData)
      expect(result).toBeInstanceOf(Blob)
    })

    it('handles empty prescriptions array', () => {
      const data = { ...validPdfData, prescriptions: [] }
      const result = generatePdfReport(data)
      expect(result).toBeInstanceOf(Blob)
    })

    it('handles empty summary data', () => {
      const data = { ...validPdfData, summaryData: [] }
      const result = generatePdfReport(data)
      expect(result).toBeInstanceOf(Blob)
    })

    it('handles missing chart image gracefully', () => {
      const data = { ...validPdfData, chartImageDataUrl: '' }
      const result = generatePdfReport(data)
      expect(result).toBeInstanceOf(Blob)
      expect(mockDoc.addImage).not.toHaveBeenCalled()
    })

    it('adds chart image when data URL is valid', () => {
      generatePdfReport(validPdfData)
      expect(mockDoc.addImage).toHaveBeenCalledOnce()
    })

    it('includes metabolite data when present', () => {
      const data: PdfExportData = {
        ...validPdfData,
        prescriptions: [
          {
            ...validPdfData.prescriptions[0]!,
            metaboliteLife: 12,
            relativeMetaboliteLevel: 1.5,
          },
        ],
      }
      const result = generatePdfReport(data)
      expect(result).toBeInstanceOf(Blob)
      // Verify metabolite text was rendered
      const textCalls = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
      expect(textCalls.some((t: unknown) => typeof t === 'string' && t.includes('Metabolite half-life'))).toBe(true)
    })

    it('renders summary events with concentration values', () => {
      const data: PdfExportData = {
        ...validPdfData,
        summaryData: [
          {
            prescriptionId: 'test-1',
            prescriptionName: 'TestDrug',
            events: [
              {
                eventType: 'peak',
                clockTime: '11:00',
                elapsedTime: 'T+2h',
                elapsedHours: 2,
                description: 'Peak concentration reached',
                relativeConcentration: 0.85,
                prescriptionName: 'TestDrug',
              },
            ],
          },
        ],
      }
      generatePdfReport(data)
      const textCalls = mockDoc.text.mock.calls.map((c: unknown[]) => c[0])
      expect(textCalls.some((t: unknown) => t === '85.0%')).toBe(true)
    })

    it('returns null when jsPDF throws', () => {
      mockDoc.output.mockImplementationOnce(() => {
        throw new Error('PDF generation failed')
      })
      const result = generatePdfReport(validPdfData)
      expect(result).toBeNull()
    })
  })

  describe('downloadPdf', () => {
    let clickSpy: ReturnType<typeof vi.fn>
    let appendChildSpy: ReturnType<typeof vi.spyOn>
    let removeChildSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      clickSpy = vi.fn()
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

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

      vi.stubGlobal('URL', {
        createObjectURL: vi.fn().mockReturnValue('blob:test'),
        revokeObjectURL: vi.fn(),
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('returns true on successful download', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' })
      const result = downloadPdf(blob, 'test.pdf')
      expect(result).toBe(true)
    })

    it('creates and clicks download link', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' })
      downloadPdf(blob, 'test.pdf')
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(appendChildSpy).toHaveBeenCalledOnce()
      expect(removeChildSpy).toHaveBeenCalledOnce()
    })

    it('revokes object URL after download', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' })
      downloadPdf(blob, 'test.pdf')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    })
  })
})
