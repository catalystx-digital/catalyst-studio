import { TemplateCustomizer } from '../template-customizer'
import { CMSTemplate, TemplateField } from '../template-generator'

describe('TemplateCustomizer', () => {
  let customizer: TemplateCustomizer
  let sampleTemplate: CMSTemplate

  beforeEach(() => {
    customizer = new TemplateCustomizer({
      allowFieldAddition: true,
      allowFieldRemoval: true,
      allowFieldReordering: true,
      allowPropertyModification: true,
      validateStructure: true
    })

    sampleTemplate = {
      id: 'template-1',
      name: 'Sample Template',
      key: 'sample_template',
      category: 'page',
      fields: [
        {
          name: 'title',
          type: 'string',
          required: true,
          description: 'Page title'
        },
        {
          name: 'slug',
          type: 'string',
          required: true,
          description: 'URL slug'
        },
        {
          name: 'content',
          type: 'text',
          required: false,
          description: 'Page content'
        }
      ],
      metadata: {
        version: 1,
        createdFrom: 'import'
      }
    }
  })

  describe('addField', () => {
    it('should add a new field to the template', () => {
      const newField: TemplateField = {
        name: 'author',
        type: 'string',
        required: false,
        description: 'Page author'
      }

      const customized = customizer.addField(sampleTemplate, newField)

      expect(customized.fields).toHaveLength(4)
      expect(customized.fields).toContainEqual(newField)
      expect(customized.metadata?.version).toBe(2)
    })

    it('should throw error when field addition is not allowed', () => {
      const restrictedCustomizer = new TemplateCustomizer({
        allowFieldAddition: false
      })

      const newField: TemplateField = {
        name: 'author',
        type: 'string',
        required: false
      }

      expect(() => restrictedCustomizer.addField(sampleTemplate, newField))
        .toThrow('Field addition is not allowed')
    })
  })

  describe('removeField', () => {
    it('should remove a field from the template', () => {
      const customized = customizer.removeField(sampleTemplate, 'content')

      expect(customized.fields).toHaveLength(2)
      expect(customized.fields.find(f => f.name === 'content')).toBeUndefined()
    })

    it('should throw error when removing required field with preserveRequired', () => {
      expect(() => customizer.removeField(sampleTemplate, 'title'))
        .toThrow('Cannot remove required field title')
    })

    it('should throw error when field does not exist', () => {
      expect(() => customizer.removeField(sampleTemplate, 'nonexistent'))
        .toThrow('Field nonexistent not found')
    })
  })

  describe('modifyField', () => {
    it('should modify field properties', () => {
      const updates = {
        required: true,
        placeholder: 'Enter page content',
        validation: { minLength: 10 }
      }

      const customized = customizer.modifyField(sampleTemplate, 'content', updates)
      const modifiedField = customized.fields.find(f => f.name === 'content')

      expect(modifiedField?.required).toBe(true)
      expect(modifiedField?.placeholder).toBe('Enter page content')
      expect(modifiedField?.validation).toEqual({ minLength: 10 })
    })

    it('should throw error when field does not exist', () => {
      expect(() => customizer.modifyField(sampleTemplate, 'nonexistent', {}))
        .toThrow('Field nonexistent not found')
    })
  })

  describe('reorderFields', () => {
    it('should reorder fields according to provided order', () => {
      const newOrder = ['slug', 'content', 'title']
      const customized = customizer.reorderFields(sampleTemplate, newOrder)

      expect(customized.fields[0].name).toBe('slug')
      expect(customized.fields[1].name).toBe('content')
      expect(customized.fields[2].name).toBe('title')
    })

    it('should throw error when fields are missing in reorder', () => {
      const incompleteOrder = ['title', 'slug']
      
      expect(() => customizer.reorderFields(sampleTemplate, incompleteOrder))
        .toThrow('Missing fields in reorder: content')
    })

    it('should throw error when unknown fields in reorder', () => {
      const invalidOrder = ['title', 'slug', 'content', 'unknown']
      
      expect(() => customizer.reorderFields(sampleTemplate, invalidOrder))
        .toThrow('Unknown fields in reorder: unknown')
    })
  })

  describe('validateTemplate', () => {
    it('should validate a valid template', () => {
      const result = customizer.validateTemplate(sampleTemplate)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required template properties', () => {
      const invalidTemplate = {
        ...sampleTemplate,
        id: '',
        name: ''
      }

      const result = customizer.validateTemplate(invalidTemplate)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'missing_required',
          message: 'Template must have id, name, and key'
        })
      )
    })

    it('should detect invalid category', () => {
      const invalidTemplate = {
        ...sampleTemplate,
        category: 'invalid' as any
      }

      const result = customizer.validateTemplate(invalidTemplate)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'invalid_value',
          field: 'category'
        })
      )
    })

    it('should detect duplicate field names', () => {
      const duplicateTemplate = {
        ...sampleTemplate,
        fields: [
          ...sampleTemplate.fields,
          {
            name: 'title',
            type: 'text',
            required: false
          }
        ]
      }

      const result = customizer.validateTemplate(duplicateTemplate)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structural',
          message: 'Duplicate field name: title'
        })
      )
    })

    it('should validate page templates have required fields', () => {
      const pageTemplate = {
        ...sampleTemplate,
        fields: [
          {
            name: 'content',
            type: 'text',
            required: false
          }
        ]
      }

      const result = customizer.validateTemplate(pageTemplate)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'missing_required',
          message: 'Page template missing required field: title'
        })
      )
    })
  })

  describe('mergeTemplates', () => {
    const mergeTemplate: CMSTemplate = {
      id: 'template-2',
      name: 'Merge Template',
      key: 'merge_template',
      category: 'page',
      fields: [
        {
          name: 'author',
          type: 'string',
          required: false
        },
        {
          name: 'tags',
          type: 'array',
          required: false
        }
      ],
      metadata: {}
    }

    it('should merge templates with combine strategy', () => {
      const merged = customizer.mergeTemplates(sampleTemplate, mergeTemplate, 'combine')

      expect(merged.fields).toHaveLength(5)
      expect(merged.fields.map(f => f.name)).toContain('title')
      expect(merged.fields.map(f => f.name)).toContain('author')
      expect(merged.fields.map(f => f.name)).toContain('tags')
    })

    it('should merge templates with override strategy', () => {
      const merged = customizer.mergeTemplates(sampleTemplate, mergeTemplate, 'override')

      expect(merged.fields).toHaveLength(2)
      expect(merged.fields).toEqual(mergeTemplate.fields)
    })

    it('should merge templates with preserve strategy', () => {
      const mergeWithDuplicate = {
        ...mergeTemplate,
        fields: [
          ...mergeTemplate.fields,
          {
            name: 'title',
            type: 'text',
            required: true
          }
        ]
      }

      const merged = customizer.mergeTemplates(sampleTemplate, mergeWithDuplicate, 'preserve')

      expect(merged.fields.map(f => f.name)).toContain('author')
      expect(merged.fields.map(f => f.name)).toContain('tags')
      expect(merged.fields.filter(f => f.name === 'title')).toHaveLength(1)
    })
  })

  describe('customization history', () => {
    it('should track customization history', () => {
      const newField: TemplateField = {
        name: 'author',
        type: 'string',
        required: false
      }

      customizer.addField(sampleTemplate, newField)
      customizer.removeField(sampleTemplate, 'content')

      const history = customizer.getCustomizationHistory(sampleTemplate.id)

      expect(history).toHaveLength(2)
      expect(history[0].version).toBe(1)
      expect(history[1].version).toBe(2)
    })

    it('should revert to specific version', () => {
      // Make multiple customizations
      let customized = customizer.addField(sampleTemplate, {
        name: 'field1',
        type: 'string',
        required: false
      })

      customized = customizer.addField(customized, {
        name: 'field2',
        type: 'string',
        required: false
      })

      customized = customizer.addField(customized, {
        name: 'field3',
        type: 'string',
        required: false
      })

      // Revert to version 2
      const reverted = customizer.revertToVersion(customized, 2)

      expect(reverted.fields.map(f => f.name)).toContain('field1')
      expect(reverted.fields.map(f => f.name)).toContain('field2')
      expect(reverted.fields.map(f => f.name)).not.toContain('field3')
    })
  })

  describe('adjustComponentPlacement', () => {
    beforeEach(() => {
      sampleTemplate = {
        ...sampleTemplate,
        fields: [
          ...sampleTemplate.fields,
          {
            name: 'heroComponents',
            type: 'array',
            required: false,
            properties: {
              componentType: {
                type: 'string',
                enum: ['hero', 'banner']
              }
            }
          }
        ]
      }
    })

    it('should move component to different location', () => {
      const customized = customizer.adjustComponentPlacement(
        sampleTemplate,
        'hero',
        'header'
      )

      const headerField = customized.fields.find(f => f.name === 'headerComponents')
      const heroField = customized.fields.find(f => f.name === 'heroComponents')

      expect(headerField).toBeDefined()
      expect(headerField?.properties?.componentType?.enum).toContain('hero')
      expect(heroField?.properties?.componentType?.enum).not.toContain('hero')
    })

    it('should create new location field if it does not exist', () => {
      const customized = customizer.adjustComponentPlacement(
        sampleTemplate,
        'banner',
        'footer'
      )

      const footerField = customized.fields.find(f => f.name === 'footerComponents')
      
      expect(footerField).toBeDefined()
      expect(footerField?.type).toBe('array')
      expect(footerField?.properties?.componentType?.enum).toContain('banner')
    })

    it('should throw error if component not found', () => {
      expect(() => customizer.adjustComponentPlacement(sampleTemplate, 'nonexistent', 'header'))
        .toThrow('Component nonexistent not found in template')
    })
  })
})