/**
 * Component Definition Tests
 *
 * Verifies the defineComponent() helper and type inference work correctly
 */

import { z } from 'zod'
import { defineComponent, detectionToAIMetadata } from '../component-definition'
import { ComponentType, ComponentCategory } from '../types'

describe('defineComponent', () => {
  it('should define a component with all metadata', () => {
    const def = defineComponent({
      type: ComponentType.HeroSimple,
      category: ComponentCategory.Heroes,
      schema: z.object({
        heading: z.string().describe('Primary headline'),
        subheading: z.string().optional().describe('Secondary text')
      }),
      detection: {
        keywords: ['hero', 'simple hero'],
        confidence: 0.9
      },
      sample: {
        heading: 'Test Heading'
      }
    })

    expect(def.type).toBe(ComponentType.HeroSimple)
    expect(def.category).toBe(ComponentCategory.Heroes)
    expect(def.schema).toBeDefined()
    expect(def.detection).toBeDefined()
    expect(def.sample).toBeDefined()
  })

  it('should validate sample data against schema', () => {
    const def = defineComponent({
      type: ComponentType.HeroSimple,
      category: ComponentCategory.Heroes,
      schema: z.object({
        heading: z.string(),
        count: z.number().optional()
      }),
      sample: {
        heading: 'Test',
        count: 42
      }
    })

    const result = def.schema.safeParse(def.sample)
    expect(result.success).toBe(true)
  })

  it('should support type inference from schema', () => {
    const def = defineComponent({
      type: ComponentType.HeroSimple,
      category: ComponentCategory.Heroes,
      schema: z.object({
        heading: z.string(),
        count: z.number().optional()
      })
    })

    type Props = z.infer<typeof def.schema>

    // TypeScript will error if this doesn't match the schema
    const props: Props = {
      heading: 'Test'
    }

    expect(props.heading).toBe('Test')
  })
})

describe('detectionToAIMetadata', () => {
  it('should convert detection metadata to AIComponentMetadata', () => {
    const detection = {
      keywords: ['hero', 'banner'],
      patterns: ['hero.*banner'],
      commonNames: ['hero banner'],
      pageLocation: ['hero' as const],
      confidence: 0.9,
      relatedComponents: [ComponentType.HeroSimple],
      industry: ['saas'],
      semanticRole: 'banner',
      accessibility: {
        role: 'banner',
        ariaLabel: 'Hero section'
      }
    }

    const aiMetadata = detectionToAIMetadata(detection, ComponentType.HeroBanner)

    expect(aiMetadata.keywords).toEqual(['hero', 'banner'])
    expect(aiMetadata.patterns).toEqual(['hero.*banner'])
    expect(aiMetadata.commonNames).toEqual(['hero banner'])
    expect(aiMetadata.pageLocation).toEqual(['hero'])
    expect(aiMetadata.confidence).toBe(0.9)
    expect(aiMetadata.relatedComponents).toEqual([ComponentType.HeroSimple])
    expect(aiMetadata.industry).toEqual(['saas'])
    expect(aiMetadata.semanticRole).toBe('banner')
    expect(aiMetadata.accessibility).toEqual({
      role: 'banner',
      ariaLabel: 'Hero section'
    })
  })

  it('should provide defaults for missing fields', () => {
    const detection = {
      keywords: ['test']
    }

    const aiMetadata = detectionToAIMetadata(detection, ComponentType.HeroSimple)

    expect(aiMetadata.patterns).toEqual([])
    expect(aiMetadata.commonNames).toEqual([])
    expect(aiMetadata.pageLocation).toEqual(['main'])
    expect(aiMetadata.confidence).toBe(0.8)
  })
})
