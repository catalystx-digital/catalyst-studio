/**
 * About Component Normalizers
 *
 * Normalizers for about/team display components.
 *
 * @module about-normalizers
 */

import {
  expandSourceRecord,
  extractLinkUrl,
  isRecord,
  normalizeImage,
  normalizeString,
  pruneObjectAgainstContract,
  type ComponentContentNormalizer,
  type LocalNormalizationWarning
} from './shared-normalizer-utils'

const TEAM_GRID_COLUMN_VALUES: Record<string, Set<number>> = {
  mobile: new Set([1, 2]),
  tablet: new Set([2, 3]),
  desktop: new Set([3, 4, 5]),
  large: new Set([4, 5, 6])
}

function coerceTeamGridColumnValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const parsed = Number(trimmed)
  if (Number.isInteger(parsed) && TEAM_GRID_COLUMN_VALUES[key]?.has(parsed)) {
    return parsed
  }

  return value
}

function normalizeTeamGridColumns(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }

  const normalized: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of Object.keys(TEAM_GRID_COLUMN_VALUES)) {
    if (key in normalized) {
      normalized[key] = coerceTeamGridColumnValue(key, normalized[key])
    }
  }

  return normalized
}

function slugFromName(name: string): string {
  return name
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'member'
}

function normalizeSocialUrl(value: unknown): string | undefined {
  const url = extractLinkUrl(value)
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}

function normalizeTeamMember(
  value: unknown,
  index: number,
  warnings: LocalNormalizationWarning[]
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped team member at index ${index} because payload is not an object.`,
      field: 'members',
      childType: 'team-member',
      details: { index, valueType: typeof value }
    })
    return undefined
  }

  const flattened = expandSourceRecord(value, {
    canonicalType: 'team-member',
    parentCanonicalType: 'team-grid',
    field: 'members',
    index
  })
  const name = normalizeString(flattened.name ?? flattened.fullName ?? flattened.titleText ?? flattened.heading)
  if (!name) {
    warnings.push({
      issue: 'missing-required-field',
      message: `Dropped team member at index ${index} because name is missing.`,
      field: 'members',
      childType: 'team-member',
      details: { index }
    })
    return undefined
  }

  const photo = normalizeImage(flattened.photo ?? flattened.image ?? flattened.avatar ?? flattened.headshot, name)
  const member: Record<string, any> = {
    id: normalizeString(flattened.id) ?? `team-member-${slugFromName(name)}`,
    name
  }

  const title = normalizeString(flattened.title ?? flattened.jobTitle ?? flattened.role ?? flattened.position)
  const department = normalizeString(flattened.department ?? flattened.team ?? flattened.group)
  const bio = normalizeString(flattened.bio ?? flattened.biography ?? flattened.description ?? flattened.summary)
  const email = normalizeString(flattened.email)
  const phone = normalizeString(flattened.phone)
  const linkedin = normalizeSocialUrl(flattened.linkedin ?? flattened.linkedIn)
  const twitter = normalizeSocialUrl(flattened.twitter ?? flattened.x)
  const profileUrl = extractLinkUrl(flattened.profileUrl ?? flattened.url ?? flattened.href ?? flattened.link)

  if (title) member.title = title
  if (department) member.department = department
  if (bio) member.bio = bio
  if (photo?.src) {
    member.photo = photo.src
    member.photoAlt = photo.alt ?? name
  } else if (normalizeString(flattened.photoAlt ?? flattened.alt)) {
    member.photoAlt = normalizeString(flattened.photoAlt ?? flattened.alt)
  }
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) member.email = email
  if (phone) member.phone = phone
  if (linkedin) member.linkedin = linkedin
  if (twitter) member.twitter = twitter
  if (profileUrl) member.profileUrl = profileUrl

  return member
}

/**
 * Normalizes team-grid component content.
 * Coerces schema-valid responsive column strings emitted by models while
 * preserving strict validation for out-of-range or non-numeric values.
 */
export const normalizeTeamGridContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'team-grid',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const membersSource = flattened.members ?? flattened.manualMembers ?? flattened.team ?? flattened.staff ?? flattened.people ?? flattened.items ?? flattened.cards
  if (Array.isArray(membersSource)) {
    normalized.members = membersSource
      .map((member, index) => normalizeTeamMember(member, index, warnings))
      .filter((member): member is Record<string, any> => Boolean(member))
    delete normalized.manualMembers
  }

  if ('columns' in normalized) {
    normalized.columns = normalizeTeamGridColumns(normalized.columns)
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'team-grid', {
    childType: 'team-grid'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}
