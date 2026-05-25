import type { PromptContractBundle, PromptContractComponent } from '@/lib/studio/ai/prompt-contract-builder'
import type { PromptSchemaSummary, PromptSchemaField } from '@/lib/studio/ai/prompt-schema-builder'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'
import {
  canonicalizeComponentType,
  ensureCanonicalComponentsRegistered,
  getCanonicalComponent,
  type CanonicalComponentDefinition
} from '@/lib/studio/import/detection/canonical'
import type { ComponentCatalogComponent, ComponentCatalogSummary, ComponentPropertyInfo, BuildDetectionPromptOptions, BuildChatPromptOptions } from './types'
import { getDirectives } from '@/lib/studio/components/cms/_core/definition-loader'
import {
  PROMPT_NEWLINE,
  PROMPT_SECTION_SEPARATOR,
  createStaticSection,
  compactPromptText,
  trimTrailingEmptyLines,
  formatList,
  renderSchemaFieldNode,
  renderPropertyNode,
  ORDERING_RULES_SECTION,
  CONTENT_EXTRACTION_SECTION,
  VALUE_OBJECT_OUTPUT_SECTION,
  CONTENT_REFERENCE_RULES_SECTION,
  FULL_PAGE_COVERAGE_SECTION,
  CRITICAL_COMPLETENESS_SECTION,
  FORBIDDEN_FIELDS_SECTION,
  PAGE_METADATA_SECTION
} from './prompt-sections'

type TemplateContentSchema = NonNullable<PageCatalogTemplateSummary['contentSchema']>

interface TemplateComplianceRegionSummary {
  region: string
  definitions: CanonicalComponentDefinition[]
}

interface TemplateComplianceSummary {
  templateKey: string
  templateName: string
  regions: TemplateComplianceRegionSummary[]
  guidance?: string[]
}

function resolveCanonicalDefinition(canonicalType: string): CanonicalComponentDefinition | undefined {
  const contract = getComponentContractByCanonicalType(canonicalType)
  if (contract) {
    return {
      canonicalType: contract.canonicalType,
      componentType: contract.componentType,
      summary: contract.summary,
      fragments: [...contract.fragments],
      cues: [...contract.cues],
      sampleContent: contract.sampleContent ? { ...contract.sampleContent } : {}
    }
  }
  return getCanonicalComponent(canonicalType)
}

export function buildTemplateComplianceSection(pageSummary: PageCatalogSummary | undefined): string | null {
  ensureCanonicalComponentsRegistered()

  if (!pageSummary || !Array.isArray(pageSummary.templates) || pageSummary.templates.length === 0) {
    return null
  }

  const templates: TemplateComplianceSummary[] = []

  for (const template of pageSummary.templates) {
    const regions: TemplateComplianceRegionSummary[] = []
    const requiredRegions = template.requiredRegions || []

    for (const region of requiredRegions) {
      const allowed = Array.isArray(region.allowedComponents) ? region.allowedComponents : []
      const definitions = new Map<string, CanonicalComponentDefinition>()

      for (const value of allowed) {
        const rawType = typeof value === 'string'
          ? value
          : value && typeof (value as any).type === 'string'
            ? (value as any).type
            : String(value)
        const canonicalType = canonicalizeComponentType(rawType)
        if (!canonicalType) {
          continue
        }
        const definition = resolveCanonicalDefinition(canonicalType)
        if (definition && !definitions.has(definition.canonicalType)) {
          definitions.set(definition.canonicalType, definition)
        }
      }

      if (definitions.size > 0) {
        regions.push({
          region: String(region.region),
          definitions: Array.from(definitions.values())
        })
      }
    }

    if (regions.length > 0) {
      templates.push({
        templateKey: template.templateKey,
        templateName: template.name,
        regions,
        guidance: template.detectionGuidance ? [...template.detectionGuidance] : undefined
      })
    }
  }

  if (templates.length === 0) {
    return null
  }

  const lines: string[] = []
  lines.push('=== TEMPLATE COMPLIANCE RULES ===')
  lines.push('Always emit the canonical components required by the selected template before validation.')
  lines.push('Collapse granular detections (article-header, text-block, teaser cards, etc.) into the canonical type allowed for each region.')
  lines.push('Do not emit a "region" field; the importer assigns regions automatically. Keep the component order identical to the page.')
  lines.push('Component field contracts are listed in COMPONENT CONTRACTS; this section only maps templates to allowed canonical component types.')
  lines.push('')

  const prioritized = templates.slice(0, 6)
  for (const entry of prioritized) {
    lines.push(`Template: ${entry.templateKey} (${entry.templateName})`)
    for (const region of entry.regions) {
      lines.push(`  ${region.region}: ${region.definitions.map(definition => definition.canonicalType).join(', ')}`)
    }
    if (entry.guidance && entry.guidance.length > 0) {
      lines.push('  Guidance:')
      for (const note of entry.guidance.slice(0, 2)) {
        lines.push(`    - ${note}`)
      }
    }
    lines.push('')
  }

  return lines.join(PROMPT_NEWLINE)
}

