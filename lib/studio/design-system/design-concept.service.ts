import { PrismaClient, WebsiteDesignConcept } from '@/lib/generated/prisma'
import { DesignConceptRepository } from './design-concept.repository'
import { DesignSystemRepository } from '@/lib/studio/import/repositories/design-system.repository'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import { shufflePalette } from './palette-shuffle'
import { DesignSystemTelemetry } from '@/lib/studio/telemetry/design-system-telemetry'
import { DatabaseTelemetryStorage } from '@/lib/studio/telemetry/telemetry-storage'

export interface CreateConceptOptions {
  websiteId: string
  name?: string
  sourceConceptId?: string
  duplicatePalette?: boolean
  createdBy?: string
}

export interface ShuffleConceptOptions {
  websiteId: string
  conceptId: string
  requestedBy?: string
}

export interface RenameConceptOptions {
  websiteId: string
  conceptId: string
  name: string
}

export interface DeleteConceptOptions {
  websiteId: string
  conceptId: string
}

export class DesignConceptService {
  private readonly conceptRepository: DesignConceptRepository
  private readonly designSystemRepository: DesignSystemRepository
  private readonly telemetry: DesignSystemTelemetry

  constructor(
    private readonly prisma: PrismaClient = new PrismaClient(),
    conceptRepository?: DesignConceptRepository,
    designSystemRepository?: DesignSystemRepository,
    telemetry?: DesignSystemTelemetry
  ) {
    this.conceptRepository =
      conceptRepository ?? new DesignConceptRepository(this.prisma)
    this.designSystemRepository =
      designSystemRepository ?? new DesignSystemRepository(this.prisma)
    this.telemetry =
      telemetry ??
      new DesignSystemTelemetry(new DatabaseTelemetryStorage(this.prisma))
  }

  async listConcepts(websiteId: string): Promise<WebsiteDesignConcept[]> {
    return this.conceptRepository.listByWebsite(websiteId)
  }

  async getConcept(websiteId: string, conceptId: string): Promise<WebsiteDesignConcept> {
    const concept = await this.conceptRepository.findById(conceptId)
    if (!concept || concept.websiteId !== websiteId) {
      throw new Error('Concept not found')
    }
    return concept
  }

  async createConcept(options: CreateConceptOptions) {
    const { websiteId, duplicatePalette = false } = options
    const sourceConcept = options.sourceConceptId
      ? await this.conceptRepository.findById(options.sourceConceptId)
      : await this.conceptRepository.findDefault(websiteId)

    if (!sourceConcept) {
      throw new Error('Source concept not found')
    }

    const baseDesignSystem =
      (await this.designSystemRepository.findLatestByConceptId(sourceConcept.id)) ??
      (await this.designSystemRepository.findLatestByWebsiteId(websiteId, sourceConcept.id))

    if (!baseDesignSystem || !baseDesignSystem.tokens) {
      throw new Error('Source design system is missing')
    }

    const name =
      options.name?.trim() || (await this.buildDefaultConceptName(websiteId))
    const metadata = this.extendMetadata(sourceConcept.metadata, {
      createdBy: options.createdBy ?? 'system'
    })

    const concept = await this.conceptRepository.create({
      websiteId,
      name,
      description: sourceConcept.description,
      metadata,
      isDefault: false
    })

    const tokens = baseDesignSystem.tokens as unknown as DesignSystem
    const paletteResult = duplicatePalette
      ? {
          palette: tokens.palette,
          seed: sourceConcept.generatorSeed ?? `${concept.id}:clone`
        }
      : shufflePalette({
          conceptId: concept.id,
          palette: tokens.palette
        })

    const clonedDesignSystem: DesignSystem = {
      ...deepClone(tokens),
      palette: paletteResult.palette,
      metadata: {
        ...deepClone(tokens.metadata),
        generatorSeed: paletteResult.seed,
        capturedAt: new Date().toISOString(),
        extractionMethod: 'llm-assisted'
      }
    }

    await this.designSystemRepository.create({
      websiteId,
      designConceptId: concept.id,
      tokens: clonedDesignSystem,
      markPreviousInactive: false
    })

    await this.conceptRepository.update(concept.id, {
      generatorSeed: paletteResult.seed
    })

    const totalConcepts = (await this.conceptRepository.listByWebsite(websiteId)).length
    await this.telemetry.recordConceptCreated(websiteId, concept.id, {
      duplicatePalette,
      generatorSeed: paletteResult.seed,
      totalConcepts
    })

    return {
      concept: await this.conceptRepository.findById(concept.id),
      designSystem: clonedDesignSystem,
      seed: paletteResult.seed
    }
  }

