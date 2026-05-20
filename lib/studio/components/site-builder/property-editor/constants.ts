/**
 * Constants for Property Editor Panel
 */

// Panel dimensions
export const PANEL_DIMENSIONS = {
  MIN_WIDTH: 320,
  MAX_WIDTH: 480,
  DEFAULT_WIDTH: 400,
} as const

// Animation timings (in milliseconds)
export const ANIMATION_TIMING = {
  PANEL_SLIDE: 200,
  DEBOUNCE_DELAY: 300,
} as const

// Validation limits
export const VALIDATION_LIMITS = {
  TITLE_MAX_LENGTH: 100,
  SUBTITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 300,
  COPYRIGHT_MAX_LENGTH: 200,
  URL_MAX_LENGTH: 200,
  KEYWORDS_MAX_LENGTH: 200,
  GENERIC_TEXT_MAX_LENGTH: 500,
  LONG_TEXT_MAX_LENGTH: 5000,
} as const

// Color constants
export const COLOR_STYLES = {
  ERROR_TEXT: 'text-red-600 dark:text-red-400',
  WARNING_TEXT: 'text-amber-600 dark:text-amber-400',
  ERROR_BORDER: 'border-red-500',
} as const