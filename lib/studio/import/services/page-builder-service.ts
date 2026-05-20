import { PrismaClient, WebsitePage, Prisma } from '@/lib/generated/prisma'
import {
  IPageBuilderService,
  ComponentInstance,
  PageData,
  ComponentTree,
  ComponentType,
  DetectionResult
} from './interfaces'
import { z } from 'zod'
import {
  validatePageTemplate,
  TemplateValidationIssue
} from '@/lib/studio/pages/validation/template-validation'
import { ComponentBuilder } from './page-builder/component-builder'
import { ComponentRegionManager } from './page-builder/component-region-manager'
import { TemplateResolver, type ResolvedTemplateMetadata } from './page-builder/template-resolver'
import {
  extractPageMetadata,
  generatePageTitle,
  determinePageType as determinePageTypeUtil,
  extractKeywordsFromContent
} from './page-builder/page-metadata'
import { calculatePositions, deduplicateComponents } from './page-builder/component-tree-utils'
import { generateComponentId, extractComponentProps } from './page-builder/component-helpers'

const PageDataSchema = z.object({
  title: z.string().min(1, 'Page title is required'),
  url: z.string().url('Invalid URL format'),
  screenshot: z.string().optional(),
  detectedComponents: z.array(z.any()),
  metadata: z.object({
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    openGraph: z.record(z.any()).optional()
  }).optional(),
  templateProps: z.record(z.unknown()).optional(),
  pageTemplate: z.object({
    templateKey: z.string().min(1, 'Template key is required'),
    confidence: z.number().min(0).max(1).optional(),
    reason: z.string().max(500).optional(),
    source: z.enum(['model', 'fallback', 'home-enforced']).optional(),
    requestedKey: z.string().optional(),
    props: z.record(z.unknown()).optional()
  }).optional()
})

interface PreparedPage {
  pageContent: Record<string, any>
  metadata: Prisma.InputJsonValue
  templateMetadata: ResolvedTemplateMetadata
  templateValidation: ReturnType<typeof validatePageTemplate>
  pageTitle: string
  pageType: 'page' | 'folder'
  isValid: boolean
  validationIssues: TemplateValidationIssue[]
  contentTypeId: string
}

type NormalizedRegion = 'header' | 'hero' | 'main' | 'footer'

function normalizeRegionValue(value: unknown): NormalizedRegion | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'header' || normalized === 'hero' || normalized === 'main' || normalized === 'footer') {
    return normalized
  }
  return undefined
}

function propagateContentRegion(node: ComponentInstance): void {
  if (!node.props) {
    return
  }
  const contentRegion =
    node.props.content && typeof (node.props.content as Record<string, any>)?.region === 'string'
      ? normalizeRegionValue((node.props.content as Record<string, any>).region)
      : undefined
  const metadataRegion =
    node.props.content &&
    typeof (node.props.content as Record<string, any>)?.metadata === 'object' &&
    typeof ((node.props.content as Record<string, any>).metadata as Record<string, any>)?.region === 'string'
      ? normalizeRegionValue(
          ((node.props.content as Record<string, any>).metadata as Record<string, any>).region
        )
      : undefined
  const desiredRegion = contentRegion ?? metadataRegion
  const currentRegion = normalizeRegionValue(node.props.region ?? (node.props.metadata as any)?.region)

  if (desiredRegion && desiredRegion !== currentRegion) {
    node.props.region = desiredRegion
    if (node.props.metadata && typeof node.props.metadata === 'object') {
      node.props.metadata = { ...(node.props.metadata as Record<string, unknown>), region: desiredRegion }
    } else {
      node.props.metadata = { region: desiredRegion }
    }
  }

  if (node.children) {
    node.children.forEach(propagateContentRegion)
  }
}

export class PageBuilderService implements IPageBuilderService {
  private readonly componentBuilder = new ComponentBuilder()
  private readonly regionManager = new ComponentRegionManager()
  private readonly templateResolver = new TemplateResolver()

  private defaultContentTypeId = ''
  private templateContentTypeMap: Map<string, string> = new Map()

  constructor(private readonly prisma: PrismaClient) {}

  configureContentTypes({
    defaultContentTypeId,
    templateContentTypes
  }: {
    defaultContentTypeId: string
    templateContentTypes: Map<string, string>
  }): void {
    this.defaultContentTypeId = defaultContentTypeId
    this.templateContentTypeMap = new Map(templateContentTypes)
  }

