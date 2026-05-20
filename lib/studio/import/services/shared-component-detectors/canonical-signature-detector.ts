import { PrismaClient, WebsiteSharedComponent, WebsitePage, Prisma } from '@/lib/generated/prisma'
import { ComponentInstance } from '../interfaces/page-builder-service.interface'
import { ComponentPattern } from '../interfaces/component-type-extractor.interface'
import {
  ISharedComponentDetector,
  SharedComponentCandidate,
  SharedComponentConfig
} from '../interfaces/shared-component-detector.interface'

interface ComponentOccurrence {
  component: ComponentInstance
  pageId: string
  pageUrl: string
  position: {
    depth: number
    order: number
    isTop: boolean
    isBottom: boolean
  }
}

interface CanonicalSignature {
  typeNorm: string
  structureHash: string
  contentHash: string
  contentTokens: string[] // Store actual tokens for similarity comparison
  placement: string
  childrenTypes: string[]
  counts: Record<string, string>
}

/**
 * Canonical Signature Shared Component Detector
 *
 * This detector implements canonical hashing as described in the shared component detection PRD.
 * It normalizes type (map headers, footers, navigation variants), structural features
 * (child types, counts), and text digests, then clusters by hash with tolerance for minor differences.
 */
export class CanonicalSignatureSharedComponentDetector implements ISharedComponentDetector {
  private readonly prisma: PrismaClient
  private signatureCache = new Map<string, CanonicalSignature>()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Detect components that appear across multiple pages using canonical signature hashing
   */
  async detectShared(
    pages: WebsitePage[],
    config: SharedComponentConfig = {}
  ): Promise<SharedComponentCandidate[]> {
    const { minOccurrences = 2, categories } = config
    const allowedCategories = Array.isArray(categories) && categories.length > 0
      ? categories.map(cat => cat.toLowerCase())
      : ['header', 'footer', 'navigation']

    const occurrences = this.extractComponentOccurrences(pages)
    if (occurrences.length === 0) return []

    // Build canonical signatures for all components
    const signatures = new Map<string, Array<{ occurrence: ComponentOccurrence; signature: CanonicalSignature }>>()

    for (const occurrence of occurrences) {
      const signature = this.buildCanonicalSignature(occurrence.component)
      const signatureKey = this.getSignatureKey(signature)

      if (!signatures.has(signatureKey)) {
        signatures.set(signatureKey, [])
      }
      signatures.get(signatureKey)!.push({ occurrence, signature })
    }

    const candidates: SharedComponentCandidate[] = []

    // Process each signature cluster
    for (const [signatureKey, items] of signatures) {
      if (items.length < minOccurrences) continue

      const uniquePages = Array.from(new Set(items.map(item => String(item.occurrence.pageId))))
      if (uniquePages.length < minOccurrences) continue

      // Calculate similarity metrics for the cluster
      const avgSimilarity = this.calculateAverageSimilarity(items.map(item => item.signature))
      const representativeSignature = items[0].signature

      // Only include high-quality clusters
      if (avgSimilarity < 0.6) continue

      // Create candidate from cluster
      const representativeComponent = items[0].occurrence.component
      const category = this.identifyComponentCategory(representativeComponent)
      if (!allowedCategories.includes(category)) {
        continue
      }

      const candidate: SharedComponentCandidate = {
        pattern: this.createPatternFromComponent(representativeComponent, items.length, avgSimilarity),
        instances: items.map(item => item.occurrence.component),
        pages: uniquePages,
        similarity: avgSimilarity,
        name: this.generateComponentName(category, candidates.filter(c => c.category === category).length),
        category
      }

      if (this.validateSharedComponent(candidate)) {
        candidates.push(candidate)
      }
    }

    return candidates.sort((a, b) => (b.pages.length - a.pages.length) || (b.similarity - a.similarity))
  }

