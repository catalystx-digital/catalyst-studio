import type { DetectedComponent } from './types'

type EvidenceNode = {
  text?: unknown
  label?: unknown
  name?: unknown
  value?: unknown
  alt?: unknown
  title?: unknown
  bgColor?: unknown
  children?: unknown
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLowerCase() : ''
}

function nodeText(node: EvidenceNode): string {
  return [
    node.text,
    node.label,
    node.name,
    node.value,
    node.alt,
    node.title
  ].map(normalizeText).filter(Boolean).join(' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const color = value.trim()
  if (!color || /[;{}]/.test(color)) {
    return false
  }
  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*[\d.\s,%]+\)$/i.test(color) ||
    /^hsla?\(\s*[\d.\s,%degturnrad]+\)$/i.test(color) ||
    /^var\(--[a-z0-9-_]+\)$/i.test(color)
  )
}

function collectLabelColorEvidence(
  nodes: unknown[],
  labels: string[],
  inheritedColor: string | undefined,
  colorMatches: Map<string, Set<string>>
): void {
  for (const value of nodes) {
    if (!isRecord(value)) {
      continue
    }

    const node = value as EvidenceNode
    const ownColor = isSafeCssColor(node.bgColor) ? node.bgColor.trim() : undefined
    const effectiveColor = ownColor ?? inheritedColor
    const text = nodeText(node)
    if (effectiveColor && text) {
      const matchedLabels = labels.filter(label => text.includes(label))
      if (matchedLabels.length > 0) {
        const existing = colorMatches.get(effectiveColor) ?? new Set<string>()
        matchedLabels.forEach(label => existing.add(label))
        colorMatches.set(effectiveColor, existing)
      }
    }

    if (Array.isArray(node.children)) {
      collectLabelColorEvidence(node.children, labels, effectiveColor, colorMatches)
    }
  }
}

function selectDominantColor(colorMatches: Map<string, Set<string>>, labelCount: number): string | undefined {
  const requiredMatches = Math.min(2, labelCount)
  let selected: { color: string; count: number } | undefined

  for (const [color, labels] of colorMatches.entries()) {
    const count = labels.size
    if (count < requiredMatches) {
      continue
    }
    if (!selected || count > selected.count) {
      selected = { color, count }
    } else if (selected.count === count) {
      selected = undefined
    }
  }

  return selected?.color
}

function getMenuLabels(component: DetectedComponent, field: 'menuItems' | 'utilityNav'): string[] {
  const items = component.content?.[field]
  if (!Array.isArray(items)) {
    return []
  }

  return Array.from(new Set(
    items
      .map(item => isRecord(item) ? normalizeText(item.label) : '')
      .filter(label => label.length > 0)
  ))
}

function resolveDominantRowColor(evidenceNodes: unknown[], labels: string[]): string | undefined {
  if (labels.length === 0) {
    return undefined
  }

  const colorMatches = new Map<string, Set<string>>()
  collectLabelColorEvidence(evidenceNodes, labels, undefined, colorMatches)
  return selectDominantColor(colorMatches, labels.length)
}

function collectFlatItemColors(evidenceNodes: unknown[], labels: string[]): Map<string, string> {
  const itemColors = new Map<string, string>()
  let recentColor: string | undefined
  let recentColorTag: string | undefined
  let skipMobileList = false

  for (const value of evidenceNodes) {
    if (!isRecord(value)) {
      continue
    }
    const node = value as EvidenceNode & { class?: unknown; tag?: unknown }
    const tag = normalizeText(node.tag)
    const className = normalizeText(node.class)
    if (tag === 'ul') {
      skipMobileList = /\bvisible-xs\b/.test(className)
    }
    if (isSafeCssColor(node.bgColor)) {
      recentColor = node.bgColor.trim()
      recentColorTag = tag
    }
    if (skipMobileList) {
      continue
    }
    const text = nodeText(node)
    if (!text || !recentColor || recentColorTag !== 'li') {
      continue
    }
    for (const label of labels) {
      if (text.includes(label) && !itemColors.has(label)) {
        itemColors.set(label, recentColor)
      }
    }
  }

  return itemColors
}

