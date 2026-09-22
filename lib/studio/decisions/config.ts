/**
 * Decision model configuration.
 *
 * Standalone on purpose. This module must NEVER throw at load and must never
 * import lib/studio/import/config, which evaluates resolveImportModelSelection()
 * at module scope and throws unless IMPORT_MODEL_CHAIN is set. That variable is
 * chat-model configuration — a pipe-separated fallback chain with a quality or
 * cheap mode — and describes nothing about a typed-question endpoint.
 *
 * @module decisions/config
 */

function readString(key: string, fallback: string): string {
  const raw = process.env[key]
  if (!raw) return fallback
  const trimmed = raw.trim()
  return trimmed || fallback
}

/**
 * Accepts the same truthy set as dom-probe-flags, which is the established
 * rollout pattern in this repo, rather than import-config's narrower 1|true.
 */
function readBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === null || raw.trim() === '') return fallback
  const value = raw.trim().toLowerCase()
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false
  return fallback
}

function readList(key: string): string[] {
  const raw = process.env[key]
  if (!raw) return []
  return raw.split(',').map(entry => entry.trim()).filter(Boolean)
}

function readInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export interface DecisionConfigShape {
  enabled: boolean
  shadow: boolean
  modelId: string
  /** Host root. Note: no /v1 — the decisions endpoint sits beside it. */
  baseUrl: string
  apiKey: string | undefined
  websiteAllowlist: string[]
  timeoutMs: number
  /** Directory for the shadow log. Developer evidence, gitignored. */
  logDir: string
}

/** Read fresh each call so tests can change env without resetting modules. */
export function getDecisionConfig(): DecisionConfigShape {
  return {
    enabled: readBool('DECISION_MODEL_ENABLED', false),
    shadow: readBool('DECISION_MODEL_SHADOW', true),
    modelId: readString('DECISION_MODEL_ID', 'typesafe/jev-1.13'),
    baseUrl: readString('DECISION_MODEL_BASE_URL', 'https://openrouter.ai/api'),
    apiKey: process.env.DECISION_MODEL_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || undefined,
    websiteAllowlist: readList('DECISION_MODEL_WEBSITE_ALLOWLIST'),
    timeoutMs: readInt('DECISION_MODEL_TIMEOUT_MS', 15_000),
    logDir: readString('DECISION_MODEL_LOG_DIR', 'reports/decisions')
  }
}

/**
 * Global kill switch plus per-tenant allowlist, the same shape as
 * isDomProbeEnabledForWebsite. An empty allowlist means every website.
 */
export function isDecisionModelEnabledFor(
  websiteId?: string,
  options: { tenantScoped?: boolean } = {}
): boolean {
  const config = getDecisionConfig()
  if (!config.enabled) return false
  if (!config.apiKey) return false
  if (config.websiteAllowlist.length === 0) return true
  // A question asked before any website exists cannot be scoped to one. The
  // allowlist is a rollout control, not a second kill switch, so it does not
  // silently disable such a question.
  if (options.tenantScoped === false) return true
  if (!websiteId) return false
  return config.websiteAllowlist.includes(websiteId)
}
