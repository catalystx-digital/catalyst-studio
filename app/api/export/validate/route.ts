import { NextRequest, NextResponse } from 'next/server'
import { EnhancedExportValidator, ValidationResult } from '@/lib/services/export/export-validator'
import { BundleExporter } from '@/lib/services/export/bundle-exporter'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

interface ValidateRequestBody {
  websiteId: string
  exportType?: 'standard' | 'optimizely' | 'contentful'
}

interface ValidateResponse {
  valid: boolean
  errors: Array<{
    type: string
    severity: string
    message: string
    details?: Record<string, unknown>
  }>
  warnings: Array<{
    type: string
    severity: string
    message: string
    details?: Record<string, unknown>
  }>
  summary: {
    contentItems: number
    contentTypes: number
    components: number
    folders: number
    estimatedSize: number
    estimatedTime: number
    errorCount: number
    warningCount: number
  }
}

/**
 * POST /api/export/validate
 * Validates export data before actual export generation
 */
export async function POST(req: NextRequest) {
  // Auth check - always required
  let auth
  try {
    auth = await getAuthContext(req)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse request body
    const body: ValidateRequestBody = await req.json()
    const { websiteId, exportType = 'standard' } = body

    // Validate required parameters
    if (!websiteId) {
      return NextResponse.json(
        { error: 'Missing required parameter: websiteId' },
        { status: 400 }
      )
    }

    // Verify ownership
    await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId)

    // Check if website exists
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId
      }
    })

    if (!website) {
      return NextResponse.json(
        { error: 'Website not found or access denied' },
        { status: 404 }
      )
    }

    // Create export service instance
    const exportService = new BundleExporter()
    
    // Generate export data (without actually creating files)
    // This performs the export preparation but doesn't save to disk
    const { exportData } = await exportService.export(websiteId, {
      includeComponents: true,
      includeFolders: true
    })

    // Create validator instance
    const validator = new EnhancedExportValidator()
    
    // Perform validation
    const validationResult: ValidationResult = await validator.validateExportData(exportData)

    // Format response according to API specification
    const response: ValidateResponse = {
      valid: validationResult.valid,
      errors: validationResult.errors.map(error => ({
        type: error.type,
        severity: error.severity,
        message: error.message,
        details: error.details
      })),
      warnings: validationResult.warnings.map(warning => ({
        type: warning.type,
        severity: warning.severity,
        message: warning.message,
        details: warning.details
      })),
      summary: {
        contentItems: validationResult.summary.contentItems,
        contentTypes: validationResult.summary.contentTypes,
        components: validationResult.summary.components,
        folders: validationResult.summary.folders,
        estimatedSize: validationResult.summary.estimatedSize,
        estimatedTime: validationResult.summary.estimatedTime,
        errorCount: validationResult.summary.errorCount,
        warningCount: validationResult.summary.warningCount
      }
    }

    // Log validation statistics
    console.log(`Export validation for website ${websiteId}:`, {
      valid: response.valid,
      errors: response.summary.errorCount,
      warnings: response.summary.warningCount,
      items: response.summary.contentItems,
      exportType
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Export validation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Export validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/export/validate
 * Returns validation endpoint information
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/export/validate',
    method: 'POST',
    description: 'Validates export data before generation',
    parameters: {
      websiteId: 'string (required)',
      exportType: 'standard | optimizely | contentful (optional, default: standard)'
    },
    response: {
      valid: 'boolean',
      errors: 'array of validation errors',
      warnings: 'array of validation warnings',
      summary: 'validation statistics'
    }
  })
}