function subtreeText(node: EvidenceNode): string {
  const parts = [nodeText(node)]
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isRecord(child)) {
        parts.push(subtreeText(child as EvidenceNode))
      }
    }
  }
  return parts.filter(Boolean).join(' ')
}

function collectNestedItemColors(
  evidenceNodes: unknown[],
  labels: string[],
  itemColors: Map<string, string>,
  inMobileList = false
): void {
  for (const value of evidenceNodes) {
    if (!isRecord(value)) {
      continue
    }
    const node = value as EvidenceNode & { class?: unknown; tag?: unknown }
    const tag = normalizeText(node.tag)
    const className = normalizeText(node.class)
    const nextInMobileList = inMobileList || (tag === 'ul' && /\bvisible-xs\b/.test(className))
    const color = isSafeCssColor(node.bgColor) ? node.bgColor.trim() : undefined

    if (!nextInMobileList && tag === 'li' && color) {
      const text = subtreeText(node)
      for (const label of labels) {
        if (text.includes(label) && !itemColors.has(label)) {
          itemColors.set(label, color)
        }
      }
    }

    if (Array.isArray(node.children)) {
      collectNestedItemColors(node.children, labels, itemColors, nextInMobileList)
    }
  }
}

function collectPrimaryItemColors(evidenceNodes: unknown[], labels: string[]): Map<string, string> {
  const itemColors = collectFlatItemColors(evidenceNodes, labels)
  collectNestedItemColors(evidenceNodes, labels, itemColors)
  return itemColors
}

function mergePrimaryItemStyles(existingStyles: unknown, itemColors: Map<string, string>): Array<Record<string, string>> {
  const evidenceLabels = new Set(itemColors.keys())
  const preserved = isRecord(existingStyles) && Array.isArray(existingStyles.primaryItems)
    ? existingStyles.primaryItems.filter((item): item is Record<string, string> => {
        if (!isRecord(item) || typeof item.label !== 'string') {
          return false
        }
        return !evidenceLabels.has(normalizeText(item.label))
      })
    : []

  return [
    ...preserved,
    ...Array.from(itemColors.entries()).map(([label, backgroundColor]) => ({
      label,
      backgroundColor
    }))
  ]
}

export function enrichNavbarRowStylesFromEvidence(
  components: DetectedComponent[],
  evidenceNodes: unknown[] | undefined
): void {
  if (!Array.isArray(evidenceNodes) || evidenceNodes.length === 0) {
    return
  }

  for (const component of components) {
    if (component.type !== 'navbar' || component.component !== 'navbar') {
      continue
    }
    if (component.content?.layout !== 'multi-row') {
      continue
    }
    const primaryBackgroundColor = resolveDominantRowColor(evidenceNodes, getMenuLabels(component, 'menuItems'))
    const primaryLabels = getMenuLabels(component, 'menuItems')
    const primaryItemColors = collectPrimaryItemColors(evidenceNodes, primaryLabels)
    const utilityBackgroundColor = resolveDominantRowColor(evidenceNodes, getMenuLabels(component, 'utilityNav'))
    if (!primaryBackgroundColor && primaryItemColors.size === 0 && !utilityBackgroundColor) {
      continue
    }

    component.content.styles = {
      ...(isRecord(component.content.styles) ? component.content.styles : {}),
      ...(utilityBackgroundColor
        ? {
            utilityRow: {
              ...(isRecord(component.content.styles?.utilityRow) ? component.content.styles.utilityRow : {}),
              backgroundColor: utilityBackgroundColor
            }
          }
        : {}),
      ...(primaryBackgroundColor
        ? {
            primaryRow: {
              ...(isRecord(component.content.styles?.primaryRow) ? component.content.styles.primaryRow : {}),
              backgroundColor: primaryBackgroundColor
            }
          }
        : {}),
      ...(primaryItemColors.size > 0
        ? {
            primaryItems: mergePrimaryItemStyles(component.content.styles, primaryItemColors)
          }
        : {})
    }
  }
}
