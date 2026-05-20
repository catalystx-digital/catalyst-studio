import { ComponentType, AIComponentMetadata } from '../_core/types';

export const componentPatterns: Record<string, AIComponentMetadata> = {
  // Navigation Components
  [ComponentType.NavBar]: {
    keywords: ['navigation', 'navbar', 'header', 'menu', 'nav'],
    patterns: ['nav(?:bar|igation)?', 'menu', 'header'],
    commonNames: ['navigation bar', 'nav bar', 'header', 'main menu', 'top menu'],
    pageLocation: ['header'],
    confidence: 0.95,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    semanticRole: 'navigation',
    accessibility: {
      role: 'navigation',
      ariaLabel: 'Main navigation'
    }
  },
  
  // Hero Components
  [ComponentType.HeroSimple]: {
    keywords: ['hero', 'banner', 'jumbotron', 'masthead', 'splash'],
    patterns: ['hero(?:-?section)?', 'banner', 'jumbotron'],
    commonNames: ['hero section', 'hero banner', 'main banner', 'page header'],
    pageLocation: ['hero'],
    confidence: 0.9,
    suggestedVariants: ['default', 'minimal'],
    relatedComponents: [ComponentType.HeroWithImage, ComponentType.HeroVideo],
    semanticRole: 'banner'
  },
  
  [ComponentType.HeroWithImage]: {
    keywords: ['hero', 'banner', 'image', 'split', 'two-column'],
    patterns: ['hero.*image', 'split.*hero', 'two.*column'],
    commonNames: ['hero with image', 'split hero', 'two-column hero'],
    pageLocation: ['hero'],
    confidence: 0.85,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [ComponentType.HeroSimple, ComponentType.HeroVideo],
    semanticRole: 'banner'
  },
  
  [ComponentType.HeroVideo]: {
    keywords: ['hero', 'video', 'background', 'autoplay', 'loop'],
    patterns: ['hero.*video', 'video.*background', 'background.*video'],
    commonNames: ['video hero', 'video background', 'hero with video'],
    pageLocation: ['hero'],
    confidence: 0.9,
    suggestedVariants: ['default'],
    relatedComponents: [ComponentType.HeroSimple, ComponentType.HeroWithImage],
    semanticRole: 'banner'
  },
  
  // CTA Components
  [ComponentType.CTASimple]: {
    keywords: ['cta', 'call to action', 'action', 'button', 'click'],
    patterns: ['cta', 'call.*to.*action', 'click.*here'],
    commonNames: ['call to action', 'cta section', 'action banner'],
    pageLocation: ['main', 'hero'],
    confidence: 0.85,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    relatedComponents: [ComponentType.CTABanner, ComponentType.CTAWithForm],
    semanticRole: 'complementary'
  },
  
  [ComponentType.CTABanner]: {
    keywords: ['cta', 'banner', 'full-width', 'announcement'],
    patterns: ['cta.*banner', 'banner.*cta', 'full.*width.*cta'],
    commonNames: ['cta banner', 'announcement banner', 'full-width cta'],
    pageLocation: ['main'],
    confidence: 0.85,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [ComponentType.CTASimple],
    semanticRole: 'complementary'
  },
  
  [ComponentType.CTAWithForm]: {
    keywords: ['newsletter', 'signup', 'subscribe', 'email', 'form'],
    patterns: ['newsletter', 'sign.*up', 'subscribe', 'email.*form'],
    commonNames: ['newsletter signup', 'email signup', 'subscription form'],
    pageLocation: ['main', 'footer'],
    confidence: 0.9,
    suggestedVariants: ['default', 'minimal'],
    relatedComponents: [ComponentType.ContactForm],
    semanticRole: 'form'
  },
  
  // Footer Components
  [ComponentType.SideMenu]: { // Footer as navigation component
    keywords: ['footer', 'bottom', 'copyright', 'links', 'sitemap'],
    patterns: ['footer', 'copyright', 'site.*map'],
    commonNames: ['footer', 'site footer', 'page footer'],
    pageLocation: ['footer'],
    confidence: 0.95,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    semanticRole: 'contentinfo',
    accessibility: {
      role: 'contentinfo',
      ariaLabel: 'Site footer'
    }
  },
  
  // Feature Components
  [ComponentType.FeatureGrid]: {
    keywords: ['features', 'benefits', 'services', 'grid', 'cards'],
    patterns: ['feature(?:s)?', 'benefit(?:s)?', 'service(?:s)?'],
    commonNames: ['features', 'feature grid', 'services', 'benefits'],
    pageLocation: ['main'],
    confidence: 0.8,
    suggestedVariants: ['default', 'compact', 'expanded'],
    relatedComponents: [ComponentType.FeatureList],
    semanticRole: 'region'
  },
  
  // Content Components
  [ComponentType.TextBlock]: {
    keywords: ['text', 'content', 'paragraph', 'article', 'section'],
    patterns: ['text.*block', 'content.*section', 'article'],
    commonNames: ['text block', 'content section', 'text content'],
    pageLocation: ['main'],
    confidence: 0.7,
    suggestedVariants: ['default', 'minimal'],
    semanticRole: 'article'
  },
  
  // Social Proof Components
  [ComponentType.Testimonials]: {
    keywords: ['testimonial', 'review', 'quote', 'feedback', 'customer'],
    patterns: ['testimonial(?:s)?', 'review(?:s)?', 'customer.*quote'],
    commonNames: ['testimonials', 'customer reviews', 'client feedback'],
    pageLocation: ['main'],
    confidence: 0.85,
    suggestedVariants: ['default', 'compact'],
    relatedComponents: [ComponentType.Reviews],
    semanticRole: 'complementary'
  },
  
  // Contact Components
  [ComponentType.ContactForm]: {
    keywords: ['contact', 'form', 'message', 'inquiry', 'get in touch'],
    patterns: ['contact.*form', 'get.*in.*touch', 'send.*message'],
    commonNames: ['contact form', 'contact us', 'inquiry form'],
    pageLocation: ['main'],
    confidence: 0.9,
    suggestedVariants: ['default', 'expanded'],
    relatedComponents: [ComponentType.ContactInfo],
    semanticRole: 'form',
    accessibility: {
      role: 'form',
      ariaLabel: 'Contact form'
    }
  }
};