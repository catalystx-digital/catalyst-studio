const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function parseBooleanFlag(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue
  }
  return TRUE_VALUES.has(value.trim().toLowerCase())
}

function isDomProbeGloballyEnabled(): boolean {
  return parseBooleanFlag(process.env.DOM_PROBE_IMPORT_ENABLED, true)
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
}

function isWebsiteAllowlisted(websiteId: string | undefined): boolean {
  const allowlist = parseCommaSeparatedList(process.env.DOM_PROBE_IMPORT_WEBSITE_ALLOWLIST)
  if (allowlist.length === 0) {
    return true
  }
  if (!websiteId) {
    return false
  }
  return allowlist.includes(websiteId)
}

export function isDomProbeEnabledForWebsite(websiteId?: string): boolean {
  if (!isDomProbeGloballyEnabled()) {
    return false
  }
  return isWebsiteAllowlisted(websiteId)
}

export function shouldRunDomProbeEvaluation(): boolean {
  return parseBooleanFlag(process.env.DOM_PROBE_IMPORT_EVALUATION, true)
}

export function getDomProbeBaselineKey(): string | undefined {
  const key = process.env.DOM_PROBE_IMPORT_BASELINE
  return key && key.trim().length > 0 ? key.trim().toLowerCase() : undefined
}
