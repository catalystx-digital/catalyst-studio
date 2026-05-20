/**
 * Component Registry for Export Projects
 * Generated based on actual component directory structure
 */

export interface ComponentRegistryEntry {
  name: string;
  path: string;
  category: string;
  hasAdapter: boolean;
  description?: string;
}

export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  // Heroes
  {
    name: 'hero-banner',
    path: 'lib/studio/components/cms/heroes/hero-banner',
    category: 'heroes',
    hasAdapter: true,
    description: 'Main hero banner component'
  },
  {
    name: 'hero-minimal',
    path: 'lib/studio/components/cms/heroes/hero-minimal',
    category: 'heroes',
    hasAdapter: true,
    description: 'Minimal hero component'
  },
  {
    name: 'hero-split',
    path: 'lib/studio/components/cms/heroes/hero-split',
    category: 'heroes',
    hasAdapter: true,
    description: 'Split-screen hero component'
  },
  {
    name: 'hero-video',
    path: 'lib/studio/components/cms/heroes/hero-video',
    category: 'heroes',
    hasAdapter: true,
    description: 'Video background hero component'
  },
  {
    name: 'hero-with-image',
    path: 'lib/studio/components/cms/heroes/hero-with-image',
    category: 'heroes',
    hasAdapter: true,
    description: 'Hero with image component'
  },

  // Features
  {
    name: 'feature-grid',
    path: 'lib/studio/components/cms/features/feature-grid',
    category: 'features',
    hasAdapter: true,
    description: 'Grid layout for features'
  },
  {
    name: 'feature-item',
    path: 'lib/studio/components/cms/features/feature-item',
    category: 'features',
    hasAdapter: true,
    description: 'Individual feature item'
  },
  {
    name: 'feature-list',
    path: 'lib/studio/components/cms/features/feature-list',
    category: 'features',
    hasAdapter: true,
    description: 'List of features'
  },
  {
    name: 'feature-comparison',
    path: 'lib/studio/components/cms/features/feature-comparison',
    category: 'features',
    hasAdapter: true,
    description: 'Feature comparison table'
  },
  {
    name: 'feature-showcase',
    path: 'lib/studio/components/cms/features/feature-showcase',
    category: 'features',
    hasAdapter: true,
    description: 'Feature showcase section'
  },

  // Navigation
  {
    name: 'nav-bar',
    path: 'lib/studio/components/cms/navigation/nav-bar',
    category: 'navigation',
    hasAdapter: true,
    description: 'Main navigation bar'
  },
  {
    name: 'footer',
    path: 'lib/studio/components/cms/navigation/footer',
    category: 'navigation',
    hasAdapter: true,
    description: 'Footer navigation'
  },
  {
    name: 'breadcrumbs',
    path: 'lib/studio/components/cms/navigation/breadcrumbs',
    category: 'navigation',
    hasAdapter: true,
    description: 'Breadcrumb navigation'
  },
  {
    name: 'mobile-menu',
    path: 'lib/studio/components/cms/navigation/mobile-menu',
    category: 'navigation',
    hasAdapter: true,
    description: 'Mobile navigation menu'
  },

  // CTA (Call to Action)
  {
    name: 'cta-simple',
    path: 'lib/studio/components/cms/cta/cta-simple',
    category: 'cta',
    hasAdapter: true,
    description: 'Simple call-to-action'
  },
  {
    name: 'cta-banner',
    path: 'lib/studio/components/cms/cta/cta-banner',
    category: 'cta',
    hasAdapter: true,
    description: 'Banner call-to-action'
  },
  {
    name: 'cta-button-group',
    path: 'lib/studio/components/cms/cta/cta-button-group',
    category: 'cta',
    hasAdapter: true,
    description: 'Group of CTA buttons'
  },
  {
    name: 'cta-newsletter',
    path: 'lib/studio/components/cms/cta/cta-newsletter',
    category: 'cta',
    hasAdapter: true,
    description: 'Newsletter signup CTA'
  },

  // Content
  {
    name: 'text-block',
    path: 'lib/studio/components/cms/content/text-block',
    category: 'content',
    hasAdapter: true,
    description: 'Text content block'
  },
  {
    name: 'card-grid',
    path: 'lib/studio/components/cms/content/card-grid',
    category: 'content',
    hasAdapter: true,
    description: 'Grid of cards'
  },
  {
    name: 'card-item',
    path: 'lib/studio/components/cms/content/card-item',
    category: 'content',
    hasAdapter: true,
    description: 'Individual card item'
  },
  {
    name: 'image-gallery',
    path: 'lib/studio/components/cms/content/image-gallery',
    category: 'content',
    hasAdapter: true,
    description: 'Image gallery component'
  },
  {
    name: 'video-player',
    path: 'lib/studio/components/cms/content/video-player',
    category: 'content',
    hasAdapter: true,
    description: 'Video player component'
  },
  {
    name: 'tabs',
    path: 'lib/studio/components/cms/content/tabs',
    category: 'content',
    hasAdapter: true,
    description: 'Tabbed content'
  },
  {
    name: 'accordion',
    path: 'lib/studio/components/cms/content/accordion',
    category: 'content',
    hasAdapter: true,
    description: 'Accordion content'
  },
  {
    name: 'two-column',
    path: 'lib/studio/components/cms/content/two-column',
    category: 'content',
    hasAdapter: true,
    description: 'Two-column layout'
  },
  {
    name: 'quote-block',
    path: 'lib/studio/components/cms/content/quote-block',
    category: 'content',
    hasAdapter: true,
    description: 'Quote/testimonial block'
  },

  // About
  {
    name: 'about-section',
    path: 'lib/studio/components/cms/about/about-section',
    category: 'about',
    hasAdapter: true,
    description: 'About section component'
  },
  {
    name: 'team-grid',
    path: 'lib/studio/components/cms/about/team-grid',
    category: 'about',
    hasAdapter: true,
    description: 'Team member grid'
  },
  {
    name: 'team-member',
    path: 'lib/studio/components/cms/about/team-member',
    category: 'about',
    hasAdapter: true,
    description: 'Individual team member'
  },
  {
    name: 'mission-statement',
    path: 'lib/studio/components/cms/about/mission-statement',
    category: 'about',
    hasAdapter: true,
    description: 'Mission statement component'
  },

  // Blog
  {
    name: 'blog-list',
    path: 'lib/studio/components/cms/blog/blog-list',
    category: 'blog',
    hasAdapter: true,
    description: 'List of blog posts'
  },
  {
    name: 'blog-post',
    path: 'lib/studio/components/cms/blog/blog-post',
    category: 'blog',
    hasAdapter: true,
    description: 'Individual blog post'
  },
  {
    name: 'article-header',
    path: 'lib/studio/components/cms/blog/article-header',
    category: 'blog',
    hasAdapter: true,
    description: 'Article header component'
  },
  {
    name: 'author-bio',
    path: 'lib/studio/components/cms/blog/author-bio',
    category: 'blog',
    hasAdapter: true,
    description: 'Author biography'
  },
  {
    name: 'related-posts',
    path: 'lib/studio/components/cms/blog/related-posts',
    category: 'blog',
    hasAdapter: true,
    description: 'Related blog posts'
  },

  // Contact
  {
    name: 'contact-form',
    path: 'lib/studio/components/cms/contact/contact-form',
    category: 'contact',
    hasAdapter: true,
    description: 'Contact form component'
  },
  {
    name: 'contact-info',
    path: 'lib/studio/components/cms/contact/contact-info',
    category: 'contact',
    hasAdapter: true,
    description: 'Contact information'
  },
  {
    name: 'location-map',
    path: 'lib/studio/components/cms/contact/location-map',
    category: 'contact',
    hasAdapter: true,
    description: 'Location map component'
  },
  {
    name: 'simple-form',
    path: 'lib/studio/components/cms/contact/simple-form',
    category: 'contact',
    hasAdapter: true,
    description: 'Simple contact form'
  },

  // Pricing
  {
    name: 'pricing-table',
    path: 'lib/studio/components/cms/pricing/pricing-table',
    category: 'pricing',
    hasAdapter: true,
    description: 'Pricing table component'
  },
  {
    name: 'pricing-card',
    path: 'lib/studio/components/cms/pricing/pricing-card',
    category: 'pricing',
    hasAdapter: true,
    description: 'Individual pricing card'
  },

  // Social Proof
  {
    name: 'testimonial-grid',
    path: 'lib/studio/components/cms/social-proof/testimonial-grid',
    category: 'social-proof',
    hasAdapter: true,
    description: 'Grid of testimonials'
  },
  {
    name: 'testimonial-item',
    path: 'lib/studio/components/cms/social-proof/testimonial-item',
    category: 'social-proof',
    hasAdapter: true,
    description: 'Individual testimonial'
  },
  {
    name: 'testimonial-slider',
    path: 'lib/studio/components/cms/social-proof/testimonial-slider',
    category: 'social-proof',
    hasAdapter: true,
    description: 'Testimonial slider'
  },
  {
    name: 'review-card',
    path: 'lib/studio/components/cms/social-proof/review-card',
    category: 'social-proof',
    hasAdapter: true,
    description: 'Review card component'
  },
  {
    name: 'logo-strip',
    path: 'lib/studio/components/cms/social-proof/logo-strip',
    category: 'social-proof',
    hasAdapter: true,
    description: 'Client logo strip'
  },

  // Data
  {
    name: 'data-table',
    path: 'lib/studio/components/cms/data/data-table',
    category: 'data',
    hasAdapter: true,
    description: 'Data table component'
  },
  {
    name: 'statistics',
    path: 'lib/studio/components/cms/data/statistics',
    category: 'data',
    hasAdapter: true,
    description: 'Statistics display'
  }
];

// Helper functions for component lookup
export function getComponentsByCategory(category: string): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter(comp => comp.category === category);
}

export function getComponentByName(name: string): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find(comp => comp.name === name);
}

export function getAllComponentNames(): string[] {
  return COMPONENT_REGISTRY.map(comp => comp.name);
}

export function getComponentCategories(): string[] {
  return [...new Set(COMPONENT_REGISTRY.map(comp => comp.category))];
}