  /**
   * Calculate similarity between two component instances using canonical signatures
   */
  calculateSimilarity(comp1: ComponentInstance, comp2: ComponentInstance): number {
    const sig1 = this.buildCanonicalSignature(comp1)
    const sig2 = this.buildCanonicalSignature(comp2)
    return this.calculateSignatureSimilarity(sig1, sig2)
  }

  /**
   * Create WebsiteSharedComponent from pattern
   */
  async createSharedComponent(
    candidate: SharedComponentCandidate,
    websiteId: string,
    componentTypeId: string
  ): Promise<WebsiteSharedComponent> {
    const canonical = this.getCanonicalPropsFromInstance(candidate.instances[0])
    const config = {
      type: candidate.pattern.type,
      category: candidate.category,
      defaultProps: canonical,
      pattern: {
        structure: candidate.pattern.structure,
        frequency: candidate.pattern.frequency,
        confidence: candidate.pattern.confidence
      }
    }

    return this.prisma.websiteSharedComponent.create({
      data: {
        websiteId,
        websiteComponentTypeId: componentTypeId,
        name: candidate.name,
        config: config as Prisma.InputJsonValue,
        usageCount: candidate.pages.length
      }
    })
  }

  /**
   * Create shared component using specific Prisma client (for transactions)
   */
  private async createSharedComponentWithClient(
    candidate: SharedComponentCandidate,
    websiteId: string,
    componentTypeId: string,
    prismaClient: any
  ): Promise<WebsiteSharedComponent> {
    const canonical = this.getCanonicalPropsFromInstance(candidate.instances[0])
    const config = {
      type: candidate.pattern.type,
      category: candidate.category,
      defaultProps: canonical,
      pattern: {
        structure: candidate.pattern.structure,
        frequency: candidate.pattern.frequency,
        confidence: candidate.pattern.confidence
      }
    }

    return prismaClient.websiteSharedComponent.create({
      data: {
        websiteId,
        websiteComponentTypeId: componentTypeId,
        name: candidate.name,
        config: config as Prisma.InputJsonValue,
        usageCount: candidate.pages.length
      }
    })
  }

  /**
   * Identify component category (header, footer, navigation, etc.)
   */
  identifyComponentCategory(component: ComponentInstance): string {
    const type = component.type.toLowerCase()
    const props = component.props || {}

    // Direct type mapping
    if (type.includes('header')) return 'header'
    if (type.includes('footer')) return 'footer'
    if (type.includes('nav')) return 'navigation'
    if (type.includes('sidebar')) return 'sidebar'
    if (type.includes('menu')) return 'navigation'

    // Props-based detection
    const className = (props.className || '').toLowerCase()
    if (className.includes('header')) return 'header'
    if (className.includes('footer')) return 'footer'
    if (className.includes('nav')) return 'navigation'

    // Position-based heuristics
    if (this.isLikelyShared(component)) {
      return 'content'
    }

    return 'content'
  }

  /**
   * Generate name for shared component
   */
  generateComponentName(category: string, index: number): string {
    const categoryNames: Record<string, string> = {
      header: 'Header',
      footer: 'Footer',
      navigation: 'Navigation',
      sidebar: 'Sidebar',
      content: 'Content Block'
    }

    const baseName = categoryNames[category] || 'Component'

    if (index === 0) {
      return category === 'header' ? 'Main Header' :
             category === 'footer' ? 'Site Footer' :
             category === 'navigation' ? 'Main Navigation' :
             baseName
    }

    return `${baseName} ${index + 1}`
  }

  /**
   * Check if component is likely to be shared (header/footer patterns)
   */
  isLikelyShared(component: ComponentInstance): boolean {
    const type = component.type.toLowerCase()
    const props = component.props || {}

    // Type-based likelihood
    if (['header', 'footer', 'nav', 'navigation', 'menu'].some(t => type.includes(t))) {
      return true
    }

    // Props-based likelihood
    const className = (props.className || '').toLowerCase()
    if (['header', 'footer', 'nav', 'navbar', 'menu'].some(c => className.includes(c))) {
      return true
    }

    // Structure-based likelihood
    const hasNavLinks = component.children?.some(child =>
      child.type.toLowerCase().includes('link') ||
      child.type.toLowerCase().includes('button')
    )

    return hasNavLinks || false
  }

