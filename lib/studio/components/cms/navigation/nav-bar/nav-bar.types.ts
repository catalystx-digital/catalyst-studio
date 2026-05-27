import { CMSComponentProps } from '../../_core/types';
import { type MenuItem, type CTAButton, type Logo } from '@/lib/studio/components/cms/_core/value-objects';

export type { MenuItem, CTAButton, Logo };

// MenuItem and CTAButton now imported from registry
// MenuItemGroup is part of MenuItem schema, so it's automatically available

/**
 * Search suggestion item for autocomplete
 */
export interface SearchSuggestion {
  /** Display text for the suggestion */
  text: string;
  /** Optional category for grouping */
  category?: string;
  /** Optional URL to navigate to when selected */
  url?: string;
}

/**
 * Search configuration for navbar
 */
export interface NavBarSearch {
  /** Whether search is enabled */
  enabled?: boolean;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Action URL for search form submission */
  action?: string;
  /** Enable rich suggestions panel with autocomplete */
  showSuggestions?: boolean;
  /** Static suggestions shown in the panel */
  suggestions?: SearchSuggestion[];
  /** Preset recent searches to display */
  recentSearches?: string[];
  /** Visual style of the search panel */
  panelVariant?: 'dropdown' | 'overlay' | 'fullscreen';
}

export interface NavBarRowStyle {
  /** Source-captured row background color, e.g. #6f8434 or rgb(111, 132, 52). */
  backgroundColor?: string;
  /** Source-captured row foreground/text color. */
  textColor?: string;
  /** Source-captured row separator/border color. */
  borderColor?: string;
}

export interface NavBarItemStyle extends NavBarRowStyle {
  /** Menu item label this style belongs to. */
  label: string;
}

export interface NavBarStyles {
  /** Styles for the logo/utility/CTA row in multi-row headers. */
  utilityRow?: NavBarRowStyle;
  /** Styles for the primary category/audience row in multi-row headers. */
  primaryRow?: NavBarRowStyle;
  /** Source-captured styles for individual primary nav items. */
  primaryItems?: NavBarItemStyle[];
}

/**
 * Navigation bar content configuration
 */
export interface NavBarContent {
  /** Logo configuration for the navbar */
  logo?: Logo;
  /**
   * Utility navigation items displayed in a secondary row above the main nav.
   * Typically contains items like: Home, About, News, Careers, Shop, Contact, Login/Portal links.
   * When present, creates a two-row header layout with utilityNav on top and menuItems below.
   */
  utilityNav?: MenuItem[];
  /** Main navigation menu items (primary category navigation) */
  menuItems: MenuItem[];
  /** Optional call-to-action button */
  cta?: CTAButton;
  /** Optional search configuration - displays compact search in navbar */
  search?: NavBarSearch;
  /** Source-captured row styles for imported navigation layouts. */
  styles?: NavBarStyles;
  /** Breakpoint (in pixels) for mobile menu activation */
  mobileBreakpoint?: number;
  /** Whether navbar sticks to top on scroll */
  sticky?: boolean;
  /** Whether navbar has transparent background initially */
  transparent?: boolean;
  /** Accessible label for the navigation landmark */
  ariaLabel?: string;
  /**
   * Layout mode for the navbar.
   * - 'single-row': All menu items in one row (default)
   * - 'multi-row': Utility nav on top row, main nav on bottom row
   */
  layout?: 'single-row' | 'multi-row';
}

/**
 * Props for the NavBar component
 * @component
 */
export interface NavBarProps extends Omit<CMSComponentProps, 'content'> {
  /** Navigation bar content configuration */
  content: NavBarContent;
}
