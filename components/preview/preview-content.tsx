'use client'

/**
 * Preview Content Renderer
 * Story 1.4: Content injection and hot reload for preview
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { usePreviewContext } from '@/lib/context/preview-context'
import { useContentTypes } from '@/lib/context/content-type-context'
import { debounce } from '@/lib/utils'

interface PreviewContentProps {
  className?: string
  autoGenerate?: boolean
}

function PreviewContentComponent({ autoGenerate = true }: PreviewContentProps) {
  const { state, updateContent } = usePreviewContext()
  // Always call hooks - conditional usage handled by the context itself
  const contentTypeContext = useContentTypes()
  const lastContentRef = useRef<string>('')

  // Generate sample data for field types
  const generateFieldSample = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
        return 'Lorem ipsum dolor sit'
      case 'number':
        return '42'
      case 'boolean':
        return 'Yes'
      case 'date':
        return new Date().toLocaleDateString()
      case 'image':
        return '[Image placeholder]'
      case 'richtext':
        return 'Rich text content...'
      default:
        return 'Sample value'
    }
  }

  // Generate content cards for a content type
  const generateContentCards = useCallback((contentType: { name: string; fields?: Array<{ label: string; type: string }> }) => {
    const cards = []
    for (let i = 1; i <= 3; i++) {
      cards.push(`
        <div class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h3 class="font-semibold text-gray-800 mb-2">${contentType.name} ${i}</h3>
          <p class="text-sm text-gray-600 mb-3">Sample content for ${contentType.name.toLowerCase()}</p>
          ${contentType.fields?.slice(0, 2).map((field: { label: string; type: string }) => `
            <div class="text-xs text-gray-500 mb-1">
              <span class="font-medium">${field.label}:</span> 
              ${generateFieldSample(field.type)}
            </div>
          `).join('') || ''}
          <button class="mt-3 text-xs text-[#FF5500] hover:underline">Read more →</button>
        </div>
      `)
    }
    return cards.join('')
  }, [])

  // Generate preview content from content types
  const generatePreviewContent = useCallback(() => {
    if (!contentTypeContext) {
      return generateDefaultContent()
    }

    const { contentTypes } = contentTypeContext
    
    if (contentTypes.length === 0) {
      return generateDefaultContent()
    }

    // Generate a simple preview based on content types
    const html = `
      <div class="preview-content p-8">
        <header class="mb-8">
          <h1 class="text-4xl font-bold text-gray-900 mb-2">Welcome to Your Site</h1>
          <p class="text-lg text-gray-600">Preview of your content structure</p>
        </header>
        
        <nav class="mb-8 p-4 bg-gray-50 rounded-lg">
          <ul class="flex gap-6">
            <li><a href="#" class="text-[#FF5500] font-medium hover:underline">Home</a></li>
            <li><a href="#" class="text-gray-700 hover:text-[#FF5500]">About</a></li>
            <li><a href="#" class="text-gray-700 hover:text-[#FF5500]">Services</a></li>
            <li><a href="#" class="text-gray-700 hover:text-[#FF5500]">Contact</a></li>
          </ul>
        </nav>

        <main class="space-y-8">
          ${contentTypes.map(contentType => `
            <section class="border-l-4 border-[#FF5500] pl-6">
              <h2 class="text-2xl font-semibold text-gray-800 mb-4">
                ${contentType.icon || '📄'} ${contentType.pluralName || contentType.name}
              </h2>
              <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                ${generateContentCards(contentType)}
              </div>
            </section>
          `).join('')}
        </main>

        <footer class="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>© 2025 Your Company. Built with Catalyst Studio.</p>
        </footer>
      </div>
    `

    const styles = `
      .preview-content {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        animation: fadeIn 0.5s ease-in;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .preview-content h1, .preview-content h2 {
        background: linear-gradient(135deg, #FF5500 0%, #FF8844 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .preview-content section {
        animation: slideIn 0.6s ease-out;
        animation-fill-mode: both;
      }

      .preview-content section:nth-child(1) { animation-delay: 0.1s; }
      .preview-content section:nth-child(2) { animation-delay: 0.2s; }
      .preview-content section:nth-child(3) { animation-delay: 0.3s; }

      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @media (max-width: 768px) {
        .preview-content {
          padding: 1rem;
        }
        .preview-content h1 {
          font-size: 2rem;
        }
      }
    `

    return { html, styles }
  }, [contentTypeContext, generateContentCards])

  // Generate default content when no content types exist
  const generateDefaultContent = () => {
    const html = `
      <div class="default-preview p-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div class="max-w-4xl mx-auto">
          <header class="text-center mb-12">
            <div class="inline-block p-4 bg-[#FF5500] rounded-2xl mb-4">
              <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 class="text-4xl font-bold text-gray-900 mb-4">Preview Mode</h1>
            <p class="text-lg text-gray-600">Start building your website with Catalyst Studio</p>
          </header>

          <div class="grid gap-6 md:grid-cols-2">
            <div class="bg-white p-6 rounded-xl shadow-sm">
              <h2 class="text-xl font-semibold text-gray-800 mb-3">📝 Create Content Types</h2>
              <p class="text-gray-600 mb-4">Define your data structure with our visual builder</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Drag & drop fields</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Set validation rules</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Define relationships</span>
                </div>
              </div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm">
              <h2 class="text-xl font-semibold text-gray-800 mb-3">🎨 Design Your Site</h2>
              <p class="text-gray-600 mb-4">Use AI to generate beautiful layouts</p>
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>Responsive design</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>Multiple themes</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <span class="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>Custom components</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 p-6 bg-gradient-to-r from-[#FF5500]/10 to-[#0077CC]/10 rounded-xl">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">🚀 Ready to Deploy</h3>
            <p class="text-gray-600">Export your site to your favorite CMS platform</p>
            <div class="flex gap-4 mt-4">
              <span class="px-3 py-1 bg-white rounded-lg text-sm font-medium">Optimizely</span>
              <span class="px-3 py-1 bg-white rounded-lg text-sm font-medium">Contentful</span>
              <span class="px-3 py-1 bg-white rounded-lg text-sm font-medium">Strapi</span>
            </div>
          </div>
        </div>
      </div>
    `

    const styles = `
      .default-preview {
        animation: fadeIn 0.8s ease-in;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .default-preview > div > * {
        animation: slideUp 0.6s ease-out;
        animation-fill-mode: both;
      }

      .default-preview > div > *:nth-child(1) { animation-delay: 0.1s; }
      .default-preview > div > *:nth-child(2) { animation-delay: 0.2s; }
      .default-preview > div > *:nth-child(3) { animation-delay: 0.3s; }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `

    return { html, styles }
  }

  // Debounced content update function (ensures updates within 2 seconds)
  const debouncedUpdate = useMemo(
    () => debounce((content: string, styles: string) => {
      updateContent(content, styles)
    }, 500), // 500ms debounce, well within the 2-second requirement
    [updateContent]
  )

  // Auto-generate content when content types change
  useEffect(() => {
    if (autoGenerate && contentTypeContext) {
      const { contentTypes } = contentTypeContext
      
      // Generate content if content types have changed
      const contentKey = JSON.stringify(contentTypes)
      if (contentKey !== lastContentRef.current) {
        lastContentRef.current = contentKey
        
        const { html, styles } = generatePreviewContent()
        debouncedUpdate(html, styles)
      }
    }
  }, [contentTypeContext, autoGenerate, generatePreviewContent, debouncedUpdate])

  // Generate initial content on mount
  useEffect(() => {
    if (autoGenerate && !state.content) {
      const { html, styles } = generatePreviewContent()
      updateContent(html, styles)
    }
  }, [autoGenerate, generatePreviewContent, state.content, updateContent]) // Required dependencies

  // Hot reload simulation - refresh content periodically if enabled
  // TEMPORARILY DISABLED to debug style loss issue
  /*
  useEffect(() => {
    if (state.settings.autoRefresh && state.content) {
      const interval = setInterval(() => {
        // In a real app, this would check for actual content changes
        // For now, we'll just trigger a subtle animation
        const timestamp = Date.now()
        const refreshIndicator = `<!-- Last refresh: ${timestamp} -->`
        
        if (state.content && !state.content.includes(refreshIndicator)) {
          const updatedContent = state.content + refreshIndicator
          // Pass the current styles along with updated content
          updateContent(updatedContent, state.styles)
        }
      }, state.settings.refreshInterval)

      return () => clearInterval(interval)
    }
  }, [state.settings.autoRefresh, state.settings.refreshInterval, state.content, state.styles, updateContent])
  */

  return null // This component doesn't render anything directly
}

// Utility function for content generation from various sources
export function generateContentFromSource(source: 'contentTypes' | 'mockData' | 'ai', data?: unknown) {
  switch (source) {
    case 'contentTypes':
      // Generate from content type definitions
      return generateFromContentTypes(data)
    case 'mockData':
      // Generate from mock data
      return generateFromMockData(data)
    case 'ai':
      // Generate using AI (placeholder for future integration)
      return generateFromAI(data)
    default:
      return { html: '', styles: '' }
  }
}

function generateFromContentTypes(contentTypes: unknown) {
  // Implementation would go here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = contentTypes; // Placeholder parameter
  return { html: '<div>Generated from content types</div>', styles: '' }
}

function generateFromMockData(mockData: unknown) {
  // Implementation would go here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = mockData; // Placeholder parameter
  return { html: '<div>Generated from mock data</div>', styles: '' }
}

function generateFromAI(prompt: unknown) {
  // Placeholder for AI generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = prompt; // Placeholder parameter
  return { html: '<div>AI generation coming soon</div>', styles: '' }
}

// Export memoized component for performance
export const PreviewContent = React.memo(PreviewContentComponent)