  /**
   * Group similar components across pages
   */
  groupSimilarComponents(
    components: ComponentInstance[],
    threshold = 0.85
  ): ComponentInstance[][] {
    const groups: ComponentInstance[][] = []
    const processed = new Set<string>()

    for (const component of components) {
      if (processed.has(component.id)) continue

      const group = [component]
      processed.add(component.id)

      for (const other of components) {
        if (processed.has(other.id)) continue
        if (this.calculateSimilarity(component, other) >= threshold) {
          group.push(other)
          processed.add(other.id)
        }
      }

      if (group.length > 1) {
        groups.push(group)
      }
    }

    return groups
  }

  /**
   * Update page content to reference shared components
   */
  async updatePageReferences(
    page: WebsitePage,
    sharedComponents: WebsiteSharedComponent[]
  ): Promise<WebsitePage> {
    const pageContent = page.content as { components?: ComponentInstance[] }
    if (!pageContent?.components) return page

    const seen = new Set<string>()
    const updatedComponents = this.rewriteComponentsArray(pageContent.components, sharedComponents, seen)
    const updatedContent = { ...pageContent, components: updatedComponents }

    return this.prisma.websitePage.update({
      where: { id: page.id },
      data: { content: updatedContent as unknown as Prisma.InputJsonValue }
    })
  }

  /**
   * Update page content to reference shared components using specific Prisma client (for transactions)
   */
  private async updatePageReferencesWithClient(
    page: WebsitePage,
    sharedComponents: WebsiteSharedComponent[],
    prismaClient: any
  ): Promise<WebsitePage> {
    const pageContent = page.content as { components?: ComponentInstance[] }
    if (!pageContent?.components) return page

    const seen = new Set<string>()
    const updatedComponents = this.rewriteComponentsArray(pageContent.components, sharedComponents, seen)
    const updatedContent = { ...pageContent, components: updatedComponents }

    return prismaClient.websitePage.update({
      where: { id: page.id },
      data: { content: updatedContent as unknown as Prisma.InputJsonValue }
    })
  }

  /**
   * Calculate usage count for shared component
   */
  calculateUsageCount(sharedComponentId: string, pages: WebsitePage[]): number {
    let count = 0

    for (const page of pages) {
      const pageContent = page.content as { components?: Array<ComponentInstance & { sharedComponentId?: string }> }
      if (!pageContent?.components) continue

      const hasSharedComponent = pageContent.components.some((component) =>
        component.sharedComponentId === sharedComponentId
      )

      if (hasSharedComponent) count++
    }

    return count
  }

  /**
   * Validate shared component configuration
   */
  validateSharedComponent(component: SharedComponentCandidate): boolean {
    if (component.pages.length < 2) return false
    if (!component.pattern?.type) return false
    if (!component.instances?.length) return false
    if (component.similarity < 0.5) return false
    if (!component.name?.trim()) return false

    return true
  }

  /**
   * Create shared components and update page references in a transaction
   */
  async createAndUpdateInTransaction(
    candidates: SharedComponentCandidate[],
    websiteId: string,
    componentTypeId: string,
    pages: WebsitePage[]
  ): Promise<{
    sharedComponents: WebsiteSharedComponent[]
    updatedPages: WebsitePage[]
  }> {
    return await this.prisma.$transaction(async (tx) => {
      const sharedComponents: WebsiteSharedComponent[] = []
      const updatedPages: WebsitePage[] = []

      // Create shared components
      for (const candidate of candidates) {
        if (!this.validateSharedComponent(candidate)) continue

        const sharedComponent = await this.createSharedComponentWithClient(candidate, websiteId, componentTypeId, tx)
        sharedComponents.push(sharedComponent)
      }

      // Update page references
      for (const page of pages) {
        const updatedPage = await this.updatePageReferencesWithClient(page, sharedComponents, tx)
        if (updatedPage) {
          updatedPages.push(updatedPage)
        }
      }

      return {
        sharedComponents,
        updatedPages
      }
    })
  }

