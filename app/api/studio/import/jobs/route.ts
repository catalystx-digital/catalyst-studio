import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ImportJobRepository } from '@/lib/studio/import/repositories/import-job.repository'
import { ImportJobStatus } from '@/lib/studio/import/types/import-job.types'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

const repository = new ImportJobRepository()

// Schema for creating import job
const createJobSchema = z.object({
  websiteId: z.string().cuid(),
  url: z.string().url(),
  status: z.nativeEnum(ImportJobStatus).optional()
})

// Schema for query params
const listJobsSchema = z.object({
  websiteId: z.string().cuid().optional()
})

/**
 * POST /api/studio/import/jobs
 * Creates a new import job for website import processing
 * 
 * @param request - NextRequest containing websiteId, url, and optional status
 * @returns Created import job with 201 status or error response
 * @throws 400 for validation errors, 500 for server errors
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validatedData = createJobSchema.parse(body)
    
    // Ownership check
    const auth = await getAuthContext(request)
    await assertWebsiteOwnership(prisma, auth.accountId, validatedData.websiteId)

    // Create import job
    const job = await repository.create(validatedData)
    
    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Failed to create import job:', error)
    return NextResponse.json(
      { error: 'Failed to create import job' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/studio/import/jobs
 * Lists all import jobs for a specific website
 * 
 * @param request - NextRequest with websiteId query parameter (required)
 * @returns Array of import jobs ordered by creation date (newest first)
 * @throws 400 for missing/invalid websiteId, 500 for server errors
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const websiteId = searchParams.get('websiteId')
    
    // Validate query params
    const validatedParams = listJobsSchema.parse({ websiteId })
    
    let jobs
    if (validatedParams.websiteId) {
      // Ownership check
      const auth = await getAuthContext(request)
      await assertWebsiteOwnership(prisma, auth.accountId, validatedParams.websiteId)
      jobs = await repository.findByWebsiteId(validatedParams.websiteId)
    } else {
      // Return error if no websiteId provided in MVP
      return NextResponse.json(
        { error: 'websiteId parameter is required' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(jobs)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Failed to list import jobs:', error)
    return NextResponse.json(
      { error: 'Failed to list import jobs' },
      { status: 500 }
    )
  }
}
