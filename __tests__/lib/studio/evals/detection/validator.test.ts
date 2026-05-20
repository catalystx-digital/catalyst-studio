import { validateDetectionComponents } from '@/lib/studio/evals/detection/schema'
import type { DetectionSchemaBundle } from '@/lib/studio/evals/detection/schema'

const bundle: DetectionSchemaBundle = {
  version: 1,
  generatedAt: new Date().toISOString(),
  components: {
    'hero-simple': {
      canonicalType: 'hero-simple',
      summary: 'test',
      fields: [
        {
          name: 'heading',
          type: 'string',
          required: true
        },
        {
          name: 'ctaButtons',
          type: 'array',
          required: false
        }
      ],
      propsSource: 'propsMeta'
    },
    navbar: {
      canonicalType: 'navbar',
      summary: 'test',
      fields: [
        {
          name: 'menuItems',
          type: 'array',
          required: true,
          allowedTypes: ['nav-menu-item'],
          items: {
            kind: 'component',
            allowedTypes: ['nav-menu-item']
          }
        }
      ],
      propsSource: 'propsMeta'
    },
    'nav-menu-item': {
      canonicalType: 'nav-menu-item',
      summary: 'test',
      fields: [
        {
          name: 'label',
          type: 'string',
          required: true
        },
        {
          name: 'href',
          type: 'string',
          required: false
        }
      ],
      propsSource: 'propsMeta'
    }
  },
  integrity: {
    algorithm: 'sha256',
    hash: 'test-hash',
    componentCount: 3
  },
  warnings: []
}

describe('Detection schema validator', () => {
  it('flags missing required fields', () => {
    const result = validateDetectionComponents(bundle, [
      {
        type: 'hero-simple',
        confidence: 0.9,
        content: {}
      }
    ])

    expect(result.violations.some(v => v.code === 'field.required')).toBe(true)
  })

  it('flags disallowed subcomponent types', () => {
    const result = validateDetectionComponents(bundle, [
      {
        type: 'navbar',
        confidence: 0.9,
        content: {
          menuItems: [
            { type: 'nav-menu-item', label: 'Valid Link' },
            { type: 'unsupported-item', label: 'Broken Link' }
          ]
        }
      }
    ])

    const violation = result.violations.find(v => v.code === 'component_array.disallowed_type')
    expect(violation).toBeDefined()
    expect(violation?.path).toContain('menuItems')
  })
})

