import type { DetectionSchemaBundle, SchemaArrayField, SchemaArrayItem, SchemaField, SchemaFieldType } from './types'

export type ViolationSeverity = 'error' | 'warning'

export interface SchemaViolation {
  code: string
  message: string
  path: string
  severity: ViolationSeverity
  details?: Record<string, unknown>
}

export interface ComponentValidation {
  type: string
  path: string
  violations: SchemaViolation[]
}

export interface SchemaValidationResult {
  components: ComponentValidation[]
  violations: SchemaViolation[]
  warnings: SchemaViolation[]
}

export interface DetectionComponent {
  type: string
  confidence?: number
  content: Record<string, any>
  region?: string
  metadata?: Record<string, any>
}

function makeViolation(
  code: string,
  message: string,
  path: string,
  severity: ViolationSeverity = 'error',
  details?: Record<string, unknown>
): SchemaViolation {
  return { code, message, path, severity, ...(details ? { details } : {}) }
}

function canonicalTypeName(type: string | undefined): string {
  return (type || '').trim().toLowerCase()
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validatePrimitiveType(fieldType: SchemaFieldType, value: unknown): boolean {
  switch (fieldType) {
    case 'string':
    case 'richText':
    case 'url':
      return typeof value === 'string'
    case 'media':
      // Media fields can be either a URL string or an Image object (with src, alt, etc.)
      return typeof value === 'string' || isPlainObject(value)
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'select':
      return typeof value === 'string' || typeof value === 'number'
    case 'reference':
      return isPlainObject(value) || typeof value === 'string'
    default:
      return true
  }
}

function validateSelectOptions(field: SchemaField, value: unknown): boolean {
  if (!('options' in field) || !field.options) return true
  return field.options.some(option => option.value === value)
}

function validateComponentArrayItem(
  item: unknown,
  allowedTypes: string[] | undefined,
  path: string,
  bundle: DetectionSchemaBundle,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (!isPlainObject(item)) {
    addViolation(makeViolation('component_array.invalid_entry', 'Expected component object in content array', path))
    return
  }

  const type = canonicalTypeName(item.type)
  if (!type) {
    addViolation(makeViolation('component_array.missing_type', 'Component array entry is missing a type', path))
    return
  }

  if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !allowedTypes.includes(type)) {
    addViolation(
      makeViolation('component_array.disallowed_type', `Component type "${type}" is not allowed here`, path, 'error', {
        allowedTypes
      })
    )
  }

  const schema = bundle.components[type]
  if (!schema) {
    addViolation(
      makeViolation(
        'component_array.unknown_type',
        `Component type "${type}" is not present in schema bundle`,
        path,
        'error'
      )
    )
    return
  }

  const nestedComponent: DetectionComponent = {
    type,
    content: Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'type'))
  }
  validateComponentAgainstSchema(nestedComponent, schema, bundle, path, addViolation)
}