function buildRequiredReturnSection(pageSummary: PageCatalogSummary | undefined): string {
  const propertyMeta = new Map<string, TemplateContentSchema[string]>()

  if (pageSummary) {
    for (const template of pageSummary.templates) {
      const schema = template.contentSchema
      if (!schema) continue
      for (const [key, meta] of Object.entries(schema)) {
        if (!propertyMeta.has(key)) {
          propertyMeta.set(key, meta)
        }
      }
    }
  }

  const propertyNames = Array.from(propertyMeta.keys()).sort()
  if (propertyNames.length === 0) {
    propertyNames.push('components')
  }

  const primaryProperty = propertyNames[0]

  const descriptorLines: string[] = ['=== REQUIRED RETURN FORMAT ===']
  descriptorLines.push('Property requirements:')
  for (const name of propertyNames) {
    const meta = propertyMeta.get(name)
    const required = meta?.required ? 'required' : 'optional'
    const allowed = meta?.allowedComponentTypes && meta.allowedComponentTypes.length > 0
      ? ` allowedTypes=[${meta.allowedComponentTypes.slice(0, 8).join(', ')}${meta.allowedComponentTypes.length > 8 ? ', ...' : ''}]`
      : ''
    const description = meta?.description ? ` ${meta.description}` : ''
    descriptorLines.push(`- ${name}: ${meta?.type ?? 'unknown'} (${required}${allowed})${description}`)
  }

  descriptorLines.push('{')
  descriptorLines.push('  "pageTemplate": {')
  descriptorLines.push('    "templateKey": "<one-of-registered-template-keys>",')
  descriptorLines.push('    "confidence": 0.0-1.0,')
  descriptorLines.push('    "reason": "<brief justification using layout, URL, or component evidence>"')
  descriptorLines.push('  },')

  const propertySampleLines: string[] = []
  for (const name of propertyNames) {
    if (name === primaryProperty) {
      propertySampleLines.push(
        `  "${name}": [{ "component": "<registered-component-type>", "confidence": 0.0-1.0, "content": { "summary": "<short description>", ... } }, ...],`
      )
    } else {
      propertySampleLines.push(`  "${name}": <value>,`)
    }
  }

  descriptorLines.push(...propertySampleLines)
  descriptorLines.push('  "pageMetadata": { /* metadata fields as specified */ }')
  descriptorLines.push('}')
  descriptorLines.push('Every item in the primary content array MUST be an object with exactly this shape: { "component": "<registered-component-type>", "confidence": 0.0-1.0, "content": { ... } }.')
  descriptorLines.push('The "component" value MUST exactly match a registered top-level component type from COMPONENT CONTRACTS. Never use generic names such as "section", "container", "group", "block", "content", "layout", or DOM tag names.')
  descriptorLines.push('Never return tuple arrays such as ["type", 0.9, {...}], bare strings, or component names without content objects.')
  descriptorLines.push('IMPORTANT: Return ONLY JSON (no prose, no code fences). Maximum of 40 components. All string values MUST be valid JSON strings with escaped quotes and backslashes.')

  return createStaticSection(descriptorLines)
}

function mapContractFields(fields: any[] | undefined): ComponentPropertyInfo[] | undefined {
  if (!fields || fields.length === 0) {
    return undefined
  }

  return fields.map(field => ({
    name: String(field.name),
    type: String(field.type),
    required: Boolean(field.required),
    ...(field.description ? { description: String(field.description) } : {}),
    ...(field.allowedTypes && field.allowedTypes.length > 0
      ? { allowedTypes: field.allowedTypes.map((value: any) => String(value)) }
      : {}),
    source: field.source
  }))
}

