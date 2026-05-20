import { CMSTemplate, TemplateField } from './template-generator'
import { ContentTypeCategory } from '@/lib/generated/prisma'

interface TemplateCustomization {
  id: string
  templateId: string
  name: string
  description?: string
  modifications: TemplateModification[]
  version: number
  createdAt: Date
  updatedAt: Date
}

export interface TemplateModification {
  type: 'add' | 'remove' | 'modify' | 'reorder'
  target: 'field' | 'property' | 'metadata'
  path: string
  value?: any
  previousValue?: any
}

interface CustomizationOptions {
  allowFieldAddition?: boolean
  allowFieldRemoval?: boolean
  allowFieldReordering?: boolean
  allowPropertyModification?: boolean
  validateStructure?: boolean
  preserveRequired?: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  type: 'missing_required' | 'invalid_type' | 'invalid_value' | 'structural'
}

export interface ValidationWarning {
  field: string
  message: string
  type: 'deprecated' | 'performance' | 'compatibility'
}

export class TemplateCustomizer {
  private options: CustomizationOptions
  private templateHistory: Map<string, TemplateCustomization[]>

  constructor(options: CustomizationOptions = {}) {
    this.options = {
      allowFieldAddition: true,
      allowFieldRemoval: true,
      allowFieldReordering: true,
      allowPropertyModification: true,
      validateStructure: true,
      preserveRequired: true,
      ...options
    }
    this.templateHistory = new Map()
  }

  /**
   * Customize a template with user modifications
   */
  customizeTemplate(
    template: CMSTemplate,
    customizations: TemplateModification[]
  ): CMSTemplate {
    let customizedTemplate = this.cloneTemplate(template)
    
    for (const modification of customizations) {
      customizedTemplate = this.applyModification(customizedTemplate, modification)
    }
    
    // Validate the customized template
    if (this.options.validateStructure) {
      const validation = this.validateTemplate(customizedTemplate)
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }
    }
    
    // Track the customization in history
    this.trackCustomization(template.id, customizations)
    
    // Update version
    customizedTemplate.metadata = {
      ...customizedTemplate.metadata,
      version: (customizedTemplate.metadata?.version || 1) + 1
    }
    
