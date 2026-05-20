import { PrismaClient } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { SiteStructureService } from '@/lib/services/site-structure/site-structure-service'
import { transformToReactFlow } from '@/lib/studio/components/site-builder/transforms/to-react-flow'
import { ImportJobRepository } from '@/lib/studio/import/repositories/import-job.repository'
import { DesignConceptService } from '@/lib/studio/design-system/design-concept.service'
import { DesignSystemRepository } from '@/lib/studio/import/repositories/design-system.repository'
import { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import { getContentTypes } from '@/lib/services/content-type-service'
import {
  ProposalContextSummary,
  ProposalDesignConceptPreview,
  ProposalIANodeSummary,
  AgencyBranding,
  ProposalOriginalScreenshot,
  ProposalSEOAnalysis
} from './types'
import { collectSEOAnalysis } from './seo-analyzer'

const PAYLOAD_LIMIT_BYTES = 25 * 1024

interface ProposalContextBuilderDependencies {
  prisma?: PrismaClient
  siteStructureService?: SiteStructureService
  importJobRepository?: ImportJobRepository
  designConceptService?: DesignConceptService
  designSystemRepository?: DesignSystemRepository
  contentTypeFetcher?: typeof getContentTypes
}

export interface ProposalContextBuilderParams {
  websiteId: string
  conceptId?: string | null
  includeAlternates?: boolean
  importJobId?: string | null
  proposalTitle?: string | null
  tagline?: string | null
}

export interface ProposalContextBuilderResult {
  context: ProposalContextSummary
  llmContext: Record<string, unknown>
  designConcepts: ProposalDesignConceptPreview[]
}

export class ProposalContextBuilder {
  private readonly prisma: PrismaClient
  private readonly siteStructureService: SiteStructureService
  private readonly importJobRepository: ImportJobRepository
  private readonly designConceptService: DesignConceptService
  private readonly designSystemRepository: DesignSystemRepository
  private readonly contentTypeFetcher: typeof getContentTypes

  constructor(deps: ProposalContextBuilderDependencies = {}) {
    this.prisma = deps.prisma ?? prisma
    this.siteStructureService = deps.siteStructureService ?? new SiteStructureService(this.prisma)
    this.importJobRepository = deps.importJobRepository ?? new ImportJobRepository(this.prisma)
    this.designConceptService = deps.designConceptService ?? new DesignConceptService(this.prisma)
    this.designSystemRepository = deps.designSystemRepository ?? new DesignSystemRepository(this.prisma)
    this.contentTypeFetcher = deps.contentTypeFetcher ?? getContentTypes
  }

  async build(params: ProposalContextBuilderParams): Promise<ProposalContextBuilderResult> {
    const website = await this.prisma.website.findUnique({
      where: { id: params.websiteId },
      select: { id: true, name: true, description: true }
    })

    if (!website) {
      throw new Error('Website not found')
    }

    const tree = await this.siteStructureService.getTree(params.websiteId)
    const { nodes } = transformToReactFlow(tree)
    const trimmedNodes = this.trimNodes(nodes)
    const stats = this.computeNodeStats(nodes, trimmedNodes)

    const contentTypesRaw = await this.contentTypeFetcher(params.websiteId)
    const contentTypes = await this.mapContentTypes(contentTypesRaw, params.websiteId)

    const importBrief = await this.resolveImportBrief(params.websiteId, params.importJobId)

    const designConcepts = await this.loadDesignConcepts(
      params.websiteId,
      params.conceptId,
      Boolean(params.includeAlternates)
    )

    // Collect SEO analysis from website pages
    const seoAnalysis = await collectSEOAnalysis(this.prisma, params.websiteId)

    // Load original website screenshots from import
    const originalScreenshots = await this.loadOriginalScreenshots(params.websiteId, params.importJobId)

    // Parse agency branding from website settings
    const agencyBranding = await this.parseAgencyBranding(params.websiteId)

    const context: ProposalContextSummary = {
      website: {
        id: website.id,
        name: website.name,
        conceptId: designConcepts.length > 0 ? designConcepts[0].id : null,
        proposalTitle: params.proposalTitle ?? `${website.name} Proposal`,
        tagline: params.tagline ?? importBrief?.tagline ?? website.description ?? null
      },
      sitemap: {
        nodes: trimmedNodes,
        stats
      },
      contentTypes,
      importBrief,
      designConcepts,
      seoAnalysis,
      originalScreenshots,
      agencyBranding
    }

    const llmContext = this.buildLLMContext(context)

    return {
      context,
      llmContext,
      designConcepts
    }
  }

  private trimNodes(nodes: ReturnType<typeof transformToReactFlow>['nodes']): ProposalIANodeSummary[] {
    const maxNodes = 60
    const normalized = nodes.slice(0, maxNodes).map((node) => {
      const path = ((node.data as any)?.fullPath as string) ?? ''
      const depth = path ? path.split('/').filter(Boolean).length : 1
      return {
        id: node.id,
        label: typeof node.data?.label === 'string' ? node.data.label : 'Untitled node',
        depth,
        status: typeof node.data?.metadata?.status === 'string' ? node.data.metadata.status : undefined
      }
    })
    return normalized
  }

  private computeNodeStats(
    nodes: ReturnType<typeof transformToReactFlow>['nodes'],
    trimmed: ProposalIANodeSummary[]
  ) {
    const published = nodes.filter(
      (node) => typeof node.data?.metadata?.status === 'string' && node.data.metadata.status === 'published'
    ).length
    const draft = nodes.filter(
      (node) => typeof node.data?.metadata?.status === 'string' && node.data.metadata.status !== 'published'
    ).length
    const depthMax = trimmed.reduce((max, node) => Math.max(max, node.depth), 1)
    return {
      total: nodes.length,
      published,
      draft,
      depthMax
    }
  }

  private async mapContentTypes(contentTypes: Awaited<ReturnType<typeof getContentTypes>>, websiteId: string) {
    // Query actual page counts from database for accurate instance counts (Issue #6)
    const pageCounts = await this.prisma.websitePage.groupBy({
      by: ['contentTypeId'],
      where: { websiteId },
      _count: { contentTypeId: true }
    })
    const countMap = new Map(pageCounts.map((pc) => [pc.contentTypeId, pc._count.contentTypeId]))

    return contentTypes.slice(0, 8).map((type) => ({
      id: type.id,
      name: this.formatContentTypeName(type.name),
      category: typeof type.category === 'string' ? type.category : 'page',
      instanceCount: countMap.get(type.id) ?? 0,
      missingSchemaFields: Array.isArray((type.fields as any)?.fields)
        ? (type.fields as any).fields.filter((field: any) => field.required === false).length
        : 0,
      notes:
        typeof (type.settings as any)?.description === 'string'
          ? this.redactSensitive((type.settings as any).description as string)
          : null
    }))
  }

  /**
   * Formats content type names for client-friendly display (Issue #5)
   * Transforms technical names like "hero" to "Hero Section"
   */
  private formatContentTypeName(name: string): string {
    // Common mapping for known technical names
    const nameMap: Record<string, string> = {
      'hero': 'Hero Section',
      'cta': 'Call to Action',
      'nav': 'Navigation',
      'navigation': 'Navigation',
      'footer': 'Footer',
      'header': 'Header',
      'blog': 'Blog Post',
      'blog-post': 'Blog Post',
      'blogpost': 'Blog Post',
      'service': 'Service Page',
      'services': 'Services Page',
      'about': 'About Page',
      'contact': 'Contact Page',
      'team': 'Team Member',
      'testimonial': 'Testimonial',
      'testimonials': 'Testimonials',
      'faq': 'FAQ Section',
      'pricing': 'Pricing Page',
      'gallery': 'Gallery',
      'portfolio': 'Portfolio',
      'home': 'Home Page',
      'landing': 'Landing Page',
      'product': 'Product Page',
      'products': 'Products Page',
      'case-study': 'Case Study',
      'casestudy': 'Case Study'
    }

    const lowerName = name.toLowerCase().trim()

    // Check if we have a direct mapping
    if (nameMap[lowerName]) {
      return nameMap[lowerName]
    }

    // Remove "(Generic Page)" suffix if present
    let cleanName = name.replace(/\s*\(Generic Page\)\s*$/i, '').trim()

    // Convert to title case with proper handling
    cleanName = cleanName
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    return cleanName
  }

  private async resolveImportBrief(websiteId: string, importJobId?: string | null) {
    let job = null
    if (importJobId) {
      job = await this.importJobRepository.findById(importJobId)
    }
    if (!job) {
      const jobs = await this.importJobRepository.findByWebsiteId(websiteId)
      job = jobs[0] ?? null
    }
    if (!job) {
      return null
    }

    const detection =
      typeof job.detectionResults === 'object' && job.detectionResults !== null
        ? (job.detectionResults as Record<string, unknown>)
        : {}

    const websiteType = typeof detection.websiteType === 'string' ? detection.websiteType : null
    const pages = Array.isArray(detection.pages) ? detection.pages.slice(0, 3) : []
    const highlights = pages
      .map((page) => {
        if (typeof page !== 'object' || page === null) {
          return null
        }
        const title = typeof (page as any).title === 'string' ? (page as any).title : null
        const url = typeof (page as any).url === 'string' ? (page as any).url : null
        if (!title && !url) {
          return null
        }
        return this.redactSensitive([title, url].filter(Boolean).join(' — '))
      })
      .filter((entry): entry is string => Boolean(entry))

    return {
      url: this.redactSensitive(job.url),
      websiteType,
      summary:
        typeof detection.summary === 'string'
          ? this.redactSensitive(detection.summary)
          : job.status ?? null,
      tagline: typeof detection.tagline === 'string' ? this.redactSensitive(detection.tagline) : null,
      detectionHighlights: highlights
    }
  }

  private async loadDesignConcepts(
    websiteId: string,
    requestedConceptId?: string | null,
    includeAlternates?: boolean
  ): Promise<ProposalDesignConceptPreview[]> {
    const concepts = await this.designConceptService.listConcepts(websiteId)
    if (concepts.length === 0) {
      throw new Error('No design concepts are available for this website')
    }
    const primary =
      concepts.find((concept) => concept.id === requestedConceptId) ??
      concepts.find((concept) => concept.isDefault) ??
      concepts[0]

    const alternates = concepts.filter((concept) => concept.id !== primary.id)
    const orderedPool = includeAlternates ? [primary, ...alternates] : [primary]
    const limited = orderedPool.slice(0, 4)

    const previews: ProposalDesignConceptPreview[] = []
    for (const concept of limited) {
      const designSystemEntity = await this.designSystemRepository.findLatestByConceptId(concept.id)
      const tokens = (designSystemEntity?.tokens as unknown as DesignSystem) ?? null
      previews.push({
        id: concept.id,
        name: concept.name,
        isDefault: concept.isDefault,
        generatorSeed: concept.generatorSeed ?? null,
        palette: this.resolvePalette(tokens),
        typography: this.resolveTypography(tokens),
        positioningNote: this.extractPositioning(concept.metadata),
        paletteAngleNote: tokens?.metadata?.generatorSeed ?? undefined
      })
    }

    return previews
  }

  private resolvePalette(designSystem: DesignSystem | null) {
    const fallback = {
      primary: '#FF5500',
      secondary: '#7C3AED',
      accent: '#0EA5E9',
      neutral: '#1F2937',
      surface: '#0B1120'
    }
    if (!designSystem?.palette) {
      return fallback
    }
    const pickColor = (category: keyof DesignSystem['palette'], defaultColor: string) => {
      const tokens = designSystem.palette[category]
      if (Array.isArray(tokens) && tokens.length > 0) {
        return tokens[0].value || tokens[0].hex || defaultColor
      }
      return defaultColor
    }
    return {
      primary: pickColor('primary', fallback.primary),
      secondary: pickColor('secondary', fallback.secondary),
      accent: pickColor('accent', fallback.accent),
      neutral: pickColor('neutral', fallback.neutral),
      surface: pickColor('surface', fallback.surface)
    }
  }

  private resolveTypography(designSystem: DesignSystem | null) {
    const fallback = {
      heading: 'Sora',
      body: 'Inter'
    }
    if (!designSystem?.typography) {
      return fallback
    }
    const heading =
      designSystem.typography.heading?.[0]?.fontFamily ||
      designSystem.typography.ui?.[0]?.fontFamily ||
      fallback.heading
    const body =
      designSystem.typography.body?.[0]?.fontFamily ||
      designSystem.typography.ui?.[0]?.fontFamily ||
      fallback.body
    return {
      heading,
      body
    }
  }

  private extractPositioning(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') {
      return null
    }
    try {
      const parsed = JSON.parse(JSON.stringify(metadata))
      if (parsed && typeof parsed.positioning === 'string') {
        return this.redactSensitive(parsed.positioning)
      }
      if (parsed && typeof parsed.tagline === 'string') {
        return this.redactSensitive(parsed.tagline)
      }
    } catch {
      // no-op
    }
    return null
  }

  private async loadOriginalScreenshots(
    websiteId: string,
    importJobId?: string | null
  ): Promise<ProposalOriginalScreenshot[]> {
    let job = null
    if (importJobId) {
      job = await this.importJobRepository.findById(importJobId)
    }
    if (!job) {
      const jobs = await this.importJobRepository.findByWebsiteId(websiteId)
      job = jobs[0] ?? null
    }
    if (!job) {
      return []
    }

    const detection =
      typeof job.detectionResults === 'object' && job.detectionResults !== null
        ? (job.detectionResults as Record<string, unknown>)
        : {}

    const screenshots = detection.originalScreenshots
    if (!Array.isArray(screenshots)) {
      return []
    }

    return screenshots
      .slice(0, 6)
      .filter(
        (s): s is { url: string; pageUrl: string; key?: string } =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as any).url === 'string' &&
          typeof (s as any).pageUrl === 'string'
      )
      .map((s) => ({
        url: s.url,
        pageUrl: s.pageUrl,
        key: typeof s.key === 'string' ? s.key : undefined
      }))
  }

  private async parseAgencyBranding(websiteId: string): Promise<AgencyBranding | null> {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      select: { agencyBranding: true }
    })

    if (!website?.agencyBranding) {
      return null
    }

    const branding = website.agencyBranding as Record<string, unknown>
    return {
      logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : null,
      agencyName: typeof branding.agencyName === 'string' ? branding.agencyName : null,
      primaryColor: typeof branding.primaryColor === 'string' ? branding.primaryColor : null,
      contactEmail: typeof branding.contactEmail === 'string' ? branding.contactEmail : null,
      websiteUrl: typeof branding.websiteUrl === 'string' ? branding.websiteUrl : null,
      phone: typeof branding.phone === 'string' ? branding.phone : null
    }
  }

  private buildLLMContext(context: ProposalContextSummary) {
    const payload = {
      website: {
        name: context.website.name,
        tagline: context.website.tagline
      },
      informationArchitecture: {
        nodes: [...context.sitemap.nodes],
        stats: context.sitemap.stats
      },
      contentTypes: [...context.contentTypes],
      importBrief: context.importBrief,
      designConcepts: context.designConcepts.map((concept) => ({ ...concept }))
    }

    let serialized = JSON.stringify(payload)
    while (Buffer.byteLength(serialized) > PAYLOAD_LIMIT_BYTES && payload.informationArchitecture.nodes.length > 20) {
      payload.informationArchitecture.nodes.pop()
      serialized = JSON.stringify(payload)
    }

    return JSON.parse(serialized)
  }

  private redactSensitive(input: string): string {
    if (!input) return input
    const withoutEmails = input.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    const withoutPhones = withoutEmails.replace(
      /(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g,
      '[redacted]'
    )
    return withoutPhones
  }
}
