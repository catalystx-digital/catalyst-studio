import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ImportJobRepository } from '@/lib/studio/import/repositories/import-job.repository'
import { ImportJobStatus } from '@/lib/studio/import/types/import-job.types'
import { validateJSON, getJSONSizeInBytes, formatBytes } from '@/lib/studio/import/utils/validation'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'

const repository = new ImportJobRepository()

// Schema for updating import job
const updateJobSchema = z.object({
  status: z.nativeEnum(ImportJobStatus).optional(),
  templatesGenerated: z.any().optional(),
  detectionResults: z.any().optional(),
  errorMessage: z.string().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional()
})

/**
 * GET /api/studio/import/jobs/[jobId]
 * Retrieves a specific import job by its ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Auth check - always required (before any DB queries)
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await repository.findById(jobId)
    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    const site: any = await prisma.website.findUnique({ where: { id: job.websiteId } })
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Failed to get import job:', error)
    return NextResponse.json(
      { error: 'Failed to get import job' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/studio/import/jobs/[jobId]
 * Updates an existing import job with validation for JSON fields
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Auth check - always required (before any DB queries)
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate request body
    const validatedData = updateJobSchema.parse(body)

    // Validate JSON fields if provided
    if (validatedData.templatesGenerated !== undefined) {
      const validation = validateJSON(validatedData.templatesGenerated)
      if (!validation.valid) {
        const sizeInBytes = getJSONSizeInBytes(validatedData.templatesGenerated)
        return NextResponse.json(
          {
            error: 'Templates data validation failed',
            details: validation.error,
            size: formatBytes(sizeInBytes)
          },
          { status: 400 }
        )
      }
    }

    if (validatedData.detectionResults !== undefined) {
      const validation = validateJSON(validatedData.detectionResults)
      if (!validation.valid) {
        const sizeInBytes = getJSONSizeInBytes(validatedData.detectionResults)
        return NextResponse.json(
          {
            error: 'Detection results validation failed',
            details: validation.error,
            size: formatBytes(sizeInBytes)
          },
          { status: 400 }
        )
      }
    }

    // Convert datetime strings to Date objects
    const updateData = {
      ...validatedData,
      startedAt: validatedData.startedAt ? new Date(validatedData.startedAt) : undefined,
      completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : undefined
    }

    const current = await repository.findById(jobId)
    if (!current) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    const site: any = await prisma.website.findUnique({ where: { id: current.websiteId } })
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const job = await repository.update(jobId, updateData)

    return NextResponse.json(job)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update import job:', error)
    return NextResponse.json(
      { error: 'Failed to update import job' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/studio/import/jobs/[jobId]
 * Deletes an import job from the database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Auth check - always required (before any DB queries)
    let auth
    try {
      auth = await getAuthContext(request)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await repository.findById(jobId)
    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    const site: any = await prisma.website.findUnique({ where: { id: job.websiteId } })
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await repository.delete(jobId)

    return NextResponse.json(
      { message: 'Import job deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete import job:', error)
    return NextResponse.json(
      { error: 'Failed to delete import job' },
      { status: 500 }
    )
  }
}
