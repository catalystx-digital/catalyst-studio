import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { createRequire } from 'node:module'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import {
  ComponentCategory,
  ComponentType,
  type CMSComponentProps
} from '@/lib/studio/components/cms/_core/types'
import { listComponentContracts } from '@/lib/studio/components/catalog/component-contracts'
import { canonicalizeComponentType } from '@/lib/studio/import/detection/canonical'
import { buildExpectedFromRaw } from './build-expected-from-raw'

type CliFlag =
  | '--write-components'
  | '--build-fixtures'
  | '--update-expected'
  | '--generate-data'
  | '--serve'
  | '--port'
  | '--help'

interface CliOptions {
  writeComponents: boolean
  buildFixtures: boolean
  updateExpected: boolean
  generateData: boolean
  serve: boolean
  port: number
}

interface AtlasComponentSpec {
  canonicalType: string
  componentType: string
  description?: string
  cues?: string[]
  fragments?: string[]
  defaultRegion?: string
  source?: Record<string, unknown>
  content: Record<string, unknown>
  metadata?: Record<string, unknown>
  props?: Record<string, unknown>
}

interface AtlasRegionComponent {
  canonicalType: string
  heading?: string
  notes?: string
  variant?: string
}

interface AtlasRegionSpec {
  region: string
  heading?: string
  description?: string
  components: AtlasRegionComponent[]
}

interface AtlasPageSpec {
  id: string
  title: string
  description?: string
  regions: AtlasRegionSpec[]
  tags?: string[]
}

interface AtlasContractIndexEntry {
  canonicalType: string
  componentType?: string
  summary: string
  description?: string
  fragments: string[]
  cues: string[]
  defaultRegion?: string
  sources: Record<string, unknown>
}

interface AtlasComponentContract {
  canonicalType: string
  componentType?: string
  summary: string
  description?: string
  fragments: string[]
  cues: string[]
  sampleContent?: Record<string, unknown>
  defaultRegion?: string
  aiMetadata?: Record<string, unknown>
  propsMeta?: Record<string, unknown>
  sources: Record<string, unknown>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const ATLAS_ROOT = path.join(REPO_ROOT, 'prompts', 'component-atlas')
const SPEC_ROOT = path.join(ATLAS_ROOT, 'spec')
const COMPONENT_SPEC_DIR = path.join(SPEC_ROOT, 'components')
const PAGE_SPEC_DIR = path.join(SPEC_ROOT, 'pages')
const METADATA_DIR = path.join(ATLAS_ROOT, 'metadata')
const DATASET_ROOT = path.join(REPO_ROOT, 'prompts', 'evals', 'component-atlas')

const DEFAULT_CONTEXT = {
  language: 'en'
}

const CDN_BASE = 'https://cdn.component-atlas.dev'
const ATLAS_BASE_URL = process.env.COMPONENT_ATLAS_BASE_URL || 'https://component-atlas.local'

const COMPONENT_OVERRIDES: Record<string, (spec: AtlasComponentSpec) => AtlasComponentSpec> = {
  'blog-post': (spec) => {
    const content = { ...(spec.content || {}) } as Record<string, unknown>
    const heroImage = { ...(content.heroImage as Record<string, unknown> | undefined) }
    if (!heroImage.src || typeof heroImage.src !== 'string' || heroImage.src.includes('example.com')) {
      heroImage.src = `${CDN_BASE}/blog/hero.jpg`
    }
    heroImage.alt = heroImage.alt || 'Hero image for blog story'
    content.heroImage = heroImage

    delete (content as any).showShareActions
    delete (content as any).shareActions

    const props = { ...(spec.props || {}) }
    props.showShareActions = true
    props.shareActions = [
      {
        label: 'Share on LinkedIn',
        icon: 'linkedin',
        url: 'https://www.linkedin.com/shareArticle?mini=true&url=https://component-atlas.local/blog/barc-farmgate-launch'
      },
      {
        label: 'Share on X',
        icon: 'twitter',
        url: 'https://twitter.com/intent/tweet?url=https://component-atlas.local/blog/barc-farmgate-launch'
      }
    ]

    content.attachments = [
      {
        label: 'Download market insights report',
        url: '/downloads/market-insights-2024.pdf'
      }
    ]

    content.relatedLinks = [
      {
        label: 'Market activation recap',
        url: '/blog/market-activation-recap'
      },
      {
        label: 'Retail partnership toolkit',
        url: '/resources/retail-partnership-toolkit'
      }
    ]

    return {
      ...spec,
      content,
      props
    }
  }
}

const CUSTOM_RENDERERS: Record<string, (props: CMSComponentProps) => React.ReactElement> = {
  reviews: (props: CMSComponentProps) => {
    const content = (props.content || {}) as Record<string, any>
    const reviews = Array.isArray(content.reviews) ? (content.reviews as Array<Record<string, any>>) : []
    return React.createElement(
      'div',
      {
        className: 'atlas-reviews-grid',
        'data-component': 'reviews'
      },
      reviews.map((review, index) =>
        React.createElement(
          'article',
          {
            key: review.id || `review-${index}`,
            className: 'atlas-review-card'
          },
          [
            React.createElement(
              'div',
              { className: 'atlas-review-rating', key: 'rating' },
              '★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))
            ),
            review.reviewText
              ? React.createElement('p', { className: 'atlas-review-text', key: 'text' }, review.reviewText)
              : null,
            React.createElement(
              'footer',
              { className: 'atlas-review-footer', key: 'footer' },
              `${review.author || 'Anonymous'}${review.date ? ' • ' + review.date : ''}`
            )
          ].filter(Boolean)
        )
      )
    )
  }
}

function configureNextImage(): void {
  const globalAny = globalThis as any
  if (globalAny.__NEXT_IMAGE_OPTS) {
    return
  }

  const opts = {
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 64, 96, 160, 320],
    path: '/_next/image',
    loader: 'custom',
    domains: [],
    disableStaticImages: true,
    dangerouslyAllowSVG: true,
    unoptimized: true
  }

