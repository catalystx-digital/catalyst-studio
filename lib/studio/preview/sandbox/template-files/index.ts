/**
 * Template Files for Sandbox Preview
 *
 * These templates are written to the sandbox via writeFiles() API.
 * They provide the dynamic content rendering capability without
 * requiring a separate git template repository.
 */

export { dynamicPageTemplate, homePageTemplate } from './dynamic-page'
export { previewRendererTemplate } from './preview-renderer'
export { layoutTemplate, globalsCssTemplate } from './layout-template'

/**
 * Get all template files ready to write to sandbox
 */
export function getSandboxTemplateFiles(designSystemCss?: string): Array<{ path: string; content: Buffer }> {
  const { dynamicPageTemplate } = require('./dynamic-page')
  const { previewRendererTemplate } = require('./preview-renderer')
  const { layoutTemplate, globalsCssTemplate } = require('./layout-template')

  // Use provided CSS or default
  const cssContent = designSystemCss || globalsCssTemplate

  return [
    // Main page - overwrites template's app/page.tsx to use our dynamic rendering
    {
      path: 'app/page.tsx',
      content: Buffer.from(dynamicPageTemplate),
    },
    // Preview renderer with all components
    {
      path: 'lib/preview-renderer.tsx',
      content: Buffer.from(previewRendererTemplate),
    },
    // Root layout
    {
      path: 'app/layout.tsx',
      content: Buffer.from(layoutTemplate),
    },
    // Design system CSS
    {
      path: 'app/globals.css',
      content: Buffer.from(cssContent),
    },
  ]
}
