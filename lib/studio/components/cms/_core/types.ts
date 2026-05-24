import { z } from 'zod';

// ============================================================================
// Core Enums
// ============================================================================

export enum ComponentCategory {
  Navigation = 'navigation',
  Heroes = 'heroes',
  Content = 'content',
  Features = 'features',
  CTA = 'cta',
  SocialProof = 'social-proof',
  Contact = 'contact',
  About = 'about',
  Blog = 'blog',
  Pricing = 'pricing',
  Data = 'data'
}

export enum ComponentType {
  // Navigation
  NavBar = 'navbar',
  NavMenuItem = 'nav-menu-item',
  Footer = 'footer',
  MobileMenu = 'mobile-menu',
  Breadcrumbs = 'breadcrumbs',
  ColumnItem = 'columnItem',
  SocialLinkItem = 'socialLinkItem',
  SideMenu = 'sidemenu',
  SidebarNav = 'sidebar-nav',
  Breadcrumb = 'breadcrumb',
  MegaMenu = 'megamenu',

  // Heroes
  HeroSimple = 'hero-simple',
  HeroWithImage = 'hero-with-image',
  HeroVideo = 'hero-video',
  HeroCarousel = 'hero-carousel',
  HeroBanner = 'hero-banner',
  HeroSplit = 'hero-split',
  HeroMinimal = 'hero-minimal',

  // Content
  TextBlock = 'text-block',
  TwoColumn = 'two-column',
  ImageGallery = 'image-gallery',
  VideoPlayer = 'video-player',
  VideoEmbed = 'video-embed',
  Accordion = 'accordion',
  AccordionItem = 'accordion-item',
  Tabs = 'tabs',
  TabItem = 'tab-item',
  CardGrid = 'card-grid',
  ContentFeed = 'content-feed',
  HtmlBlock = 'html-block',
  // Sub-components (CMS model)
  CardItem = 'card-item',
  PromoItem = 'promo-item',
  QuoteBlock = 'quote-block',

  // Features
  FeatureGrid = 'feature-grid',
  FeatureList = 'feature-list',
  FeatureShowcase = 'feature-showcase',
  FeatureItem = 'feature-item',
  ShowcaseSection = 'showcase-section',
  FeatureComparison = 'feature-comparison',

  // CTA
  CTASimple = 'cta-simple',
  CTAWithForm = 'cta-with-form',
  CTABanner = 'cta-banner',
  CTAButtonGroup = 'cta-button-group',

  // Social Proof
  Testimonials = 'testimonials',
  TestimonialItem = 'testimonial-item',
  LogoCloud = 'logo-cloud',
  Reviews = 'reviews',
  CaseStudy = 'case-study',

  // Contact
  ContactForm = 'contact-form',
  ContactInfo = 'contact-info',
  LocationMap = 'location-map',
  SimpleForm = 'simple-form',

  // About
  TeamGrid = 'team-grid',
  TeamMember = 'team-member',
  AboutSection = 'about-section',
  Timeline = 'timeline',
  TimelineEvent = 'timeline-event',
  TimelineAction = 'timeline-action',
  Mission = 'mission',

  // Blog
  BlogPost = 'blog-post',
  BlogList = 'blog-list',
  BlogCard = 'blog-card',
  ArticleHeader = 'article-header',
  AuthorBio = 'author-bio',
  RelatedPosts = 'related-posts',

  // Pricing
  PricingTable = 'pricing-table',
  PricingCard = 'pricing-card',
  PricingComparison = 'pricing-comparison',

  // Data
  DataTable = 'data-table',
  Chart = 'chart',
  Statistics = 'statistics'
}

// ============================================================================
// Core Types
// ============================================================================

export type ComponentTheme = 'light' | 'dark' | 'auto' | 'inverted';
export type PageLocation = 'header' | 'hero' | 'main' | 'sidebar' | 'footer';
export type ComponentPriority = 'critical' | 'high' | 'normal' | 'low' | 'lazy';

export interface SectionBackground {
  /** Background color preset: 'default' | 'muted' | 'primary' | 'accent' */
  color?: 'default' | 'muted' | 'primary' | 'accent';
  /** Direct CSS color value (hex, rgb, hsl) - overrides color preset */
  customColor?: string;
}

export interface ComponentContent {
  // Text content
  heading?: string;
  subheading?: string;
  body?: string;
  title?: string;        // Used by accordion items, cards, etc.
  content?: string;      // Used by accordion items, rich text blocks
  description?: string;  // Used by cards, features, etc.

