/**
 * Design System Canvas Injector
 *
 * Injects design system CSS variables into the Site Builder canvas (ReactFlow container)
 * and ensures snapshots/print CSS uses imported design tokens.
 *
 * @module DesignSystemCanvasInjector
 */

'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { useDesignSystem } from '@/lib/studio/design-system/DesignSystemProvider'

export interface DesignSystemCanvasInjectorProps {
  /** Website ID for the current site being edited */
  websiteId?: string
  /** Canvas container selector (defaults to ReactFlow viewport) */
  canvasSelector?: string
  /** Whether to inject print styles as well */
  enablePrintStyles?: boolean
  /** Custom CSS variables to inject in addition to design system */
  customVariables?: Record<string, string>
  /** Children that will receive design system context */
  children: React.ReactNode
}

/**
 * Injects design system CSS variables into a specific DOM element
 */
function injectCSSVariables(
  element: HTMLElement | ShadowRoot,
  variables: Record<string, string>,
  websiteId?: string
): void {
  // Create or update style element for design system variables
  let styleElement = element.querySelector('#canvas-design-system-variables') as HTMLStyleElement

  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'canvas-design-system-variables'
    styleElement.setAttribute('data-canvas-injection', 'true')
    if (websiteId) {
      styleElement.setAttribute('data-website-id', websiteId)
    }
    element.appendChild(styleElement)
  }

  // Generate CSS variable declarations
  const cssDeclarations = Object.entries(variables)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n')

  styleElement.textContent = `
    :root {
${cssDeclarations}
    }
  `
}

/**
 * Creates print styles that use design system variables
 */
function createPrintStylesheet(websiteId?: string): HTMLStyleElement {
  const styleElement = document.createElement('style')
  styleElement.id = 'canvas-design-system-print-styles'
  styleElement.setAttribute('data-print-styles', 'true')
  if (websiteId) {
    styleElement.setAttribute('data-website-id', websiteId)
  }

  styleElement.textContent = `
    /* Print styles using design system variables */
    @media print {
      .site-builder-canvas {
        background: var(--ds-surface, #1a1a1a) !important;
      }

      .glass-panel {
        background: var(--ds-surface, rgba(26, 26, 26, 0.9)) !important;
        border-color: var(--ds-neutral, rgba(255, 255, 255, 0.1)) !important;
      }

      .node-card {
        background: var(--ds-surface, #1a1a1a) !important;
        border-color: var(--ds-neutral, rgba(255, 255, 255, 0.1)) !important;
        color: var(--ds-surface-foreground, #ffffff) !important;
      }

      .status-published {
        box-shadow:
          0 0 20px var(--ds-primary, rgba(16, 185, 129, 0.15)),
          inset 0 0 10px var(--ds-primary, rgba(16, 185, 129, 0.05)) !important;
      }

      .status-draft {
        box-shadow:
          0 0 20px var(--ds-accent, rgba(245, 158, 11, 0.15)),
          inset 0 0 10px var(--ds-accent, rgba(245, 158, 11, 0.05)) !important;
      }

      .react-flow__controls {
        background: var(--ds-surface, rgba(26, 26, 26, 0.9)) !important;
        border-color: var(--ds-neutral, rgba(255, 255, 255, 0.1)) !important;
      }

      .react-flow__minimap {
        background: var(--ds-surface, rgba(26, 26, 26, 0.9)) !important;
        border-color: var(--ds-neutral, rgba(255, 255, 255, 0.1)) !important;
      }

      /* Force text colors for print */
      * {
        color: var(--ds-surface-foreground, #ffffff) !important;
      }

      /* Hide UI elements in print */
      .react-flow__controls,
      .react-flow__minimap {
        display: none !important;
      }
    }
  `

  return styleElement
}

/**
 * Finds the ReactFlow canvas viewport element
 */
function findReactFlowViewport(selector?: string): HTMLElement | null {
  if (selector) {
    return document.querySelector(selector) as HTMLElement
  }

  // Try multiple selectors to find ReactFlow viewport
  const selectors = [
    '.react-flow__viewport',
    '.react-flow__renderer',
    '.react-flow',
    '[data-testid="react-flow"]',
    '.react-flow__pane'
  ]

  for (const sel of selectors) {
    const element = document.querySelector(sel) as HTMLElement
    if (element) {
      return element
    }
  }

  return null
}

/**
 * Observes DOM changes to re-inject variables when canvas is recreated
 */
function useCanvasObserver(
  callback: (viewport: HTMLElement) => void,
  canvasSelector?: string
): void {
  const observerRef = useRef<MutationObserver | null>(null)

  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if ReactFlow viewport was added
          const viewport = findReactFlowViewport(canvasSelector)
          if (viewport) {
            callback(viewport)
            break
          }
        }
      }
    })

    // Start observing document body
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [callback, canvasSelector])
}

/**
 * Main Design System Canvas Injector Component
 */
