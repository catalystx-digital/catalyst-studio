/**
 * Review Service
 * 
 * Backend service for managing import review sessions,
 * component approvals, and template generation from reviewed imports.
 */

import { PrismaClient, ContentTypeCategory } from '@/lib/generated/prisma'
import { ImportDetectionResult } from '../web-detection'
import { CMSTemplate } from '../template-generator'

interface ImportJob {
  id: string
  websiteId: string
  userId: string
  url: string
  status: 'pending' | 'processing' | 'reviewing' | 'completed' | 'failed'
  detectedStructure: DetectedStructure
  createdAt: Date
  updatedAt: Date
}

export interface DetectedStructure {
  pages: PageStructure[]
  components: ComponentDetection[]
  designTokens: DesignTokens
  navigation: NavigationStructure
  confidence: ConfidenceMetrics
}

interface PageStructure {
  url: string
  title: string
  components: string[] // Component IDs
  template?: string
}

export interface ComponentDetection {
  id: string
  type: string
  originalHtml?: string
  detectedProps: Record<string, any>
  confidence: number // 0-100
  location: {
    page: string
    selector: string
    index: number
  }
  suggested_mapping: string
  user_override?: string
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  reviewNotes?: string
}

interface NavigationStructure {
  pages: Array<{
    title: string
    url: string
    children: any[]
  }>
  sections: Array<{
    name: string
    pages: string[]
  }>
}

interface DesignTokens {
  images: string[]
  textPatterns: string[]
  contentOrganization: any[]
  componentUsage: Array<{
    type: string
    frequency: number
    instances: number
  }>
}

interface ConfidenceMetrics {
  overall: number
  byType: Record<string, number>
  byPage: Record<string, number>
}

interface ComponentMapping {
  targetTemplate: string
  props: Record<string, any>
  notes?: string
}

interface BulkApproveOptions {
  autoApproveThreshold?: number
  skipLowConfidence?: boolean
  applyToSimilar?: boolean
}

interface ReviewSession {
  id: string
  importJobId: string
  userId: string
  startedAt: Date
  completedAt?: Date
  totalComponents: number
  approvedCount: number
  rejectedCount: number
  modifiedCount: number
  sessionData?: any
}

// Note: ReviewService class removed as it is not used directly.