function buildContractComponentSection(
  contractBundle: PromptContractBundle,
  schemaSummary: PromptSchemaSummary
): string {
  const schemaIndex = new Map(schemaSummary.components.map(component => [component.type, component]))
  const lines: string[] = [`=== COMPONENT CONTRACTS (${contractBundle.components.length}) ===`]
  lines.push('Only emit documented fields; omit any legacy or unsupported keys.')
  lines.push('Follow allowedTypes exactly—create child components for each canonical type listed; when no list is provided, treat it as a wildcard and still pick the correct canonical type.')
  lines.push('If a field is absent here (e.g., summary on navigation), do NOT synthesize it.')

  contractBundle.components.forEach((component, index) => {
    if (index > 0) {
      lines.push('')
    }
    const schemaComponent = schemaIndex.get(component.type)
    const headerParts = [component.type]
    if (schemaComponent?.defaultRegion) {
      headerParts.push(`[default region: ${schemaComponent.defaultRegion}]`)
    }
    const summary = component.summary || schemaComponent?.summary || component.description || 'No summary provided.'
    lines.push(`${headerParts.join(' ')} — ${summary}`)

    const fields = mapContractFields(component.fields)
    if (schemaComponent && schemaComponent.fields.length > 0) {
      lines.push('  Fields:')
      schemaComponent.fields.forEach(field => renderSchemaFieldNode(field, 2, lines))
    } else if (fields && fields.length > 0) {
      lines.push('  Fields:')
      fields.forEach(field => renderPropertyNode(field, 2, lines))
    } else {
      lines.push('  Fields: none declared.')
    }

    if (fields && fields.length > 0) {
      const requiredArrayFields = fields.filter(field => {
        if (!field.required) return false
        const type = field.type.trim().toLowerCase()
        return type.endsWith('[]')
      })
      for (const field of requiredArrayFields) {
        const allowed =
          field.allowedTypes && field.allowedTypes.length > 0
            ? ` Use allowedTypes: ${formatList(field.allowedTypes)}.`
            : ' Allowed types not listed: choose the component type that best matches the rendered content.'
        lines.push(
          `  REQUIRED ARRAY "${field.name}": include every real entry from the UI in order; never return an empty array when content exists.${allowed}`
        )
      }
    }

    const directives = stripDirectiveExamples(getDirectives(component.type))
    if (directives.length > 0) {
      for (const directive of directives) {
        lines.push(`  ${compactPromptText(directive, 260)}`)
      }
    }

    const lacksSummary = component.category === 'navigation' && !component.fields.some((field: any) => field.name === 'summary')
    if (lacksSummary) {
      lines.push('  Forbidden: summary (navigation contracts omit summary fields).')
    }
  })

  trimTrailingEmptyLines(lines)
  return lines.join(PROMPT_NEWLINE)
}

function stripDirectiveExamples(directives: string[]): string[] {
  const kept: string[] = []
  let skippingExampleBlock = false

  for (const directive of directives) {
    const trimmed = directive.trim()
    const startsExampleBlock =
      /^example\b/i.test(trimmed) ||
      /^example payload\b/i.test(trimmed) ||
      /^image extraction examples\b/i.test(trimmed) ||
      /^common html patterns\b/i.test(trimmed)

    if (startsExampleBlock) {
      skippingExampleBlock = true
      continue
    }

    if (skippingExampleBlock) {
      const looksLikeExampleContinuation =
        directive.startsWith('  ') ||
        /^[{}\]"']/.test(trimmed) ||
        /^-?\s*<[^>]+>/.test(trimmed)

      if (looksLikeExampleContinuation) {
        continue
      }
      skippingExampleBlock = false
    }

    kept.push(directive)
  }

  return kept
}

