import { ComponentType } from '@/lib/studio/components/cms/_core/types'

export enum PageTemplateCategory {
  Core = 'core',
  Marketing = 'marketing',
  Blog = 'blog',
  Commerce = 'commerce'
}

export type PageTemplateRegionKey = 'header' | 'hero' | 'main' | 'footer'

export interface PageTemplateRegionConfig {
  region: PageTemplateRegionKey
  allowedComponents: ComponentType[]
  min?: number
  max?: number
  description?: string
}

export type PageTemplateRegionList = PageTemplateRegionConfig[]

export type PageTemplatePropKind =
  | 'string'
  | 'rich-text'
  | 'markdown'
  | 'boolean'
  | 'number'
  | 'enum'
  | 'image'
  | 'date'
  | 'content-reference'
  | 'content-reference[]'

export interface PageTemplatePropMeta {
  type: PageTemplatePropKind
  required: boolean
  description?: string
  allowedComponentTypes?: ComponentType[]
  allowedValues?: string[]
  defaultValue?: unknown
}

export type PageTemplatePropsMeta = Record<string, PageTemplatePropMeta>

export type PageTemplateContentFieldType = 'content[]'

export interface PageTemplateContentFieldMeta {
  type: PageTemplateContentFieldType
  required: boolean
  description?: string
  allowedComponentTypes?: ComponentType[]
  defaultValue?: unknown
}

export type PageTemplateContentSchema = Record<string, PageTemplateContentFieldMeta>

export interface PageTemplateAIMetadata {
  keywords: string[]
  layoutGuidelines: string[]
  contentGuidelines?: string[]
  recommendedComponents?: ComponentType[]
  discouragedComponents?: ComponentType[]
  exampleUseCases?: string[]
  routeHints?: string[]
}

export interface PageTemplateRegistration {
  templateKey: string
  name: string
  category: PageTemplateCategory
  isHomeEligible: boolean
  description: string
  requiredRegions: PageTemplateRegionList
  optionalRegions?: PageTemplateRegionList
  propsMeta?: PageTemplatePropsMeta
  contentSchema?: PageTemplateContentSchema
  childContainment?: string[]
  aiMetadata: PageTemplateAIMetadata
}