  // Media
  image?: string | Record<string, unknown>;
  images?: string[] | Array<Record<string, unknown>>;
  icon?: string;         // Used by accordion items, features, etc.

  // Links
  link?: string;
  links?: Array<{ label: string; url: string }>;

  // State
  defaultOpen?: boolean; // Used by accordion items

  // Visual styling
  /** Section background configuration for visual rhythm */
  background?: SectionBackground;
}

// ============================================================================
// AI Metadata Interface
// ============================================================================

export interface AIComponentMetadata {
  keywords: string[];
  patterns: string[];
  commonNames: string[];
  pageLocation: PageLocation[];
  confidence: number;
  relatedComponents?: ComponentType[];
  industry?: string[];
  semanticRole?: string;
  region?: string;
  suggestedVariants?: string[];
  accessibility?: {
    ariaLabel?: string;
    ariaDescribedBy?: string;
    role?: string;
  };
  // Optional: brief description of the component for LLM context
  description?: string;
  // Optional: runtime-friendly properties description for LLMs and tooling
  properties?: Array<{
    name: string;
    type: string; // e.g., 'string', 'number', 'boolean', 'string[]', 'CTAButton[]'
    required?: boolean;
    description?: string;
    allowedTypes?: string[];
  }>;
}

// ============================================================================
// Main Component Props Interface
// ============================================================================

export interface CMSComponentProps {
  // Required
  id: string;
  type: ComponentType;
  category: ComponentCategory;
  content: ComponentContent;

  // Optional Styling
  className?: string;
  style?: React.CSSProperties;
  theme?: ComponentTheme;
  variant?: string;

  // Optional Behavior
  loading?: 'eager' | 'lazy';
  priority?: ComponentPriority;
  interactive?: boolean;

  // Optional Metadata
  aiMetadata?: AIComponentMetadata;
  analytics?: {
    trackingId?: string;
    events?: string[];
  };

  // Optional Callbacks
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (event: string, data?: any) => void;
}

// ============================================================================
// Component Registry Types
// ============================================================================

export type ComponentConstructor = React.ComponentType<CMSComponentProps>;

export interface ComponentRegistryEntry {
  component: ComponentConstructor;
  metadata: AIComponentMetadata;
  preload?: boolean;
  dependencies?: ComponentType[];
  // Mark CMS-only types that must never appear at page top-level
  subOnly?: boolean;
  // Optional: human-readable description of the component
  description?: string;
  // Zod schema for component props (single source of truth)
  schema: z.ZodObject<any>;
}

export interface ComponentRegistryMap {
  [key: string]: ComponentRegistryEntry;
}

// ============================================================================
// Performance Metrics
// ============================================================================

export interface ComponentPerformanceMetrics {
  componentId: string;
  componentType: ComponentType;
  renderTime: number;
  mountTime: number;
  updateCount: number;
  bundleSize?: number;
  memoryUsage?: number;
  timestamp: number;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const ComponentContentSchema = z.object({
  heading: z.string().optional(),
  subheading: z.string().optional(),
  body: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  link: z.string().optional(),
  links: z.array(z.object({
    label: z.string(),
    url: z.string()
  })).optional()
});

export const AIComponentMetadataSchema = z.object({
  keywords: z.array(z.string()),
  patterns: z.array(z.string()),
  commonNames: z.array(z.string()),
  pageLocation: z.array(z.enum(['header', 'hero', 'main', 'sidebar', 'footer'])),
  confidence: z.number().min(0).max(1),
  relatedComponents: z.array(z.nativeEnum(ComponentType)).optional(),
  industry: z.array(z.string()).optional(),
  semanticRole: z.string().optional(),
  accessibility: z.object({
    ariaLabel: z.string().optional(),
    ariaDescribedBy: z.string().optional(),
    role: z.string().optional()
  }).optional()
});

export const CMSComponentPropsSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ComponentType),
  category: z.nativeEnum(ComponentCategory),
  content: ComponentContentSchema,

  className: z.string().optional(),
  style: z.record(z.any()).optional(),
  theme: z.enum(['light', 'dark', 'auto', 'inverted']).optional(),

  loading: z.enum(['eager', 'lazy']).optional(),
  priority: z.enum(['critical', 'high', 'normal', 'low', 'lazy']).optional(),
  interactive: z.boolean().optional(),

  aiMetadata: AIComponentMetadataSchema.optional(),
  analytics: z.object({
    trackingId: z.string().optional(),
    events: z.array(z.string()).optional()
  }).optional()
});

