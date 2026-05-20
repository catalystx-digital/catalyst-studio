/**
 * Navbar height configuration - Single Source of Truth
 *
 * IMPORTANT: These values define the navbar dimensions used for:
 * - Navbar container height
 * - Spacer height when using fixed positioning
 * - scroll-padding-top calculations
 *
 * Heights differ based on utility nav presence to maintain
 * visual hierarchy and appropriate touch target sizes.
 */

export const NAVBAR_HEIGHT = {
  /** Default height: 64px (h-16) */
  DEFAULT: 'h-16',
  /** Height with utility nav: 56px (h-14) */
  WITH_UTILITY: 'h-14',
  /** Pixel values for CSS/JS calculations */
  DEFAULT_PX: 64,
  WITH_UTILITY_PX: 56,
} as const

/**
 * Get the Tailwind height class for the navbar
 */
export function getNavbarHeightClass(hasUtilityNav: boolean): string {
  return hasUtilityNav ? NAVBAR_HEIGHT.WITH_UTILITY : NAVBAR_HEIGHT.DEFAULT
}

/**
 * Get the navbar height in pixels
 */
export function getNavbarHeightPx(hasUtilityNav: boolean): number {
  return hasUtilityNav ? NAVBAR_HEIGHT.WITH_UTILITY_PX : NAVBAR_HEIGHT.DEFAULT_PX
}
