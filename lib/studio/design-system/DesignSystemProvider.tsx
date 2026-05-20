/**
 * Design System Provider
 *
 * Applies design system tokens to the application through CSS variables and React context
 * @module DesignSystemProvider
 */

'use client'

import React, { createContext, useContext, useEffect, useCallback, useState } from 'react'
import type { WebsiteDesignConcept } from '@/lib/generated/prisma'
import {
  useDesignSystemCache,
  getCSSVariable as getCSSVariableUtil
} from './cache-utils.client'
import { DesignSystemCssContext } from '@/lib/design-system/scoped-css-context'
import { type ShadcnDesignSystemTokens, generateExportCss } from './shadcn-transformer'

export interface DesignSystemContextValue {
  designSystem: ShadcnDesignSystemTokens | null
  isLoaded: boolean
  error: string | null
  refetch: () => Promise<void>
  getCSSVariable: (variableName: string) => string | null
  getToken: (category: string, name: string) => any
  cssVariables: string | null
  concepts: WebsiteDesignConcept[]
  activeConceptId: string | null
  setActiveConceptId: (conceptId: string | null) => void
}

const DesignSystemContext = createContext<DesignSystemContextValue>({
  designSystem: null,
  isLoaded: false,
  error: null,
  refetch: async () => {},
  getCSSVariable: () => null,
  getToken: () => null,
  cssVariables: null,
  concepts: [],
  activeConceptId: null,
  setActiveConceptId: () => {}
})

export interface DesignSystemProviderProps {
  websiteId?: string
  conceptId?: string
  concepts?: WebsiteDesignConcept[]
  designSystem?: ShadcnDesignSystemTokens | null
  children: React.ReactNode
  enableSSR?: boolean
}

export function DesignSystemProvider({
  websiteId,
  conceptId,
  concepts: initialConcepts = [],
  designSystem: initialDesignSystem,
  children,
  enableSSR = true
}: DesignSystemProviderProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(conceptId ?? null)

  useEffect(() => {
    setSelectedConceptId(conceptId ?? null)
  }, [conceptId])

  // Use client-side cache hook if websiteId is provided, otherwise use initial design system
  const {
    designSystem: cachedDesignSystem,
    cssVariables,
    canonicalCssVariables,
    aliasCssVariables,
    concepts,
    activeConceptId,
    loading,
    error,
    fetchDesignSystem,
    invalidateCache,
    lastUpdated
  } = useDesignSystemCache(websiteId || '', selectedConceptId ?? undefined)

  // Use cached design system or fallback to initial design system
  const designSystem = cachedDesignSystem || initialDesignSystem || null
  const finalError = error || null
  const hasResolved = !!designSystem || !!finalError || !websiteId || lastUpdated !== null
  const isLoaded = hasResolved && !loading

  // Generate CSS from new format
  const generatedCss = designSystem ? generateExportCss(designSystem) : null

  const cachedCombinedCss = cssVariables ?? (
    (canonicalCssVariables || aliasCssVariables)
      ? [canonicalCssVariables, aliasCssVariables].filter(Boolean).join('\n')
      : null
  )

  const resolvedCssVariables = cachedCombinedCss ?? generatedCss ?? null

  // Auto-fetch design system on mount when websiteId is provided but no data exists
  useEffect(() => {
    if (websiteId && !cachedDesignSystem && !loading && !error && lastUpdated === null) {
      fetchDesignSystem()
    }
  }, [websiteId, cachedDesignSystem, loading, error, lastUpdated, fetchDesignSystem])

  // Refetch function that combines cache invalidation and fetch
  const refetch = useCallback(async () => {
    if (websiteId) {
      invalidateCache()
      await fetchDesignSystem()
    }
  }, [websiteId, invalidateCache, fetchDesignSystem])

  const handleConceptChange = useCallback(
    (nextConceptId: string | null) => {
      if (nextConceptId === selectedConceptId) {
        return
      }
      setSelectedConceptId(nextConceptId)
    },
    [selectedConceptId]
  )

  // Helper to get CSS variable value from design system data
  // variableName should be in format "--primary" or "primary"
  const getCSSVariable = useCallback((variableName: string): string | null => {
    if (!designSystem) return null

    // Normalize the variable name to include "--" prefix
    const normalizedName = variableName.startsWith('--') ? variableName : `--${variableName}`

    // Look up in variables
    if (designSystem.variables && normalizedName in designSystem.variables) {
      return designSystem.variables[normalizedName]
    }

    // Fallback to actual CSS variable
    return getCSSVariableUtil(variableName.replace(/^--/, ''))
  }, [designSystem])

  // Helper to get token object by category and name
  // Supports: 'variables', 'typography', 'spacing'
  const getToken = useCallback((category: string, name: string): any => {
    if (!designSystem) return null

    switch (category) {
      case 'variables':
        // Look up a CSS variable
        const varName = name.startsWith('--') ? name : `--${name}`
        return designSystem.variables?.[varName] ?? null

      case 'typography': {
        // Search in typography arrays
        if (!designSystem.typography) return null
        const typographyCategories = ['heading', 'body', 'ui'] as const
        for (const cat of typographyCategories) {
          const tokens = designSystem.typography[cat]
          if (tokens) {
            const found = tokens.find(t => t.name === name || t.fontFamily === name || t.role === name)
            if (found) return found
          }
        }
        return null
      }

      case 'spacing': {
        // Search in spacing scale
        if (!designSystem.spacing?.scale) return null
        return designSystem.spacing.scale.find(s => s.name === name || s.value.toString() === name) ?? null
      }

      default:
        return null
    }
  }, [designSystem])

  const resolvedConcepts = concepts.length ? concepts : initialConcepts

  const contextValue: DesignSystemContextValue = {
    designSystem,
    isLoaded,
    error: finalError,
    refetch,
    getCSSVariable,
    getToken,
    cssVariables: resolvedCssVariables,
    concepts: resolvedConcepts,
    activeConceptId: activeConceptId ?? selectedConceptId,
    setActiveConceptId: handleConceptChange
  }

  const cssContextValue = {
    cssVariables: resolvedCssVariables
  }

  return (
    <DesignSystemCssContext.Provider value={cssContextValue}>
      <DesignSystemContext.Provider value={contextValue}>
        {children}
      </DesignSystemContext.Provider>
    </DesignSystemCssContext.Provider>
  )
}

/**
 * Hook to use the design system context
 */
export function useDesignSystem() {
  return useContext(DesignSystemContext)
}