  async shuffleConceptPalette(options: ShuffleConceptOptions) {
    const concept = await this.conceptRepository.findById(options.conceptId)
    if (!concept || concept.websiteId !== options.websiteId) {
      throw new Error('Concept not found')
    }

    const designSystemEntity = await this.designSystemRepository.findLatestByConceptId(concept.id)
    if (!designSystemEntity) {
      throw new Error('Design system missing for concept')
    }

    const currentDesignSystem = designSystemEntity.tokens as unknown as DesignSystem
    const shuffleResult = shufflePalette({
      conceptId: concept.id,
      palette: currentDesignSystem.palette
    })

    const updatedDesignSystem: DesignSystem = {
      ...deepClone(currentDesignSystem),
      palette: shuffleResult.palette,
      metadata: {
        ...deepClone(currentDesignSystem.metadata),
        generatorSeed: shuffleResult.seed,
        capturedAt: new Date().toISOString(),
        extractionMethod: 'llm-assisted'
      }
    }

    await this.designSystemRepository.create({
      websiteId: options.websiteId,
      designConceptId: concept.id,
      tokens: updatedDesignSystem
    })

    await this.conceptRepository.update(concept.id, {
      generatorSeed: shuffleResult.seed,
      metadata: this.extendMetadata(concept.metadata, {
        lastShuffleBy: options.requestedBy ?? 'system',
        lastShuffleAt: new Date().toISOString()
      })
    })

    await this.telemetry.recordConceptShuffle(options.websiteId, concept.id, {
      generatorSeed: shuffleResult.seed,
      deltaMetrics: shuffleResult.deltaMap
    })

    return {
      concept: await this.conceptRepository.findById(concept.id),
      designSystem: updatedDesignSystem,
      seed: shuffleResult.seed
    }
  }

  async renameConcept(options: RenameConceptOptions) {
    const existing = await this.conceptRepository.findById(options.conceptId)
    if (!existing || existing.websiteId !== options.websiteId) {
      throw new Error('Concept not found')
    }

    return this.conceptRepository.update(existing.id, {
      name: options.name
    })
  }

  async deleteConcept(options: DeleteConceptOptions) {
    const concepts = await this.conceptRepository.listByWebsite(options.websiteId)
    if (concepts.length <= 1) {
      throw new Error('A website must have at least one design concept')
    }

    const target = concepts.find((concept) => concept.id === options.conceptId)
    if (!target) {
      throw new Error('Concept not found')
    }

    if (target.isDefault) {
      const fallback = concepts.find((concept) => concept.id !== target.id)
      if (fallback) {
        await this.conceptRepository.setDefault(fallback.id, options.websiteId)
      }
    }

    await this.conceptRepository.delete(target.id)
    await this.telemetry.recordConceptDeleted(options.websiteId, target.id, {
      remainingConcepts: concepts.length - 1
    })
  }

  async setDefaultConcept(websiteId: string, conceptId: string) {
    const concept = await this.conceptRepository.findById(conceptId)
    if (!concept || concept.websiteId !== websiteId) {
      throw new Error('Concept not found')
    }
    await this.conceptRepository.setDefault(conceptId, websiteId)
  }

  async updateConceptDetails(
    websiteId: string,
    conceptId: string,
    input: { name?: string; description?: string; metadata?: Record<string, unknown> }
  ) {
    const concept = await this.getConcept(websiteId, conceptId)
    const existingMetadata = (concept.metadata ?? {}) as Record<string, unknown>
    return this.conceptRepository.update(concept.id, {
      name: input.name ?? concept.name,
      description: input.description ?? concept.description,
      metadata: input.metadata
        ? this.extendMetadata(existingMetadata, input.metadata)
        : existingMetadata
    })
  }

  private async buildDefaultConceptName(websiteId: string): Promise<string> {
    const concepts = await this.conceptRepository.listByWebsite(websiteId)
    return `Design Concept ${concepts.length + 1}`
  }

  private extendMetadata(
    metadata: any,
    next: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      ...next
    }
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}
