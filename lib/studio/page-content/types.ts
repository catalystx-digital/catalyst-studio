import { z } from 'zod'
import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PageTemplateRegionKey } from '@/lib/studio/pages/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

export const PAGE_CONTENT_VERSION = 1

export type PageContentDiagnosticSeverity = 'info' | 'warn' | 'error'

export interface PageContentDiagnostic {
  code: string
  severity: PageContentDiagnosticSeverity
  message: string
  componentId?: string
  path?: string
  continued: boolean
  context?: Record<string, unknown>
}

export interface PageContentV1 {
  version: 1
  components: ComponentInstance[]
  regions?: PageContentRegionSummary[]
  metadata?: Record<string, unknown>
}

export interface PageContentRegionSummary {
  region: PageTemplateRegionKey
  componentTypes: ComponentType[]
}

export interface NormalizePageContentResult {
  pageContent: PageContentV1
  diagnostics: PageContentDiagnostic[]
}

export type NormalizePageContentMode = 'canonical-read' | 'strict-read' | 'strict-write'

export interface NormalizePageContentOptions {
  mode?: NormalizePageContentMode
}

const recordSchema = z.record(z.string(), z.unknown())

export const componentInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  componentType: z.string().optional(),
  componentTypeId: z.string().optional(),
  typeId: z.string().optional(),
  parentId: z.string().nullable(),
  position: z.number(),
  props: recordSchema,
  content: recordSchema,
  styles: recordSchema,
  metadata: recordSchema,
  globalComponentId: z.string().optional(),
  sharedComponentId: z.string().optional(),
}).passthrough()

export const pageContentV1Schema = z.object({
  version: z.literal(PAGE_CONTENT_VERSION),
  components: z.array(componentInstanceSchema),
  regions: z.array(z.object({
    region: z.string(),
    componentTypes: z.array(z.string()),
  })).optional(),
  metadata: recordSchema.optional(),
}).passthrough()
