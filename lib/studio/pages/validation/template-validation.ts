import { z } from 'zod'
import type { PageCatalogTemplateSummary } from '../catalog'
import type {
  PageTemplatePropMeta,
  PageTemplatePropsMeta,
  PageTemplateRegionConfig
} from '../_core/types'
import type {
  ComponentInstance,
  ComponentType
} from '@/lib/studio/import/services/interfaces'

function canonicalizeComponentType(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined
  }
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  const withoutVersion = normalized.replace(/-v\d+$/i, '')
  const collapsed = withoutVersion.replace(/[\s_]+/g, '-')
  const alias = collapsed.replace(/[^a-z0-9-]/g, '')

  switch (alias) {
    case 'nav':
    case 'navbar':
    case 'nav-bar':
    case 'navigation':
    case 'navigationbar':
    case 'navigation-menu':
    case 'navigationmenu':
    case 'menu-bar':
    case 'menubar':
    case 'top-nav':
    case 'topnav':
    case 'site-header':
    case 'siteheader':
    case 'global-header':
    case 'globalheader':
    case 'header':
      return 'navbar'
    case 'quote':
    case 'quoteblock':
    case 'quote-block':
      return 'quote-block'
    case 'site-footer':
    case 'sitefooter':
    case 'global-footer':
    case 'globalfooter':
    case 'footer-menu':
    case 'footermenu':
      return 'footer'
    default:
      return alias
  }
}

export type TemplateValidationSeverity = 'error' | 'warning'

export interface TemplateValidationIssue {
  type: 'props' | 'region'
  code: string
  message: string
  severity: TemplateValidationSeverity
  path?: string[]
  details?: Record<string, unknown>
}

export interface TemplateValidationResult {
  isValid: boolean
  issues: TemplateValidationIssue[]
  props: Record<string, unknown>
}

export class TemplateValidationError extends Error {
  readonly issues: TemplateValidationIssue[]
  readonly templateKey: string
  readonly pageUrl: string

  constructor({
    issues,
    templateKey,
    pageUrl
  }: {
    issues: TemplateValidationIssue[]
    templateKey: string
    pageUrl: string
  }) {
    const issueMessages = issues
      .map(issue => `${issue.code}: ${issue.message}`)
      .join('; ')
    super(`Template validation failed for ${pageUrl} using template "${templateKey}": ${issueMessages}`)
    this.name = 'TemplateValidationError'
    this.issues = issues
    this.templateKey = templateKey
    this.pageUrl = pageUrl
  }
}

interface TemplatePropsValidation {
  schema: z.ZodTypeAny
  issues: TemplateValidationIssue[]
  props: Record<string, unknown>
}

function buildBaseSchema(meta: PageTemplatePropMeta): z.ZodTypeAny {
  const required = meta.required ?? false
  let schema: z.ZodTypeAny

  switch (meta.type) {
    case 'string':
    case 'rich-text':
    case 'markdown':
      schema = z.string().trim()
      break
    case 'boolean':
      schema = z.boolean()
      break
    case 'number':
      schema = z.number()
      break
    case 'enum':
      schema = (meta.allowedValues && meta.allowedValues.length > 0)
        ? z.enum([...new Set(meta.allowedValues)] as [string, ...string[]])
        : z.string()
      break
    case 'image':
      schema = z.string().url().or(z.object({ src: z.string().url(), alt: z.string().optional() }))
      break
    case 'date':
      schema = z.string().refine(value => {
        const time = Date.parse(value)
        return !Number.isNaN(time)
      }, 'Invalid date format')
      break
    case 'content-reference':
      schema = z.string().min(1)
      break
    case 'content-reference[]':
      schema = z.array(z.string().min(1))
      break
    default:
      schema = z.any()
  }

  if (!required) {
    schema = schema.optional()
  }

  if (meta.defaultValue !== undefined) {
    schema = schema.default(meta.defaultValue as any)
  }

  return schema
}

function buildPropsSchema(meta: PageTemplatePropsMeta | undefined): TemplatePropsValidation {
  if (!meta || Object.keys(meta).length === 0) {
    return {
      schema: z.object({}).passthrough(),
      issues: [],
      props: {}
    }
  }

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, propMeta] of Object.entries(meta)) {
    shape[key] = buildBaseSchema(propMeta)
  }

  const schema = z.object(shape).strict()
  return {
    schema,
    issues: [],
    props: {}
  }
}

