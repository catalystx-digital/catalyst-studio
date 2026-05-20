import { z } from 'zod'
import { ComponentCategory, ComponentType, CMSComponentProps } from '../../_core/types'
import { getCategoryFromType } from '../../_core/utils'
import { MenuItem } from '../nav-bar/nav-bar.types'
import type { NavMenuItemContent } from '../nav-menu-item/nav-menu-item.types'

const DEFAULT_HREF = '#'
const VALID_ALIGNS = new Set(['start', 'center', 'end'])

// Validation schemas for input data normalization
const UnknownRecordSchema = z.record(z.unknown())

const CMSComponentSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  category: z.nativeEnum(ComponentCategory).optional(),
  content: z.unknown().optional(),
})

const RawMenuItemInputSchema = z.union([
  z.string(), // Simple string labels
  CMSComponentSchema, // CMS component
  UnknownRecordSchema, // Plain object with menu data
])

function isCMSComponent(value: unknown): value is CMSComponentProps {
  const result = CMSComponentSchema.safeParse(value)
  return result.success && 'type' in result.data
}

function parseOffset(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return undefined
}

function parseWidth(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return undefined
}

function parseAlign(value: unknown): 'start' | 'center' | 'end' | undefined {
  if (typeof value === 'string' && VALID_ALIGNS.has(value)) {
    return value as 'start' | 'center' | 'end'
  }
  return undefined
}

function coerceContent(value: unknown): NavMenuItemContent {
  const parseResult = UnknownRecordSchema.safeParse(value)
  const content = parseResult.success ? parseResult.data : {}

  return {
    label: typeof content.label === 'string' ? content.label : '',
    href: typeof content.href === 'string' ? content.href : typeof content.url === 'string' ? content.url : undefined,
    external: typeof content.external === 'boolean' ? content.external : undefined,
    icon: typeof content.icon === 'string' ? content.icon : undefined,
    children: Array.isArray(content.children) ? (content.children as unknown[]).filter(isCMSComponent) : undefined,
    panelOffset: parseOffset(content.panelOffset),
    panelWidth: parseWidth(content.panelWidth),
    panelAlign: parseAlign(content.panelAlign)
  }
}

function normalizeSingleMenuItem(source: unknown): MenuItem | null {
  // Validate input at entry point
  const validationResult = RawMenuItemInputSchema.safeParse(source)
  if (!validationResult.success) {
    return null
  }

  const validSource = validationResult.data

  // Handle string input
  if (typeof validSource === 'string') {
    const trimmed = validSource.trim()
    return trimmed ? { label: trimmed, href: DEFAULT_HREF } : null
  }

  // Handle CMS component
  if (isCMSComponent(validSource) && validSource.type === ComponentType.NavMenuItem) {
    const contentData = coerceContent(validSource.content)
    const rootData = coerceContent(validSource)

    const label = (contentData.label || rootData.label || '').trim()
    if (!label) return null

    const href = contentData.href || rootData.href
    const external = contentData.external ?? rootData.external
    const icon = contentData.icon || rootData.icon
    const rawChildren = contentData.children || rootData.children
    const children = normalizeMenuItems(rawChildren)
    const panelOffset = contentData.panelOffset ?? rootData.panelOffset
    const panelWidth = contentData.panelWidth ?? rootData.panelWidth
    const panelAlign = contentData.panelAlign || rootData.panelAlign

    return {
      label,
      href: href || DEFAULT_HREF,
      external,
      icon,
      children,
      ...(panelOffset !== undefined ? { panelOffset } : {}),
      ...(panelWidth !== undefined ? { panelWidth } : {}),
      ...(panelAlign ? { panelAlign } : {})
    }
  }

  // Handle plain object
  const obj = validSource
  const nestedResult = UnknownRecordSchema.safeParse(obj.content)
  const nested = nestedResult.success ? nestedResult.data : {}

  const labelCandidate =
    typeof obj.label === 'string' ? obj.label :
    typeof obj.text === 'string' ? obj.text :
    typeof nested.label === 'string' ? nested.label :
    typeof nested.text === 'string' ? nested.text :
    undefined

  const label = labelCandidate?.trim() || ''
  if (!label) return null

  const href = typeof obj.href === 'string' ? obj.href :
    typeof obj.url === 'string' ? obj.url :
    typeof nested.href === 'string' ? nested.href :
    typeof nested.url === 'string' ? nested.url :
    DEFAULT_HREF

  const external = typeof obj.external === 'boolean' ? obj.external : undefined
  const icon = typeof obj.icon === 'string' ? obj.icon : undefined

  const rawChildren = Array.isArray(obj.children) ? obj.children :
    Array.isArray(obj.menuItems) ? obj.menuItems : undefined

  const children = normalizeMenuItems(rawChildren)
  const panelOffset = parseOffset(obj.panelOffset)
  const panelWidth = parseWidth(obj.panelWidth)
  const panelAlign = parseAlign(obj.panelAlign)

  return {
    label,
    href,
    external,
    icon,
    children,
    ...(panelOffset !== undefined ? { panelOffset } : {}),
    ...(panelWidth !== undefined ? { panelWidth } : {}),
    ...(panelAlign ? { panelAlign } : {})
  }
}