  globalAny.__NEXT_IMAGE_OPTS = opts
  try {
    Object.defineProperty(process.env, '__NEXT_IMAGE_OPTS', {
      value: opts,
      configurable: true,
      enumerable: false,
      writable: false
    })
  } catch {
    ;(process.env as unknown as Record<string, unknown>).__NEXT_IMAGE_OPTS = opts
  }

  globalAny.__next_image_custom_loader = (params: { src: string }) => params.src
}

function parseCliOptions(argv: string[]): CliOptions {
  const flags = new Set<CliFlag>()
  let port = 4173

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as CliFlag
    if (arg === '--port') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --port')
      }
      port = Number(value)
      if (!Number.isFinite(port) || port <= 0) {
        throw new Error(`Invalid port value: ${value}`)
      }
      index += 1
      continue
    }

    if (arg === '--help') {
      printHelp()
      process.exit(0)
    }

    if (
      arg === '--write-components' ||
      arg === '--build-fixtures' ||
      arg === '--update-expected' ||
      arg === '--generate-data' ||
      arg === '--serve'
    ) {
      flags.add(arg)
      continue
    }

    throw new Error(`Unknown flag: ${arg}`)
  }

  if (flags.size === 0) {
    printHelp()
    process.exit(1)
  }

  return {
    writeComponents: flags.has('--write-components'),
    buildFixtures: flags.has('--build-fixtures'),
    updateExpected: flags.has('--update-expected'),
    generateData: flags.has('--generate-data'),
    serve: flags.has('--serve'),
    port
  }
}

function printHelp(): void {
  console.log(`
Usage: pnpm tsx scripts/eval/build-component-atlas-fixtures.ts [flags]

Flags:
  --write-components   Export canonical component contracts to spec files.
  --build-fixtures     Render atlas pages and emit dom/context/assets files.
  --update-expected    Rebuild expected.json for pages that have raw.json captured.
  --generate-data      Overwrite raw.json/expected.json using canonical spec content.
  --serve              Serve generated DOM fixtures over HTTP for detector recording.
  --port <number>      Port used when --serve is enabled (default: 4173).
  --help               Show this help text.
`.trim())
}

async function ensureDirectories(): Promise<void> {
  const dirs = [ATLAS_ROOT, SPEC_ROOT, COMPONENT_SPEC_DIR, PAGE_SPEC_DIR, METADATA_DIR, DATASET_ROOT]
  await Promise.all(dirs.map(dir => fs.mkdir(dir, { recursive: true })))
}

function sortKeys<T extends Record<string, unknown>>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(entry => sortKeys(entry as T)) as unknown as T
  }

  const sorted: Record<string, unknown> = {}
  Object.keys(value)
    .sort()
    .forEach(key => {
      sorted[key] = sortKeys(value[key] as T)
    })
  return sorted as T
}

