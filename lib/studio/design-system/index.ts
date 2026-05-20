/**
 * Design System Module
 *
 * Provides components and utilities for applying design systems
 * @module design-system
 */

export { DesignSystemProvider, useDesignSystem } from './DesignSystemProvider'
export { DesignSystemScope } from '@/lib/design-system/design-system-scope'
export type { DesignSystemContextValue, DesignSystemProviderProps } from './DesignSystemProvider'

// New simplified design system exports (Phase 1)
export {
  SHADCN_DEFAULTS,
  SHADCN_DEFAULTS_DARK,
  SHADCN_VARIABLE_NAMES,
  getShadcnVariablesWithDefaults,
  generateShadcnCss,
} from './shadcn-defaults'
export type { ShadcnVariableName, ShadcnVariables } from './shadcn-defaults'

export {
  toShadcnVariables,
  generateExportCss,
} from './shadcn-transformer'
export type { ShadcnDesignSystemTokens } from './shadcn-transformer'

export {
  getDesignSystemVariables,
  getNormalizedDesignSystem,
  generateDesignSystemCss,
  isNewFormat,
  isLegacyFormat,
} from './design-system-reader'

