/**
 * Tests for extended ComponentDefinition interface (T-001)
 * Verifies aliases, processing, and normalization fields work correctly.
 */

import { describe, it, expect } from '@jest/globals'
import { defineComponent } from '../component-definition'
import { ComponentType, ComponentCategory } from '../types'
import { z } from 'zod'

describe('ComponentDefinition - Extended Fields (T-001)', () => {
  it('should accept aliases field', () => {
    const def = defineComponent({
      type: ComponentType.NavBar,
      category: ComponentCategory.Navigation,
      schema: z.object({ items: z.array(z.string()) }),
      aliases: ['nav', 'navbar', 'navigation', 'menu']
    })

    expect(def.aliases).toEqual(['nav', 'navbar', 'navigation', 'menu'])
  })

  it('should accept processing.multiRowDetection field', () => {
    const def = defineComponent({
      type: ComponentType.NavBar,
      category: ComponentCategory.Navigation,
      schema: z.object({ items: z.array(z.string()) }),
      processing: {
        multiRowDetection: {
          enabled: true,
          utilityPatterns: ['Login', 'Sign Up', 'Account']
        }
      }
    })

    expect(def.processing?.multiRowDetection?.enabled).toBe(true)
    expect(def.processing?.multiRowDetection?.utilityPatterns).toContain('Login')
  })

  it('should accept processing.backgroundPromotion field', () => {
    const def = defineComponent({
      type: ComponentType.HeroSimple,
      category: ComponentCategory.Heroes,
      schema: z.object({ heading: z.string() }),
      processing: {
        backgroundPromotion: {
          enabled: true,
          domSelectors: ['.hero-bg', '[data-hero-background]']
        }
      }
    })

    expect(def.processing?.backgroundPromotion?.enabled).toBe(true)
    expect(def.processing?.backgroundPromotion?.domSelectors).toHaveLength(2)
  })

  it('should accept processing.deduplication field', () => {
    const def = defineComponent({
      type: ComponentType.CTASimple,
      category: ComponentCategory.CTA,
      schema: z.object({ heading: z.string() }),
      processing: {
        deduplication: {
          enabled: true,
          deduplicateWith: [ComponentType.TwoColumn, ComponentType.Timeline],
          context: 'adjacent'
        }
      }
    })

    expect(def.processing?.deduplication?.enabled).toBe(true)
    expect(def.processing?.deduplication?.deduplicateWith).toContain(ComponentType.TwoColumn)
    expect(def.processing?.deduplication?.context).toBe('adjacent')
  })

  it('should accept processing.contentFeedPromotion field', () => {
    const def = defineComponent({
      type: ComponentType.CardGrid,
      category: ComponentCategory.Content,
      schema: z.object({ items: z.array(z.string()) }),
      processing: {
        contentFeedPromotion: {
          enabled: true,
          promotionPatterns: ['blog', 'article', 'news']
        }
      }
    })

    expect(def.processing?.contentFeedPromotion?.enabled).toBe(true)
    expect(def.processing?.contentFeedPromotion?.promotionPatterns).toContain('blog')
  })

  it('should accept normalization field', () => {
    const def = defineComponent({
      type: ComponentType.BlogPost,
      category: ComponentCategory.Blog,
      schema: z.object({ title: z.string() }),
      normalization: {
        enabled: true,
        fieldTransforms: {
          heading: {
            from: 'title',
            to: 'heading',
            transform: 'titleCase'
          }
        }
      }
    })

    expect(def.normalization?.enabled).toBe(true)
    expect(def.normalization?.fieldTransforms?.heading.from).toBe('title')
  })

  it('should allow all fields to be optional (backward compatibility)', () => {
    const def = defineComponent({
      type: ComponentType.TextBlock,
      category: ComponentCategory.Content,
      schema: z.object({ content: z.string() })
      // No aliases, processing, or normalization
    })

    expect(def.aliases).toBeUndefined()
    expect(def.processing).toBeUndefined()
    expect(def.normalization).toBeUndefined()
  })

  it('should accept combined aliases + processing + normalization', () => {
    const def = defineComponent({
      type: ComponentType.NavBar,
      category: ComponentCategory.Navigation,
      schema: z.object({ items: z.array(z.string()) }),
      aliases: ['nav', 'navbar', 'navigation'],
      processing: {
        multiRowDetection: {
          enabled: true,
          utilityPatterns: ['Login']
        }
      },
      normalization: {
        enabled: true
      }
    })

    expect(def.aliases).toHaveLength(3)
    expect(def.processing?.multiRowDetection?.enabled).toBe(true)
    expect(def.normalization?.enabled).toBe(true)
  })
})