function toJson(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

function resolveCategory(componentType: ComponentType | string | undefined): ComponentCategory {
  const canonical = (componentType ? canonicalizeComponentType(componentType) : undefined) ?? 'unknown'

  if (
    canonical === 'navbar' ||
    canonical === 'mobile-menu' ||
    canonical === 'breadcrumb' ||
    canonical === 'breadcrumbs' ||
    canonical === 'megamenu' ||
    canonical === 'sidemenu' ||
    canonical === 'footer'
  ) {
    return ComponentCategory.Navigation
  }

  if (canonical.startsWith('hero-') || canonical === 'hero-simple') {
    return ComponentCategory.Heroes
  }

  if (
    canonical === 'text-block' ||
    canonical === 'two-column' ||
    canonical === 'accordion' ||
    canonical === 'tabs' ||
    canonical === 'card-grid' ||
    canonical === 'image-gallery' ||
    canonical === 'video-player' ||
    canonical === 'video-embed' ||
    canonical === 'quote-block'
  ) {
    return ComponentCategory.Content
  }

  if (
    canonical === 'feature-grid' ||
    canonical === 'feature-list' ||
    canonical === 'feature-showcase' ||
    canonical === 'feature-comparison'
  ) {
    return ComponentCategory.Features
  }

  if (
    canonical === 'cta-simple' ||
    canonical === 'cta-banner' ||
    canonical === 'cta-with-form' ||
    canonical === 'cta-button-group'
  ) {
    return ComponentCategory.CTA
  }

  if (
    canonical === 'testimonials' ||
    canonical === 'reviews' ||
    canonical === 'logo-cloud' ||
    canonical === 'case-study'
  ) {
    return ComponentCategory.SocialProof
  }

  if (
    canonical === 'contact-form' ||
    canonical === 'contact-info' ||
    canonical === 'location-map' ||
    canonical === 'simple-form'
  ) {
    return ComponentCategory.Contact
  }

  if (
    canonical === 'about-section' ||
    canonical === 'team-grid' ||
    canonical === 'mission' ||
    canonical === 'timeline'
  ) {
    return ComponentCategory.About
  }

  if (
    canonical === 'blog-post' ||
    canonical === 'blog-list' ||
    canonical === 'article-header' ||
    canonical === 'author-bio' ||
    canonical === 'related-posts'
  ) {
    return ComponentCategory.Blog
  }

  if (
    canonical === 'pricing-table' ||
    canonical === 'pricing-card' ||
    canonical === 'pricing-comparison'
  ) {
    return ComponentCategory.Pricing
  }

  if (canonical === 'data-table' || canonical === 'statistics' || canonical === 'chart') {
    return ComponentCategory.Data
  }

  return ComponentCategory.Content
}

function sanitizeContentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => sanitizeContentValue(entry))
  }

  if (value && typeof value === 'object') {
    const record: Record<string, unknown> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      record[key] = sanitizeContentValue(entry)
    })
    return record
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized === '#' || normalized === '') {
      return '/atlas'
    }
  }

  return value
}

function sanitizeComponentContent(content: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(content)) as Record<string, unknown>

  const stack: Array<Record<string, unknown>> = [clone]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    for (const [key, value] of Object.entries(current)) {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          current[key] = value.map(entry => {
            if (entry && typeof entry === 'object') {
              const copy = sanitizeContentValue(entry)
              if (copy && typeof copy === 'object') {
                stack.push(copy as Record<string, unknown>)
              }
              return copy
            }
            return sanitizeContentValue(entry)
          })
        } else {
          stack.push(value as Record<string, unknown>)
        }
        continue
      }

      if (
        (key === 'href' ||
          key === 'url' ||
          key === 'action' ||
          key === 'src' ||
          key === 'poster') &&
        typeof value === 'string'
      ) {
        const sanitized = sanitizeContentValue(value)
        current[key] = sanitized
      }
    }
  }

  return clone
}

async function loadComponentSpecs(): Promise<Map<string, AtlasComponentSpec>> {
  const specs = new Map<string, AtlasComponentSpec>()
  const entries = await fs.readdir(COMPONENT_SPEC_DIR)
  for (const file of entries) {
    if (!file.endsWith('.json')) continue
    const canonicalType = file.replace(/\.json$/, '')
    const filePath = path.join(COMPONENT_SPEC_DIR, file)
    const raw = await fs.readFile(filePath, 'utf-8')
    const spec = JSON.parse(raw) as AtlasComponentSpec
    specs.set(canonicalType, spec)
  }
  return specs
}

