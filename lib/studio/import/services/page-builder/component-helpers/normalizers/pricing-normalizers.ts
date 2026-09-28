import type { ComponentContentNormalizer } from './shared-normalizer-utils'

const MONTHLY_PERIODS = new Set(['month', 'monthly', 'mo', 'pm', 'a month', 'every month'])
const ANNUAL_PERIODS = new Set([
  'year', 'yearly', 'annual', 'annually', 'yr', 'pa',
  'annum', '12 months', 'a year', 'every year'
])
const ONE_TIME_PERIODS = new Set([
  'once', 'one-off', 'one off', 'one time', 'one-time', 'onetime',
  'single payment', 'lifetime'
])

function normalizePeriod(period: string): string {
  const value = period.toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/^per\s+/, '').replace(/^\//, '').replace(/\./g, '').trim()

  if (MONTHLY_PERIODS.has(value)) return 'monthly'
  if (ANNUAL_PERIODS.has(value)) return 'annual'
  if (ONE_TIME_PERIODS.has(value)) return 'one-time'
  return period
}

/** Normalizes known billing-period wording while leaving unknown values for schema validation. */
export const normalizePricingTableContent: ComponentContentNormalizer = (rawContent) => ({
  content: {
    ...rawContent,
    ...(Array.isArray(rawContent.plans) ? {
      plans: rawContent.plans.map(plan => {
        if (!plan || typeof plan !== 'object' || Array.isArray(plan) || typeof plan.period !== 'string') return plan
        return { ...plan, period: normalizePeriod(plan.period) }
      })
    } : {})
  },
  warnings: []
})