function flattenComponents(components: ComponentInstance[]): ComponentInstance[] {
  const stack = [...components]
  const flat: ComponentInstance[] = []

  while (stack.length > 0) {
    const current = stack.shift()!
    flat.push(current)
    if (current.children && current.children.length > 0) {
      stack.unshift(...current.children)
    }
  }

  return flat
}

function buildComponentTypeIndex(componentTypes: ComponentType[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const type of componentTypes) {
    const id = (type as any).id
    if (id) {
      const canonical = canonicalizeComponentType(type.type)
      index.set(String(id), canonical ?? type.type)
    }
  }
  return index
}

function resolveComponentType(
  instance: ComponentInstance,
  index: Map<string, string>
): string | undefined {
  if (instance.typeId && index.has(instance.typeId)) {
    return index.get(instance.typeId)
  }
  const canonical = canonicalizeComponentType(instance.type)
  return canonical ?? ((instance.type || undefined) as string | undefined)
}

function validateRegionConfig(
  config: PageTemplateRegionConfig,
  regionInstances: ComponentInstance[],
  allowedSet: Set<string> | undefined,
  issues: TemplateValidationIssue[],
  kind: 'required' | 'optional',
  getComponentType: (instance: ComponentInstance) => string | undefined
): void {
  const matchingInstances = allowedSet
    ? regionInstances.filter(instance => {
        const componentType = getComponentType(instance)
        return componentType !== undefined && allowedSet.has(componentType)
      })
    : regionInstances

  const count = matchingInstances.length
  const min = typeof config.min === 'number' ? config.min : (kind === 'required' ? 1 : 0)
  const max = typeof config.max === 'number' ? config.max : undefined

  if (count < min) {
    issues.push({
      type: 'region',
      code: 'region.min',
      message: `Region "${config.region}" requires at least ${min} component(s); found ${count}.`,
      severity: 'error'
    })
  }

  if (typeof max === 'number' && count > max) {
    issues.push({
      type: 'region',
      code: 'region.max',
      message: `Region "${config.region}" allows at most ${max} component(s); found ${count}.`,
      severity: 'warning'
    })
  }
}


function validateTemplateProps(
  template: PageCatalogTemplateSummary,
  props: Record<string, unknown> | undefined,
  componentIndex: Map<string, string>,
  componentInstances: ComponentInstance[],
  baseIssues: TemplateValidationIssue[]
): { issues: TemplateValidationIssue[]; props: Record<string, unknown> } {
  // Use template.schema directly if available (eliminates circular conversion)
  // Fall back to building from propsMeta for backward compatibility
  let validation: TemplatePropsValidation
  if ((template as any).schema) {
    validation = {
      schema: (template as any).schema,
      issues: [],
      props: {}
    }
  } else {
    validation = buildPropsSchema(template.propsMeta)
  }

  const result = validation.schema.safeParse(props ?? {})
  const issues = [...baseIssues]

  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        type: 'props',
        code: issue.code,
        message: issue.message,
        severity: 'error',
        path: issue.path.map(segment => String(segment))
      })
    }
    return {
      issues,
      props: {}
    }
  }

  const normalized = result.data as Record<string, unknown>

  if (template.propsMeta) {
    for (const [key, meta] of Object.entries(template.propsMeta)) {
      const value = normalized[key]
      if (value == null) {
        continue
      }

      if (meta.type === 'content-reference' || meta.type === 'content-reference[]') {
        const references = Array.isArray(value) ? value as string[] : [value as string]
        const allowedSet = meta.allowedComponentTypes ? new Set(meta.allowedComponentTypes.map(value => canonicalizeComponentType(String(value)) ?? String(value))) : undefined

        for (const ref of references) {
          const target = componentInstances.find(instance => instance.id === ref)
          if (!target) {
            issues.push({
              type: 'props',
              code: 'props.missingReference',
              message: `Template prop "${key}" references unknown component id "${ref}".`,
              severity: 'error'
            })
            continue
          }

          if (allowedSet && allowedSet.size > 0) {
            const componentType = canonicalizeComponentType(resolveComponentType(target, componentIndex))
            if (componentType && !allowedSet.has(componentType)) {
              issues.push({
                type: 'props',
                code: 'props.disallowedReference',
                message: `Template prop "${key}" references component ${ref} (${componentType}) which is not permitted.`,
                severity: 'error'
              })
            }
          }
        }
      }
    }
  }

  return {
    issues,
    props: normalized
  }
}

