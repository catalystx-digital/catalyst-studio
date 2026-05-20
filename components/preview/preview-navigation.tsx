'use client'

/**
 * Preview Navigation Component
 * Story 1.4: Multi-page navigation for preview system
 */

import React from 'react'
import { usePreviewContext } from '@/lib/context/preview-context'
import { ChevronLeft, ChevronRight, Home, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviewNavigationProps {
  className?: string
}

function PreviewNavigationComponent({ className }: PreviewNavigationProps) {
  const { state, navigateToPage } = usePreviewContext()
  const { pages, currentPage } = state

  if (pages.length <= 1) {
    return null // No navigation needed for single page
  }

  const currentPageData = pages[currentPage] || pages[0]
  const canGoPrevious = currentPage > 0
  const canGoNext = currentPage < pages.length - 1

  // Generate breadcrumb path
  const breadcrumbs = currentPageData?.path?.split('/').filter(Boolean) || []

  return (
    <div className={cn('preview-navigation', className)}>
      {/* Main Navigation Bar */}
      <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={!canGoPrevious}
            className={cn(
              'p-1.5 rounded hover:bg-gray-100 transition-colors',
              !canGoPrevious && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={!canGoNext}
            className={cn(
              'p-1.5 rounded hover:bg-gray-100 transition-colors',
              !canGoNext && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigateToPage(0)}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            aria-label="Go to home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded">
          <span className="text-xs text-gray-500">localhost:3000</span>
          {currentPageData?.path && (
            <>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-gray-700 font-medium">
                {currentPageData.path}
              </span>
            </>
          )}
        </div>

        {/* External Link */}
        <button
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          aria-label="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <button
            onClick={() => navigateToPage(0)}
            className="text-gray-600 hover:text-[#FF5500] transition-colors"
          >
            Home
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => {
                  // Find page by matching path
                  const pageIndex = pages.findIndex(p => 
                    p.path === breadcrumbs.slice(0, index + 1).join('/')
                  )
                  if (pageIndex >= 0) navigateToPage(pageIndex)
                }}
                className={cn(
                  'text-gray-600 hover:text-[#FF5500] transition-colors capitalize',
                  index === breadcrumbs.length - 1 && 'text-gray-900 font-medium'
                )}
              >
                {crumb.replace(/-/g, ' ')}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Page Switcher */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Page {currentPage + 1} of {pages.length}
        </div>
        
        {/* Quick Page Selector */}
        <div className="flex gap-1">
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => navigateToPage(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentPage
                  ? 'bg-[#FF5500] w-6'
                  : 'bg-gray-300 hover:bg-gray-400'
              )}
              aria-label={`Go to ${page.title}`}
              title={page.title}
            />
          ))}
        </div>
      </div>

      {/* Page List Dropdown */}
      {pages.length > 5 && (
        <div className="mt-2">
          <select
            value={currentPage}
            onChange={(e) => navigateToPage(parseInt(e.target.value))}
            className="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#FF5500] focus:border-transparent"
          >
            {pages.map((page, index) => (
              <option key={page.id} value={index}>
                {page.title} - {page.path}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// Export memoized component for performance
export const PreviewNavigation = React.memo(PreviewNavigationComponent)