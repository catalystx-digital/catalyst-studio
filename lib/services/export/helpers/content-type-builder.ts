import type { UniversalContentType } from '@/lib/cms-export/types'
import type { ContentTypeExport } from '../types'

/**
 * Pick the first non-empty key from candidates.
 * No sanitization - providers handle their own naming conventions.
 */
export const pickTypeKey = (...candidates: Array<string | undefined>): string => {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }
  return ''
}

const sanitizeForDependency = (raw?: string) => {
  if (!raw) return ''
  let value = raw.toString().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  if (/^[0-9]/.test(value)) value = `t_${value}`
  return value
}

const coerceDefaultValue = (value: unknown): string | number | boolean | null => {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return null
}

const normalizeFieldType = (raw?: string) => {
  const type = (raw || '').toString().trim().toLowerCase()
  switch (type) {
    case 'text':
    case 'string':
    case 'shorttext':
      return 'text'
    case 'textarea':
    case 'longtext':
      return 'longText'
    case 'richtext':
    case 'rich_text':
    case 'wysiwyg':
    case 'markdown':
      return 'richText'
    case 'number':
    case 'integer':
      return 'number'
    case 'decimal':
    case 'float':
    case 'double':
      return 'decimal'
    case 'boolean':
    case 'checkbox':
      return 'boolean'
    case 'date':
    case 'datetime':
      return 'date'
    case 'json':
    case 'object':
      return 'json'
    case 'media':
    case 'image':
    case 'asset':
    case 'file':
      return 'media'
    case 'reference':
    case 'component':
    case 'entry':
    case 'link':
      return 'component'
    case 'content[]':
      return 'array'
    case 'repeater':
    case 'list':
    case 'array':
      return 'repeater'
    case 'tags':
    case 'multiselect':
    case 'multi-select':
    case 'multi_select':
      return 'collection'
    default:
      return 'text'
  }
}

const inferLayer = (type: string): 'primitive' | 'common' | 'extension' => {
  switch (type) {
    case 'text':
    case 'longText':
    case 'number':
    case 'decimal':
    case 'boolean':
    case 'date':
    case 'json':
      return 'primitive'
    case 'richText':
    case 'media':
    case 'collection':
    case 'component':
    case 'repeater':
      return 'common'
    default:
      return 'common'
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseJson = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (error) {
      console.error('[buildUniversalContentType] Failed to parse JSON payload', error)
      return value
    }
  }
  return value
}

