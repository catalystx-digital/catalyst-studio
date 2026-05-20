import { PrismaClient, Prisma, WebsiteDesignConcept } from '@/lib/generated/prisma'

export interface CreateDesignConceptInput {
  websiteId: string
  name: string
  slug?: string
  description?: string | null
  metadata?: Record<string, any> | null
  isDefault?: boolean
  generatorSeed?: string | null
  position?: number
}

export interface UpdateDesignConceptInput {
  name?: string
  slug?: string
  description?: string | null
  metadata?: Record<string, any> | null
  isDefault?: boolean
  generatorSeed?: string | null
  position?: number
}

export class DesignConceptRepository {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async listByWebsite(websiteId: string): Promise<WebsiteDesignConcept[]> {
    return this.prisma.websiteDesignConcept.findMany({
      where: { websiteId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    })
  }

  async findById(id: string): Promise<WebsiteDesignConcept | null> {
    return this.prisma.websiteDesignConcept.findUnique({ where: { id } })
  }

  async findBySlug(websiteId: string, slug: string): Promise<WebsiteDesignConcept | null> {
    return this.prisma.websiteDesignConcept.findFirst({
      where: {
        websiteId,
        slug
      }
    })
  }

  async findByName(websiteId: string, name: string): Promise<WebsiteDesignConcept | null> {
    return this.prisma.websiteDesignConcept.findFirst({
      where: {
        websiteId,
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    })
  }

  async findDefault(websiteId: string): Promise<WebsiteDesignConcept | null> {
    const explicitDefault = await this.prisma.websiteDesignConcept.findFirst({
      where: { websiteId, isDefault: true },
      orderBy: { updatedAt: 'desc' }
    })
    if (explicitDefault) {
      return explicitDefault
    }
    return this.prisma.websiteDesignConcept.findFirst({
      where: { websiteId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    })
  }

  async create(input: CreateDesignConceptInput): Promise<WebsiteDesignConcept> {
    const slug = await this.resolveSlug(input.websiteId, input.slug ?? input.name)
    const position =
      input.position ??
      ((await this.prisma.websiteDesignConcept.aggregate({
        where: { websiteId: input.websiteId },
        _max: { position: true }
      }))._max.position ?? -1) +
        1

    return this.prisma.websiteDesignConcept.create({
      data: {
        websiteId: input.websiteId,
        name: input.name,
        slug,
        description: input.description,
        metadata: input.metadata === null ? Prisma.JsonNull : input.metadata,
        isDefault: input.isDefault ?? false,
        generatorSeed: input.generatorSeed,
        position
      }
    })
  }

  async update(id: string, input: UpdateDesignConceptInput): Promise<WebsiteDesignConcept> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new Error(`Design concept ${id} not found`)
    }

    let slug: string | undefined
    if (input.slug) {
      slug = await this.resolveSlug(existing.websiteId, input.slug, id)
    } else if (input.name && !input.slug) {
      slug = await this.resolveSlug(existing.websiteId, input.name, id)
    }

    const { metadata, ...restInput } = input
    return this.prisma.websiteDesignConcept.update({
      where: { id },
      data: {
        ...restInput,
        ...(metadata !== undefined && { metadata: metadata === null ? Prisma.JsonNull : metadata }),
        slug,
        position: input.position ?? existing.position
      }
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.websiteDesignConcept.delete({ where: { id } })
  }

  async setDefault(id: string, websiteId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.websiteDesignConcept.updateMany({
        where: { websiteId, isDefault: true },
        data: { isDefault: false }
      }),
      this.prisma.websiteDesignConcept.update({
        where: { id },
        data: { isDefault: true }
      })
    ])
  }

  private async resolveSlug(
    websiteId: string,
    value: string,
    conceptId?: string
  ): Promise<string> {
    const base = slugifyConceptName(value)
    if (!base) {
      return await this.generateFallbackSlug(websiteId)
    }
    let candidate = base
    let suffix = 2
    while (true) {
      const existing = await this.findBySlug(websiteId, candidate)
      if (!existing || existing.id === conceptId) {
        return candidate
      }
      candidate = `${base}-${suffix++}`
    }
  }

  private async generateFallbackSlug(websiteId: string): Promise<string> {
    const count = await this.prisma.websiteDesignConcept.count({ where: { websiteId } })
    return `design-concept-${count + 1}`
  }
}

export function slugifyConceptName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}