async function loadPageSpecs(): Promise<AtlasPageSpec[]> {
  const entries = await fs.readdir(PAGE_SPEC_DIR)
  const pages: AtlasPageSpec[] = []
  for (const file of entries) {
    if (!file.endsWith('.json')) continue
    const filePath = path.join(PAGE_SPEC_DIR, file)
    const raw = await fs.readFile(filePath, 'utf-8')
    const page = JSON.parse(raw) as AtlasPageSpec
    pages.push(page)
  }
  pages.sort((a, b) => a.id.localeCompare(b.id))
  return pages
}

async function writeComponentSpecs(contracts: AtlasComponentContract[]): Promise<void> {
  const indexEntries: AtlasContractIndexEntry[] = []

  for (const contract of contracts) {
    const canonicalType = contract.canonicalType
    const componentType = contract.componentType ?? canonicalType
    const defaultRegion =
      contract.defaultRegion ||
      (Array.isArray(contract.aiMetadata?.pageLocation) && contract.aiMetadata?.pageLocation?.length
        ? String(contract.aiMetadata?.pageLocation?.[0])
        : undefined)

    const spec: AtlasComponentSpec = sortKeys({
      canonicalType,
      componentType,
      description: contract.summary,
      cues: contract.cues,
      fragments: contract.fragments,
      defaultRegion,
      source: contract.sources,
      metadata: contract.aiMetadata,
      content: contract.sampleContent || {}
    })

    const override = COMPONENT_OVERRIDES[canonicalType]
    const finalSpec = override ? sortKeys(override(spec) as any) : spec

    const targetPath = path.join(COMPONENT_SPEC_DIR, `${canonicalType}.json`)
    await fs.writeFile(targetPath, toJson(finalSpec), 'utf-8')

    indexEntries.push({
      canonicalType,
      componentType,
      summary: contract.summary,
      description: contract.description,
      fragments: contract.fragments,
      cues: contract.cues,
      defaultRegion,
      sources: contract.sources
    })
  }

  indexEntries.sort((a, b) => a.canonicalType.localeCompare(b.canonicalType))
  const indexPath = path.join(METADATA_DIR, 'components.json')
  await fs.writeFile(indexPath, toJson(indexEntries), 'utf-8')
}

function buildComponentProps(
  page: AtlasPageSpec,
  region: AtlasRegionSpec,
  component: AtlasRegionComponent,
  spec: AtlasComponentSpec,
  ordinal: number
): CMSComponentProps {
  const canonicalType = canonicalizeComponentType(spec.componentType) ?? spec.componentType
  const componentType = (canonicalType as ComponentType) ?? (spec.componentType as ComponentType)
  const category = resolveCategory(componentType)
  const regionId = region.region as CMSComponentProps['content']['region']

  const props: CMSComponentProps = {
    id: `atlas-${page.id}-${component.canonicalType}-${ordinal}`,
    type: componentType,
    category,
    content: sanitizeComponentContent((spec.content || {}) as Record<string, unknown>),
    theme: 'light',
    variant: 'default'
  }

  if (spec.metadata && Object.keys(spec.metadata).length > 0) {
    props.aiMetadata = spec.metadata as unknown as CMSComponentProps['aiMetadata']
  }

  if (!props.content) {
    props.content = {}
  }

  if (component.variant) {
    props.variant = component.variant as CMSComponentProps['variant']
  }

  if (spec.props && typeof spec.props === 'object') {
    const extraProps = JSON.parse(JSON.stringify(spec.props)) as Record<string, unknown>
    for (const [key, value] of Object.entries(extraProps)) {
      if (key === 'id' || key === 'type' || key === 'category' || key === 'content') {
        continue
      }
      ;(props as unknown as Record<string, unknown>)[key] = value
    }
  }

  return props
}

