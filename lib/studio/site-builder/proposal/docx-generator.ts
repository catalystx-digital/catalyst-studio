import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  ExternalHyperlink,
  Header,
  Footer
} from 'docx'
import type { FileChild } from 'docx'
import {
  ProposalContextSummary,
  ProposalNarrative,
  ProposalDesignConceptPreview,
  ProposalTemplate
} from './types'
import { generateFromTemplate, parseProposalTemplate } from './template-processor'

// Re-export for convenience
export { parseProposalTemplate } from './template-processor'

interface ConceptAsset {
  concept: ProposalDesignConceptPreview
  previewUrl?: string | null
  previewAvailable: boolean
}

export interface DocxGeneratorOptions {
  websiteName: string
  proposalTitle: string
  narrative: ProposalNarrative
  context: ProposalContextSummary
  sitemapPreview?: string | null
  conceptAssets: ConceptAsset[]
  capturedAt: string
  /** Optional custom template for variable substitution */
  template?: ProposalTemplate | null
}

const BRAND_COLOR = 'FF5500'
const DARK_TEXT = '1C0A05'

/**
 * Fetches an image from a data URL or HTTP URL and returns it as a Buffer/Uint8Array.
 */
async function fetchImageBuffer(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:')) {
      const base64Match = url.match(/^data:[^;]+;base64,(.+)$/)
      if (base64Match) {
        const base64Data = base64Match[1]
        if (typeof window !== 'undefined') {
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          return bytes
        } else {
          return new Uint8Array(Buffer.from(base64Data, 'base64'))
        }
      }
      return null
    }

    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  } catch {
    return null
  }
}

function createHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 400, after: 200 }
  })
}

function createSubheading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: BRAND_COLOR
      })
    ],
    spacing: { before: 300, after: 100 }
  })
}

function createBodyText(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 }
  })
}

function createBulletList(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        children: [new TextRun({ text: item, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80 }
      })
  )
}

function createNumberedList(items: string[]): Paragraph[] {
  return items.map(
    (item, index) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, bold: true, size: 22 }),
          new TextRun({ text: item, size: 22 })
        ],
        spacing: { after: 80 }
      })
  )
}

function createStatsTable(stats: { label: string; value: string | number }[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: stats.map(
          (stat) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: String(stat.value), bold: true, size: 36, color: BRAND_COLOR })
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [new TextRun({ text: stat.label.toUpperCase(), size: 18, color: '666666' })],
                  alignment: AlignmentType.CENTER
                })
              ],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE }
              }
            })
        )
      })
    ]
  })
}

async function createImageParagraph(
  imageUrl: string,
  altText: string,
  width: number = 600,
  height: number = 400
): Promise<Paragraph | null> {
  const imageBuffer = await fetchImageBuffer(imageUrl)
  if (!imageBuffer) return null

  return new Paragraph({
    children: [
      new ImageRun({
        data: imageBuffer,
        transformation: { width, height },
        type: 'png'
      })
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 }
  })
}

