'use client'

import React, { useState, useMemo } from 'react'
import { X, Plus, Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import { toast } from 'sonner'

export interface SectionData {
  id: string
  type: string
  name: string
  category: string
  description?: string
  instances?: number
  preview?: string
  sharedComponentId?: string
}

// API response interface
interface ComponentType {
  id: string
  type: string
  category: string
  version: string
  defaultConfig: any
  placeholderData: any
  aiMetadata: any
  isGlobal: boolean
}

interface ComponentsApiResponse {
  items: ComponentType[]
  total: number
  page: number
  limit: number
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<ComponentsApiResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// Transform ComponentType from API to SectionData format
const transformComponentToSection = (component: ComponentType): SectionData => ({
  id: component.id,
  type: component.type,
  name: component.defaultConfig?.name || component.type,
  category: component.category,
  description: component.defaultConfig?.description || '',
  instances: component.isGlobal ? 1 : undefined, // Global components show instance count
})

interface SectionPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectSection: (section: SectionData) => void
  nodeId?: string
  websiteId?: string
}

export function SectionPicker({ isOpen, onClose, onSelectSection, nodeId, websiteId }: SectionPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  
  // Fetch components from API with retry logic
  const listKey = useMemo(
    () => (websiteId ? `/api/studio/site-builder/components?websiteId=${encodeURIComponent(websiteId)}&limit=100` : null),
    [websiteId]
  );
  const { data: apiResponse, error, isLoading, mutate } = useSWR(
    listKey,
    fetcher,
    {
      isPaused: () => !listKey,
      revalidateOnFocus: false,
      retryCount: 3,
      retryDelay: (attempt: number) => Math.min(1000 * (2 ** attempt), 4000), // Exponential backoff: 1s, 2s, 4s
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch components:', error)
        }
        toast.error('Unable to load components.')
      }
    }
  )

  // Fetch shared (global) components for this website
  type GlobalComponent = {
    id: string
    name: string
    type: string
    usageCount?: number
    properties?: Record<string, unknown>
  }

  const fetchShared = async (url: string): Promise<GlobalComponent[]> => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const json = await response.json()
    // API returns { success: true, data: [...], count, components: [...] }
    if (json?.success && Array.isArray(json.data)) return json.data
    if (Array.isArray(json.components)) return json.components
    if (Array.isArray(json)) return json
    return []
  }

  const { data: sharedItems, error: sharedError, isLoading: sharedLoading, mutate: mutateShared } = useSWR(
    websiteId ? `/api/studio/site-builder/global-components?websiteId=${websiteId}` : null,
    fetchShared,
    { revalidateOnFocus: false }
  )

  // Transform API data or use fallback
  const allSections = useMemo(() => {
    if (apiResponse?.items) {
      return apiResponse.items.map(transformComponentToSection)
    }
    return []
  }, [apiResponse])

  // Separate global (shared) and regular sections
  const { globalSections, regularSections } = useMemo(() => {
    const global: SectionData[] = []
    const regular: SectionData[] = []

    // First, use shared components from API as true global sections
    if (Array.isArray(sharedItems) && sharedItems.length > 0) {
      sharedItems.forEach((gc) => {
        global.push({
          id: gc.id,
          type: gc.type,
          name: gc.name,
          category: 'Global',
          description: '',
          instances: gc.usageCount ?? undefined,
          preview: undefined,
          sharedComponentId: gc.id,
        })
      })
    }

    // Then include regular component types
    allSections.forEach(section => {
      // If it already exists in global list by name, skip adding to regular list
      if (global.some(g => g.name === section.name)) return
      regular.push(section)
    })
    
    return { globalSections: global, regularSections: regular }
  }, [allSections, sharedItems])

  // Group regular sections by category
  const sectionCategories = useMemo(() => {
    const categories: Record<string, SectionData[]> = {}
    
    regularSections.forEach(section => {
      if (!categories[section.category]) {
        categories[section.category] = []
      }
      categories[section.category].push(section)
    })
    
    return categories
  }, [regularSections])

  // Filter sections based on search query
  const filteredGlobalSections = useMemo(() => 
    globalSections.filter(section =>
      section.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [globalSections, searchQuery])

  const filteredCategories = useMemo(() => 
    Object.entries(sectionCategories).filter(([category, sections]) =>
      category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sections.some(section => 
        section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (section.description && section.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    ), [sectionCategories, searchQuery])

  const filteredPreviewSections = useMemo(() => 
    regularSections.filter(section =>
      section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (section.description && section.description.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [regularSections, searchQuery])

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const handleSelectSection = (section: SectionData) => {
    onSelectSection(section)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - Click outside to close */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-y-0 left-0 z-50 pointer-events-none">
        {/* Left Panel */}
        <div className="w-[320px] bg-gray-900/95 backdrop-blur-md shadow-2xl pointer-events-auto flex flex-col h-full border-r border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Add Section</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF5500]/50 focus:border-[#FF5500]/50 focus:bg-white/10 transition-all"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Loading State */}
            {(isLoading || sharedLoading) && (
              <div className="space-y-6">
                <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Shared components
                </h3>
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="w-full p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-600 rounded animate-pulse" />
                            <div className="h-4 w-16 bg-gray-600 rounded animate-pulse" />
                          </div>
                          <div className="h-3 w-12 bg-gray-600 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Categories
                  </h3>
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="border border-white/10 rounded-lg overflow-hidden bg-white/5">
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-600 rounded animate-pulse" />
                              <div className="h-4 w-24 bg-gray-600 rounded animate-pulse" />
                            </div>
                            <div className="h-4 w-4 bg-gray-600 rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No results message */}
            {!isLoading && searchQuery && filteredGlobalSections.length === 0 && filteredCategories.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No sections found for &quot;{searchQuery}&quot;</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[#FF5500] text-sm mt-2 hover:underline"
                >
                  Clear search
                </button>
              </div>
            )}

            {!isLoading && !sharedLoading && (error || sharedError) && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">Components could not be loaded.</p>
                <button
                  onClick={() => {
                    mutate()
                    mutateShared()
                  }}
                  className="text-[#FF5500] text-sm mt-2 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !sharedLoading && !error && !sharedError && !searchQuery && filteredGlobalSections.length === 0 && filteredCategories.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No sections available.</p>
              </div>
            )}

            {/* Shared Components */}
            {!isLoading && !sharedError && filteredGlobalSections.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Shared components
                </h3>
                <div className="space-y-2">
                  {filteredGlobalSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => handleSelectSection(section)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FF5500]/50 rounded-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center">
                        <div className="w-4 h-4 bg-emerald-500 rounded-sm" />
                      </div>
                      <span className="text-sm font-medium text-gray-200">{section.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{section.instances} instance{section.instances !== 1 ? 's' : ''}</span>
                      <Plus className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {!isLoading && !error && filteredCategories.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Categories
                </h3>
                <div className="space-y-2">
                  {filteredCategories.map(([category, sections]) => (
                  <div key={category} className="border border-white/10 rounded-lg overflow-hidden bg-white/5">
                    <button
                      onClick={() => {
                        // If category has no sub-sections, add it directly
                        if (sections.length === 0) {
                          return
                        } else {
                          // Otherwise toggle to show sub-sections
                          toggleCategory(category)
                        }
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
                          <div className="w-4 h-4 bg-gray-500 rounded-sm" />
                        </div>
                        <span className="text-sm font-medium text-gray-200">{category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sections.length > 0 && (
                          <span className="text-xs text-gray-500">{sections.length}</span>
                        )}
                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-[#FF5500] transition-colors" />
                      </div>
                    </button>
                    
                    {expandedCategories.has(category) && sections.length > 0 && (
                      <div className="border-t border-white/10 bg-black/20 p-2">
                        {sections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() => handleSelectSection(section)}
                            className="w-full text-left p-2 hover:bg-white/10 rounded transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-300">{section.name}</div>
                            {section.description && (
                              <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}


