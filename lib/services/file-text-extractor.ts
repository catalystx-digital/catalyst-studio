'use client'

// Libraries are loaded dynamically to avoid SSR/bundling issues
let pdfjsLib: typeof import('pdfjs-dist') | null = null
let mammothLib: typeof import('mammoth') | null = null

async function getPdfjs() {
  if (!pdfjsLib && typeof window !== 'undefined') {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }
  return pdfjsLib
}

async function getMammoth() {
  if (!mammothLib && typeof window !== 'undefined') {
    mammothLib = await import('mammoth')
  }
  return mammothLib
}

export type SupportedFileType = 'pdf' | 'docx' | 'md' | 'txt'

export interface ExtractionResult {
  text: string
  fileType: SupportedFileType
  fileName: string
  charCount: number
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'] as const

export function getSupportedFileType(fileName: string): SupportedFileType | null {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (ext === '.md') return 'md'
  if (ext === '.txt') return 'txt'
  return null
}

export function isSupportedFile(fileName: string): boolean {
  return getSupportedFileType(fileName) !== null
}

async function extractFromPDF(file: File): Promise<string> {
  const pdfjs = await getPdfjs()
  if (!pdfjs) {
    throw new Error('PDF.js could not be loaded')
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise

  const textParts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .filter((item): item is { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ')
    textParts.push(pageText)
  }

  return textParts.join('\n\n')
}

async function extractFromDOCX(file: File): Promise<string> {
  const mammoth = await getMammoth()
  if (!mammoth) {
    throw new Error('Mammoth library could not be loaded')
  }

  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractFromText(file: File): Promise<string> {
  return await file.text()
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const fileType = getSupportedFileType(file.name)

  if (!fileType) {
    throw new Error(
      `Unsupported file type: ${file.name}. Supported types: ${SUPPORTED_EXTENSIONS.join(', ')}`
    )
  }

  let text: string

  try {
    switch (fileType) {
      case 'pdf':
        text = await extractFromPDF(file)
        break
      case 'docx':
        text = await extractFromDOCX(file)
        break
      case 'md':
      case 'txt':
        text = await extractFromText(file)
        break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to extract text from ${file.name}: ${message}`)
  }

  return {
    text: text.trim(),
    fileType,
    fileName: file.name,
    charCount: text.trim().length,
  }
}

export function getAcceptedFileTypes(): string {
  return '.pdf,.docx,.md,.txt'
}
