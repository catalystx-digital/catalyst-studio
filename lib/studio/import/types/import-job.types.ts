import { Prisma } from '@/lib/generated/prisma'

export enum ImportJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  COMPLETED_WITH_WARNINGS = 'completed_with_warnings',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface CreateImportJobDto {
  websiteId: string
  url: string
  status?: ImportJobStatus
}

export interface UpdateImportJobDto {
  status?: ImportJobStatus
  templatesGenerated?: Prisma.JsonValue
  detectionResults?: Prisma.JsonValue
  errorMessage?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
}


export interface DetectionResult {
  technology?: string
  framework?: string
  features?: string[]
  components?: Array<{
    type: string
    confidence: number
    metadata?: Record<string, unknown>
  }>
  metadata?: Record<string, unknown>
}

// Removed unused interfaces: ImportJobResponse, TemplateGenerated
