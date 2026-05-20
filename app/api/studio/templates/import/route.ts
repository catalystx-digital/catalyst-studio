import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/lib/generated/prisma'
import TemplateStorageService from '@/lib/studio/import/services/template-storage-service'
import { CMSTemplate } from '@/lib/studio/import/template-generator'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

// Request validation schema
const saveTemplatesSchema = z.object({
  importJobId: z.string().cuid(),
  websiteId: z.string().cuid(),
  templates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    key: z.string(),
    category: z.enum(['page', 'component', 'folder']),
    fields: z.array(z.unknown()),
    metadata: z.object({
      source: z.string().optional(),
      sourcePages: z.array(z.string()).optional(),
      confidence: z.number().optional(),
      patterns: z.array(z.string()).optional(),
      createdFrom: z.string().optional(),
      version: z.number().optional(),
      designTokens: z.record(z.unknown()).optional()
    })
  }))
})

export async function POST(request: NextRequest) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse request body
    const body = await request.json()

    // Validate request
    const validation = saveTemplatesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { importJobId, websiteId, templates } = validation.data

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    // Verify import job exists
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId }
    })

    if (!importJob) {
      return NextResponse.json(
        {
          success: false,
          error: 'Import job not found'
        },
        { status: 404 }
      )
    }

    // Verify website exists
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    })

    if (!website) {
      return NextResponse.json(
        {
          success: false,
          error: 'Website not found'
        },
        { status: 404 }
      )
    }
    
    // Initialize storage service
    const storageService = new TemplateStorageService({
      batchSize: 10,
      validateBeforeSave: true,
      overwriteExisting: false,
      autoApproveThreshold: 0.7
    })
    
    // Save templates to CMS
    const result = await storageService.saveImportedTemplates(
      templates as CMSTemplate[],
      websiteId,
      importJobId
    )
    
    // Update import job with saved template IDs
    if (result.savedTemplateIds.length > 0) {
      const existingTemplates = (importJob.templatesGenerated as Record<string, unknown>[]) || []
      const updatedTemplates = [
        ...existingTemplates,
        ...result.savedTemplateIds.map(id => ({
          id,
          savedAt: new Date().toISOString(),
          type: 'cms_component'
        }))
      ]
      
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          templatesGenerated: updatedTemplates as Prisma.InputJsonValue,
          status: result.success ? 'templates_saved' : 'partial_save',
          updatedAt: new Date()
        }
      })
    }
    
    // Return response
    return NextResponse.json({
      success: result.success,
      savedTemplateIds: result.savedTemplateIds,
      failedTemplates: result.failedTemplates,
      totalSaved: result.totalSaved,
      totalFailed: result.totalFailed,
      message: result.success 
        ? `Successfully saved ${result.totalSaved} templates`
        : `Saved ${result.totalSaved} templates with ${result.totalFailed} failures`
    })
    
  } catch (error) {
    console.error('Error saving templates:', error)
    
    // Check if it's a database error
    if (error instanceof Error && error.message.includes('P2002')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Duplicate template detected',
          message: 'One or more templates already exist in the database'
        },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save templates',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve saved templates for a job
export async function GET(request: NextRequest) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const importJobId = searchParams.get('importJobId')
    const websiteId = searchParams.get('websiteId')

    if (!importJobId && !websiteId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either importJobId or websiteId must be provided'
        },
        { status: 400 }
      )
    }

    // Verify ownership if websiteId provided
    if (websiteId) {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)
    }

    // Build query filter
    const where: Record<string, unknown> = {}

    if (websiteId) {
      where.websiteId = websiteId
    }
    
    if (importJobId) {
      where.aiMetadata = {
        path: ['importJobId'],
        equals: importJobId
      }
    }
    
    // Fetch templates from database
    const templates = await prisma.websiteComponentType.findMany({
      where,
      select: {
        id: true,
        type: true,
        category: true,
        version: true,
        confidence: true,
        defaultConfig: true,
        placeholderData: true,
        styles: true,
        aiMetadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json({
      success: true,
      templates,
      count: templates.length
    })
    
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch templates',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}