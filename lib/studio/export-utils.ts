import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { Node, Edge } from 'reactflow'

type Html2CanvasOptions = Parameters<typeof html2canvas>[1]

export async function toPng(element: HTMLElement, options: Html2CanvasOptions = {}) {
  const { scale = 1, backgroundColor, ...rest } = options ?? {}
  const canvas = await html2canvas(element, {
    ...rest,
    backgroundColor: backgroundColor ?? '#111827',
    scale,
    logging: false
  })
  return canvas.toDataURL('image/png')
}

interface PdfDocumentOptions {
  orientation?: 'portrait' | 'landscape'
  format?: 'a4' | 'letter' | [number, number]
  backgroundColor?: string
  scale?: number
  imageQuality?: number
  imageType?: 'JPEG' | 'PNG'
}

interface PdfMetadataOptions {
  title?: string
  subject?: string
  author?: string
  keywords?: string
  creator?: string
}

interface PdfExportOptions {
  filename?: string
  projectName?: string
  nodes?: Node[]
  edges?: Edge[]
  metadata?: PdfMetadataOptions
  document?: PdfDocumentOptions
  download?: boolean
}

const DEFAULT_METADATA: PdfMetadataOptions = {
  title: 'Sitemap Export',
  subject: 'Sitemap Export',
  author: 'Sitemap Builder',
  keywords: 'sitemap, website, structure',
  creator: 'Catalyst Studio'
}

const MAX_PDF_DIMENSION = 14400
const DEFAULT_PDF_SCALE = 1.1
const DEFAULT_IMAGE_QUALITY = 0.85
const DEFAULT_IMAGE_TYPE: 'JPEG' | 'PNG' = 'JPEG'

const clampDimensions = (width: number, height: number) => {
  const ratio = Math.min(MAX_PDF_DIMENSION / width, MAX_PDF_DIMENSION / height, 1)
  const safeWidth = Math.max(1, Math.round(width * ratio))
  const safeHeight = Math.max(1, Math.round(height * ratio))
  return { width: safeWidth, height: safeHeight }
}

export async function toPdf(element: HTMLElement | HTMLElement[], options: PdfExportOptions = {}): Promise<Blob | null> {
  const { document: documentOptions = {}, download = true } = options
  const targets = Array.isArray(element) ? element : [element]
  if (targets.length === 0) {
    return null
  }

  const captureElement = (target: HTMLElement) =>
    html2canvas(target, {
      backgroundColor: documentOptions.backgroundColor ?? '#111827',
      scale: documentOptions.scale ?? DEFAULT_PDF_SCALE,
      logging: false
    })

  const firstCanvas = await captureElement(targets[0])
  const firstDimensions = clampDimensions(firstCanvas.width, firstCanvas.height)
  const inferredOrientation = firstDimensions.width >= firstDimensions.height ? 'landscape' : 'portrait'
  const orientation = documentOptions.orientation ?? inferredOrientation
  const format = documentOptions.format ?? [firstDimensions.width, firstDimensions.height]

  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format
  })

  const imageType = documentOptions.imageType ?? DEFAULT_IMAGE_TYPE
  const mimeType = imageType === 'PNG' ? 'image/png' : 'image/jpeg'
  const imageQuality =
    imageType === 'PNG' ? undefined : Math.min(1, Math.max(0.4, documentOptions.imageQuality ?? DEFAULT_IMAGE_QUALITY))

  const addCanvasToPdf = (canvas: HTMLCanvasElement, isFirstPage: boolean) => {
    const { width, height } = clampDimensions(canvas.width, canvas.height)
    if (!isFirstPage) {
      pdf.addPage([width, height], orientation)
    }
    const dataUrl = canvas.toDataURL(mimeType, imageQuality)
    pdf.addImage(dataUrl, imageType, 0, 0, width, height)
    canvas.width = 0
    canvas.height = 0
  }

  addCanvasToPdf(firstCanvas, true)

  for (let index = 1; index < targets.length; index++) {
    const canvas = await captureElement(targets[index])
    addCanvasToPdf(canvas, false)
  }

  // Add metadata
  const metadata: PdfMetadataOptions = {
    ...DEFAULT_METADATA,
    ...(options.projectName ? { title: options.projectName } : {}),
    ...(options.metadata ?? {})
  }
  pdf.setProperties(metadata)

  // Add page with node details
  if (options.nodes) {
    pdf.addPage()
    pdf.setFontSize(20)
    pdf.text('Sitemap Details', 20, 30)

    let yPosition = 60
    pdf.setFontSize(12)

    options.nodes.forEach((node: Node, index: number) => {
      if (yPosition > pdf.internal.pageSize.height - 30) {
        pdf.addPage()
        yPosition = 30
      }

      pdf.text(`${index + 1}. ${node.data.label}`, 20, yPosition)
      if (node.data.url) {
        pdf.setFontSize(10)
        pdf.text(`   URL: ${node.data.url}`, 30, yPosition + 15)
        pdf.setFontSize(12)
        yPosition += 15
      }
      yPosition += 20
    })
  }

  const blob = new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  if (download) {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = options.filename || 'sitemap.pdf'
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
  return blob
}