async function renderPageToHtml(
  page: AtlasPageSpec,
  componentSpecs: Map<string, AtlasComponentSpec>
): Promise<string> {
  const sectionElements: React.ReactNode[] = []
  const sidebarElements: React.ReactNode[] = []
  const footerElements: React.ReactNode[] = []
  const headerElements: React.ReactNode[] = []

  let componentOrdinal = 0

  for (const regionSpec of page.regions) {
    const regionId = regionSpec.region

    const regionChildren: React.ReactNode[] = []
    for (const componentEntry of regionSpec.components) {
      const spec = componentSpecs.get(componentEntry.canonicalType)
      if (!spec) {
        throw new Error(
          `Component spec not found for canonical type "${componentEntry.canonicalType}" (page "${page.id}")`
        )
      }

      componentOrdinal += 1
      const props = buildComponentProps(page, regionSpec, componentEntry, spec, componentOrdinal)
      const customRenderer = CUSTOM_RENDERERS[componentEntry.canonicalType]
      let element: React.ReactElement
      if (customRenderer) {
        element = customRenderer(props)
      } else {
        const ComponentCtor = await cmsComponentFactory.loadComponent(props.type)
        element = React.createElement(ComponentCtor, props)
      }

      regionChildren.push(
        React.createElement(
          'section',
          {
            key: props.id,
            className: 'atlas-component-wrapper',
            'data-canonical-type': componentEntry.canonicalType,
            'data-region': regionId
          },
          React.createElement(
            React.Fragment,
            null,
            [
              componentEntry.heading
                ? React.createElement(
                    'h3',
                    { className: 'atlas-component-heading', key: `${props.id}-heading` },
                    componentEntry.heading
                  )
                : null,
              React.cloneElement(element as React.ReactElement, { key: `${props.id}-component` })
            ].filter(Boolean)
          )
        )
      )
    }

    const regionWrapperProps = {
      key: `${page.id}-${regionId}`,
      className: `atlas-region atlas-region-${regionId}`,
      'data-region': regionId
    }

    const regionHeading =
      regionSpec.heading ||
      `${regionId.charAt(0).toUpperCase()}${regionId.slice(1)} region (${regionSpec.components.length} components)`

    const headingElement = React.createElement(
      'h2',
      { className: 'atlas-region-heading', key: `${regionId}-heading` },
      regionHeading
    )
    const descriptionElement = regionSpec.description
      ? React.createElement('p', { className: 'atlas-region-description' }, regionSpec.description)
      : null

    const regionContainer = React.createElement(
      'div',
      {
        className: 'atlas-region-content',
        key: `${regionId}-content`
      },
      regionChildren
    )

    const wrapper = React.createElement(
      'div',
      regionWrapperProps,
      [headingElement, descriptionElement, regionContainer].filter(Boolean)
    )

    if (regionId === 'header') {
      headerElements.push(wrapper)
    } else if (regionId === 'footer') {
      footerElements.push(wrapper)
    } else if (regionId === 'sidebar') {
      sidebarElements.push(wrapper)
    } else {
      sectionElements.push(wrapper)
    }
  }

  const document = React.createElement(
    'html',
    { lang: 'en', className: 'atlas-html' },
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'head',
        null,
        [
          React.createElement('meta', { charSet: 'utf-8', key: 'charset' }),
          React.createElement('title', { key: 'title' }, `Component Atlas – ${page.title}`),
          React.createElement(
            'style',
            { key: 'styles' },
            `
              body {
                margin: 0;
                font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #f4f6f8;
                color: #0f172a;
              }
              .atlas-shell {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 3rem;
                padding: 2.5rem;
              }
              header.atlas-header,
              main.atlas-main,
              aside.atlas-sidebar,
              footer.atlas-footer {
                background: #ffffff;
                border-radius: 24px;
                box-shadow:
                  0 8px 20px rgba(15, 23, 42, 0.08),
                  0 2px 6px rgba(15, 23, 42, 0.04);
                padding: 2.5rem;
              }
              header.atlas-header {
                position: sticky;
                top: 0;
                z-index: 10;
              }
              main.atlas-main {
                display: grid;
                gap: 2rem;
              }
              .atlas-page-title {
                font-size: 2.5rem;
                margin-bottom: 0.75rem;
              }
              .atlas-page-subtitle {
                font-size: 1.1rem;
                color: #475569;
                max-width: 72ch;
              }
              .atlas-region {
                border: 1px solid #e2e8f0;
                border-radius: 18px;
                padding: 1.5rem;
                background: #f8fafc;
              }
              .atlas-region-heading {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
              }
              .atlas-region-description {
                margin-bottom: 1rem;
                color: #64748b;
              }
              .atlas-region-content {
                display: grid;
                gap: 1.25rem;
              }
              .atlas-component-wrapper {
                border-radius: 12px;
                padding: 1.25rem;
                background: #ffffff;
                border: 1px solid rgba(148, 163, 184, 0.6);
                box-shadow:
                  inset 0 1px 0 rgba(148, 163, 184, 0.1),
                  0 1px 2px rgba(15, 23, 42, 0.05);
              }
              .atlas-component-heading {
                margin-top: 0;
                margin-bottom: 0.75rem;
                font-size: 1rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748b;
              }
              .atlas-reviews-grid {
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
              }
              .atlas-review-card {
                background: #ffffff;
                border-radius: 16px;
                border: 1px solid rgba(148, 163, 184, 0.4);
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
              }
              .atlas-review-rating {
                color: #f59e0b;
                font-size: 1.1rem;
                letter-spacing: 0.1em;
              }
              .atlas-review-text {
                margin: 0;
                color: #1e293b;
                line-height: 1.6;
              }
              .atlas-review-footer {
                margin-top: auto;
                color: #475569;
                font-size: 0.9rem;
              }
              footer.atlas-footer {
                margin-top: 2rem;
              }
              @media (min-width: 1200px) {
                .atlas-shell {
                  grid-template-columns: minmax(0, 1fr);
                }
              }
            `
          )
        ]
      ),
      React.createElement(
        'body',
        { className: 'atlas-body' },
        React.createElement(
          'div',
          { className: 'atlas-shell', id: 'root' },
          [
            headerElements.length
              ? React.createElement(
                  'header',
                  { className: 'atlas-header', key: 'header' },
                  [
                    React.createElement(
                      'div',
                      { className: 'atlas-page-header', key: 'page-heading' },
                      [
                        React.createElement('h1', { className: 'atlas-page-title' }, page.title),
                        page.description
                          ? React.createElement(
                              'p',
                              { className: 'atlas-page-subtitle' },
                              page.description
                            )
                          : null
                      ].filter(Boolean)
                    ),
                    ...headerElements
                  ]
                )
              : null,
            React.createElement(
              'main',
              { className: 'atlas-main', key: 'main' },
              sectionElements
            ),
            sidebarElements.length
              ? React.createElement(
                  'aside',
                  { className: 'atlas-sidebar', key: 'sidebar' },
                  sidebarElements
                )
              : null,
            footerElements.length
              ? React.createElement('footer', { className: 'atlas-footer', key: 'footer' }, footerElements)
              : null
          ].filter(Boolean)
        )
      )
    )
  )

  return `<!DOCTYPE html>${renderToStaticMarkup(document)}`
}

