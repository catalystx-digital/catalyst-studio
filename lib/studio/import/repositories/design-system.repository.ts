/**
 * Design System Repository
 *
 * Handles CRUD operations for WebsiteDesignSystem entities
 * @module design-system.repository
 */

import { PrismaClient, WebsiteDesignSystem } from '@/lib/generated/prisma'
import { DesignSystem, CapturedDesignSystem } from '../types/design-system.types'
import { type ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'
import { getDesignSystemVariables, getNormalizedDesignSystem } from '@/lib/studio/design-system/design-system-reader'

export interface CreateDesignSystemInput {
  websiteId: string
  designConceptId: string
  version?: string
  tokens: DesignSystem | ShadcnDesignSystemTokens
  sourceJobId?: string
  markPreviousInactive?: boolean
}

export interface CreateShadcnDesignSystemInput {
  websiteId: string
  designConceptId: string
  version?: string
  tokens: ShadcnDesignSystemTokens
  sourceJobId?: string
  markPreviousInactive?: boolean
}

export interface UpdateDesignSystemInput {
  version?: string
  tokens?: DesignSystem | ShadcnDesignSystemTokens
  sourceJobId?: string
}

export interface DesignSystemListOptions {
  websiteId?: string
  designConceptId?: string
  sourceJobId?: string
  version?: string
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt' | 'version'
  orderDirection?: 'asc' | 'desc'
}

export class DesignSystemRepository {
  private prisma: PrismaClient

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient()
  }

  /**
   * Create a new design system snapshot for a concept
   * Marks the previous snapshot as non-current but keeps history intact
   */
  async create(input: CreateDesignSystemInput): Promise<WebsiteDesignSystem> {
    const {
      websiteId,
      designConceptId,
      version = '1.0.0',
      tokens,
      sourceJobId,
      markPreviousInactive = true
    } = input

    if (markPreviousInactive) {
      await this.prisma.websiteDesignSystem.updateMany({
        where: { designConceptId, isCurrent: true },
        data: { isCurrent: false }
      })
    }

    const designSystem = await this.prisma.websiteDesignSystem.create({
      data: {
        websiteId,
        designConceptId,
        version,
        tokens: tokens as any, // Prisma JSON field
        sourceJobId,
        isCurrent: true
      }
    })

    return designSystem
  }

  /**
   * Upsert design system (create or update)
   */
  async upsert(input: CreateDesignSystemInput): Promise<WebsiteDesignSystem> {
    const { websiteId, designConceptId, version = '1.0.0', tokens, sourceJobId } = input

    const existing = await this.findLatestByConceptId(designConceptId)

    if (existing) {
      return this.update(existing.id, {
        version,
        tokens,
        sourceJobId
      })
    } else {
      return this.create({
        websiteId,
        designConceptId,
        version,
        tokens,
        sourceJobId
      })
    }
  }

  /**
   * Update an existing design system
   */
  async update(id: string, input: UpdateDesignSystemInput): Promise<WebsiteDesignSystem> {
    const { version, tokens, sourceJobId } = input

    const updateData: any = {}
    if (version !== undefined) updateData.version = version
    if (tokens !== undefined) updateData.tokens = tokens as any
    if (sourceJobId !== undefined) updateData.sourceJobId = sourceJobId

    const designSystem = await this.prisma.websiteDesignSystem.update({
      where: { id },
      data: updateData
    })

    return designSystem
  }

  /**
   * Find a design system by ID
   */
  async findById(id: string): Promise<WebsiteDesignSystem | null> {
    return this.prisma.websiteDesignSystem.findUnique({
      where: { id },
      include: {
        website: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        importJob: {
          select: {
            id: true,
            url: true,
            status: true,
            createdAt: true
          }
        }
      }
    })
  }

  /**
   * Find the latest design system for a website or concept
   */
  async findLatestByWebsiteId(
    websiteId: string,
    designConceptId?: string
  ): Promise<WebsiteDesignSystem | null> {
    const where: any = { websiteId, isCurrent: true }
    if (designConceptId) {
      where.designConceptId = designConceptId
    }

    return this.prisma.websiteDesignSystem.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.defaultIncludes()
    })
  }

  async findLatestByConceptId(designConceptId: string): Promise<WebsiteDesignSystem | null> {
    return this.prisma.websiteDesignSystem.findFirst({
      where: { designConceptId, isCurrent: true },
      orderBy: { createdAt: 'desc' },
      include: this.defaultIncludes()
    })
  }

  /**
   * Find design systems with filters
   */
  async findMany(options: DesignSystemListOptions = {}): Promise<WebsiteDesignSystem[]> {
    const {
      websiteId,
      designConceptId,
      sourceJobId,
      version,
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc'
    } = options

    const where: any = {}
    if (websiteId) where.websiteId = websiteId
    if (designConceptId) where.designConceptId = designConceptId
    if (sourceJobId) where.sourceJobId = sourceJobId
    if (version) where.version = version

    const orderByField: any = {}
    orderByField[orderBy] = orderDirection

    return this.prisma.websiteDesignSystem.findMany({
      where,
      orderBy: orderByField,
      skip: offset,
      take: limit,
      include: this.defaultIncludes()
    })
  }

  /**
   * Count design systems with filters
   */
  async count(options: Omit<DesignSystemListOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
    const { websiteId, designConceptId, sourceJobId, version } = options

    const where: any = {}
    if (websiteId) where.websiteId = websiteId
    if (designConceptId) where.designConceptId = designConceptId
    if (sourceJobId) where.sourceJobId = sourceJobId
    if (version) where.version = version

    return this.prisma.websiteDesignSystem.count({ where })
  }

  /**
   * Delete a design system by ID
   */
  async delete(id: string): Promise<void> {
    await this.prisma.websiteDesignSystem.delete({
      where: { id }
    })
  }

  /**
   * Delete all design systems for a website
   */
  async deleteByWebsiteId(websiteId: string): Promise<void> {
    await this.prisma.websiteDesignSystem.deleteMany({
      where: { websiteId }
    })
  }

  /**
   * Check if a website has a design system
   */
  async existsByWebsiteId(websiteId: string): Promise<boolean> {
    const count = await this.prisma.websiteDesignSystem.count({
      where: { websiteId }
    })
    return count > 0
  }

  /**
   * Get design system statistics
   */
  async getStatistics(): Promise<{
    total: number
    websitesWithDesignSystems: number
    averageVersion: string
    latestCreated: Date | null
  }> {
    const [total, websitesWithDesignSystems, latestResult] = await Promise.all([
      this.prisma.websiteDesignSystem.count(),
      this.prisma.websiteDesignSystem.groupBy({
        by: ['websiteId'],
        _count: true
      }).then(results => results.length),
      this.prisma.websiteDesignSystem.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ])

    // Get average version (simplified - could be improved with semantic version parsing)
    const versions = await this.prisma.websiteDesignSystem.findMany({
      select: { version: true }
    })
    const versionCounts = new Map<string, number>()
    versions.forEach(v => {
      versionCounts.set(v.version, (versionCounts.get(v.version) || 0) + 1)
    })
    const averageVersion = versionCounts.size > 0
      ? Array.from(versionCounts.entries())
          .sort(([, a], [, b]) => b - a)[0][0]
      : '1.0.0'

    return {
      total,
      websitesWithDesignSystems,
      averageVersion,
      latestCreated: latestResult?.createdAt || null
    }
  }

  /**
   * Create a captured design system from detection results
   */
  async createFromCaptured(
    websiteId: string,
    capturedDesignSystem: CapturedDesignSystem,
    sourceJobId?: string,
    designConceptId?: string
  ): Promise<WebsiteDesignSystem> {
    if (!designConceptId) {
      throw new Error('designConceptId is required when persisting captured design systems')
    }

    return this.create({
      websiteId,
      designConceptId,
      tokens: capturedDesignSystem.designSystem,
      sourceJobId
    })
  }

  /**
   * Create a design system from shadcn tokens (NEW simplified format)
   */
  async createFromShadcnTokens(
    input: CreateShadcnDesignSystemInput
  ): Promise<WebsiteDesignSystem> {
    const {
      websiteId,
      designConceptId,
      version = '2.0.0', // New format starts at 2.0
      tokens,
      sourceJobId,
      markPreviousInactive = true
    } = input

    if (markPreviousInactive) {
      await this.prisma.websiteDesignSystem.updateMany({
        where: { designConceptId, isCurrent: true },
        data: { isCurrent: false }
      })
    }

    const designSystem = await this.prisma.websiteDesignSystem.create({
      data: {
        websiteId,
        designConceptId,
        version,
        tokens: tokens as any, // Store new format directly
        sourceJobId,
        isCurrent: true
      }
    })

    return designSystem
  }

  /**
   * Get CSS variables from a design system (handles both old and new formats)
   */
  getCssVariables(designSystem: WebsiteDesignSystem): Record<string, string> {
    return getDesignSystemVariables(designSystem.tokens)
  }

  /**
   * Get normalized design system tokens (converts old format to new)
   */
  getNormalizedTokens(designSystem: WebsiteDesignSystem): ShadcnDesignSystemTokens {
    return getNormalizedDesignSystem(designSystem.tokens)
  }

  /**
   * Get design systems created from a specific import job
   */
  async findBySourceJobId(sourceJobId: string): Promise<WebsiteDesignSystem[]> {
    return this.findMany({ sourceJobId })
  }

  /**
   * Validate design system tokens before persisting
   */
  private validateDesignSystem(tokens: DesignSystem): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Basic validation
    if (!tokens.palette) errors.push('Palette is required')
    if (!tokens.typography) errors.push('Typography is required')
    if (!tokens.version) errors.push('Version is required')
    if (!tokens.metadata) errors.push('Metadata is required')

    // Palette validation
    if (tokens.palette) {
      if (!tokens.palette.primary || tokens.palette.primary.length === 0) {
        errors.push('Primary colors are required')
      }
    }

    // Typography validation
    if (tokens.typography) {
      if (!tokens.typography.heading || tokens.typography.heading.length === 0) {
        errors.push('Heading fonts are required')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Clean up old design systems (if implementing versioning in future)
   */
  async cleanupOldVersions(websiteId: string, keepLatest: number = 1): Promise<number> {
    const designSystems = await this.prisma.websiteDesignSystem.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' }
    })

    if (designSystems.length <= keepLatest) {
      return 0
    }

    const toDelete = designSystems.slice(keepLatest)
    await this.prisma.websiteDesignSystem.deleteMany({
      where: {
        id: {
          in: toDelete.map(ds => ds.id)
        }
      }
    })

    return toDelete.length
  }

  private defaultIncludes() {
    return {
      website: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      designConcept: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      importJob: {
        select: {
          id: true,
          url: true,
          status: true,
          createdAt: true
        }
      }
    }
  }
}
