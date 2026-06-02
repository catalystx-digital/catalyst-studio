import { PrismaClient, ImportJob, Prisma } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { 
  CreateImportJobDto, 
  UpdateImportJobDto,
  ImportJobStatus 
} from '@/lib/studio/import/types/import-job.types'
import { validateJSON, validateImportJSON } from '@/lib/studio/import/utils/validation'

type PrismaCtx = PrismaClient | Prisma.TransactionClient
type ImportJobWithWebsite = Prisma.ImportJobGetPayload<{ include: { website: true } }>

interface IImportJobRepository {
  create(data: CreateImportJobDto, tx?: PrismaCtx): Promise<ImportJob>
  update(id: string, data: UpdateImportJobDto, tx?: PrismaCtx): Promise<ImportJob>
  findById(id: string, tx?: PrismaCtx): Promise<ImportJobWithWebsite | null>
  findByWebsiteId(websiteId: string, tx?: PrismaCtx): Promise<ImportJob[]>
  updateStatus(id: string, status: ImportJobStatus, tx?: PrismaCtx): Promise<void>
  updateTemplates(id: string, templates: unknown, tx?: PrismaCtx): Promise<ImportJob>
  delete(id: string, tx?: PrismaCtx): Promise<void>
  getPageDetections(jobId: string, options?: PageDetectionQueryOptions, tx?: PrismaCtx): Promise<PageDetectionResult>
  getPageDetection(jobId: string, pageUrl: string, tx?: PrismaCtx): Promise<any | null>
}

interface PageDetectionQueryOptions {
  status?: string
  limit?: number
  offset?: number
}

interface PageDetectionResult {
  total: number
  pages: any[]
}

export class ImportJobRepository implements IImportJobRepository {
  constructor(private readonly db: PrismaClient = prisma as unknown as PrismaClient) {}

  /**
   * Creates a new import job
   * @param data - The import job creation data
   * @param tx - Optional transaction client
   * @returns The created import job
   */
  async create(data: CreateImportJobDto, tx?: PrismaCtx): Promise<ImportJob> {
    const client = tx || this.db
    
    return client.importJob.create({
      data: {
        websiteId: data.websiteId,
        url: data.url,
        status: data.status || ImportJobStatus.PENDING
      }
    })
  }