export function normalizeMenuItems(input: unknown): MenuItem[] {
  const values = Array.isArray(input) ? input : []
  const transformed: MenuItem[] = []
  values.forEach((value) => {
    const item = normalizeSingleMenuItem(value)
    if (item) {
      if (item.children && item.children.length === 0) {
        delete item.children
      }
      transformed.push(item)
    }
  })
  return transformed
}

function buildComponentFromLegacy(value: unknown, index: number, type: string): CMSComponentProps | null {
  // Validate input
  const validationResult = RawMenuItemInputSchema.safeParse(value)
  if (!validationResult.success) {
    return null
  }

  const validValue = validationResult.data

  // Handle string input
  if (typeof validValue === 'string') {
    const label = validValue.trim()
    if (!label) return null

    return {
      id: `legacy-${type}-${index}`,
      type: type as ComponentType,
      category: getCategoryFromType(type as ComponentType) ?? ComponentCategory.Navigation,
      content: { label, href: DEFAULT_HREF }
    }
  }

  // Extract source component if available
  const sourceComponent = isCMSComponent(validValue) ? validValue : null

  // Parse content object if exists
  const contentParseResult = UnknownRecordSchema.safeParse(sourceComponent?.content)
  const contentObj = contentParseResult.success ? contentParseResult.data : {}

  // Parse raw object
  const rawParseResult = UnknownRecordSchema.safeParse(validValue)
  const raw = rawParseResult.success ? rawParseResult.data : {}

  // Extract label from various possible locations
  const labelCandidate =
    typeof raw.label === 'string' ? raw.label :
    typeof raw.text === 'string' ? raw.text :
    typeof contentObj.label === 'string' ? contentObj.label :
    undefined

  const label = labelCandidate?.trim() || ''
  if (!label) return null

  // Extract href
  const href =
    typeof raw.href === 'string' ? raw.href :
    typeof raw.url === 'string' ? raw.url :
    typeof contentObj.href === 'string' ? contentObj.href :
    typeof contentObj.url === 'string' ? contentObj.url :
    DEFAULT_HREF

  // Extract other properties
  const external =
    typeof raw.external === 'boolean' ? raw.external :
    typeof contentObj.external === 'boolean' ? contentObj.external :
    undefined

  const icon =
    typeof raw.icon === 'string' ? raw.icon :
    typeof contentObj.icon === 'string' ? contentObj.icon :
    undefined

  // Extract children
  const childrenRaw =
    Array.isArray(raw.children) ? raw.children :
    Array.isArray(raw.menuItems) ? raw.menuItems :
    Array.isArray(contentObj.children) ? contentObj.children :
    undefined

  const children = ensureSubcomponentArray(childrenRaw, [type])

  // Extract panel configuration
  const panelOffset = parseOffset(raw.panelOffset) ?? parseOffset(contentObj.panelOffset)
  const panelWidth = parseWidth(raw.panelWidth) ?? parseWidth(contentObj.panelWidth)
  const panelAlign = parseAlign(raw.panelAlign) ?? parseAlign(contentObj.panelAlign)

  const normalizedContent: Record<string, unknown> = {
    label,
    href,
    ...(external !== undefined ? { external } : {}),
    ...(icon ? { icon } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...(panelOffset !== undefined ? { panelOffset } : {}),
    ...(panelWidth !== undefined ? { panelWidth } : {}),
    ...(panelAlign ? { panelAlign } : {})
  }

  // Extract ID
  const idParseResult = UnknownRecordSchema.safeParse(validValue)
  const valueAsRecord = idParseResult.success ? idParseResult.data : {}
  const id = sourceComponent?.id ??
    (typeof valueAsRecord.id === 'string' ? valueAsRecord.id : `legacy-${type}-${index}`)

  const categoryGuess = sourceComponent?.category ?? getCategoryFromType(type as ComponentType) ?? ComponentCategory.Navigation

  return {
    id,
    type: type as ComponentType,
    category: categoryGuess,
    content: normalizedContent
  }
}

export function ensureSubcomponentArray(value: unknown, allowedTypes: string[]): CMSComponentProps[] {
  const items = Array.isArray(value) ? value : []

  // Fast path: all items are already valid CMS components
  if (items.every(item => isCMSComponent(item))) {
    const typedItems = items.filter(isCMSComponent)
    if (allowedTypes.length === 0 || typedItems.every(item => allowedTypes.includes(item.type))) {
      return typedItems
    }
  }

  // Conversion path: normalize each item
  const targetType = allowedTypes[0]
  const converted: CMSComponentProps[] = []

  items.forEach((item, index) => {
    // If it's already a valid CMS component with correct type, keep it
    if (isCMSComponent(item)) {
      if (allowedTypes.length === 0 || allowedTypes.includes(item.type)) {
        converted.push(item)
        return
      }
    }

    // Otherwise, try to build from legacy format
    if (!targetType) return

    const built = buildComponentFromLegacy(item, index, targetType)
    if (built) {
      converted.push(built)
    }
  })

  return converted
}