  async createPage(
    pageData: PageData,
    componentTypes: ComponentType[],
    websiteId: string,
    contentTypeId: string
  ): Promise<WebsitePage> {
    const [page] = await this.createPagesInBatch([
      {
        pageData,
        componentTypes,
        websiteId,
        contentTypeId
      }
    ])

    if (!page) {
      throw new Error('Failed to create page; transaction returned no result')
    }

    return page
  }

  buildComponentTree(components: DetectionResult[]): ComponentTree {
    return this.componentBuilder.buildComponentTree(components)
  }

  mapToComponentInstances(
    detected: DetectionResult[],
    types: ComponentType[]
  ): ComponentInstance[] {
    return this.componentBuilder.mapToComponentInstances(detected, types)
  }

  generateComponentId(type: string, index: number): string {
    return generateComponentId(type, index)
  }

  validateComponentTree(tree: ComponentTree): boolean {
    return this.componentBuilder.validateComponentTree(tree)
  }

  calculatePositions(components: ComponentInstance[]): ComponentInstance[] {
    return calculatePositions(components)
  }

  extractPageMetadata(detectionResults: DetectionResult[]): PageData['metadata'] {
    return extractPageMetadata(detectionResults)
  }

  optimizeComponentTree(tree: ComponentTree): ComponentTree {
    return this.componentBuilder.optimizeComponentTree(tree)
  }

  formatPageContent(tree: ComponentTree, primaryFieldName: string): Record<string, any> {
    return {
      [primaryFieldName]: tree.components,
      metadata: tree.metadata
    }
  }