export async function generateProposalDocx(options: DocxGeneratorOptions): Promise<Blob> {
  // Check for custom template first - if present, use template-based generation
  if (options.template) {
    return generateFromTemplate(
      options.template,
      options.websiteName,
      options.proposalTitle,
      options.narrative,
      options.context,
      options.capturedAt
    )
  }

  // Fall back to programmatic generation
  const { websiteName, proposalTitle, narrative, context, sitemapPreview, conceptAssets, capturedAt } =
    options
  const capturedDate = new Date(capturedAt)
  const capturedDateLabel = Number.isNaN(capturedDate.getTime())
    ? ''
    : capturedDate.toLocaleDateString()
  const tagline =
    context.website.tagline ||
    narrative.project_summary.split('.').at(0) ||
    'Audience-first experience uplift'

  const branding = context.agencyBranding
  const brandName = branding?.agencyName || 'Catalyst Studio'

  const sections: FileChild[] = []

  // --- COVER PAGE ---
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: proposalTitle || `${websiteName} Proposal`,
          bold: true,
          size: 72,
          color: BRAND_COLOR
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 400 }
    })
  )

  sections.push(
    new Paragraph({
      children: [new TextRun({ text: tagline, size: 32, italics: true, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    })
  )

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Prepared for `, size: 24 }),
        new TextRun({ text: websiteName, bold: true, size: 24 }),
        new TextRun({ text: ` on ${capturedDateLabel}`, size: 24 })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  )

  sections.push(
    new Paragraph({
      children: [new TextRun({ text: `Powered by ${brandName}`, size: 20, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  )

  sections.push(new Paragraph({ children: [new PageBreak()] }))

  // --- EXECUTIVE SUMMARY ---
  sections.push(createHeading('Executive Summary'))
  sections.push(createBodyText(narrative.project_summary))

  // --- INFORMATION ARCHITECTURE ---
  sections.push(createHeading('Information Architecture'))
  sections.push(
    createStatsTable([
      { label: 'Total Pages', value: context.sitemap.stats.total },
      { label: 'Max Depth', value: context.sitemap.stats.depthMax },
      { label: 'Published', value: context.sitemap.stats.published },
      { label: 'Draft', value: context.sitemap.stats.draft }
    ])
  )

  sections.push(createSubheading('Key Insights'))
  const iaHighlights = narrative.ia_highlights.slice(0, 6)
  for (const highlight of iaHighlights) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: highlight.section, bold: true, size: 22 }),
          new TextRun({ text: ` - ${highlight.insight}`, size: 22 })
        ],
        spacing: { after: 80 }
      })
    )
  }

  // Sitemap preview image
  if (sitemapPreview) {
    const sitemapImage = await createImageParagraph(sitemapPreview, 'Sitemap Preview', 560, 350)
    if (sitemapImage) {
      sections.push(sitemapImage)
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }))

  // --- CONTENT TYPES ---
  sections.push(createHeading('Content Systems'))
  sections.push(
    createBodyText('Reusable publishing blocks identified for this website:')
  )

  const contentTypeNotes = narrative.content_type_notes.slice(0, 6)
  for (const note of contentTypeNotes) {
    sections.push(createSubheading(note.typeName))
    sections.push(createBodyText(note.summary))
    if (note.opportunities && note.opportunities.length > 0) {
      sections.push(...createBulletList(note.opportunities))
    }
  }

  // --- CURRENT WEBSITE SCREENSHOTS ---
  if (context.originalScreenshots && context.originalScreenshots.length > 0) {
    sections.push(new Paragraph({ children: [new PageBreak()] }))
    sections.push(createHeading('Current Website'))
    sections.push(
      createBodyText(
        'Screenshots captured during the import process showing the current state of the website.'
      )
    )

    for (const screenshot of context.originalScreenshots) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: screenshot.pageUrl, size: 18, italics: true, color: '666666' })
          ],
          spacing: { before: 200, after: 100 }
        })
      )
      const screenshotImage = await createImageParagraph(screenshot.url, screenshot.pageUrl, 560, 350)
      if (screenshotImage) {
        sections.push(screenshotImage)
      }
    }
  }

  // --- SEO ANALYSIS ---
  if (context.seoAnalysis) {
    sections.push(new Paragraph({ children: [new PageBreak()] }))
    sections.push(createHeading('SEO Analysis'))

    const seo = context.seoAnalysis
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'SEO Health Score: ', size: 24 }),
          new TextRun({
            text: `${seo.score}/100`,
            bold: true,
            size: 32,
            color: seo.score >= 70 ? '22C55E' : seo.score >= 40 ? 'F59E0B' : 'EF4444'
          })
        ],
        spacing: { after: 200 }
      })
    )

    sections.push(
      createStatsTable([
        { label: 'Total Pages', value: seo.stats.totalPages },
        { label: 'Pages with Meta', value: seo.stats.pagesWithMeta },
        { label: 'Images with Alt', value: seo.stats.imagesWithAlt },
        { label: 'Internal Links', value: seo.stats.internalLinks }
      ])
    )

    if (seo.issues.length > 0) {
      sections.push(createSubheading('Issues Found'))
      const criticalIssues = seo.issues.filter((i) => i.severity === 'critical')
      const warningIssues = seo.issues.filter((i) => i.severity === 'warning')

      if (criticalIssues.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Critical Issues:', bold: true, size: 22, color: 'EF4444' })],
            spacing: { before: 100, after: 50 }
          })
        )
        sections.push(...createBulletList(criticalIssues.map((i) => i.message)))
      }

      if (warningIssues.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Warnings:', bold: true, size: 22, color: 'F59E0B' })],
            spacing: { before: 100, after: 50 }
          })
        )
        sections.push(...createBulletList(warningIssues.map((i) => i.message)))
      }
    }

    if (narrative.seo_recommendations) {
      sections.push(createSubheading('Recommendations'))
      sections.push(createBodyText(narrative.seo_recommendations))
    }
  }

  // --- DESIGN CONCEPTS ---
  const featuredConcepts = conceptAssets.slice(0, 3)
  if (featuredConcepts.length > 0) {
    sections.push(new Paragraph({ children: [new PageBreak()] }))
    sections.push(createHeading('Design Concepts'))

    const designNarrativeById = new Map(
      narrative.design_concepts.map((entry) => [entry.conceptId, entry])
    )

    for (const asset of featuredConcepts) {
      const narrativeEntry = designNarrativeById.get(asset.concept.id)

      sections.push(createSubheading(asset.concept.name))

      if (narrativeEntry?.positioning) {
        sections.push(createBodyText(narrativeEntry.positioning))
      }

      if (narrativeEntry?.paletteAngle) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Palette Angle: ', bold: true, size: 22 }),
              new TextRun({ text: narrativeEntry.paletteAngle, size: 22, italics: true })
            ],
            spacing: { after: 100 }
          })
        )
      }

      // Color palette display
      const paletteColors = Object.entries(asset.concept.palette)
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Color Palette:', bold: true, size: 22 })],
          spacing: { before: 100, after: 50 }
        })
      )

      sections.push(
        new Paragraph({
          children: paletteColors.map(
            ([name, color]) =>
              new TextRun({
                text: `${name}: ${color}  `,
                size: 20,
                color: color.replace('#', '')
              })
          ),
          spacing: { after: 100 }
        })
      )

      if (narrativeEntry?.bestUseCases && narrativeEntry.bestUseCases.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Best Use Cases:', bold: true, size: 22 })],
            spacing: { before: 100, after: 50 }
          })
        )
        sections.push(...createBulletList(narrativeEntry.bestUseCases))
      }

      // Concept preview image
      if (asset.previewUrl && asset.previewAvailable) {
        const conceptImage = await createImageParagraph(
          asset.previewUrl,
          `${asset.concept.name} preview`,
          500,
          320
        )
        if (conceptImage) {
          sections.push(conceptImage)
        }
      }

      sections.push(
        new Paragraph({ children: [], spacing: { after: 300 } })
      )
    }
  }

  // --- IMPLEMENTATION ROADMAP ---
  sections.push(new Paragraph({ children: [new PageBreak()] }))
  sections.push(createHeading('Implementation Roadmap'))

  const upliftSteps = narrative.uplift_plan.slice(0, 8)
  sections.push(createSubheading('Uplift Plan'))
  sections.push(...createNumberedList(upliftSteps))

  // --- CALL TO ACTION ---
  sections.push(
    new Paragraph({
      children: [],
      spacing: { before: 400 }
    })
  )

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: narrative.call_to_action,
          bold: true,
          size: 28,
          color: BRAND_COLOR
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 }
    })
  )

  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Ready to get started? Contact ${brandName} to begin your website transformation.`,
          size: 24
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  )

  if (branding?.contactEmail) {
    sections.push(
      new Paragraph({
        children: [
          new ExternalHyperlink({
            children: [
              new TextRun({ text: branding.contactEmail, size: 22, color: BRAND_COLOR, underline: {} })
            ],
            link: `mailto:${branding.contactEmail}`
          })
        ],
        alignment: AlignmentType.CENTER
      })
    )
  }

  // Build document
  const doc = new Document({
    creator: brandName,
    title: proposalTitle || `${websiteName} Proposal`,
    description: `Website proposal for ${websiteName}`,
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: brandName, size: 18, color: '999999' })
                ],
                alignment: AlignmentType.RIGHT
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${websiteName} Proposal - Confidential`,
                    size: 16,
                    color: 'AAAAAA'
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children: sections
      }
    ]
  })

  const { Packer } = await import('docx')
  const blob = await Packer.toBlob(doc)
  return blob
}

/**
 * Slugify a string for use in filenames.
 */
export function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'proposal'
  )
}

/**
 * Triggers download of a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