// ============================================================================
// Component Processing Rules
// ============================================================================

/**
 * Rules for multi-row navigation detection and splitting.
 * Used by navigation-processor to split menuItems into utilityNav + menuItems.
 */
export interface MultiRowDetectionRules {
  /** Label patterns that indicate utility navigation items (e.g., 'Login', 'Sign Up') */
  utilityPatterns?: string[]
  /** Whether to enable multi-row detection for this component */
  enabled?: boolean
}

/**
 * Rules for background image promotion from DOM snapshot.
 * Used by hero-processor to upgrade hero-simple → hero-banner.
 */
export interface BackgroundPromotionRules {
  /** Whether to enable background promotion for this component */
  enabled?: boolean
  /** Selector patterns to search for background images in DOM */
  domSelectors?: string[]
}

/**
 * Rules for deduplication of components.
 * Used by cta-processor to remove duplicate CTAs.
 */
export interface DeduplicationRules {
  /** Whether to enable deduplication for this component */
  enabled?: boolean
  /** Component types that this component might duplicate */
  deduplicateWith?: ComponentType[]
  /** Context where deduplication applies (e.g., 'adjacent', 'within-parent') */
  context?: string
}

/**
 * Rules for content feed promotion.
 * Used by content-feed-processor to promote listing components to content feeds.
 */
export interface ContentFeedPromotionRules {
  /** Whether to enable content feed promotion for this component */
  enabled?: boolean
  /** Patterns that indicate this component should be promoted to content feed */
  promotionPatterns?: string[]
}

/**
 * Component processing rules (declarative metadata for post-processors).
 * Replaces hardcoded logic in detection-post-processor modules.
 */
export interface ComponentProcessingRules {
  /** Multi-row navigation detection rules */
  multiRowDetection?: MultiRowDetectionRules
  /** Background image promotion rules */
  backgroundPromotion?: BackgroundPromotionRules
  /** Deduplication rules */
  deduplication?: DeduplicationRules
  /** Content feed promotion rules */
  contentFeedPromotion?: ContentFeedPromotionRules
}

/**
 * Component normalization rules (declarative metadata for normalizers).
 * Will replace hardcoded logic in *-normalizers.ts files.
 */
export interface ComponentNormalizationRules {
  /** Field transformations to apply during normalization */
  fieldTransforms?: Record<string, {
    /** Source field name */
    from: string
    /** Target field name */
    to: string
    /** Optional transformation function name */
    transform?: string
  }>
  /** Whether to enable normalization for this component */
  enabled?: boolean
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ComponentPropsWithRef<T = CMSComponentProps> = T & {
  ref?: React.Ref<HTMLElement>;
};

export type ComponentRenderFunction = (
  props: CMSComponentProps
) => React.ReactElement | null;

// ============================================================================
// Component Type Aliases
// ============================================================================

/**
 * Normalized aliases for component type resolution.
 * Maps common variations and abbreviations to canonical ComponentType values.
 */
export const COMPONENT_TYPE_ALIASES: Record<string, ComponentType> = {
  navigation: ComponentType.NavBar,
  navbar: ComponentType.NavBar,
  'navigation-bar': ComponentType.NavBar,
  'hero-banner': ComponentType.HeroBanner,
  hero: ComponentType.HeroBanner,
  'feature-grid': ComponentType.FeatureGrid,
  'feature-list': ComponentType.FeatureList,
  'feature-showcase': ComponentType.FeatureShowcase,
  'card-grid': ComponentType.CardGrid,
  'text-block': ComponentType.TextBlock,
  text: ComponentType.TextBlock,
  cta: ComponentType.CTASimple,
  'cta-banner': ComponentType.CTABanner,
  'cta-newsletter': ComponentType.CTAWithForm,
  newsletter: ComponentType.CTAWithForm,
  'newsletter-signup': ComponentType.CTAWithForm,
  subscribe: ComponentType.CTAWithForm,
  'call-to-action': ComponentType.CTABanner,
  footer: ComponentType.Footer,
  breadcrumbs: ComponentType.Breadcrumbs,
  'contact-form': ComponentType.ContactForm,
  'contact-info': ComponentType.ContactInfo,
  'location-map': ComponentType.LocationMap,
  'blog-list': ComponentType.BlogList
} as const;