  // Private helper methods

  private extractComponentOccurrences(pages: WebsitePage[]): ComponentOccurrence[] {
    const occurrences: ComponentOccurrence[] = []

    for (const page of pages) {
      const pageContent = page.content as { components?: ComponentInstance[] }
      if (!pageContent?.components) continue

      const components = pageContent.components as ComponentInstance[]

      components.forEach((component, index) => {
        const totalComponents = components.length
        const depth = this.calculateComponentDepth(component, components)

        occurrences.push({
          component,
          pageId: page.id,
          pageUrl: (page as any).url || (page.metadata as any)?.importSource || page.title || 'Unknown',
          position: {
            depth,
            order: index,
            isTop: index < totalComponents * 0.2,
            isBottom: index > totalComponents * 0.8
          }
        })
      })
    }

    return occurrences
  }

  private buildCanonicalSignature(component: ComponentInstance): CanonicalSignature {
    // Include props in cache key to ensure different prop snapshots generate different signatures
    const propsHash = this.hashObject(component.props || {})
    const cacheKey = component.id + component.type + propsHash

    if (this.signatureCache.has(cacheKey)) {
      return this.signatureCache.get(cacheKey)!
    }

    const props = (component.props || {}) as Record<string, any>

    // Normalize type
    const typeNorm = this.normalizeType(component.type)

    // Build structural features
    const counts: Record<string, string> = {}
    const countKeys = ['menuItemCount', 'linkCount', 'buttonCount']
    countKeys.forEach(key => {
      const value = props[key]
      if (value !== undefined) {
        counts[key] = this.normalizeCount(value)
      }
    })

    // Extract children types (sorted for consistency)
    const childrenTypes = Array.isArray(component.children)
      ? component.children.map(child => this.normalizeType(child.type)).sort()
      : []

    // Structural hash - includes type, children types, and counts
    const structureData = {
      type: typeNorm,
      childrenTypes,
      counts,
      childCount: component.children?.length || 0
    }
    const structureHash = this.hashObject(structureData)

    // Content hash - semantic tokens and text content
    const contentTokens = this.extractContentTokens(props)
    const contentHash = this.hashContent(contentTokens)

    // Placement
    const placement = (props.region && typeof props.region === 'string')
      ? props.region
      : (props.placementBucket || 'middle')

    const signature: CanonicalSignature = {
      typeNorm,
      structureHash,
      contentHash,
      contentTokens, // Store actual tokens for similarity comparison
      placement,
      childrenTypes,
      counts
    }

    this.signatureCache.set(cacheKey, signature)
    return signature
  }

  private normalizeType(type: string): string {
    const s = (type || '').toLowerCase()
    if (/(nav|navbar|menu)/.test(s)) return 'navigation'
    if (/(subscribe|newsletter)/.test(s)) return 'subscribe'
    if (/(cta|call-to-action)/.test(s)) return 'cta'
    if (/(header|head)/.test(s)) return 'header'
    if (/(footer|foot)/.test(s)) return 'footer'
    return s
  }

  private normalizeCount(value: any): string {
    const num = parseInt(String(value), 10)
    if (isNaN(num) || num <= 0) return '0'
    if (num <= 3) return '1-3'
    if (num <= 8) return '4-8'
    return '9+'
  }

  private extractContentTokens(props: Record<string, any>): string[] {
    const tokens: string[] = []

    // Extract semantic tokens
    if (Array.isArray(props.semanticTokens)) {
      props.semanticTokens.forEach((token: any) => {
        if (typeof token === 'string') {
          tokens.push(token.toLowerCase().trim())
        }
      })
    }

    // Extract text content
    const textFields = ['text', 'content', 'title', 'label', 'alt']
    textFields.forEach(field => {
      if (props[field] && typeof props[field] === 'string') {
        // Simple tokenization - split on whitespace and clean
        const words = props[field].toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2) // Skip very short words
        tokens.push(...words)
      }
    })