    return customizedTemplate
  }

  /**
   * Add a field to the template
   */
  addField(template: CMSTemplate, field: TemplateField, position?: number): CMSTemplate {
    if (!this.options.allowFieldAddition) {
      throw new Error('Field addition is not allowed')
    }
    
    const modification: TemplateModification = {
      type: 'add',
      target: 'field',
      path: field.name,
      value: field
    }
    
    return this.customizeTemplate(template, [modification])
  }

  /**
   * Remove a field from the template
   */
  removeField(template: CMSTemplate, fieldName: string): CMSTemplate {
    if (!this.options.allowFieldRemoval) {
      throw new Error('Field removal is not allowed')
    }
    
    const field = template.fields.find(f => f.name === fieldName)
    if (!field) {
      throw new Error(`Field ${fieldName} not found`)
    }
    
    if (this.options.preserveRequired && field.required) {
      throw new Error(`Cannot remove required field ${fieldName}`)
    }
    
    const modification: TemplateModification = {
      type: 'remove',
      target: 'field',
      path: fieldName,
      previousValue: field
    }
    
    return this.customizeTemplate(template, [modification])
  }

  /**
   * Modify field properties
   */
  modifyField(
    template: CMSTemplate,
    fieldName: string,
    updates: Partial<TemplateField>
  ): CMSTemplate {
    if (!this.options.allowPropertyModification) {
      throw new Error('Field modification is not allowed')
    }
    
    const field = template.fields.find(f => f.name === fieldName)
    if (!field) {
      throw new Error(`Field ${fieldName} not found`)
    }
    
    const modification: TemplateModification = {
      type: 'modify',
      target: 'field',
      path: fieldName,
      value: updates,
      previousValue: field
    }
    
    return this.customizeTemplate(template, [modification])
  }

  /**
   * Reorder fields in the template
   */
  reorderFields(template: CMSTemplate, fieldOrder: string[]): CMSTemplate {
    if (!this.options.allowFieldReordering) {
      throw new Error('Field reordering is not allowed')
    }
    
    // Validate all fields are present
    const existingFieldNames = template.fields.map(f => f.name)
    const missingFields = existingFieldNames.filter(name => !fieldOrder.includes(name))
    const extraFields = fieldOrder.filter(name => !existingFieldNames.includes(name))
    
    if (missingFields.length > 0) {
      throw new Error(`Missing fields in reorder: ${missingFields.join(', ')}`)
    }
    
    if (extraFields.length > 0) {
      throw new Error(`Unknown fields in reorder: ${extraFields.join(', ')}`)
    }
    
    const modification: TemplateModification = {
      type: 'reorder',
      target: 'field',
      path: 'fields',
      value: fieldOrder,
      previousValue: existingFieldNames
    }
    
    return this.customizeTemplate(template, [modification])
  }

  /**
   * Adjust component placement within a template
   */
  adjustComponentPlacement(
    template: CMSTemplate,
    componentFieldName: string,
    newLocation: 'header' | 'hero' | 'main' | 'footer'
  ): CMSTemplate {
    const oldLocationField = template.fields.find(f => 
      f.name.includes('Components') && 
      f.properties?.componentType?.enum?.includes(componentFieldName)
    )
    
    if (!oldLocationField) {
      throw new Error(`Component ${componentFieldName} not found in template`)
    }
    
    const newLocationFieldName = `${newLocation}Components`
    let newLocationField = template.fields.find(f => f.name === newLocationFieldName)
    
    if (!newLocationField) {
      // Create new location field if it doesn't exist
      newLocationField = {
        name: newLocationFieldName,
        type: 'array',
        required: false,
        description: `Components in the ${newLocation} section`,
        properties: {}
      }
      
      template = this.addField(template, newLocationField)
    }
    
    // Move component properties to new location
    const modifications: TemplateModification[] = [
      {
        type: 'modify',
        target: 'property',
        path: `${oldLocationField.name}.properties`,
        value: this.removeFromProperties(oldLocationField.properties, componentFieldName)
      },
      {
        type: 'modify',
        target: 'property',
        path: `${newLocationFieldName}.properties`,
        value: this.addToProperties(newLocationField.properties, componentFieldName)
      }
    ]
    
    return this.customizeTemplate(template, modifications)
  }

  /**
   * Validate a template structure
   */
  validateTemplate(template: CMSTemplate): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    
    // Check required fields
    if (!template.id || !template.name || !template.key) {
      errors.push({
        field: 'template',
        message: 'Template must have id, name, and key',
        type: 'missing_required'
      })
    }
    
    // Validate category
    const validCategories: ContentTypeCategory[] = ['page', 'component', 'folder']
    if (!validCategories.includes(template.category)) {
      errors.push({
        field: 'category',
        message: `Invalid category: ${template.category}`,
        type: 'invalid_value'
      })
    }
    
    // Validate fields
    const fieldNames = new Set<string>()
    for (const field of template.fields) {
      // Check for duplicate field names
      if (fieldNames.has(field.name)) {
        errors.push({
          field: field.name,
          message: `Duplicate field name: ${field.name}`,
          type: 'structural'
        })
      }
      fieldNames.add(field.name)
      
      // Validate field structure
      const fieldValidation = this.validateField(field)
      errors.push(...fieldValidation.errors)
      warnings.push(...fieldValidation.warnings)
    }
    
    // Check for required page fields
    if (template.category === 'page') {
      const requiredPageFields = ['title', 'slug']
      for (const requiredField of requiredPageFields) {
        if (!template.fields.find(f => f.name === requiredField)) {
          errors.push({
            field: requiredField,
            message: `Page template missing required field: ${requiredField}`,
            type: 'missing_required'
          })
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get customization history for a template
   */
  getCustomizationHistory(templateId: string): TemplateCustomization[] {
    return this.templateHistory.get(templateId) || []
  }

  /**
   * Revert template to a specific version
   */
  revertToVersion(template: CMSTemplate, version: number): CMSTemplate {
    const history = this.getCustomizationHistory(template.id)
    const targetVersion = history.find(h => h.version === version)
    
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for template ${template.id}`)
    }
    
    // Start from the original template state (only base fields)
    const baseFields = ['title', 'slug', 'content'].map(name => 
      template.fields.find(f => f.name === name)
    ).filter(Boolean) as TemplateField[]
    
    let revertedTemplate = this.cloneTemplate({
      ...template,
      fields: baseFields
    })
    
    // Apply only modifications up to the target version
    for (const customization of history) {
      if (customization.version <= version) {
        for (const modification of customization.modifications) {
          revertedTemplate = this.applyModification(revertedTemplate, modification)
        }
      }
    }
    
    return revertedTemplate
  }

  /**
   * Merge two templates
   */
  mergeTemplates(
    baseTemplate: CMSTemplate,
    mergeTemplate: CMSTemplate,
    strategy: 'override' | 'combine' | 'preserve' = 'combine'
  ): CMSTemplate {
    const mergedTemplate = this.cloneTemplate(baseTemplate)
    
    switch (strategy) {
      case 'override':
        // Override base fields with merge fields
        mergedTemplate.fields = mergeTemplate.fields
        break
        
      case 'combine':
        // Combine fields from both templates
        const baseFieldNames = new Set(baseTemplate.fields.map(f => f.name))
        for (const field of mergeTemplate.fields) {
          if (!baseFieldNames.has(field.name)) {
            mergedTemplate.fields.push(field)
          }
        }
        break
        
      case 'preserve':
        // Only add fields that don't exist in base
        const existingNames = new Set(baseTemplate.fields.map(f => f.name))
        for (const field of mergeTemplate.fields) {
          if (!existingNames.has(field.name)) {
            mergedTemplate.fields.push(field)
          }
        }
        break
    }
    
    // Merge metadata
    mergedTemplate.metadata = {
      ...baseTemplate.metadata,
      ...mergeTemplate.metadata,
      version: (baseTemplate.metadata?.version || 1) + 1
    }
    
    return mergedTemplate
  }

  private applyModification(
    template: CMSTemplate,
    modification: TemplateModification
  ): CMSTemplate {
    const modifiedTemplate = this.cloneTemplate(template)
    
    switch (modification.type) {
      case 'add':
        if (modification.target === 'field') {
          modifiedTemplate.fields.push(modification.value)
        }
        break
        
      case 'remove':
        if (modification.target === 'field') {
          modifiedTemplate.fields = modifiedTemplate.fields.filter(
            f => f.name !== modification.path
          )
        }
        break
        
      case 'modify':
        if (modification.target === 'field') {
          const fieldIndex = modifiedTemplate.fields.findIndex(
            f => f.name === modification.path
          )
          if (fieldIndex !== -1) {
            modifiedTemplate.fields[fieldIndex] = {
              ...modifiedTemplate.fields[fieldIndex],
              ...modification.value
            }
          }
        } else if (modification.target === 'property') {
          // Handle property modifications
          const pathParts = modification.path.split('.')
          const fieldName = pathParts[0]
          const field = modifiedTemplate.fields.find(f => f.name === fieldName)
          if (field && pathParts[1] === 'properties') {
            field.properties = modification.value
          }
        }
        break
        
      case 'reorder':
        if (modification.target === 'field') {
          const reorderedFields: TemplateField[] = []
          for (const fieldName of modification.value) {
            const field = modifiedTemplate.fields.find(f => f.name === fieldName)
            if (field) {
              reorderedFields.push(field)
            }
          }
          modifiedTemplate.fields = reorderedFields
        }
        break
    }
    
    return modifiedTemplate
  }

  private validateField(field: TemplateField): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    
    // Check required field properties
    if (!field.name) {
      errors.push({
        field: field.name || 'unknown',
        message: 'Field must have a name',
        type: 'missing_required'
      })
    }
    
    if (!field.type) {
      errors.push({
        field: field.name,
        message: 'Field must have a type',
        type: 'missing_required'
      })
    }
    
    // Validate field type
    const validTypes = ['string', 'text', 'number', 'boolean', 'object', 'array', 'image', 'media', 'link', 'url']
    if (field.type && !validTypes.includes(field.type)) {
      warnings.push({
        field: field.name,
        message: `Unknown field type: ${field.type}`,
        type: 'compatibility'
      })
    }
    
    // Check array fields have properties
    if (field.type === 'array' && !field.properties) {
      warnings.push({
        field: field.name,
        message: 'Array field should define item properties',
        type: 'compatibility'
      })
    }
    
    return { valid: errors.length === 0, errors, warnings }
  }

  private cloneTemplate(template: CMSTemplate): CMSTemplate {
    return JSON.parse(JSON.stringify(template))
  }

  private trackCustomization(templateId: string, modifications: TemplateModification[]): void {
    const history = this.templateHistory.get(templateId) || []
    const customization: TemplateCustomization = {
      id: `customization-${Date.now()}`,
      templateId,
      name: `Customization ${history.length + 1}`,
      modifications,
      version: history.length + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    history.push(customization)
    this.templateHistory.set(templateId, history)
  }

  private removeFromProperties(properties: any, componentType: string): any {
    if (!properties) return {}
    
    const updated = { ...properties }
    if (updated.componentType?.enum) {
      updated.componentType.enum = updated.componentType.enum.filter(
        (t: string) => t !== componentType
      )
    }
    
    return updated
  }

  private addToProperties(properties: any, componentType: string): any {
    if (!properties) {
      return {
        componentType: { type: 'string', enum: [componentType] }
      }
    }
    
    const updated = { ...properties }
    if (!updated.componentType) {
      updated.componentType = { type: 'string', enum: [componentType] }
    } else if (!updated.componentType.enum) {
      updated.componentType.enum = [componentType]
    } else if (!updated.componentType.enum.includes(componentType)) {
      updated.componentType.enum.push(componentType)
    }
    
    return updated
  }
}

export default TemplateCustomizer