function validateTemplateRegions(
  template: PageCatalogTemplateSummary,
  componentInstances: ComponentInstance[],
  componentTypes: ComponentType[]
): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = []
  const flatInstances = flattenComponents(componentInstances)
  const componentTypeIndex = buildComponentTypeIndex(componentTypes)
  const regionInstancesMap = new Map<string, ComponentInstance[]>()
  const typeCache = new Map<ComponentInstance, string | undefined>()

  const getComponentType = (instance: ComponentInstance): string | undefined => {
    if (typeCache.has(instance)) {
      return typeCache.get(instance)!
    }
    const resolved = canonicalizeComponentType(resolveComponentType(instance, componentTypeIndex))
    typeCache.set(instance, resolved)
    return resolved
  }

  for (const instance of flatInstances) {
    const region = (instance.props as any)?.region
    if (!region) continue
    if (!regionInstancesMap.has(region)) {
      regionInstancesMap.set(region, [])
    }
    regionInstancesMap.get(region)!.push(instance)
  }

  const regionAllowed = new Map<string, Set<string> | null>()

  const mergeAllowed = (region: string, allowed: Set<string> | undefined): void => {
    if (!regionAllowed.has(region)) {
      regionAllowed.set(region, allowed ? new Set(allowed) : null)
      return
    }
    const current = regionAllowed.get(region)
    if (current === null) {
      return
    }
    if (!allowed) {
      regionAllowed.set(region, null)
      return
    }
    for (const value of allowed) {
      current!.add(value)
    }
  }

  const configs: { config: PageTemplateRegionConfig; kind: 'required' | 'optional' }[] = []
  for (const config of template.requiredRegions) {
    configs.push({ config, kind: 'required' })
    if (!regionInstancesMap.has(config.region)) {
      regionInstancesMap.set(config.region, [])
    }
  }
  if (template.optionalRegions) {
    for (const config of template.optionalRegions) {
      configs.push({ config, kind: 'optional' })
      if (!regionInstancesMap.has(config.region)) {
        regionInstancesMap.set(config.region, [])
      }
    }
  }

  const buildAllowedSet = (config: PageTemplateRegionConfig): Set<string> | undefined => {
    if (!config.allowedComponents || config.allowedComponents.length === 0) {
      return undefined
    }
    const allowed = new Set<string>()
    for (const value of config.allowedComponents) {
      const canonical = canonicalizeComponentType(String(value))
      if (canonical) {
        allowed.add(canonical)
      }
    }
    return allowed
  }

  for (const { config, kind } of configs) {
    const allowedSet = buildAllowedSet(config)
    mergeAllowed(config.region, allowedSet)
    const regionInstances = regionInstancesMap.get(config.region) ?? []
    validateRegionConfig(config, regionInstances, allowedSet, issues, kind, getComponentType)
  }

  for (const [region, instances] of regionInstancesMap.entries()) {
    const allowedSet = regionAllowed.get(region)
    if (allowedSet === undefined || allowedSet === null) {
      continue
    }
    for (const instance of instances) {
      const componentType = getComponentType(instance)
      if (!componentType) {
        issues.push({
          type: 'region',
          code: 'region.unknownType',
          message: `Component ${instance.id} in region "${region}" has unknown type.`,
          severity: 'warning'
        })
        continue
      }
      if (!allowedSet.has(componentType)) {
        issues.push({
          type: 'region',
          code: 'region.disallowedComponent',
          message: `Component ${instance.id} (${componentType}) is not allowed in region "${region}".`,
          severity: 'error'
        })
      }
    }
  }

  return issues
}


export function validatePageTemplate(
  options: {
    template: PageCatalogTemplateSummary
    templateProps?: Record<string, unknown>
    componentTree: ComponentInstance[]
    componentTypes: ComponentType[]
  }
): TemplateValidationResult {
  const { template, templateProps, componentTree, componentTypes } = options
  const baseIssues: TemplateValidationIssue[] = []

  const componentIndex = buildComponentTypeIndex(componentTypes)
  const flatInstances = flattenComponents(componentTree)
  const propsResult = validateTemplateProps(
    template,
    templateProps,
    componentIndex,
    flatInstances,
    baseIssues
  )

  const regionIssues = validateTemplateRegions(template, componentTree, componentTypes)
  const issues = [...propsResult.issues, ...regionIssues]
  const isValid = issues.every(issue => issue.severity !== 'error')

  return {
    isValid,
    issues,
    props: propsResult.props
  }
}
