/**
 * shadcn/ui Default Theme
 *
 * Source: https://ui.shadcn.com/themes (default theme)
 *
 * These values are used during IMPORT when we can't extract
 * a color from the source website. No mapping/translation needed.
 *
 * All values are HSL format without the hsl() wrapper, ready for CSS variables.
 * Example: '--primary': '240 5.9% 10%' → used as `hsl(var(--primary))`
 */

export const SHADCN_DEFAULTS = {
  // Core semantic colors
  '--background': '0 0% 100%',
  '--foreground': '240 10% 3.9%',
  '--card': '0 0% 100%',
  '--card-foreground': '240 10% 3.9%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '240 10% 3.9%',
  '--primary': '240 5.9% 10%',
  '--primary-foreground': '0 0% 98%',
  '--secondary': '240 4.8% 95.9%',
  '--secondary-foreground': '240 5.9% 10%',
  '--muted': '240 4.8% 95.9%',
  '--muted-foreground': '240 3.8% 46.1%',
  '--accent': '240 4.8% 95.9%',
  '--accent-foreground': '240 5.9% 10%',
  '--destructive': '0 84.2% 60.2%',
  '--destructive-foreground': '0 0% 98%',
  '--border': '240 5.9% 90%',
  '--input': '240 5.9% 90%',
  '--ring': '240 5.9% 10%',
  '--radius': '0.5rem',

  // Chart colors (shadcn defaults)
  '--chart-1': '12 76% 61%',
  '--chart-2': '173 58% 39%',
  '--chart-3': '197 37% 24%',
  '--chart-4': '43 74% 66%',
  '--chart-5': '27 87% 67%',
} as const

export const SHADCN_DEFAULTS_DARK = {
  '--background': '240 10% 3.9%',
  '--foreground': '0 0% 98%',
  '--card': '240 10% 3.9%',
  '--card-foreground': '0 0% 98%',
  '--popover': '240 10% 3.9%',
  '--popover-foreground': '0 0% 98%',
  '--primary': '0 0% 98%',
  '--primary-foreground': '240 5.9% 10%',
  '--secondary': '240 3.7% 15.9%',
  '--secondary-foreground': '0 0% 98%',
  '--muted': '240 3.7% 15.9%',
  '--muted-foreground': '240 5% 64.9%',
  '--accent': '240 3.7% 15.9%',
  '--accent-foreground': '0 0% 98%',
  '--destructive': '0 62.8% 30.6%',
  '--destructive-foreground': '0 0% 98%',
  '--border': '240 3.7% 15.9%',
  '--input': '240 3.7% 15.9%',
  '--ring': '240 4.9% 83.9%',

  // Chart colors (shadcn dark defaults)
  '--chart-1': '220 70% 50%',
  '--chart-2': '160 60% 45%',
  '--chart-3': '30 80% 55%',
  '--chart-4': '280 65% 60%',
  '--chart-5': '340 75% 55%',
} as const

/**
 * All shadcn CSS variable names (used for validation/iteration)
 */
export const SHADCN_VARIABLE_NAMES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--radius',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const

export type ShadcnVariableName = (typeof SHADCN_VARIABLE_NAMES)[number]
export type ShadcnVariables = Record<ShadcnVariableName, string>

/**
 * Get complete shadcn variables with defaults for any missing values
 */
export function getShadcnVariablesWithDefaults(
  extracted: Partial<Record<string, string>>,
  mode: 'light' | 'dark' = 'light'
): Record<string, string> {
  const defaults: Record<string, string> = mode === 'dark'
    ? { ...SHADCN_DEFAULTS_DARK }
    : { ...SHADCN_DEFAULTS }
  const result: Record<string, string> = {}

  for (const key of SHADCN_VARIABLE_NAMES) {
    result[key] = extracted[key] ?? defaults[key]
  }

  return result
}

/**
 * Generate CSS string from shadcn variables
 */
export function generateShadcnCss(
  variables: Record<string, string>,
  indent: string = '  '
): string {
  return Object.entries(variables)
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join('\n')
}
