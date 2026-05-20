/**
 * Shared type definitions for the import pipeline
 * 
 * @module types
 */

/**
 * Navigation hierarchy extracted from website
 */
export interface NavigationHierarchy {
  pages: NavigationPage[]
  sections: NavigationSection[]
}

export interface NavigationPage {
  title: string
  url: string
  children: NavigationPage[]
}

export interface NavigationSection {
  name: string
  pages: NavigationPage[]
}

/**
 * Page template definition
 */
export interface Template {
  id: string
  name: string
  pages: string[]
  regions: TemplateRegion
  similarity: number
}

export interface TemplateRegion {
  header: string[]
  hero: string[]
  main: string[]
  footer: string[]
}

/**
 * Design tokens extracted from website
 */
export interface DesignTokens {
  images: string[]
  textPatterns: string[]
  contentOrganization: any[]
  componentUsage: ComponentUsagePattern[]
  colors?: string[]
  fonts?: string[]
  designSystem?: import('./types/design-system.types').DesignSystem
}

export interface ComponentUsagePattern {
  type: string
  frequency: number
  instances: number
}

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use DesignTokens instead
 */
// Removed deprecated DesignTokenMap alias (use DesignTokens directly)
