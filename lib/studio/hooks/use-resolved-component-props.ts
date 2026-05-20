import { useMemo } from 'react'
import { deepMerge } from '@/lib/services/unified-content-repository'

/**
 * Result of resolving component props for shared components.
 */
export interface ResolvedComponentPropsResult {
  /** The resolved/merged properties to display in the editor */
  props: Record<string, unknown>
  /** Whether this component is a shared/global component */
  isShared: boolean
  /** Whether this instance has local overrides */
  hasOverrides: boolean
  /** The shared component ID if this is a shared component */
  sharedComponentId?: string
}

/**
 * Resolves component properties for display in the properties panel.
 *
 * For shared components (those with a `sharedComponentId`), the actual data
 * is stored in `props._resolvedSharedContent` (populated by the API).
 * This hook merges that data with any instance-specific overrides.
 *
 * Merge semantics (from unified-content-repository.ts):
 * - Objects: recursive merge
 * - Arrays: override replaces base (no per-element merge)
 * - `null` in overrides: deletes the property
 * - `undefined` in overrides: preserves base value
 *
 * @param component - The component instance from the site builder
 * @returns Resolved props and metadata about the component
 */
export function useResolvedComponentProps(
  component: { props?: Record<string, unknown> } | null | undefined
): ResolvedComponentPropsResult {
  return useMemo(() => {
    // Null/undefined component
    if (!component) {
      return { props: {}, isShared: false, hasOverrides: false }
    }

    const props = component.props || {}
    const sharedId = props.sharedComponentId as string | undefined
    const isShared = !!sharedId

    // Not a shared component - return props as-is
    if (!isShared) {
      return {
        props: props as Record<string, unknown>,
        isShared: false,
        hasOverrides: false,
      }
    }

    // Shared component - resolve from _resolvedSharedContent
    const resolvedContent = (props._resolvedSharedContent || {}) as Record<string, unknown>
    const overrides = (props.overrides || {}) as Record<string, unknown>
    const hasOverrides = Object.keys(overrides).length > 0

    // Deep merge: base (shared) + overrides (instance)
    const merged = deepMerge(resolvedContent, overrides) as Record<string, unknown>

    return {
      props: merged,
      isShared: true,
      hasOverrides,
      sharedComponentId: sharedId,
    }
  }, [component])
}

/**
 * Helper to check if a component is a shared component.
 */
export function isSharedComponent(component: { props?: Record<string, unknown> } | null | undefined): boolean {
  return !!component?.props?.sharedComponentId
}

/**
 * Helper to get the shared component ID if present.
 */
export function getSharedComponentId(component: { props?: Record<string, unknown> } | null | undefined): string | undefined {
  return component?.props?.sharedComponentId as string | undefined
}