export const buildUniversalContentType = (
  contentType: ContentTypeExport
): UniversalContentType => {
  try {
    const rawFields = contentType.fields as unknown
    const usedIds = new Set<string>()
    const makeId = (candidate: string, fallback: string): string => {
      let base = sanitizeForDependency(candidate)
      if (!base) {
        base = sanitizeForDependency(fallback) || fallback
      }
      if (/^[0-9]/.test(base)) {
        base = `f_${base}`
      }
      let id = base || fallback
      let attempt = 1
      while (usedIds.has(id)) {
        id = `${base}_${attempt++}`
      }
      usedIds.add(id)
      return id
    }

    const rawFieldsSource = (contentType.metadata as any)?.templateFields ?? rawFields
    const parsedValue = parseJson(rawFieldsSource)
    let fieldsMeta: Record<string, any> | null = null
    let templateMetadata: Record<string, any> | null = null
    const metadataEnvelope = isPlainObject((contentType.metadata as any)?.templateMetadata)
      ? ((contentType.metadata as any).templateMetadata as Record<string, any>)
      : null

    const buildTemplateFields = (templateFields: any[]): UniversalContentType['fields'] => {
      const result: UniversalContentType['fields'] = []
      templateFields.forEach((field, index) => {
        if (!field || typeof field !== 'object') return
        const rawName = typeof field.name === 'string' && field.name.trim() ? field.name.trim() : `field_${index}`
        let normalizedType = normalizeFieldType(field?.type)
        if (normalizedType === 'repeater') {
          const props = field?.properties
          if (isPlainObject(props) && typeof props.itemType === 'string' && props.itemType !== 'object') {
            normalizedType = 'collection'
          }
        }
        const defaultValue = coerceDefaultValue(field?.defaultValue ?? field?.default)
        const platformSpecific: Record<string, unknown> = {}
        if (isPlainObject(field?.properties)) {
          platformSpecific.properties = field.properties
          if (Array.isArray((field.properties as any).allowedTypes)) {
            platformSpecific.allowedTypes = (field.properties as any).allowedTypes
          }
          if ((field.properties as any).itemType) {
            platformSpecific.itemType = (field.properties as any).itemType
          }
        }
        if (Array.isArray(field?.options) && field.options.length > 0) {
          platformSpecific.options = field.options
        }
        if (Array.isArray(field?.allowedComponentTypes) && field.allowedComponentTypes.length > 0) {
          platformSpecific.allowedTypes = Array.from(new Set(field.allowedComponentTypes))
        }
        const metadata: Record<string, unknown> = {
          createdAt: new Date(),
          updatedAt: new Date(),
          order: index,
          importedType: field?.type,
        }
        if (Array.isArray(field?.allowedComponentTypes) && field.allowedComponentTypes.length > 0) {
          metadata.allowedComponentTypes = Array.from(new Set(field.allowedComponentTypes))
        }
        if (field?.type === 'content[]' || (field?.properties && (field.properties as any).itemType)) {
          metadata.itemType = (field?.properties as any)?.itemType || 'content'
          metadata.componentList = true
        }
        if (field?.placeholder !== undefined) {
          metadata.placeholder = field.placeholder
        }
        result.push({
          id: makeId(rawName, `field_${index}`),
          name: rawName,
          layer: inferLayer(normalizedType),
          type: normalizedType,
          description: typeof field?.description === 'string' ? field.description : '',
          required: Boolean(field?.required),
          defaultValue,
          validations: field?.required
            ? [{
                type: 'required' as const,
                message: `${rawName} is required`,
              }]
            : [],
          platformSpecific: Object.keys(platformSpecific).length ? platformSpecific : undefined,
          metadata: metadata as any,
        })
      })
      return result
    }

    const isFieldDefinition = (value: any): boolean => {
      return value && typeof value === 'object' && typeof value.id === 'string'
    }

    const extractFieldDefinitions = (candidate: any): any[] => {
      if (!candidate) return []
      if (Array.isArray(candidate)) {
        return candidate.filter(isFieldDefinition)
      }
      if (isPlainObject(candidate)) {
        if (Array.isArray((candidate as any).fields)) {
          return ((candidate as any).fields as any[]).filter(isFieldDefinition)
        }
        const numericKeys = Object.keys(candidate).filter((key) => /^\d+$/.test(key))
        if (numericKeys.length) {
          return numericKeys
            .map((key) => (candidate as any)[key])
            .filter(isFieldDefinition)
        }
      }
      return []
    }

    let universalFields: UniversalContentType['fields'] = []

    if (isPlainObject(parsedValue) && Array.isArray((parsedValue as any).__fields)) {
      const templateFields = (parsedValue as any).__fields as any[]
      templateMetadata = metadataEnvelope || (isPlainObject((parsedValue as any).__metadata) ? ((parsedValue as any).__metadata as Record<string, any>) : null)
      fieldsMeta = templateMetadata
      universalFields = buildTemplateFields(templateFields)
    } else {
      let fieldsArray: any[] = []
      if (Array.isArray(parsedValue)) {
        fieldsArray = extractFieldDefinitions(parsedValue)
        if (!fieldsArray.length) {
          for (const entry of parsedValue) {
            const defs = extractFieldDefinitions(entry)
            if (defs.length) {
              fieldsArray = defs
              break
            }
          }
        }
      } else if (isPlainObject(parsedValue)) {
        fieldsMeta = metadataEnvelope || (parsedValue as Record<string, any>)
        fieldsArray = extractFieldDefinitions(parsedValue)
      } else if (typeof rawFieldsSource === 'string') {
        const parsed = parseJson(rawFieldsSource)
        fieldsArray = extractFieldDefinitions(parsed)
        if (isPlainObject(parsed) && !fieldsMeta) {
          fieldsMeta = metadataEnvelope || (parsed as Record<string, any>)
        }
      }

      if ((!Array.isArray(fieldsArray) || fieldsArray.length === 0) && rawFieldsSource) {
        const fallback = extractFieldDefinitions(rawFieldsSource)
        if (fallback.length) {
          fieldsArray = fallback
        }
      }

      fieldsArray = Array.isArray(fieldsArray) ? fieldsArray.filter(isFieldDefinition) : []
      fieldsArray.sort((a, b) => ((a?.order ?? 0) - (b?.order ?? 0)))

      universalFields = fieldsArray.map((field: any, index: number) => {
        const normalizedType = normalizeFieldType(field?.type)
        const name = field?.name || field?.id || `field_${index}`
        const id = makeId(field?.id || field?.name || `field_${index}`, `field_${index}`)
        const platformSpecific = {
          ...(field?.options ? { options: field.options } : {}),
          ...(field?.rawType ? { rawType: field.rawType } : {}),
          ...((field?.platformSpecific && field.platformSpecific.allowedTypes)
            ? { allowedTypes: field.platformSpecific.allowedTypes }
            : {}),
        }
        return {
          id,
          name,
          layer: inferLayer(normalizedType),
          type: normalizedType,
          description: field?.label || field?.description || '',
          required: Boolean(field?.required),
          defaultValue: coerceDefaultValue(field?.default || field?.defaultValue),
          validations: field?.required
            ? [{
                type: 'required' as const,
                message: `${field?.label || field?.name || 'Field'} is required`,
              }]
            : [],
          platformSpecific: Object.keys(platformSpecific).length ? platformSpecific : undefined,
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            order: field?.order ?? index,
            componentType: field?.componentType,
            itemType: field?.itemType,
          } as any,
        }
      })
    }

    const rawKey = (contentType.key || contentType.name || contentType.id || 'type').toString()
    const safeKey = pickTypeKey(contentType.key, contentType.name, contentType.id) || pickTypeKey(rawKey) || 'type'

    const surfaceMeta = templateMetadata ?? fieldsMeta ?? {}
    const platformSpecificMeta: Record<string, unknown> = { provider: 'contentful' }
    if ((surfaceMeta as any)?.icon) platformSpecificMeta.icon = (surfaceMeta as any).icon
    if ((surfaceMeta as any)?.name && typeof (surfaceMeta as any).name === 'string') platformSpecificMeta.displayName = (surfaceMeta as any).name
    if ((surfaceMeta as any)?.pluralName && typeof (surfaceMeta as any).pluralName === 'string') platformSpecificMeta.pluralName = (surfaceMeta as any).pluralName
    if (Array.isArray(contentType.mayContainTypes)) {
      const sanitizedContainment = Array.from(
        new Set(
          contentType.mayContainTypes.filter((value): value is string => typeof value === 'string')
        )
      )
      platformSpecificMeta.mayContainTypes = sanitizedContainment.includes('*')
        ? ['*']
        : sanitizedContainment
    }

    const metadataPayload: Record<string, unknown> = {
      category: contentType.category,
      key: safeKey,
      originalKey: contentType.key,
      databaseId: contentType.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      platformSpecific: platformSpecificMeta,
    }
    if (Array.isArray(contentType.mayContainTypes)) {
      const sanitizedContainment = Array.from(
        new Set(contentType.mayContainTypes.filter((value): value is string => typeof value === 'string'))
      )
      metadataPayload.mayContainTypes = sanitizedContainment.includes('*')
        ? ['*']
        : sanitizedContainment
    }
    if (templateMetadata) {
      metadataPayload.templateMetadata = templateMetadata
    }

    return {
      id: safeKey,
      name: contentType.name,
      pluralName: contentType.pluralName,
      description: typeof (surfaceMeta as any)?.description === 'string' ? (surfaceMeta as any).description : '',
      version: '1.0',
      type: (contentType.category && contentType.category.toLowerCase() === 'page') ? 'page' : 'component',
      isRoutable: contentType.category === 'page',
      fields: universalFields,
      metadata: metadataPayload as any,
    } as UniversalContentType
  } catch (error) {
    console.error(`[buildUniversalContentType] Failed for ${contentType.key}`, error)
    const rawKey = (contentType.key || contentType.name || contentType.id || 'type').toString()
    const safeKey = pickTypeKey(contentType.key, contentType.name, contentType.id) || pickTypeKey(rawKey) || 'type'

    return {
      id: safeKey,
      name: contentType.name || safeKey,
      pluralName: contentType.pluralName || `${safeKey}s`,
      description: '',
      version: '1.0',
      type: 'component',
      isRoutable: false,
      fields: [],
      metadata: {
        category: contentType.category,
        key: safeKey,
        originalKey: contentType.key,
        databaseId: contentType.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        platformSpecific: { provider: 'contentful' },
      } as any,
    } as UniversalContentType
  }
}

