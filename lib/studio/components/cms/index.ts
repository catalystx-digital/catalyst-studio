/**

 * CMS Component Library - Main Export File

 * Exports all 60 CMS components across categories

 * 

 * Categories:

 * - Navigation (5 components)

 * - Heroes (4 components)

 * - Content Display (8 components)

 * - Features & CTA (7 components)

 * - Social Proof (4 components)

 * - Contact & Forms (4 components)

 * - About & Team (3 components)

 * - Blog (5 components + utils)

 * - Pricing & Data (5 components)

 */

import { cmsComponentFactory } from './_factory/factory';
import { ComponentType } from './_core/types';

// NOTE: Component initialization removed from auto-load to prevent build hangs

// Components are now initialized on-demand via dynamic imports in the factory

export { initializeCMSComponents } from './_factory/initialize';

// ============================================

// Navigation Components (6)

// ============================================

export { default as NavBar } from './navigation/nav-bar';

export { default as Footer } from './navigation/footer';

export { default as Breadcrumbs } from './navigation/breadcrumbs';

export { default as MobileMenu } from './navigation/mobile-menu';

export { SidebarNav } from './navigation/sidebar-nav';

// Sidemenu alias for backwards compatibility with exported sites
export { SidebarNav as Sidemenu } from './navigation/sidebar-nav';

// Navigation Adapters

export {

  NavBarAdapter,

  FooterAdapter,

  BreadcrumbsAdapter,

  MobileMenuAdapter,

  SidebarNavAdapter,

  SidebarNavAdapter as SidemenuAdapter

} from './navigation/adapters';

// ============================================

// Hero Components (4)

// ============================================

export { HeroSimple } from './heroes/hero-simple';
export { HeroBanner } from './heroes/hero-banner';
export { HeroWithImage } from './heroes/hero-with-image';
export { HeroSplit } from './heroes/hero-split';
export { HeroMinimal } from './heroes/hero-minimal';
export { HeroVideo } from './heroes/hero-video';
export { HeroCarousel } from './heroes/hero-carousel';

// Hero Adapters

export { 
  HeroSimpleAdapter,
  HeroBannerAdapter,
  HeroWithImageAdapter,
  HeroSplitAdapter, 
  HeroMinimalAdapter,
  HeroVideoAdapter,
  HeroCarouselAdapter
} from './heroes/adapters';

// ============================================

// Content Display Components (9)

// ============================================

export { default as TextBlock } from './content/text-block';

export { default as TwoColumn } from './content/two-column';

export { Accordion } from './content/accordion';

export { Tabs } from './content/tabs';

export { CardGrid } from './content/card-grid';
export { CardItem } from './content/card-item';
export { ContentFeed } from './content/content-feed';

export { default as ImageGallery } from './content/image-gallery';

export { default as VideoPlayer } from './content/video-player';

export { QuoteBlock } from './content/quote-block';
export { VideoEmbed } from './content/video-embed';
export { HtmlBlock } from './content/html-block';

// Content Adapters - Part 1

export {

  TextBlockAdapter,

  TwoColumnAdapter,

  ImageGalleryAdapter,

  VideoPlayerAdapter,

  VideoEmbedAdapter

} from './content/adapters';

// Content Adapters - Part 2

export {

  AccordionAdapter,

  TabsAdapter,

  CardGridAdapter,

  CardItemAdapter,

  ContentFeedAdapter,

  QuoteBlockAdapter,

  HtmlBlockAdapter

} from './content/adapters';

// ============================================

// Features Components (4)

// ============================================

export { FeatureGrid } from './features/feature-grid';

export { FeatureShowcase } from './features/feature-showcase';

export { FeatureList } from './features/feature-list';

export { FeatureComparison } from './features/feature-comparison';

// Feature Adapters

export {

  FeatureGridAdapter,

  FeatureShowcaseAdapter,

  FeatureListAdapter,

  FeatureComparisonAdapter

} from './features/adapters';

// ============================================

// CTA Components (4)

export { default as CTASimple } from './cta/cta-simple';

