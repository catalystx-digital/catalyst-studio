import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder, TextEncoder } from 'node:util'

import { analyzeDomDocument } from '../peek-adapter'
import { __INTERNAL_ANALYSIS_IMPLEMENTATION } from '../peek-adapter/dom-analysis.cjs'

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