async function writeFixtureFiles(pages: AtlasPageSpec[], componentSpecs: Map<string, AtlasComponentSpec>): Promise<void> {
  const timestamp = new Date().toISOString()
  await fs.mkdir(DATASET_ROOT, { recursive: true })

  for (const page of pages) {
    const domHtml = await renderPageToHtml(page, componentSpecs)
    const pageDir = path.join(DATASET_ROOT, page.id)
    await fs.mkdir(pageDir, { recursive: true })

    const domPath = path.join(pageDir, 'dom.html')
    const assetsPath = path.join(pageDir, 'assets.json')
    const contextPath = path.join(pageDir, 'context.json')

    await fs.writeFile(domPath, domHtml, 'utf-8')
    await fs.writeFile(assetsPath, toJson({}), 'utf-8')

    const pageUrl = new URL(`/${page.id}`, ATLAS_BASE_URL)
    const context = {
      ...DEFAULT_CONTEXT,
      url: pageUrl.toString(),
      path: pageUrl.pathname,
      capturedAt: timestamp,
      dataset: 'component-atlas',
      pageId: page.id,
      pageTitle: page.title
    }
    await fs.writeFile(contextPath, toJson(context), 'utf-8')
  }
}

async function updateExpectedFiles(pages: AtlasPageSpec[]): Promise<void> {
  for (const page of pages) {
    const pageDir = path.join(DATASET_ROOT, page.id)
    const rawPath = path.join(pageDir, 'raw.json')
    try {
      await fs.access(rawPath)
    } catch {
      continue
    }

    const expectedPath = path.join(pageDir, 'expected.json')
    buildExpectedFromRaw(rawPath, expectedPath)
  }
}

