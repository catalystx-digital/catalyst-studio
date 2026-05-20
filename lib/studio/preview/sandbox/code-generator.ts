/**
 * Code Generator for Sandbox Preview
 *
 * Generates React/Next.js code from component configurations
 * for live preview in the Vercel Sandbox.
 */

import type { PreviewDesignTokens, PreviewComponentConfig } from './types'

/**
 * Component type to import path mapping
 * Matches the component registry structure
 */
const COMPONENT_IMPORTS: Record<string, string> = {
  // Heroes
  'hero-simple': '@/lib/studio/components/cms/heroes/hero-simple',
  'hero-banner': '@/lib/studio/components/cms/heroes/hero-banner',
  'hero-with-image': '@/lib/studio/components/cms/heroes/hero-with-image',
  'hero-split': '@/lib/studio/components/cms/heroes/hero-split',
  'hero-minimal': '@/lib/studio/components/cms/heroes/hero-minimal',
  'hero-video': '@/lib/studio/components/cms/heroes/hero-video',
  'hero-carousel': '@/lib/studio/components/cms/heroes/hero-carousel',
  // Navigation
  'nav-bar': '@/lib/studio/components/cms/navigation/nav-bar',
  'footer': '@/lib/studio/components/cms/navigation/footer',
  // About
  'about-section': '@/lib/studio/components/cms/about/about-section',
  'team-grid': '@/lib/studio/components/cms/about/team-grid',
  // Features
  'feature-grid': '@/lib/studio/components/cms/features/feature-grid',
  'feature-list': '@/lib/studio/components/cms/features/feature-list',
  // CTA
  'cta-simple': '@/lib/studio/components/cms/cta/cta-simple',
  'cta-banner': '@/lib/studio/components/cms/cta/cta-banner',
  // Contact
  'contact-form': '@/lib/studio/components/cms/contact/contact-form',
  // Blog
  'blog-list': '@/lib/studio/components/cms/blog/blog-list',
  // Content
  'card-grid': '@/lib/studio/components/cms/content/card-grid',
  'two-column': '@/lib/studio/components/cms/content/two-column',
  'accordion': '@/lib/studio/components/cms/content/accordion',
  // Pricing
  'pricing-table': '@/lib/studio/components/cms/pricing/pricing-table',
}

/**
 * Convert component type to valid React component name
 */
function toComponentName(type: string): string {
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Generate CSS from design tokens
 */
export function generateDesignSystemCSS(tokens: PreviewDesignTokens): string {
  const lightVars = Object.entries(tokens.variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  let css = `/* Design System - Auto-generated */\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n${lightVars}\n}`

  if (tokens.darkVariables) {
    const darkVars = Object.entries(tokens.darkVariables)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n')
    css += `\n\n.dark {\n${darkVars}\n}`
  }

  return css
}

/**
 * Generate a preview page with components
 */
export function generatePreviewPage(components: PreviewComponentConfig[]): string {
  if (components.length === 0) {
    return generateEmptyPreviewPage()
  }

  // Collect unique component types and their imports
  const imports: string[] = []
  const componentTypes = new Set<string>()

  components.forEach((c) => {
    if (!componentTypes.has(c.type)) {
      componentTypes.add(c.type)
      const importPath = COMPONENT_IMPORTS[c.type]
      if (importPath) {
        const componentName = toComponentName(c.type)
        imports.push(`import { ${componentName} } from '${importPath}'`)
      }
    }
  })

  // Generate component JSX
  const componentJsx = components
    .map((c, i) => {
      const componentName = toComponentName(c.type)
      const propsStr = JSON.stringify(c.props, null, 2)
        .split('\n')
        .map((line, idx) => (idx === 0 ? line : '        ' + line))
        .join('\n')
      return `      <${componentName} key={${i}} {...(${propsStr})} />`
    })
    .join('\n')

  return `'use client'

/**
 * Preview Page - Auto-generated
 * This file is dynamically updated by the Site Builder
 */

${imports.join('\n')}

export default function PreviewPage() {
  return (
    <main className="min-h-screen">
${componentJsx}
    </main>
  )
}
`
}

/**
 * Generate empty preview page with placeholder
 */
function generateEmptyPreviewPage(): string {
  return `'use client'

/**
 * Preview Page - Auto-generated
 * Add components in the Site Builder to see them here
 */

export default function PreviewPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Live Preview Ready
        </h1>
        <p className="text-gray-600 mb-6">
          Add components in the Site Builder to see them here
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-500">Connected to sandbox</span>
        </div>
      </div>
    </main>
  )
}
`
}

/**
 * Generate a component props JSON file for dynamic updates
 * This allows updating props without regenerating the entire page
 */
export function generatePropsJson(
  components: PreviewComponentConfig[]
): string {
  return JSON.stringify(
    {
      timestamp: Date.now(),
      components: components.map((c, i) => ({
        id: `component-${i}`,
        type: c.type,
        props: c.props,
      })),
    },
    null,
    2
  )
}

/**
 * Generate all files needed for preview
 */
export function generatePreviewFiles(
  designSystem: PreviewDesignTokens | undefined,
  components: PreviewComponentConfig[]
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []

  // Always generate the preview page
  files.push({
    path: 'app/preview/page.tsx',
    content: generatePreviewPage(components),
  })

  // Generate design system CSS if provided
  if (designSystem) {
    files.push({
      path: 'app/globals.css',
      content: generateDesignSystemCSS(designSystem),
    })
  }

  // Generate props JSON for dynamic updates
  files.push({
    path: 'app/preview/props.json',
    content: generatePropsJson(components),
  })

  return files
}
