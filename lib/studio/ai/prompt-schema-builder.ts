import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import type { ComponentRegistryEntry } from '@/lib/studio/components/cms/_core/types'
import { buildDetectionSchemaBundle } from '@/lib/studio/evals/detection/schema'
import type {
  ComponentSchema,
  DetectionSchemaBundle,
  SchemaArrayField,
  SchemaField,
  SchemaFieldType
} from '@/lib/studio/evals/detection/schema'

export interface PromptSchemaField {
  name: string
  path: string
  type: string
  required: boolean
  description?: string
  allowedTypes?: string[]
  options?: Array<string | number>
  children?: PromptSchemaField[]
}

export interface PromptSchemaComponent {
  type: string
  summary: string
  description?: string
  defaultRegion?: string
  fields: PromptSchemaField[]
  source?: 'schema' | 'registry'
}

export interface PromptSchemaSummary {
  components: PromptSchemaComponent[]
  subcomponents: PromptSchemaComponent[]
  schemaHash: string
  generatedAt: string
}

interface CachedSchemaSummary {
  hash: string
  summary: PromptSchemaSummary
}

let cachedSummary: CachedSchemaSummary | null = null

export async function buildPromptSchemaSummary(): Promise<PromptSchemaSummary> {
  const bundle = await buildDetectionSchemaBundle()
  if (cachedSummary && cachedSummary.hash === bundle.integrity.hash) {
    return cachedSummary.summary
  }

  const registry = cmsComponentFactory.getRegistry()

  const entries = Object.values(bundle.components).map(schema => {
    const registryEntry = resolveRegistryEntry(schema, registry)
    return {
      schema,
      registryEntry,
      promptComponent: toPromptSchemaComponent(schema, registryEntry)
    }
  })

  const components: PromptSchemaComponent[] = []
  const subcomponents: PromptSchemaComponent[] = []

  entries.forEach(entry => {
    if (!entry.promptComponent) return
    const isSubOnly = Boolean(
      entry.registryEntry?.subOnly ??
        registry.get((entry.schema.componentType ?? entry.schema.canonicalType) as any)?.subOnly
    )
    if (isSubOnly) {
      subcomponents.push(entry.promptComponent)
    } else {
      components.push(entry.promptComponent)
    }
  })

  components.sort((a, b) => a.type.localeCompare(b.type))
  subcomponents.sort((a, b) => a.type.localeCompare(b.type))

  const summary: PromptSchemaSummary = {
    components,
    subcomponents,
    schemaHash: bundle.integrity.hash,
    generatedAt: bundle.generatedAt
  }

  cachedSummary = { hash: bundle.integrity.hash, summary }
  return summary
}

function resolveRegistryEntry(
  schema: ComponentSchema,
  registry: Map<string, ComponentRegistryEntry>
): ComponentRegistryEntry | undefined {
  const lookup = schema.componentType ?? schema.canonicalType
  return registry.get(lookup as any)
}

function toPromptSchemaComponent(
  schema: ComponentSchema,
  registryEntry: ComponentRegistryEntry | undefined
): PromptSchemaComponent | undefined {
  const fields = schema.fields
    .map(field => toPromptSchemaField(field))
    .filter(Boolean) as PromptSchemaField[]

  const summary = truncateText(schema.summary || registryEntry?.description || '', 90)

  return {
    type: schema.canonicalType,
    summary,
    description: schema.description ?? registryEntry?.description,
    defaultRegion: schema.defaultRegion,
    fields,
    source: schema.propsSource === 'propsMeta' ? 'schema' : registryEntry ? 'registry' : 'schema'
  }
}

function toPromptSchemaField(field: SchemaField, parentPath?: string): PromptSchemaField | undefined {
  const path = parentPath ? `${parentPath}.${field.name}` : field.name
  const description = field.description ? sanitizeDescription(field.description) : undefined

  if (field.type === 'object') {
    const children = (field.fields ?? [])
      .map(child => toPromptSchemaField(child, path))
      .filter(Boolean) as PromptSchemaField[]
    return {
      name: field.name,
      path,
      type: 'object',
      required: field.required,
      description,
      children
    }
  }

  if (field.type === 'array') {
    const arrayField = field as SchemaArrayField
    const { allowedTypes, displayType, children, options } = describeArrayField(arrayField, path)
    return {
      name: field.name,
      path,
      type: displayType,
      required: field.required,
      description,
      allowedTypes,
      options,
      ...(children.length > 0 ? { children } : {})
    }
  }

  return {
    name: field.name,
    path,
    type: mapPrimitiveType(field.type),
    required: field.required,
    description,
    options: collectOptions(field)
  }
}

function describeArrayField(
  field: SchemaArrayField,
  path: string
): {
  allowedTypes?: string[]
  displayType: string
  children: PromptSchemaField[]
  options?: Array<string | number>
} {
  const allowedTypes =
    field.allowedTypes ??
    (field.items && field.items.kind === 'component' ? field.items.allowedTypes : undefined)

  if (field.items?.kind === 'object') {
    const children =
      field.items.fields?.map(child => toPromptSchemaField(child, `${path}[]`)).filter((c): c is PromptSchemaField => c !== undefined) ?? []
    return {
      allowedTypes,
      displayType: 'object[]',
      children,
      options: undefined
    }
  }

  if (field.items?.kind === 'primitive') {
    const displayType = `${mapPrimitiveType(field.items.type)}[]`
    const options = field.items.options?.map(option => option.value)
    return { allowedTypes, displayType, children: [], options }
  }

  if (allowedTypes && allowedTypes.length > 0) {
    return {
      allowedTypes,
      displayType: 'content[]',
      children: [],
      options: undefined
    }
  }

  return {
    allowedTypes,
    displayType: 'array',
    children: [],
    options: undefined
  }
}

function mapPrimitiveType(type: SchemaFieldType): string {
  switch (type) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'url':
      return 'url'
    case 'richText':
      return 'richText'
    case 'media':
      return 'media'
    case 'select':
      return 'select'
    case 'reference':
      return 'reference'
    default:
      return type
  }
}

function collectOptions(field: SchemaField): Array<string | number> | undefined {
  if ('options' in field && field.options && field.options.length > 0) {
    return field.options.map(option => option.value)
  }
  return undefined
}

function sanitizeDescription(description: string): string {
  return description.replace(/\s+/g, ' ').trim()
}

function truncateText(value: string, max: number): string {
  if (!value) return value
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}