function buildContractSubcomponentSection(
  contractBundle: PromptContractBundle,
  schemaSummary: PromptSchemaSummary
): string | null {
  if (contractBundle.subcomponents.length === 0) {
    return null
  }

  const schemaIndex = new Map(schemaSummary.subcomponents.map(component => [component.type, component]))
  const lines: string[] = [`SUBCOMPONENT CONTRACTS (${contractBundle.subcomponents.length})`]
  lines.push('Use these only inside content[] fields that list the matching allowedTypes; if the parent omits allowedTypes, treat it as wildcard and use the subcomponent whenever it fits the rendered element.')

  contractBundle.subcomponents.forEach((component, index) => {
    if (index > 0) {
      lines.push('')
    }
    const schemaComponent = schemaIndex.get(component.type)
    const summary = component.summary || schemaComponent?.summary || component.description || 'No summary provided.'
    lines.push(`${component.type} — ${summary}`)

    const usage = contractBundle.subcomponentUsage[component.type]
    if (usage && usage.length > 0) {
      const usageList = usage.flatMap(entry => entry.fields.map(field => `${entry.component}.${field}`))
      if (usageList.length > 0) {
        lines.push(`  Allowed in: ${formatList(usageList, 10)}`)
      }
    }

    const fields = mapContractFields(component.fields)
    if (schemaComponent && schemaComponent.fields.length > 0) {
      lines.push('  Fields:')
      schemaComponent.fields.forEach(field => renderSchemaFieldNode(field, 2, lines))
    } else if (fields && fields.length > 0) {
      lines.push('  Fields:')
      fields.forEach(field => renderPropertyNode(field, 2, lines))
    } else {
      lines.push('  Fields: none declared.')
    }
  })

  trimTrailingEmptyLines(lines)
  return lines.join(PROMPT_NEWLINE)
}

function buildSchemaComponentSection(schemaSummary: PromptSchemaSummary): string {
  const lines: string[] = [`=== COMPONENT CONTRACTS (${schemaSummary.components.length}) ===`]
  lines.push('Only emit documented fields; omit any legacy or unsupported keys.')
  lines.push('Follow allowedTypes exactly—create child components for each canonical type listed; when no list is provided, treat it as a wildcard and still choose the appropriate canonical type.')

  schemaSummary.components.forEach((component, index) => {
    if (index > 0) {
      lines.push('')
    }
    const headerParts = [component.type]
    if (component.defaultRegion) {
      headerParts.push(`[default region: ${component.defaultRegion}]`)
    }
    lines.push(`${headerParts.join(' ')} — ${component.summary}`)
    if (component.fields.length === 0) {
      lines.push('  Fields: none declared.')
      return
    }
    lines.push('  Fields:')
    component.fields.forEach(field => renderSchemaFieldNode(field, 2, lines))
  })

  trimTrailingEmptyLines(lines)
  return lines.join(PROMPT_NEWLINE)
}

function buildSchemaSubcomponentSection(schemaSummary: PromptSchemaSummary): string | null {
  if (schemaSummary.subcomponents.length === 0) {
    return null
  }

  const lines: string[] = [`SUBCOMPONENT CONTRACTS (${schemaSummary.subcomponents.length})`]
  lines.push('Use these only inside content[] fields that list the matching allowedTypes.')

  schemaSummary.subcomponents.forEach((component, index) => {
    if (index > 0) {
      lines.push('')
    }
    lines.push(`${component.type} — ${component.summary}`)
    if (component.fields.length === 0) {
      lines.push('  Fields: none declared.')
      return
    }
    lines.push('  Fields:')
    component.fields.forEach(field => renderSchemaFieldNode(field, 2, lines))
  })

  trimTrailingEmptyLines(lines)
  return lines.join(PROMPT_NEWLINE)
}

export function buildDetectionPrompt(
  _summary: ComponentCatalogSummary,
  options: BuildDetectionPromptOptions
): string {
  const sections: string[] = []
  const pagePrompt = options.pagePrompt?.trim()
  const complianceSection = buildTemplateComplianceSection(options.pageSummary)
  const componentSection = options.contractBundle
    ? buildContractComponentSection(options.contractBundle, options.schemaSummary)
    : buildSchemaComponentSection(options.schemaSummary)
  const subcomponentSection = options.contractBundle
    ? buildContractSubcomponentSection(options.contractBundle, options.schemaSummary)
    : buildSchemaSubcomponentSection(options.schemaSummary)

  if (pagePrompt) {
    sections.push(pagePrompt)
  }
  if (complianceSection) {
    sections.push(complianceSection)
  }

  sections.push(componentSection)
  if (subcomponentSection) {
    sections.push(subcomponentSection)
  }
  sections.push(ORDERING_RULES_SECTION)
  sections.push(CONTENT_EXTRACTION_SECTION)
  sections.push(VALUE_OBJECT_OUTPUT_SECTION)
  sections.push(CONTENT_REFERENCE_RULES_SECTION)
  sections.push(FULL_PAGE_COVERAGE_SECTION)
  sections.push(CRITICAL_COMPLETENESS_SECTION)
  sections.push(FORBIDDEN_FIELDS_SECTION)
  sections.push(PAGE_METADATA_SECTION)
  sections.push(buildRequiredReturnSection(options.pageSummary))

  return sections.filter(Boolean).join(PROMPT_SECTION_SEPARATOR)
}

