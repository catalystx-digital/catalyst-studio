/**
 * Client-side Design System Cache Utilities
 *
 * Client-safe caching utilities that work in the browser without server dependencies
 * Uses React hooks and local storage for client-side caching.
 *
 * @module DesignSystemCacheUtilsClient
 */

import { useState, useEffect, useCallback } from 'react'
import type { WebsiteDesignConcept } from '@/lib/generated/prisma'
import { type ShadcnDesignSystemTokens, generateExportCss } from './shadcn-transformer'
import { getNormalizedDesignSystem } from './design-system-reader'

// Client-side cache storage key
const CLIENT_CACHE_KEY = 'design-system-cache'

// Cache durations in milliseconds
export const CLIENT_CACHE_DURATIONS = {
  DESIGN_SYSTEM: 3600000, // 1 hour in ms
  CSS_VARIABLES: 7200000 // 2 hours in ms
}

export interface ClientCacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CachedCssPayload {
  combined: string
  canonical?: string | null
  aliases?: string | null
}

export interface DesignSystemCacheState {
  designSystem: ShadcnDesignSystemTokens | null
  cssVariables: string | null
  canonicalCssVariables: string | null
  aliasCssVariables: string | null
  concepts: WebsiteDesignConcept[]
  activeConceptId: string | null
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

/**
 * Client-side cache for design system data
 */
export function useDesignSystemCache(websiteId: string, conceptId?: string): DesignSystemCacheState & {
  fetchDesignSystem: () => Promise<void>
  clearCache: () => void
  invalidateCache: () => void
} {
  const conceptKey = conceptId ?? 'default'
  const [state, setState] = useState<DesignSystemCacheState>({
    designSystem: null,
    cssVariables: null,
    canonicalCssVariables: null,
    aliasCssVariables: null,
    concepts: [],
    activeConceptId: conceptId ?? null,
    loading: false,
    error: null,
    lastUpdated: null
  })

  // Clear previous website state so downstream hooks refetch for the next website
  useEffect(() => {
    setState(prev => {
      if (
        prev.designSystem === null &&
        prev.cssVariables === null &&
        prev.canonicalCssVariables === null &&
        prev.aliasCssVariables === null &&
        prev.loading === false &&
        prev.error === null &&
        prev.lastUpdated === null
      ) {
        return prev
      }

      return {
        designSystem: null,
        cssVariables: null,
        canonicalCssVariables: null,
        aliasCssVariables: null,
        concepts: [],
        activeConceptId: conceptId ?? null,
        loading: false,
        error: null,
        lastUpdated: null
      }
    })
  }, [websiteId, conceptKey])

  // Get cached data from localStorage
  const getCachedData = useCallback(<T>(key: string): T | null => {
    if (typeof window === 'undefined') return null

    try {
      const cached = localStorage.getItem(`${CLIENT_CACHE_KEY}:${key}`)
      if (!cached) return null

      const entry: ClientCacheEntry<T> = JSON.parse(cached)

      // Check if cache is expired
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(`${CLIENT_CACHE_KEY}:${key}`)
        return null
      }

      return entry.data
    } catch (error) {
      console.warn('Failed to read from cache:', error)
      return null
    }
  }, [])