async function buildCanonicalDataset(pages: AtlasPageSpec[], componentSpecs: Map<string, AtlasComponentSpec>): Promise<void> {
  for (const page of pages) {
    const components: Array<[string, number, Record<string, unknown>]> = []

    for (const regionSpec of page.regions) {
      for (const componentEntry of regionSpec.components) {
        const spec = componentSpecs.get(componentEntry.canonicalType)
        if (!spec) {
          throw new Error(
            `Component spec not found for canonical type "${componentEntry.canonicalType}" while generating dataset for page "${page.id}".`
          )
        }

        const canonicalType = spec.componentType || spec.canonicalType
        const content = sanitizeComponentContent(sanitizeContentValue(spec.content))

        components.push([
          canonicalType,
          0.99,
          sortKeys(content)
        ])
      }
    }

    const pageDir = path.join(DATASET_ROOT, page.id)
    await fs.mkdir(pageDir, { recursive: true })

    const rawPayload = {
      pageTemplate: null,
      components,
      pageMetadata: sortKeys({
        title: page.title,
        description: page.description ?? '',
        tags: page.tags ?? []
      })
    }

    const rawPath = path.join(pageDir, 'raw.json')
    await fs.writeFile(rawPath, toJson(rawPayload), 'utf-8')

    const expectedPath = path.join(pageDir, 'expected.json')
    buildExpectedFromRaw(rawPath, expectedPath)
  }
}

async function startFixtureServer(port: number): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400
      res.end('Missing URL')
      return
    }

    const pathname = req.url.split('?')[0] ?? '/'
    const parts = pathname.replace(/^\/+/, '').split('/')
    const pageId = parts.length ? parts[0] : ''
    if (!pageId) {
      res.statusCode = 404
      res.end('Page id not provided')
      return
    }

    const domPath = path.join(DATASET_ROOT, pageId, 'dom.html')
    try {
      const html = await fs.readFile(domPath, 'utf-8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(html)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.statusCode = 404
        res.end(`Fixture not found for ${pageId}`)
        return
      }
      res.statusCode = 500
      res.end(`Failed to render fixture: ${error.message || 'unknown error'}`)
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => resolve())
  })

  console.log(`Component atlas fixture server listening on http://localhost:${port}`)
  console.log('Press Ctrl+C to stop serving fixtures.')
}

async function main(): Promise<void> {
  installNextImageStub()
  configureNextImage()
  const options = parseCliOptions(process.argv.slice(2))
  await ensureDirectories()
  await initializeCMSComponents()

  const contracts = listComponentContracts() as AtlasComponentContract[]

  if (options.writeComponents) {
    await writeComponentSpecs(contracts)
    console.log(`Wrote ${contracts.length} component specs to ${COMPONENT_SPEC_DIR}`)
  }

  const [componentSpecs, pageSpecs] = await Promise.all([
    loadComponentSpecs(),
    loadPageSpecs()
  ])

  if (options.buildFixtures) {
    await writeFixtureFiles(pageSpecs, componentSpecs)
    console.log(`Rendered ${pageSpecs.length} component atlas pages to ${DATASET_ROOT}`)
  }

  if (options.generateData) {
    await buildCanonicalDataset(pageSpecs, componentSpecs)
    console.log('Generated canonical raw/expected dataset for component atlas pages')
  }

  if (options.updateExpected) {
    await updateExpectedFiles(pageSpecs)
    console.log('Updated expected.json for component atlas pages with captured raw.json payloads')
  }

  if (options.serve) {
    await startFixtureServer(options.port)
  }
}

main().catch(error => {
  console.error('[component-atlas] Fatal error:', error)
  process.exit(1)
})
function installNextImageStub(): void {
  const require = createRequire(import.meta.url)
  const Module = require('module') as typeof import('module')
  const originalLoad = Module._load

  Module._load = function patchedLoad(request: string, parent, isMain) {
    if (request === 'next/dist/shared/lib/image-loader') {
      return function atlasImageLoader({ src }: { src: string }) {
        return src
      }
    }

    if (request === 'next/image') {
      const React = require('react') as typeof import('react')
      const stub = React.forwardRef<HTMLImageElement, any>((props, ref) => {
        const {
          src,
          alt,
          fill: _fill,
          priority: _priority,
          placeholder: _placeholder,
          loader: _loader,
          unoptimized: _unoptimized,
          ...rest
        } = props || {}
        const resolved = typeof src === 'string' ? src : (src?.src as string) || ''
        return React.createElement('img', { ...rest, src: resolved, alt, ref })
      })
      return {
        __esModule: true,
        default: stub,
        Image: stub
      }
    }

    return originalLoad.call(Module, request, parent, isMain)
  }
}