function formatRequiredProperties(properties: ComponentPropertyInfo[] | undefined): string {
  if (!properties) return 'none'
  const required = properties.filter(prop => prop.required).map(prop => prop.name)
  return required.length > 0 ? required.join(', ') : 'none'
}

function formatContentAreas(properties: ComponentPropertyInfo[] | undefined): string | null {
  if (!properties) return null
  const contentFields: string[] = []
  for (const property of properties) {
    const type = property.type.toLowerCase()
    if (type.includes('content')) {
      const allowed = property.allowedTypes && property.allowedTypes.length > 0
        ? property.allowedTypes.join('/')
        : 'any registered type'
      contentFields.push(`${property.name} -> ${allowed}`)
    }
  }
  return contentFields.length > 0 ? contentFields.join('; ') : null
}

export function buildChatPrompt(
  summary: ComponentCatalogSummary,
  options: BuildChatPromptOptions = {}
): string {
  const includeGuidelines = options.includeGuidelines !== false
  const maxPerCategory = options.maxComponentsPerCategory ?? 8
  const maxProps = options.maxPropertiesPerComponent ?? 5

  const lines: string[] = []
  lines.push('=== COMPONENT LIBRARY OVERVIEW ===')
  lines.push(`Total top-level components: ${summary.total}`)
  if (summary.topLevelTypes.length > 0) {
    lines.push(`Use only these types on page content arrays: ${summary.topLevelTypes.join(', ')}`)
  }
  if (summary.subComponentTypes.length > 0) {
    lines.push(`Sub-component types (only inside allowed content fields): ${summary.subComponentTypes.join(', ')}`)
  }

  if (includeGuidelines) {
    lines.push('')
    lines.push('STRICT RULES:')
    lines.push('- Every content[] item MUST include a "type" matching the parent allowedTypes list.')
    lines.push('- When allowedTypes has a single entry, set that value automatically on each child item.')
    lines.push('- Never place sub-component-only types directly on a page or inside disallowed fields.')
    lines.push('- Preserve the order of components exactly as shown in layouts or user instructions.')
    lines.push('- Omit editorial summary fields unless the props metadata explicitly lists them in the contract.')
  }

  for (const categoryEntry of summary.categories) {
    lines.push('')
    lines.push(`Category: ${categoryEntry.name} (${categoryEntry.components.length} types)`)
    const slice = categoryEntry.components.slice(0, maxPerCategory)
    for (const component of slice) {
      const required = formatRequiredProperties(component.properties)
      const description = component.description || (component.keywords.length > 0 ? component.keywords.join(', ') : 'No description provided')
      const contentAreas = formatContentAreas(component.properties)
      lines.push(`- ${component.type}: ${description}`)
      lines.push(`  Required fields: ${required}`)
      if (contentAreas) {
        lines.push(`  Content slots: ${contentAreas}`)
      }
      if (component.properties && component.properties.length > 0) {
        const optionalProps = component.properties
          .filter(prop => !prop.required)
          .slice(0, maxProps)
          .map(prop => prop.name)
        if (optionalProps.length > 0) {
          lines.push(`  Optional fields: ${optionalProps.join(', ')}`)
        }
      }
      // Include directives from component definition (LLM guidance for usage)
      if (component.directives && component.directives.length > 0) {
        for (const directive of component.directives) {
          lines.push(`  ${directive}`)
        }
      }
    }
    if (categoryEntry.components.length > slice.length) {
      lines.push(`  ...and ${categoryEntry.components.length - slice.length} more in this category.`)
    }
  }

  return lines.join(PROMPT_NEWLINE)
}