  async createPagesInBatch(
    pagesData: Array<{
      pageData: PageData
      componentTypes: ComponentType[]
      websiteId: string
      contentTypeId: string
    }>
  ): Promise<WebsitePage[]> {
    const maxRetries = 5
    let attempt = 0

    while (true) {
      try {
        return await this.prisma.$transaction(async tx => {
          const createdPages: WebsitePage[] = []

          for (const { pageData, componentTypes, websiteId, contentTypeId } of pagesData) {
            try {
              const prepared = await this.preparePage({ pageData, componentTypes })
              const page = await this.upsertPage({
                tx,
                websiteId,
                contentTypeId,
                pageData,
                prepared
              })
              createdPages.push(page)
            } catch (error) {
              console.error(`Failed to create page ${pageData.url}:`, error)
              throw error
            }
          }

          return createdPages
        }, {
          maxWait: 10000,
          timeout: 14000,  // Prisma Accelerate limit is 15000ms - staying under
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        })
      } catch (error) {
        const isKnown = error instanceof Prisma.PrismaClientKnownRequestError
        if (isKnown && error.code === 'P2034' && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 100)
          console.warn('[PageBuilderService] Write conflict detected (P2034); retrying', {
            attempt: attempt + 1,
            backoffMs,
            pages: pagesData.length
          })
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          attempt += 1
          continue
        }
        throw error
      }
    }
  }

  private async preparePage({
    pageData,
    componentTypes
  }: {
    pageData: PageData
    componentTypes: ComponentType[]
  }): Promise<PreparedPage> {
    PageDataSchema.parse(pageData)

    const componentTree = this.componentBuilder.buildTreeFromDetections(
      pageData.detectedComponents,
      componentTypes
    )

    const templateMetadata = await this.templateResolver.resolve(pageData)
    if (!templateMetadata) {
      throw new Error(`Unable to resolve page template for ${pageData.url}`)
    }

    const regionAdjustedTree = this.regionManager.ensureRequiredRegionCoverage({
      tree: componentTree,
      template: templateMetadata.template,
      componentTypes,
      pageData
    })
    regionAdjustedTree.components.forEach(propagateContentRegion)

    if (!this.componentBuilder.validateComponentTree(regionAdjustedTree)) {
      throw new Error(`Invalid component tree structure for page: ${pageData.url}`)
    }

    const templatePropsInput = pageData.templateProps ?? pageData.pageTemplate?.props
    const templateValidation = validatePageTemplate({
      template: templateMetadata.template,
      templateProps: templatePropsInput as Record<string, unknown> | undefined,
      componentTree: regionAdjustedTree.components,
      componentTypes
    })

    const validationErrors = templateValidation.issues.filter(issue => issue.severity === 'error')
    // Only fail on critical errors - region issues are non-critical and should not block import
    const criticalErrors = validationErrors.filter(e => !e.code.startsWith('region.'))
    const isValid = criticalErrors.length === 0

    if (validationErrors.length > 0) {
      const message = validationErrors.map(issue => `${issue.code}: ${issue.message}`).join('; ')
      console.warn('[PageBuilderService] Template validation issues (proceeding with import)', {
        url: pageData.url,
        templateKey: templateMetadata.templateKey,
        errors: validationErrors,
        criticalErrors: criticalErrors.length,
        nonCriticalErrors: validationErrors.length - criticalErrors.length,
        message
      })
      // Don't throw - allow import to proceed with warnings
    }

    const validationWarnings = templateValidation.issues.filter(issue => issue.severity === 'warning')
    if (validationWarnings.length > 0) {
      console.warn('Template validation warnings for page', {
        url: pageData.url,
        templateKey: templateMetadata.templateKey,
        warnings: validationWarnings
      })
    }

    const primaryContentField = this.resolvePrimaryContentField(templateMetadata.template)
    const pageContent = this.formatPageContent(regionAdjustedTree, primaryContentField)
    const metadata = this.buildPageMetadata({
      pageData,
      templateMetadata,
      templateValidation,
      isValid
    })

    return {
      pageContent,
      metadata,
      templateMetadata,
      templateValidation,
      pageTitle: generatePageTitle(pageData),
      pageType: determinePageTypeUtil(pageData),
      isValid,
      validationIssues: templateValidation.issues,
      contentTypeId: this.resolveContentTypeId(templateMetadata.templateKey)
    }
  }

  private resolveContentTypeId(templateKey: string): string {
    const mapped = this.templateContentTypeMap.get(templateKey)
    if (mapped && typeof mapped === 'string' && mapped.trim().length > 0) {
      return mapped
    }
    if (this.defaultContentTypeId && this.defaultContentTypeId.trim().length > 0) {
      return this.defaultContentTypeId
    }
    throw new Error(`[PageBuilderService] Missing content type mapping for template "${templateKey}"`)
  }

  private resolvePrimaryContentField(template: ResolvedTemplateMetadata['template']): string {
    const schema = template.contentSchema
    if (schema) {
      const prioritized = Object.entries(schema).find(([, meta]) => meta.type === 'content[]')
      if (prioritized) {
        return prioritized[0]
      }
      const firstKey = Object.keys(schema)[0]
      if (firstKey) {
        return firstKey
      }
    }
    return 'components'
  }

  private buildPageMetadata({
    pageData,
    templateMetadata,
    templateValidation,
    isValid
  }: {
    pageData: PageData
    templateMetadata: ResolvedTemplateMetadata
    templateValidation: ReturnType<typeof validatePageTemplate>
    isValid: boolean
  }): Prisma.InputJsonValue {
    const rootDetection = pageData.detectedComponents?.[0]
    const llmMeta = (rootDetection?.metadata as any)?.pageMetadata
    const extractedMetadata = extractPageMetadata(pageData.detectedComponents)
    const normalizedIssues = templateValidation.issues.map(issue => ({
      type: issue.type,
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
      path: issue.path,
      details: issue.details
    }))
    const issueSummary = {
      errors: normalizedIssues.filter(issue => issue.severity === 'error').length,
      warnings: normalizedIssues.filter(issue => issue.severity === 'warning').length
    }
    const timestamp = new Date().toISOString()
    // Determine validation status based on error severity
    const hasRegionIssues = normalizedIssues.some(
      issue => issue.severity === 'error' && issue.code.startsWith('region.')
    )
    const hasCriticalIssues = normalizedIssues.some(
      issue => issue.severity === 'error' && !issue.code.startsWith('region.')
    )
    const validationStatus = hasCriticalIssues ? 'invalid' : hasRegionIssues ? 'has-warnings' : 'valid'
    const importStatus = isValid ? 'ready' : hasRegionIssues ? 'ready-with-warnings' : 'invalid'

    const metadataPayload: Record<string, unknown> = {
      seo: {
        title: llmMeta?.title,
        description: llmMeta?.description,
        keywords: llmMeta?.keywords,
        canonicalUrl: llmMeta?.canonicalUrl,
        robots: llmMeta?.robots,
        author: llmMeta?.author,
        language: llmMeta?.language,
        publishedDate: llmMeta?.publishedDate,
        modifiedDate: llmMeta?.modifiedDate
      },
      openGraph: llmMeta?.openGraph,
      twitterCard: llmMeta?.twitterCard,
      classification: {
        pageType: llmMeta?.pageType,
        purpose: llmMeta?.primaryPurpose,
        audience: llmMeta?.targetAudience
      },
      visual: {
        favicon: llmMeta?.favicon,
        logo: llmMeta?.logo,
        primaryColors: llmMeta?.primaryColors,
        fonts: llmMeta?.fonts,
        style: llmMeta?.visualStyle
      },
      social: llmMeta?.socialLinks,
      structuredData: llmMeta?.schemaOrgData,
      sitemap: (rootDetection?.metadata as any)?.sitemap,
      description: extractedMetadata?.description,
      keywords: extractedMetadata?.keywords,
      openGraphCompat: extractedMetadata?.openGraph,
      ...(isValid ? {} : { status: 'import-invalid' }),
      importSource: pageData.url,
      importTimestamp: timestamp,
      importStatus,
      importValidatedAt: timestamp,
      importIssues: normalizedIssues,
      importIssueSummary: issueSummary,
      // Validation status for UI to display
      validationStatus,
      validationIssues: normalizedIssues.length > 0
        ? normalizedIssues.map(issue => ({
            code: issue.code,
            message: issue.message,
            severity: issue.severity,
            type: issue.type
          }))
        : undefined,
      template: {
        key: templateMetadata.templateKey,
        name: templateMetadata.templateName,
        category: templateMetadata.category,
        isHomeEligible: templateMetadata.isHomeEligible,
        source: templateMetadata.source,
        requestedKey: templateMetadata.requestedKey,
        confidence: templateMetadata.confidence,
        reason: templateMetadata.reason,
        enforcedHome: templateMetadata.enforcedHome,
        props: (templateValidation.props ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        issues: templateValidation.issues,
        resolvedAt: timestamp
      }
    }

    return metadataPayload as Prisma.InputJsonValue
  }

  private async upsertPage({
    tx,
    websiteId,
    contentTypeId,
    pageData,
    prepared
  }: {
    tx: Prisma.TransactionClient
    websiteId: string
    contentTypeId: string
    pageData: PageData
    prepared: PreparedPage
  }): Promise<WebsitePage> {
    const existing = await tx.websitePage.findFirst({
      where: {
        websiteId,
        metadata: {
          path: ['importSource'],
          equals: pageData.url
        }
      }
    })

    const baseData = {
      type: prepared.pageType,
      title: prepared.pageTitle,
      content: prepared.pageContent,
      metadata: prepared.metadata,
      templateKey: prepared.templateMetadata.templateKey,
      templateProps: (prepared.templateValidation.props ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      contentTypeId: prepared.contentTypeId ?? contentTypeId,
      status: prepared.isValid ? 'draft' : 'invalid'
    }

    if (existing) {
      return tx.websitePage.update({
        where: { id: existing.id },
        data: baseData
      })
    }

    return tx.websitePage.create({
      data: {
        websiteId,
        ...baseData
      }
    })
  }

  private async resolveParentPage(url: string, websiteId: string): Promise<string | null> {
    if (!url || !websiteId) {
      return null
    }

    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)

      if (pathParts.length <= 1) {
        return null
      }

      const parentPath = pathParts.slice(0, -1).join('/')
      const parentUrl = `${urlObj.protocol}//${urlObj.host}/${parentPath}`

      const parentPage = await this.prisma.websitePage.findFirst({
        where: {
          websiteId,
          metadata: {
            path: ['importSource'],
            equals: parentUrl
          }
        }
      })

      return parentPage?.id || null
    } catch (error) {
      console.warn('Failed to resolve parent page:', error)
      return null
    }
  }

  private calculateMaxDepth(components: DetectionResult[]): number {
    return this.componentBuilder.calculateMaxDepth(components)
  }

  private buildHierarchicalTree(components: ComponentInstance[]): ComponentInstance[] {
    return this.componentBuilder.buildHierarchicalTree(components)
  }

  private extractComponentProps(
    detection: DetectionResult,
    componentType: ComponentType
  ): Record<string, any> {
    return extractComponentProps(detection, componentType)
  }

  private formatPathSegment(segment: string): string {
    if (!segment) {
      return ''
    }
    const cleaned = segment
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleaned) {
      return ''
    }

    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private deduplicateComponents(components: ComponentInstance[]): ComponentInstance[] {
    return deduplicateComponents(components)
  }

  private extractKeywordsFromContent(
    detectionResults: DetectionResult[]
  ): string[] {
    return extractKeywordsFromContent(detectionResults)
  }

  private determinePageType(pageData: PageData | null): 'page' | 'folder' {
    if (!pageData) {
      return 'page'
    }
    return determinePageTypeUtil(pageData)
  }
}
