// Generated component registry - DO NOT EDIT MANUALLY
// Run 'npm run build:components' to regenerate

import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types';

export interface ComponentRegistryEntry {
  name: ComponentType;
  path: string;
  category: ComponentCategory;
  hasAdapter: boolean;
  description?: string;
}

export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  {
    name: ComponentType.AboutSection,
    path: 'lib/studio/components/cms/about/about-section',
    category: ComponentCategory.About,
    hasAdapter: true,
    description: "About page section with story, mission, values, milestones, images, and stats."
  },
  {
    name: ComponentType.TeamGrid,
    path: 'lib/studio/components/cms/about/team-grid',
    category: ComponentCategory.About,
    hasAdapter: true,
    description: "Grid of team members with photos, titles, and optional department and profile links."
  },
  {
    name: ComponentType.Timeline,
    path: 'lib/studio/components/cms/data/timeline',
    category: ComponentCategory.About,
    hasAdapter: true,
    description: "Chronological timeline of events with titles, dates, descriptions, and optional icons."
  },
  {
    name: ComponentType.ArticleHeader,
    path: 'lib/studio/components/cms/blog/article-header',
    category: ComponentCategory.Blog,
    hasAdapter: true,
    description: "Article header with title, author, dates, categories/tags, and optional featured image."
  },
  {
    name: ComponentType.AuthorBio,
    path: 'lib/studio/components/cms/blog/author-bio',
    category: ComponentCategory.Blog,
    hasAdapter: true,
    description: "Author bio with photo, social links, stats, expertise, and expandable text."
  },
  {
    name: ComponentType.BlogList,
    path: 'lib/studio/components/cms/blog/blog-list',
    category: ComponentCategory.Blog,
    hasAdapter: true,
    description: "List or grid of blog posts with pagination, filters, and sorting options. Auto-filled blog feed with optional manual pins for editorial control."
  },
  {
    name: ComponentType.BlogPost,
    path: 'lib/studio/components/cms/blog/blog-post',
    category: ComponentCategory.Blog,
    hasAdapter: true,
    description: "Long-form article component combining hero details, rich body content, and author metadata."
  },
  {
    name: ComponentType.RelatedPosts,
    path: 'lib/studio/components/cms/blog/related-posts',
    category: ComponentCategory.Blog,
    hasAdapter: true,
    description: "Related posts section showing selected or automatically related articles. Hybrid related content module that auto-suggests posts and supports editorial overrides."
  },
  {
    name: ComponentType.ContactForm,
    path: 'lib/studio/components/cms/contact/contact-form',
    category: ComponentCategory.Contact,
    hasAdapter: true,
    description: "Contact form with configurable fields, validation, endpoint, and success/error handling."
  },
  {
    name: ComponentType.ContactInfo,
    path: 'lib/studio/components/cms/contact/contact-info',
    category: ComponentCategory.Contact,
    hasAdapter: true,
    description: "Business contact information including address, phone/email lists, social links, and hours."
  },
  {
    name: ComponentType.LocationMap,
    path: 'lib/studio/components/cms/contact/location-map',
    category: ComponentCategory.Contact,
    hasAdapter: true,
    description: "Embeddable map with address/coordinates, marker info window, and styling options."
  },
  {
    name: ComponentType.SimpleForm,
    path: 'lib/studio/components/cms/contact/simple-form',
    category: ComponentCategory.Contact,
    hasAdapter: true,
    description: "Lightweight form with up to three fields, templates (newsletter/contact/callback), and customizable submit handling."
  },
  {
    name: ComponentType.Accordion,
    path: 'lib/studio/components/cms/content/accordion',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Collapsible list of items with titles and expandable content, optionally allowing multiple open."
  },
  {
    name: ComponentType.CardGrid,
    path: 'lib/studio/components/cms/content/card-grid',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Grid of cards with images, text, metadata, and optional actions; configurable columns and layout."
  },
  {
    name: ComponentType.CardItem,
    path: 'lib/studio/components/cms/content/card-item',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Basic card item with title, description, optional media and actions."
  },
  {
    name: ComponentType.ContentFeed,
    path: 'lib/studio/components/cms/content/content-feed',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Dynamic provider-backed content feed that supports pinned items, sorting, and list or grid layouts."
  },
  {
    name: ComponentType.HtmlBlock,
    path: 'lib/studio/components/cms/content/html-block',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Rich HTML content block for documentation, resource pages, and information content without author/date metadata."
  },
  {
    name: ComponentType.ImageGallery,
    path: 'lib/studio/components/cms/content/image-gallery',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Responsive gallery of images with grid, carousel, or masonry layout and optional lightbox."
  },
  {
    name: ComponentType.QuoteBlock,
    path: 'lib/studio/components/cms/content/quote-block',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Pull quote section with attribution and styles for emphasis in content pages."
  },
  {
    name: ComponentType.Tabs,
    path: 'lib/studio/components/cms/content/tabs',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Tabbed content interface with labeled tabs, orientation, and alignment options."
  },
  {
    name: ComponentType.TextBlock,
    path: 'lib/studio/components/cms/content/text-block',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Rich text block for headings and paragraphs, with alignment and optional columns."
  },
  {
    name: ComponentType.TwoColumn,
    path: 'lib/studio/components/cms/content/two-column',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Layout wrapper for side-by-side content. Use when visual separation exists between content sections (sidebar + content, image + text, or any two columns displayed horizontally). Supports nested components in each column."
  },
  {
    name: ComponentType.VideoEmbed,
    path: 'lib/studio/components/cms/content/video-embed',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Embeds externally hosted video players (YouTube, Vimeo, Loom, Wistia) with responsive sizing and analytics support."
  },
  {
    name: ComponentType.VideoPlayer,
    path: 'lib/studio/components/cms/content/video-player',
    category: ComponentCategory.Content,
    hasAdapter: true,
    description: "Responsive video player supporting multiple sources and playback controls."
  },
  {
    name: ComponentType.CTABanner,
    path: 'lib/studio/components/cms/cta/cta-banner',
    category: ComponentCategory.CTA,
    hasAdapter: true,
    description: "Full-width call-to-action section with headline and primary/secondary buttons."
  },
  {
    name: ComponentType.CTAButtonGroup,
    path: 'lib/studio/components/cms/cta/cta-button-group',
    category: ComponentCategory.CTA,
    hasAdapter: true,
    description: "Group of call-to-action buttons with alignment, orientation, and spacing controls."
  },
  {
    name: ComponentType.CTASimple,
    path: 'lib/studio/components/cms/cta/cta-simple',
    category: ComponentCategory.CTA,
    hasAdapter: true,
    description: "Compact call-to-action card with headline, supporting copy, and primary action."
  },
  {
    name: ComponentType.CTAWithForm,
    path: 'lib/studio/components/cms/cta/cta-newsletter',
    category: ComponentCategory.CTA,
    hasAdapter: true,
    description: "Email newsletter signup form with configurable layout and messaging."
  },
  {
    name: ComponentType.Chart,
    path: 'lib/studio/components/cms/data/chart',
    category: ComponentCategory.Data,
    hasAdapter: true,
    description: "Data visualization card supporting bar, line, and donut charts with multi-series support."
  },
  {
    name: ComponentType.DataTable,
    path: 'lib/studio/components/cms/data/data-table',
    category: ComponentCategory.Data,
    hasAdapter: true,
    description: "Tabular data display with configurable columns, pagination, sorting, and filtering."
  },
  {
    name: ComponentType.Statistics,
    path: 'lib/studio/components/cms/data/statistics',
    category: ComponentCategory.Data,
    hasAdapter: true,
    description: "Key performance indicators and metrics displayed as stats with labels, delta trends, and optional icons."
  },
  {
    name: ComponentType.FeatureComparison,
    path: 'lib/studio/components/cms/features/feature-comparison',
    category: ComponentCategory.Features,
    hasAdapter: true,
    description: "Side-by-side comparison table for features/plans with optional highlights."
  },
  {
    name: ComponentType.FeatureGrid,
    path: 'lib/studio/components/cms/features/feature-grid',
    category: ComponentCategory.Features,
    hasAdapter: true,
    description: "Grid layout highlighting multiple features with optional headers and configurable columns."
  },
  {
    name: ComponentType.FeatureList,
    path: 'lib/studio/components/cms/features/feature-list',
    category: ComponentCategory.Features,
    hasAdapter: true,
    description: "List-based feature presentation with icons, titles, descriptions, and optional links."
  },
  {
    name: ComponentType.FeatureShowcase,
    path: 'lib/studio/components/cms/features/feature-showcase',
    category: ComponentCategory.Features,
    hasAdapter: true,
    description: "Interactive showcase with multiple sections combining images, descriptive text, checklists, and CTAs."
  },
  {
    name: ComponentType.HeroBanner,
    path: 'lib/studio/components/cms/heroes/hero-banner',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Prominent top-of-page section featuring a primary message, background media, and optional call-to-action buttons."
  },
  {
    name: ComponentType.HeroCarousel,
    path: 'lib/studio/components/cms/heroes/hero-carousel',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Carousel-style hero section rotating featured stories or promotions with imagery and calls to action."
  },
  {
    name: ComponentType.HeroMinimal,
    path: 'lib/studio/components/cms/heroes/hero-minimal',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Minimal hero layout with focused copy, optional CTAs, and subtle styling controls."
  },
  {
    name: ComponentType.HeroSimple,
    path: 'lib/studio/components/cms/heroes/hero-simple',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Compact hero with headline, supporting copy, and primary calls-to-action for quick conversions."
  },
  {
    name: ComponentType.HeroSplit,
    path: 'lib/studio/components/cms/heroes/hero-split',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Hero section with split layout: text on one side and media (image/video/embed) on the other."
  },
  {
    name: ComponentType.HeroVideo,
    path: 'lib/studio/components/cms/heroes/hero-video',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Video-first hero section with optional overlay content and playback controls."
  },
  {
    name: ComponentType.HeroWithImage,
    path: 'lib/studio/components/cms/heroes/hero-with-image',
    category: ComponentCategory.Heroes,
    hasAdapter: true,
    description: "Primary hero section pairing marketing copy with a supporting image and optional CTA buttons."
  },
  {
    name: ComponentType.Breadcrumbs,
    path: 'lib/studio/components/cms/navigation/breadcrumbs',
    category: ComponentCategory.Navigation,
    hasAdapter: true,
    description: "Automatically generated breadcrumb trail reflecting the current page hierarchy with optional display tweaks."
  },
  {
    name: ComponentType.Footer,
    path: 'lib/studio/components/cms/navigation/footer',
    category: ComponentCategory.Navigation,
    hasAdapter: true,
    description: "Site footer with navigation columns, branding, legal links, social icons, and optional newsletter signup."
  },
  {
    name: ComponentType.MobileMenu,
    path: 'lib/studio/components/cms/navigation/mobile-menu',
    category: ComponentCategory.Navigation,
    hasAdapter: true,
    description: "Mobile navigation drawer with hierarchical items, supporting left/right slide or fade animations."
  },
  {
    name: ComponentType.NavBar,
    path: 'lib/studio/components/cms/navigation/nav-bar',
    category: ComponentCategory.Navigation,
    hasAdapter: true,
    description: "Primary site navigation with brand logo, hierarchical menu items, and optional call-to-action."
  },
  {
    name: ComponentType.SidebarNav,
    path: 'lib/studio/components/cms/navigation/sidebar-nav',
    category: ComponentCategory.Navigation,
    hasAdapter: true,
    description: "Hierarchical sidebar navigation for \"In this section\" style navigation. Commonly used on documentation pages, content hubs, and service detail pages."
  },
  {
    name: ComponentType.PricingCard,
    path: 'lib/studio/components/cms/pricing/pricing-card',
    category: ComponentCategory.Pricing,
    hasAdapter: true,
    description: "Single pricing card with price, features, and call-to-action."
  },
  {
    name: ComponentType.PricingTable,
    path: 'lib/studio/components/cms/pricing/pricing-table',
    category: ComponentCategory.Pricing,
    hasAdapter: true,
    description: "Pricing table with multiple plans and optional feature comparison matrix."
  },
  {
    name: ComponentType.LogoCloud,
    path: 'lib/studio/components/cms/social-proof/logo-strip',
    category: ComponentCategory.SocialProof,
    hasAdapter: true,
    description: "Row of client/partner logos with optional scrolling animation and caption."
  },
  {
    name: ComponentType.Reviews,
    path: 'lib/studio/components/cms/social-proof/review-card',
    category: ComponentCategory.SocialProof,
    hasAdapter: true,
    description: "Individual review with rating, author, date, and optional platform metadata."
  },
  {
    name: ComponentType.Testimonials,
    path: 'lib/studio/components/cms/social-proof/testimonial-grid',
    category: ComponentCategory.SocialProof,
    hasAdapter: true,
    description: "Carousel-style slider for testimonials with autoplay and navigation controls."
  }

];

export function getComponentByName(name: ComponentType): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find(entry => entry.name === name);
}

export function getComponentsByCategory(category: ComponentCategory): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter(entry => entry.category === category);
}

export function hasComponent(name: ComponentType): boolean {
  return COMPONENT_REGISTRY.some(entry => entry.name === name);
}