  /**
   * Updates an existing import job
   * @param id - The import job ID
   * @param data - The update data
   * @param tx - Optional transaction client
   * @returns The updated import job
   * @throws Error if JSON validation fails
   */
  async update(id: string, data: UpdateImportJobDto, tx?: PrismaCtx): Promise<ImportJob> {
    const client = tx || this.db
    
    // Validate JSON fields if provided
    if (data.templatesGenerated !== undefined) {
      const validation = validateJSON(data.templatesGenerated)
      if (!validation.valid) {
        throw new Error(`Templates validation failed: ${validation.error}`)
      }
    }
    
    if (data.detectionResults !== undefined) {
      // Use specialized validation for import detection results (higher depth limit)
      const validation = validateImportJSON(data.detectionResults)
      if (!validation.valid) {
        throw new Error(`Detection results validation failed: ${validation.error}`)
      }
    }
    
    return client.importJob.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.templatesGenerated !== undefined && { templatesGenerated: data.templatesGenerated as Prisma.InputJsonValue }),
        ...(data.detectionResults !== undefined && { detectionResults: data.detectionResults as Prisma.InputJsonValue }),
        ...(data.errorMessage !== undefined
          ? { errorMessage: data.errorMessage }
          : data.status === ImportJobStatus.COMPLETED || data.status === ImportJobStatus.COMPLETED_WITH_WARNINGS
            ? { errorMessage: null }
            : {}),
        ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
        ...(data.completedAt !== undefined && { completedAt: data.completedAt })
      }
    })
  }

  /**
   * Finds an import job by ID
   * @param id - The import job ID
   * @param tx - Optional transaction client
   * @returns The import job or null if not found
   */
  async findById(id: string, tx?: PrismaCtx): Promise<ImportJobWithWebsite | null> {
    const client = tx || this.db
    
    return client.importJob.findUnique({
      where: { id },
      include: {
        website: true
      }
    })
  }

  /**
   * Finds all import jobs for a website
   * @param websiteId - The website ID
   * @param tx - Optional transaction client
   * @returns Array of import jobs ordered by creation date (newest first)
   */
  async findByWebsiteId(websiteId: string, tx?: PrismaCtx): Promise<ImportJob[]> {
    const client = tx || this.db
    
    return client.importJob.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Updates the status of an import job and sets appropriate timestamps
   * @param id - The import job ID
   * @param status - The new status
   * @param tx - Optional transaction client
   */
  async updateStatus(id: string, status: ImportJobStatus, tx?: PrismaCtx): Promise<void> {
    const client = tx || this.db
    
    interface StatusUpdateData {
      status: ImportJobStatus
      startedAt?: Date
      completedAt?: Date
      errorMessage?: null
    }
    
    const updateData: StatusUpdateData = {
      status
    }
    
    // Set timestamps based on status
    if (status === ImportJobStatus.PROCESSING) {
      updateData.startedAt = new Date()
      updateData.errorMessage = null
    } else if (
      status === ImportJobStatus.COMPLETED ||
      status === ImportJobStatus.COMPLETED_WITH_WARNINGS
    ) {
      updateData.completedAt = new Date()
      updateData.errorMessage = null
    } else if (status === ImportJobStatus.FAILED) {
      updateData.completedAt = new Date()
    }
    
    await client.importJob.update({
      where: { id },
      data: updateData
    })
  }

  /**
   * Updates the templates generated field for an import job
   * @param id - The import job ID
   * @param templates - The templates data to store
   * @param tx - Optional transaction client
   * @returns The updated import job
   * @throws Error if JSON validation fails (size or depth limits exceeded)
   */
  async updateTemplates(id: string, templates: unknown, tx?: PrismaCtx): Promise<ImportJob> {
    const client = tx || this.db
    
    // Validate JSON size and depth
    const validation = validateJSON(templates)
    if (!validation.valid) {
      throw new Error(`Templates validation failed: ${validation.error}`)
    }
    
    return client.importJob.update({
      where: { id },
      data: {
        templatesGenerated: templates as Prisma.InputJsonValue
      }
    })
  }

  /**
   * Deletes an import job
   * @param id - The import job ID
   * @param tx - Optional transaction client
   */
  async delete(id: string, tx?: PrismaCtx): Promise<void> {
    const client = tx || this.db

    await client.importJob.delete({
      where: { id }
    })
  }

  /**
   * Gets page detections for an import job with filtering and pagination
   * @param jobId - The import job ID
   * @param options - Query options (status filter, pagination)
   * @param tx - Optional transaction client
   * @returns Paginated page detections with total count
   */
  async getPageDetections(
    jobId: string,
    options?: PageDetectionQueryOptions,
    tx?: PrismaCtx
  ): Promise<PageDetectionResult> {
    const client = tx || this.db

    const where: any = { jobId }
    if (options?.status) {
      where.status = options.status
    }

    const [total, pages] = await Promise.all([
      client.importPageDetection.count({ where }),
      client.importPageDetection.findMany({
        where,
        take: options?.limit || 100,
        skip: options?.offset || 0,
        orderBy: { createdAt: 'asc' }
      })
    ])

    return { total, pages }
  }

  /**
   * Gets a single page detection by job ID and page URL
   * @param jobId - The import job ID
   * @param pageUrl - The page URL
   * @param tx - Optional transaction client
   * @returns The page detection or null if not found
   */
  async getPageDetection(
    jobId: string,
    pageUrl: string,
    tx?: PrismaCtx
  ): Promise<any | null> {
    const client = tx || this.db

    return client.importPageDetection.findFirst({
      where: { jobId, pageUrl }
    })
  }
}