  // Set cached data in localStorage
  const setCachedData = useCallback(<T>(key: string, data: T, duration: number): void => {
    if (typeof window === 'undefined') return

    try {
      const entry: ClientCacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + duration
      }

      localStorage.setItem(`${CLIENT_CACHE_KEY}:${key}`, JSON.stringify(entry))
    } catch (error) {
      console.warn('Failed to write to cache:', error)
    }
  }, [])

  // Fetch design system from API with client-side caching
  const fetchDesignSystem = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const cacheKey = `design-system:${websiteId}:${conceptKey}`
      const cssCacheKey = `css-variables:${websiteId}:${conceptKey}`
      const conceptsCacheKey = `${CLIENT_CACHE_KEY}:concepts:${websiteId}`

      const cachedDesignSystem = getCachedData<ShadcnDesignSystemTokens>(cacheKey)
      const cachedCssPayload = getCachedData<CachedCssPayload | string>(cssCacheKey)
      const cachedConcepts = getCachedData<WebsiteDesignConcept[]>(conceptsCacheKey)

      if (cachedDesignSystem) {
        const normalized = normalizeCachedCssPayload(cachedCssPayload)
        setState(prev => ({
          ...prev,
          designSystem: getNormalizedDesignSystem(cachedDesignSystem),
          cssVariables: normalized.combined,
          canonicalCssVariables: normalized.canonical,
          aliasCssVariables: normalized.aliases,
          concepts: cachedConcepts ?? prev.concepts,
          activeConceptId: conceptKey,
          loading: false,
          lastUpdated: Date.now()
        }))
        return
      }

      const response = await fetch(`/api/website/${websiteId}/design-system${conceptId ? `?conceptId=${conceptId}` : ''}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch design system: ${response.statusText}`)
      }

      const result = await response.json()
      const rawDesignSystem = result.data?.designSystem
      const concepts = (result.data?.concepts as WebsiteDesignConcept[] | undefined) ?? []
      const activeConcept = result.data?.activeConcept ?? null

      if (rawDesignSystem) {
        // Normalize to ShadcnDesignSystemTokens format (handles both old and new formats)
        const designSystem = getNormalizedDesignSystem(rawDesignSystem)

        setCachedData(cacheKey, designSystem, CLIENT_CACHE_DURATIONS.DESIGN_SYSTEM)
        if (concepts.length) {
          setCachedData(conceptsCacheKey, concepts, CLIENT_CACHE_DURATIONS.DESIGN_SYSTEM)
        }

        // Generate CSS from the new format
        const cssOutput = generateExportCss(designSystem)
        const payload: CachedCssPayload = {
          combined: cssOutput,
          canonical: cssOutput,
          aliases: null
        }
        setCachedData(cssCacheKey, payload, CLIENT_CACHE_DURATIONS.CSS_VARIABLES)

        setState(prev => ({
          ...prev,
          designSystem,
          cssVariables: cssOutput,
          canonicalCssVariables: cssOutput,
          aliasCssVariables: null,
          concepts: concepts.length ? concepts : prev.concepts,
          activeConceptId: activeConcept?.id ?? conceptKey,
          loading: false,
          lastUpdated: Date.now()
        }))
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          cssVariables: null,
          canonicalCssVariables: null,
          aliasCssVariables: null,
          error: null,
          lastUpdated: Date.now()
        }))
      }
    } catch (error) {
      console.error('Failed to fetch design system:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        cssVariables: null,
        canonicalCssVariables: null,
        aliasCssVariables: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: Date.now()
      }))
    }
  }, [websiteId, conceptKey, conceptId, getCachedData, setCachedData])

  // Clear all cache
  const clearCache = useCallback((): void => {
    if (typeof window === 'undefined') return

    try {
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(CLIENT_CACHE_KEY)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))

      setState({
        designSystem: null,
        cssVariables: null,
        canonicalCssVariables: null,
        aliasCssVariables: null,
        concepts: [],
        activeConceptId: null,
        loading: false,
        error: null,
        lastUpdated: null
      })
    } catch (error) {
      console.warn('Failed to clear cache:', error)
    }
  }, [])

  // Invalidate specific cache entry
  const invalidateCache = useCallback((): void => {
    if (typeof window === 'undefined') return

    try {
      const cacheKey = `${CLIENT_CACHE_KEY}:design-system:${websiteId}:${conceptKey}`
      const cssCacheKey = `${CLIENT_CACHE_KEY}:css-variables:${websiteId}:${conceptKey}`
      const conceptsCacheKey = `${CLIENT_CACHE_KEY}:concepts:${websiteId}`

      localStorage.removeItem(cacheKey)
      localStorage.removeItem(cssCacheKey)
      localStorage.removeItem(conceptsCacheKey)

      setState(prev => ({
        ...prev,
        designSystem: null,
        cssVariables: null,
        canonicalCssVariables: null,
        aliasCssVariables: null,
        concepts: [],
        activeConceptId: conceptId ?? null,
        lastUpdated: null
      }))
    } catch (error) {
      console.warn('Failed to invalidate cache:', error)
    }
  }, [websiteId, conceptKey, conceptId])

  // Initialize with cached data on mount
  useEffect(() => {
    const cacheKey = `${CLIENT_CACHE_KEY}:design-system:${websiteId}:${conceptKey}`
    const cssCacheKey = `${CLIENT_CACHE_KEY}:css-variables:${websiteId}:${conceptKey}`
    const conceptsCacheKey = `${CLIENT_CACHE_KEY}:concepts:${websiteId}`

    const cachedDesignSystem = getCachedData<ShadcnDesignSystemTokens>(cacheKey)
    const cachedCssVariables = getCachedData<CachedCssPayload | string>(cssCacheKey)
    const cachedConcepts = getCachedData<WebsiteDesignConcept[]>(conceptsCacheKey)
    const normalized = normalizeCachedCssPayload(cachedCssVariables)

    if (cachedDesignSystem) {
      setState(prev => ({
        ...prev,
        designSystem: getNormalizedDesignSystem(cachedDesignSystem),
        cssVariables: normalized.combined,
        canonicalCssVariables: normalized.canonical,
        aliasCssVariables: normalized.aliases,
        concepts: cachedConcepts ?? prev.concepts,
        activeConceptId: conceptKey,
        lastUpdated: Date.now()
      }))
    }
  }, [websiteId, conceptKey, getCachedData])

  return {
    ...state,
    fetchDesignSystem,
    clearCache,
    invalidateCache
  }
}

function normalizeCachedCssPayload(
  payload: CachedCssPayload | string | null
): { combined: string | null; canonical: string | null; aliases: string | null } {
  if (!payload) {
    return { combined: null, canonical: null, aliases: null }
  }

  if (typeof payload === 'string') {
    return { combined: payload, canonical: null, aliases: null }
  }

  return {
    combined: payload.combined ?? null,
    canonical: payload.canonical ?? null,
    aliases: payload.aliases ?? null
  }
}

export function getCSSVariable(property: string): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  try {
    const root = document.documentElement
    return getComputedStyle(root).getPropertyValue(`--${property}`).trim() || null
  } catch (error) {
    console.error('Failed to get CSS variable:', error)
    return null
  }
}