export function DesignSystemCanvasInjector({
  websiteId,
  canvasSelector,
  enablePrintStyles = true,
  customVariables = {},
  children
}: DesignSystemCanvasInjectorProps) {
  const { designSystem, isLoaded, activeConceptId } = useDesignSystem()
  const injectedRef = useRef<Set<string>>(new Set())

  /**
   * Generates CSS variables from design system
   */
  const generateCSSVariables = useCallback((): Record<string, string> => {
    if (!designSystem) return {}

    const variables: Record<string, string> = {}

    Object.entries(designSystem.variables).forEach(([key, value]) => {
      variables[key.replace(/^--/, '')] = value
    })

    Object.entries(designSystem.darkVariables ?? {}).forEach(([key, value]) => {
      variables[`dark-${key.replace(/^--/, '')}`] = value
    })

    // Typography variables
    if (designSystem.typography) {
      Object.entries(designSystem.typography).forEach(([category, fonts]) => {
        fonts.forEach((font, index) => {
          const name = font.name || `${category}-${index + 1}`
          variables[`ds-${category}-${name}`] = font.fontFamily
          if (font.fontSize) variables[`ds-${category}-${name}-size`] = font.fontSize
          if (font.fontWeight) variables[`ds-${category}-${name}-weight`] = String(font.fontWeight)
          if (font.lineHeight) variables[`ds-${category}-${name}-line-height`] = String(font.lineHeight)
          if (font.letterSpacing) variables[`ds-${category}-${name}-letter-spacing`] = font.letterSpacing
        })
      })
    }

    // Spacing variables
    if (designSystem.spacing?.scale) {
      designSystem.spacing.scale.forEach((value, index) => {
        const name = value.name || `${index + 1}`
        variables[`ds-spacing-${name}`] = `${value.value}${value.unit}`
      })
    }

    if (designSystem.spacing?.baseUnitPx !== undefined && designSystem.spacing.baseUnitPx !== null) {
      variables['ds-spacing-base'] = `${designSystem.spacing.baseUnitPx}px`
    }

    return variables
  }, [designSystem, activeConceptId])

  /**
   * Inject design system into canvas viewport
   */
  const injectIntoCanvas = useCallback((viewport: HTMLElement) => {
    if (!isLoaded || !designSystem) return

    const variables = generateCSSVariables()
    const allVariables = { ...variables, ...customVariables }

    // Inject into viewport
    injectCSSVariables(viewport, allVariables, websiteId)

    // Track injection
    const injectionId = `${websiteId || 'unknown'}-${viewport.id || 'unnamed'}`
    injectedRef.current.add(injectionId)

    // Add print styles to document head if enabled
    if (enablePrintStyles) {
      const existingPrintStyles = document.querySelector('#canvas-design-system-print-styles')
      if (!existingPrintStyles) {
        const printStylesheet = createPrintStylesheet(websiteId)
        document.head.appendChild(printStylesheet)
      }
    }
  }, [
    designSystem,
    isLoaded,
    generateCSSVariables,
    customVariables,
    websiteId,
    enablePrintStyles,
    activeConceptId
  ])

  // Set up canvas observer
  useCanvasObserver(injectIntoCanvas, canvasSelector)

  // Initial injection when component mounts or design system changes
  useEffect(() => {
    const viewport = findReactFlowViewport(canvasSelector)
    if (viewport) {
      injectIntoCanvas(viewport)
    }
  }, [injectIntoCanvas, canvasSelector])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove injected styles
      const styles = document.querySelectorAll('[data-canvas-injection="true"]')
      styles.forEach(style => {
        const websiteMatch = !websiteId || style.getAttribute('data-website-id') === websiteId
        if (websiteMatch) {
          style.remove()
        }
      })

      // Remove print styles
      const printStyles = document.querySelector('#canvas-design-system-print-styles')
      if (printStyles) {
        const websiteMatch = !websiteId || printStyles.getAttribute('data-website-id') === websiteId
        if (websiteMatch) {
          printStyles.remove()
        }
      }

      injectedRef.current.clear()
    }
  }, [websiteId])

  return <>{children}</>
}

/**
 * Hook to manually inject design system into custom canvas elements
 */
export function useDesignSystemCanvasInjection() {
  const { designSystem, isLoaded, activeConceptId } = useDesignSystem()

  const injectIntoElement = useCallback((
    element: HTMLElement | ShadowRoot,
    customVariables: Record<string, string> = {},
    websiteId?: string
  ) => {
    if (!isLoaded || !designSystem) return

    const variables: Record<string, string> = {}

    // Generate design system variables (same logic as component)
    Object.entries(designSystem.variables).forEach(([key, value]) => {
      variables[key.replace(/^--/, '')] = value
    })

    Object.entries(designSystem.darkVariables ?? {}).forEach(([key, value]) => {
      variables[`dark-${key.replace(/^--/, '')}`] = value
    })

    // Add custom variables
    Object.assign(variables, customVariables)

    injectCSSVariables(element, variables, websiteId)
  }, [designSystem, isLoaded, activeConceptId])

  return {
    injectIntoElement,
    hasDesignSystem: isLoaded && !!designSystem
  }
}
