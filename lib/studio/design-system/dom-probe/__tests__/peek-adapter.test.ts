import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder, TextEncoder } from 'node:util'

import { analyzeDomDocument } from '../peek-adapter'
import { analyzeDomDocument as analyzeDomDocumentTs } from '../peek-adapter/dom-analysis'
import { __INTERNAL_ANALYSIS_IMPLEMENTATION } from '../peek-adapter/dom-analysis.cjs'
import { toShadcnVariables } from '../../shadcn-transformer'
import type { DomDesignSystemCapture } from '../types'

// jsdom relies on TextEncoder/TextDecoder in Node.js environments.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder
}

function loadFixture(name: string): Document {
  const fixturePath = path.join(__dirname, '..', '__fixtures__', name)
  const html = fs.readFileSync(fixturePath, 'utf-8')
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    document.head.innerHTML = parsed.head.innerHTML
    document.body.innerHTML = parsed.body.innerHTML
    document.querySelectorAll('h1').forEach(heading => {
      heading.getBoundingClientRect = () => ({ width: 500, height: 50 } as DOMRect)
    })
    return document
  }
  document.documentElement.innerHTML = html
  return document
}

describe('peek adapter DOM analysis', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('extracts typography, palette, and spacing from the happy-path fixture', () => {
    const document = loadFixture('happy-path.html')
    const result = analyzeDomDocument(document)

    expect(result.typography.length).toBeGreaterThan(0)
    const heading = result.typography.find(sample => sample.role === 'heading')
    expect(heading).toBeDefined()
    expect(heading?.fontFamily).toBe('Roboto')
    expect(heading?.fontSizePx).toBeGreaterThanOrEqual(24)

    expect(result.palette.colors.length).toBeGreaterThanOrEqual(3)
    expect(result.palette.colors.map(color => color.hex)).toEqual(
      expect.arrayContaining(['#1434a4', '#ff6600', '#ffffff'])
    )
    const primarySecondary = [result.palette.primary?.hex, result.palette.secondary?.hex].filter(
      (hex): hex is string => Boolean(hex)
    )
    expect(primarySecondary.length).toBeGreaterThan(0)

    expect(result.spacing.baseUnitPx).toBeGreaterThan(0)
    expect(result.spacing.baseUnitPx ?? 0).toBeLessThanOrEqual(32)
    expect(result.spacing.scale.some(token => token.valuePx === 12)).toBe(true)
    expect(result.spacing.scale.some(token => token.valuePx === 24)).toBe(true)

    expect(result.components.length).toBeGreaterThan(0)
    expect(result.components.some(component => component.role === 'cta')).toBe(true)
    expect(result.components.some(component => component.role === 'container')).toBe(true)

    expect(result.diagnostics.errors).toEqual([])
    expect(result.diagnostics.warnings.length).toBeLessThanOrEqual(1)
  })

  it('keeps a rare h1 beyond the style cap and emits its size and weight', () => {
    document.body.innerHTML = `
      <h1 style="font-size:48px;font-weight:800">A real headline</h1>
      <h2 style="font-size:48px;font-weight:800">A section heading</h2>
      <h3 style="font-size:48px;font-weight:800">A smaller heading</h3>
      ${Array.from({ length: 19 }, (_, index) =>
        `<p style="font-size:${10 + index / 10}px">Caption style ${index}</p><p style="font-size:${10 + index / 10}px">Another caption ${index}</p>`
      ).join('')}
    `
    const heading = document.querySelector('h1')!
    heading.getBoundingClientRect = () => ({ width: 600, height: 58 } as DOMRect)

    const result = analyzeDomDocument(document)
    const tokens = toShadcnVariables({ ...result } as DomDesignSystemCapture)

    expect(result.typography.filter(sample => /^h[1-3]$/.test(sample.tag ?? '')).map(sample => sample.tag)).toEqual(['h1', 'h2', 'h3'])
    expect(tokens.typography?.heading[0].fontSize).toBe('48px')
    expect(tokens.typography?.heading[0].fontWeight).toBe('800')
  })

  it('ignores a visually hidden h1 and chooses the largest visible h1', () => {
    document.body.innerHTML = `
      <h1 style="font-size:72px">Hidden headline</h1>
      <h1 style="font-size:32px">Small headline</h1>
      <h1 style="font-size:48px">Large headline</h1>
    `
    const headings = document.querySelectorAll('h1')
    headings.forEach((heading, index) => {
      heading.getBoundingClientRect = () => ({ width: index === 0 ? 1 : 600, height: index === 0 ? 1 : 60 } as DOMRect)
    })

    const result = analyzeDomDocument(document)
    const tokens = toShadcnVariables({ ...result } as DomDesignSystemCapture)

    expect(result.typography.some(sample => sample.fontSizePx === 72)).toBe(false)
    expect(tokens.typography?.heading[0].fontSize).toBe('48px')
  })

  it('counts text on its own element rather than each ancestor', () => {
    document.body.innerHTML = '<section><div><p style="font-size:16px">A paragraph of text</p></div></section>'

    const result = analyzeDomDocument(document)

    expect(result.typography.filter(sample => sample.textSample === 'A paragraph of text')).toHaveLength(1)
  })

  it('keeps an h1 tag when its text is inside a span', () => {
    document.body.innerHTML = '<h1><span style="font-size:48px;font-weight:800">Nested headline text</span></h1>'
    document.querySelector('h1')!.getBoundingClientRect = () => ({ width: 600, height: 60 } as DOMRect)

    const result = analyzeDomDocument(document)

    expect(result.typography.filter(sample => sample.tag === 'h1')).toHaveLength(1)
    expect(result.typography.find(sample => sample.tag === 'h1')?.fontSizePx).toBe(48)
  })

  it('keeps short direct-text fragments in h1–h3 when the full heading is long enough', () => {
    document.body.innerHTML = `
      <h1 style="font-size:48px">Grow <em>now</em></h1>
      <h2 style="font-size:36px">Build <em>fast</em></h2>
      <h3 style="font-size:24px">Start <em>here</em></h3>
    `
    document.querySelector('h1')!.getBoundingClientRect = () => ({ width: 600, height: 60 } as DOMRect)

    for (const analyze of [analyzeDomDocument, analyzeDomDocumentTs]) {
      const result = analyze(document)
      expect(result.typography.find(sample => sample.tag === 'h1')?.fontSizePx).toBe(48)
      expect(result.typography.find(sample => sample.tag === 'h2')?.fontSizePx).toBe(36)
      expect(result.typography.find(sample => sample.tag === 'h3')?.fontSizePx).toBe(24)
    }
  })

  it('keeps dominant black text in the neutral palette and promotes chromatic accents', () => {
    const document = loadFixture('dominant-text-with-accent.html')
    const result = analyzeDomDocument(document)

    expect(result.palette.colors.some(color => color.hex === '#00838f')).toBe(true)
    expect(result.palette.primary?.hex).toBe('#00838f')
    expect(result.palette.neutrals?.some(color => color.hex === '#000000')).toBe(true)
    expect(result.palette.secondary?.hex).not.toBe('#000000')
  })

  it('flags missing fonts when document.fonts reports unavailable families', () => {
    const document = loadFixture('missing-fonts.html')
    const previousFonts = (document as any).fonts
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        check: () => false
      }
    })

    const result = analyzeDomDocument(document)
    expect(result.diagnostics.missingFonts.sort()).toEqual(['Document Mono', 'Lumen Display', 'Phantom Sans'].sort())
    expect(result.diagnostics.warnings.some(message => message.includes('fonts'))).toBe(true)

    if (previousFonts) {
      Object.defineProperty(document, 'fonts', { configurable: true, value: previousFonts })
    } else {
      delete (document as any).fonts
    }
  })

  it('executes the stringified implementation without external closures', () => {
    const document = loadFixture('dominant-text-with-accent.html')
    const resurrected = new Function(`return (${__INTERNAL_ANALYSIS_IMPLEMENTATION.toString()});`)()
    const result = resurrected(document, window, undefined)

    expect(result.palette.primary?.hex).toBe('#00838f')
    expect(result.palette.neutrals?.some(color => color.hex === '#000000')).toBe(true)
  })
})