export { default as CTABanner } from './cta/cta-banner';

export { default as CTANewsletter } from './cta/cta-newsletter';
export { default as CTAWithForm } from './cta/cta-newsletter';

export { default as CTAButtonGroup } from './cta/cta-button-group';

// CTA Adapters

export {

  CTASimpleAdapter,

  CTABannerAdapter,

  CTANewsletterAdapter,

  CTAButtonGroupAdapter

} from './cta/adapters';

// ============================================

// Social Proof Components (4)

// ============================================

export { default as Testimonials } from './social-proof/testimonial-slider';
export { default as TestimonialSlider } from './social-proof/testimonial-slider';

export { default as TestimonialGrid } from './social-proof/testimonial-grid';

export { default as ReviewCard } from './social-proof/review-card';
export { default as Reviews } from './social-proof/review-card';

export { default as LogoStrip } from './social-proof/logo-strip';

export { default as LogoCloud } from './social-proof/logo-strip';

// Social Proof Adapters

export {

  TestimonialSliderAdapter,

  TestimonialGridAdapter,

  ReviewCardAdapter,

  LogoStripAdapter

} from './social-proof/adapters';

// ============================================

// Contact & Form Components (4)

// ============================================

export { default as ContactForm } from './contact/contact-form';

export { default as ContactInfo } from './contact/contact-info';

export { default as LocationMap } from './contact/location-map';

export { default as SimpleForm } from './contact/simple-form';

// Contact Adapters

export {

  ContactFormAdapter,

  ContactInfoAdapter,

  LocationMapAdapter,

  SimpleFormAdapter

} from './contact/adapters';

// ============================================

// About & Team Components (3)

// ============================================

export { default as AboutSection } from './about/about-section';

export { default as TeamGrid } from './about/team-grid';

export { default as TeamMember } from './about/team-member';

// About Adapters

export {

  AboutSectionAdapter,

  TeamGridAdapter,

  TeamMemberAdapter

} from './about/adapters';

// ============================================

// Blog Components (5 + utils)

// ============================================

export { default as BlogList } from './blog/blog-list';

export { default as BlogCard } from './blog/blog-card';

export { default as ArticleHeader } from './blog/article-header';

export { default as AuthorBio } from './blog/author-bio';

export { default as RelatedPosts } from './blog/related-posts';

export { default as BlogPost } from './blog/blog-post';

// Blog utilities

export * from './blog/utils';

// Blog Adapters

export {

  BlogPostAdapter,

  BlogListAdapter,

  BlogCardAdapter,

  ArticleHeaderAdapter,

  AuthorBioAdapter,

  RelatedPostsAdapter

} from './blog/adapters';

// ============================================

// Pricing Components (2)

// ============================================

export { default as PricingTable } from './pricing/pricing-table';

export { default as PricingCard } from './pricing/pricing-card';

// Pricing Adapters

export {

  PricingTableAdapter,

  PricingCardAdapter

} from './pricing/adapters';

// ============================================

// Data Components (4)

// ============================================

export { default as Statistics } from './data/statistics';

export { default as DataTable } from './data/data-table';

export { default as Chart } from './data/chart';

export { default as Timeline } from './data/timeline';

// Data Adapters

export {

  StatisticsAdapter,

  DataTableAdapter,

  ChartAdapter,

  TimelineAdapter

} from './data/adapters';

// ============================================

// Core Exports

// ============================================

export { cmsComponentFactory };

// Export all types

export * from './_core/types';

export * from './_core/utils';

export * from './_core/constants';

export * from './_core/performance';

// Export AI utilities

export * from './_ai/detector';

export * from './_ai/confidence';

// Export factory utilities

export * from './_factory/factory';

export * from './_factory/registry';

// ============================================

// Component Registration

// ============================================

// NOTE: Component registration is now handled by:
// - lib/studio/components/cms/_factory/initialize.ts (async initialization)
// - Individual register.ts files in each category folder
// The old registerAllComponents() function has been removed as part of TKT-017 cleanup.