function validateArrayField(
  field: SchemaArrayField,
  value: unknown,
  path: string,
  bundle: DetectionSchemaBundle,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (value === undefined || value === null) {
    if (field.required) {
      addViolation(makeViolation('field.required', `Field "${field.name}" is required`, path))
    }
    return
  }

  if (!Array.isArray(value)) {
    addViolation(makeViolation('field.type_mismatch', `Expected array for field "${field.name}"`, path, 'error', { value }))
    return
  }

  if (!field.items) {
    return
  }

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`
    handleArrayItem(field.items as SchemaArrayItem, entry, entryPath, bundle, addViolation, field.allowedTypes)
  })
}

function handleArrayItem(
  item: SchemaArrayItem,
  entry: unknown,
  path: string,
  bundle: DetectionSchemaBundle,
  addViolation: (violation: SchemaViolation) => void,
  allowedTypes?: string[]
): void {
  if (item.kind === 'component') {
    validateComponentArrayItem(entry, allowedTypes ?? item.allowedTypes, path, bundle, addViolation)
    return
  }

  if (item.kind === 'object') {
    if (!isPlainObject(entry)) {
      addViolation(makeViolation('array.object_expected', 'Expected object in array field', path))
      return
    }
    for (const nestedField of item.fields || []) {
      validateField(nestedField, entry[nestedField.name], `${path}.${nestedField.name}`, bundle, addViolation)
    }
    return
  }

  if (!validatePrimitiveType(item.type, entry)) {
    addViolation(
      makeViolation('array.primitive_type_mismatch', 'Array entry does not match primitive type expectation', path, 'error', {
        expected: item.type,
        value: entry
      })
    )
    return
  }

  if (item.options && !item.options.some(option => option.value === entry)) {
    addViolation(
      makeViolation(
        'array.unexpected_option',
        `Value "${entry}" is not one of the allowed options`,
        path,
        'error',
        { options: item.options.map(opt => opt.value) }
      )
    )
  }
}

function validateObjectField(
  field: SchemaField,
  value: unknown,
  path: string,
  bundle: DetectionSchemaBundle,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (value === undefined || value === null) {
    if (field.required) {
      addViolation(makeViolation('field.required', `Field "${field.name}" is required`, path))
    }
    return
  }

  if (!isPlainObject(value)) {
    addViolation(
      makeViolation('field.type_mismatch', `Expected object for field "${field.name}"`, path, 'error', { value })
    )
    return
  }

  for (const nestedField of (field as any).fields || []) {
    validateField(nestedField, value[nestedField.name], `${path}.${nestedField.name}`, bundle, addViolation)
  }
}

function validatePrimitiveField(
  field: SchemaField,
  value: unknown,
  path: string,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (value === undefined || value === null) {
    if (field.required) {
      addViolation(makeViolation('field.required', `Field "${field.name}" is required`, path))
    }
    return
  }

  if (!validatePrimitiveType(field.type, value)) {
    addViolation(
      makeViolation('field.type_mismatch', `Field "${field.name}" has incorrect type`, path, 'error', {
        expected: field.type,
        value
      })
    )
    return
  }

  if (!validateSelectOptions(field, value)) {
    addViolation(
      makeViolation(
        'field.unexpected_option',
        `Value "${value}" is not one of the allowed options`,
        path,
        'error',
        {
          options: (field as any).options?.map((option: any) => option.value)
        }
      )
    )
  }
}

function validateField(
  field: SchemaField,
  value: unknown,
  path: string,
  bundle: DetectionSchemaBundle,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (field.type === 'array') {
    validateArrayField(field as SchemaArrayField, value, path, bundle, addViolation)
    return
  }

  if (field.type === 'object') {
    validateObjectField(field, value, path, bundle, addViolation)
    return
  }

  validatePrimitiveField(field, value, path, addViolation)
}

function validateComponentAgainstSchema(
  component: DetectionComponent,
  schema: NonNullable<ReturnType<typeof pickComponentSchema>>,
  bundle: DetectionSchemaBundle,
  basePath: string,
  addViolation: (violation: SchemaViolation) => void
): void {
  const { fields } = schema
  const content = component.content || {}

  for (const field of fields) {
    const value = content[field.name]
    const path = `${basePath}.content.${field.name}`
    validateField(field, value, path, bundle, addViolation)
  }

  if (component.confidence !== undefined) {
    if (typeof component.confidence !== 'number' || component.confidence < 0 || component.confidence > 1) {
      addViolation(
        makeViolation(
          'component.confidence_range',
          'Component confidence must be between 0 and 1',
          `${basePath}.confidence`,
          'warning',
          { value: component.confidence }
        )
      )
    }
  }
}

function pickComponentSchema(bundle: DetectionSchemaBundle, componentType: string) {
  return bundle.components[canonicalTypeName(componentType)]
}

function collectUnexpectedFields(
  component: DetectionComponent,
  schema: NonNullable<ReturnType<typeof pickComponentSchema>>,
  path: string,
  addViolation: (violation: SchemaViolation) => void
): void {
  if (schema.fields.length === 0) {
    return
  }
  const allowedFieldNames = new Set(schema.fields.map(field => field.name))
  const content = component.content || {}
  for (const key of Object.keys(content)) {
    if (!allowedFieldNames.has(key)) {
      addViolation(
        makeViolation('field.unexpected', `Field "${key}" is not defined in schema for component "${component.type}"`, path, 'warning')
      )
    }
  }
}

export function validateDetectionComponents(
  bundle: DetectionSchemaBundle,
  components: DetectionComponent[]
): SchemaValidationResult {
  const componentValidations: ComponentValidation[] = []
  const allViolations: SchemaViolation[] = []
  const warnings: SchemaViolation[] = []

  const add = (violation: SchemaViolation) => {
    allViolations.push(violation)
    if (violation.severity === 'warning') {
      warnings.push(violation)
    }
  }

  components.forEach((component, index) => {
    const path = `components[${index}]`
    const normalizedType = canonicalTypeName(component.type)
    if (!normalizedType) {
      const violation = makeViolation('component.missing_type', 'Component type is missing or empty', path)
      add(violation)
      componentValidations.push({ type: '(unknown)', path, violations: [violation] })
      return
    }

    const schema = pickComponentSchema(bundle, normalizedType)
    if (!schema) {
      const violation = makeViolation(
        'component.unknown',
        `Component type "${normalizedType}" is not present in schema bundle`,
        path
      )
      add(violation)
      componentValidations.push({ type: normalizedType, path, violations: [violation] })
      return
    }

    const componentViolations: SchemaViolation[] = []
    const addLocal = (violation: SchemaViolation) => {
      componentViolations.push(violation)
      add(violation)
    }

    validateComponentAgainstSchema(component, schema, bundle, path, addLocal)
    collectUnexpectedFields(component, schema, `${path}.content`, addLocal)

    componentValidations.push({
      type: normalizedType,
      path,
      violations: componentViolations
    })
  })

  bundle.warnings.forEach(message => {
    warnings.push(makeViolation('schema.warning', message, 'schema', 'warning'))
  })

  return {
    components: componentValidations,
    violations: allViolations,
    warnings
  }
}
