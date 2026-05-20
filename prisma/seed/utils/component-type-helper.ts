import { Prisma } from '../../../lib/generated/prisma'

/**
 * Helper function to create WebsiteComponentType data with required fields
 * Handles the mapping from old field names to new field names
 */
export function createComponentTypeData(data: {
  type: string
  category: string
  version?: string
  props?: any  // Old field name (maps to defaultConfig)
  content?: any  // Old field name (maps to placeholderData)
  defaultConfig?: any  // New field name
  placeholderData?: any  // New field name
  styles?: any
  aiMetadata: any
  confidence: number
  isGlobal?: boolean
  websiteId: string
  createdBy: string
}): Prisma.WebsiteComponentTypeCreateInput {
  return {
    type: data.type,
    category: data.category,
    version: data.version || '1.0.0',
    // Use new field names if provided, otherwise map from old names
    defaultConfig: data.defaultConfig ?? data.props ?? {},
    placeholderData: data.placeholderData ?? data.content ?? {},
    styles: data.styles,
    aiMetadata: data.aiMetadata,
    confidence: data.confidence,
    isGlobal: data.isGlobal,
    website: {
      connect: { id: data.websiteId }
    },
    createdBy: data.createdBy
  }
}