    // Remove duplicates and sort
    return Array.from(new Set(tokens)).sort()
  }

  private hashObject(obj: any): string {
    // Use deterministic stringification that preserves all nested properties
    const str = this.deterministicStringify(obj)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Creates a deterministic string representation of an object with all nested properties sorted
   * This ensures that objects with the same content but different key order produce identical strings
   */
  private deterministicStringify(obj: any): string {
    if (obj === null || obj === undefined) {
      return 'null'
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj)
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.deterministicStringify(item)).join(',') + ']'
    }

    // Sort object keys recursively
    const sortedKeys = Object.keys(obj).sort()
    const keyValuePairs = sortedKeys.map(key => {
      const value = this.deterministicStringify(obj[key])
      return `"${key}":${value}`
    })

    return '{' + keyValuePairs.join(',') + '}'
  }

  private hashContent(tokens: string[]): string {
    // Content hash that's more tolerant of minor variations
    // Sort tokens to make order less important for similarity
    const sortedTokens = [...tokens].sort()

    // Take first 10 significant tokens, but normalize them
    const normalizedTokens = sortedTokens.slice(0, 10).map(token => {
      // Normalize common variations
      return token.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10)
    }).filter(token => token.length > 2) // Remove very short tokens

    return this.hashObject(normalizedTokens)
  }

  private getSignatureKey(signature: CanonicalSignature): string {
    // Group signatures by type and structure only - allow content and placement variations
    // Placement differences are handled in similarity scoring, not in the key
    // This prevents splitting identical components due to inconsistent placement metadata
    return `${signature.typeNorm}:${signature.structureHash}`
  }

  private calculateSignatureSimilarity(sig1: CanonicalSignature, sig2: CanonicalSignature): number {
    if (sig1.typeNorm !== sig2.typeNorm) return 0

    // Structure similarity (most important)
    const structureSimilarity = sig1.structureHash === sig2.structureHash ? 1 : 0

    // Content similarity - use Jaccard similarity on token sets
    const contentSimilarity = this.calculateContentSimilarity(sig1.contentHash, sig2.contentHash, sig1.contentTokens, sig2.contentTokens)

    // Placement similarity
    const placementSimilarity = sig1.placement === sig2.placement ? 1 : 0

    // Weighted combination - lean more on structure, allow textual variance
    return (
      structureSimilarity * 0.7 +
      contentSimilarity * 0.2 +
      placementSimilarity * 0.1
    )
  }

  private calculateAverageSimilarity(signatures: CanonicalSignature[]): number {
    if (signatures.length < 2) return 1

    let totalSimilarity = 0
    let comparisons = 0

    for (let i = 0; i < signatures.length; i++) {
      for (let j = i + 1; j < signatures.length; j++) {
        totalSimilarity += this.calculateSignatureSimilarity(signatures[i], signatures[j])
        comparisons++
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0
  }

  private calculateContentSimilarity(hash1: string, hash2: string, tokens1?: string[], tokens2?: string[]): number {
    // Exact match = 1.0
    if (hash1 === hash2) return 1.0

    // Use Jaccard similarity on token sets if available
    if (tokens1 && tokens2 && tokens1.length > 0 && tokens2.length > 0) {
      return this.calculateJaccardSimilarity(tokens1, tokens2)
    }

    // Fallback to hash comparison (shouldn't happen with our new approach)
    const maxLength = Math.max(hash1.length, hash2.length)
    let matchingChars = 0

    for (let i = 0; i < maxLength; i++) {
      if (i < hash1.length && i < hash2.length && hash1[i] === hash2[i]) {
        matchingChars++
      }
    }

    return matchingChars / maxLength
  }

  private calculateJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
    // Jaccard similarity: intersection / union
    const set1 = new Set(tokens1)
    const set2 = new Set(tokens2)

    const intersection = new Set([...set1].filter(token => set2.has(token)))
    const union = new Set([...set1, ...set2])

    if (union.size === 0) return 1.0 // Both empty sets are identical

    const jaccardSimilarity = intersection.size / union.size

    // For very small sets, add a small boost to account for minor variations
    // This helps with cases like "Welcome to Our Site" vs "Welcome to Site 0"
    if (tokens1.length <= 5 && tokens2.length <= 5 && jaccardSimilarity >= 0.4) {
      return Math.min(jaccardSimilarity + 0.2, 0.9)
    }

    return jaccardSimilarity
  }

  private createPatternFromComponent(component: ComponentInstance, frequency: number, confidence: number): ComponentPattern {
    const structure = {
      hasText: this.hasTextContent(component),
      hasImage: this.hasImageContent(component),
      hasButton: this.hasButtonContent(component),
      hasInput: this.hasInputContent(component),
      childCount: component.children?.length || 0,
      depth: 0 // Will be calculated by caller if needed
    }

    return {
      type: component.type,
      category: this.identifyComponentCategory(component),
      structure,
      instances: [], // Will be populated by caller
      frequency,
      confidence,
      defaultConfig: this.extractStructuralProps(component),
      placeholderData: {}
    }
  }

  private hasTextContent(component: ComponentInstance): boolean {
    const props = component.props || {}
    return !!(props.text || props.content || props.label || props.title)
  }

  private hasImageContent(component: ComponentInstance): boolean {
    const props = component.props || {}
    return !!(props.src || props.image || props.backgroundImage)
  }

  private hasButtonContent(component: ComponentInstance): boolean {
    return component.type.toLowerCase().includes('button') ||
           !!(component.children?.some(c => c.type.toLowerCase().includes('button')))
  }

  private hasInputContent(component: ComponentInstance): boolean {
    return component.type.toLowerCase().includes('input') ||
           !!(component.children?.some(c => c.type.toLowerCase().includes('input')))
  }

  private extractStructuralProps(component: ComponentInstance): Record<string, unknown> {
    const props = (component.props || {}) as Record<string, unknown>
    const structural: Record<string, unknown> = {}

    const structuralKeys = [
      'className', 'layout', 'variant', 'size', 'position', 'region', 'placementBucket',
      'menuItemCount', 'linkCount', 'buttonCount', 'hasLogo', 'hasSearch', 'hasForm', 'hasSubscribe'
    ]

    structuralKeys.forEach(key => {
      if (props[key] !== undefined) {
        structural[key] = props[key]
      }
    })

    return structural
  }

  private calculateComponentDepth(component: ComponentInstance, allComponents: ComponentInstance[]): number {
    let depth = 0
    let currentParentId = component.parentId

    while (currentParentId) {
      const parent = allComponents.find(c => c.id === currentParentId)
      if (!parent) break
      depth++
      currentParentId = parent.parentId
    }

    return depth
  }

  private getCanonicalPropsFromInstance(component: ComponentInstance): Record<string, unknown> {
    const source = (component?.props && typeof component.props === 'object') ? component.props as Record<string, unknown> : {}
    const canonical: Record<string, unknown> = { ...source }

    // Remove detection-time/transient fields
    delete (canonical as any).bounds
    delete (canonical as any).confidence
    delete (canonical as any).metadata

    return canonical
  }

  private rewriteComponentsArray(
    components: ComponentInstance[],
    sharedComponents: WebsiteSharedComponent[],
    seenShared: Set<string>
  ): ComponentInstance[] {
    if (!Array.isArray(components)) return []

    const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value)

    const cloneMetadata = (value: unknown): Record<string, unknown> | undefined => {
      if (!isPlainRecord(value)) {
        return undefined
      }
      return { ...value }
    }

    const resolveRegionFromProps = (props: Record<string, unknown> | undefined): string | undefined => {
      if (!props) {
        return undefined
      }
      const direct = typeof props.region === 'string' ? props.region.trim() : undefined
      if (direct) {
        return direct
      }
      const meta = props.metadata
      if (isPlainRecord(meta) && typeof meta.region === 'string') {
        const metadataRegion = meta.region.trim()
        return metadataRegion ? metadataRegion : undefined
      }
      return undefined
    }

    const resolvePlacementBucket = (props: Record<string, unknown> | undefined): string | undefined => {
      if (!props) {
        return undefined
      }
      const bucket = typeof props.placementBucket === 'string' ? props.placementBucket.trim() : undefined
      return bucket ? bucket : undefined
    }

    const derivePlacementBucketFromRegion = (region: string | undefined): string | undefined => {
      if (!region) {
        return undefined
      }
      if (region === 'header') {
        return 'top'
      }
      if (region === 'footer') {
        return 'bottom'
      }
      return undefined
    }

    const sharedList = sharedComponents.map(sc => ({
      id: sc.id,
      typeId: sc.websiteComponentTypeId,
      config: sc.config as { type: string; defaultProps?: Record<string, unknown> }
    }))

    const result: ComponentInstance[] = []

    for (const comp of components) {
      let rewritten: ComponentInstance | null = comp

      for (const s of sharedList) {
        if (this.componentMatchesShared(comp, s.config)) {
          const sid = s.id
          if (seenShared.has(sid)) {
            rewritten = null
            break
          }
          seenShared.add(sid)

          const existingProps = isPlainRecord(comp.props) ? (comp.props as Record<string, unknown>) : undefined
          const sharedDefaults = isPlainRecord(s.config?.defaultProps)
            ? (s.config!.defaultProps as Record<string, unknown>)
            : undefined

          const resolvedRegion =
            resolveRegionFromProps(existingProps) ?? resolveRegionFromProps(sharedDefaults)
          const resolvedPlacementBucket =
            resolvePlacementBucket(existingProps) ??
            resolvePlacementBucket(sharedDefaults) ??
            derivePlacementBucketFromRegion(resolvedRegion)
          const metadata =
            cloneMetadata(existingProps?.metadata) ??
            cloneMetadata(sharedDefaults?.metadata)

          const nextProps: Record<string, unknown> = { sharedComponentId: sid }

          if (resolvedRegion) {
            nextProps.region = resolvedRegion
          }

          if (resolvedPlacementBucket) {
            nextProps.placementBucket = resolvedPlacementBucket
          }

          if (metadata) {
            if (resolvedRegion) {
              metadata.region = resolvedRegion
            }
            nextProps.metadata = metadata
          }

          rewritten = {
            id: comp.id,
            type: comp.type,
            typeId: s.typeId,
            parentId: comp.parentId ?? null,
            position: comp.position ?? 0,
            props: nextProps,
            children: comp.children,
            ...( { isShared: true, sharedComponentId: sid } as any )
          } as unknown as ComponentInstance
          break
        }
      }

      if (!rewritten) continue

      if (Array.isArray((rewritten as any).children)) {
        (rewritten as any).children = this.rewriteComponentsArray((rewritten as any).children!, sharedComponents, seenShared)
      }

      result.push(rewritten)
    }

    result.forEach((c, idx) => { (c as any).position = idx })
    return result
  }

  private componentMatchesShared(component: ComponentInstance, sharedConfig: { type: string; defaultProps?: Record<string, unknown> }): boolean {
    if (this.normalizeType(component.type) !== this.normalizeType(sharedConfig.type)) return false

    const componentProps = (component.props || {}) as Record<string, unknown>
    const referenceProps = (sharedConfig.defaultProps && typeof sharedConfig.defaultProps === 'object')
      ? (sharedConfig.defaultProps as Record<string, unknown>)
      : {}

    const componentSig = this.buildCanonicalSignature(component)
    const referenceSig = this.buildCanonicalSignature({
      ...component,
      props: referenceProps
    } as ComponentInstance)

    const similarity = this.calculateSignatureSimilarity(componentSig, referenceSig)
    return similarity >= 0.6 // Align with cluster threshold
  }
}
