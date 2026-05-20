import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { VALIDATION_LIMITS } from '@/lib/studio/components/site-builder/property-editor/constants'
import { getAuthContext } from '@/lib/auth/context'
import { prisma } from '@/lib/prisma'

const PropertyUpdateSchema = z.object({
  properties: z.record(z.any()),
  validateOnly: z.boolean().optional()
})

const ColorSchema = z.string().regex(
  /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$|^rgb\(|^rgba\(|^hsl\(|^hsla\(|^transparent$/,
  'Invalid color format'
)

const UrlSchema = z.string().url().or(z.string().regex(/^\//, 'Must be a valid URL or relative path'))

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Mock implementation for development
    // In production, this would integrate with actual database and auth
    
    const { id: componentId } = await params

    // Ownership check against component type -> website.accountId
    const auth = await getAuthContext(request)
    const comp = await prisma.websiteComponentType.findUnique({ where: { id: componentId } })
    const site: any = comp ? await prisma.website.findUnique({ where: { id: (comp as any).websiteId } }) : null
    if (!site?.accountId || site.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const body = await request.json()
    const validation = PropertyUpdateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            valid: false,
            errors: validation.error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        },
        { status: 400 }
      )
    }
    
    const { properties, validateOnly } = validation.data
    
    const validationErrors: Array<{ field: string; message: string }> = []
    
    Object.entries(properties).forEach(([key, value]) => {
      if (key.includes('color') || key.includes('Color')) {
        const result = ColorSchema.safeParse(value)
        if (!result.success) {
          validationErrors.push({
            field: key,
            message: 'Invalid color format'
          })
        }
      }
      
      if (key.includes('link') || key.includes('Link') || key.includes('url') || key.includes('URL')) {
        if (value && typeof value === 'string') {
          const result = UrlSchema.safeParse(value)
          if (!result.success) {
            validationErrors.push({
              field: key,
              message: 'Invalid URL format'
            })
          }
        }
      }
      
      if (typeof value === 'string') {
        if (key.includes('text') || key.includes('Text') || key.includes('label') || key.includes('Label')) {
          if (value.length > VALIDATION_LIMITS.GENERIC_TEXT_MAX_LENGTH) {
            validationErrors.push({
              field: key,
              message: `Text is too long (max ${VALIDATION_LIMITS.GENERIC_TEXT_MAX_LENGTH} characters)`
            })
          }
        }
        
        if (key.includes('description') || key.includes('Description')) {
          if (value.length > VALIDATION_LIMITS.LONG_TEXT_MAX_LENGTH) {
            validationErrors.push({
              field: key,
              message: `Description is too long (max ${VALIDATION_LIMITS.LONG_TEXT_MAX_LENGTH} characters)`
            })
          }
        }
      }
    })
    
    if (validateOnly) {
      return NextResponse.json({
        success: true,
        validation: {
          valid: validationErrors.length === 0,
          errors: validationErrors
        }
      })
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            valid: false,
            errors: validationErrors
          }
        },
        { status: 400 }
      )
    }
    
    // Mock successful update
    const updatedComponent = {
      id: componentId,
      content: {
        ...properties
      },
      updatedAt: new Date().toISOString()
    }
    
    return NextResponse.json({
      success: true,
      component: updatedComponent,
      validation: {
        valid: true,
        errors: []
      }
    })
    
  } catch (error) {
    console.error('Failed to update component properties:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            valid: false,
            errors: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to update component properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

