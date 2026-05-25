/**
 * Example component definition using extended fields (T-001)
 *
 * This demonstrates how to use the new aliases, processing, and normalization
 * fields in component definitions.
 */

import { defineComponent } from '../component-definition'
import { ComponentType, ComponentCategory } from '../types'
import { z } from 'zod'

/**
 * Example: NavBar with all extended fields
 */
export const NavBarDefExample = defineComponent({
  type: ComponentType.NavBar,
  category: ComponentCategory.Navigation,
  schema: z.object({
    menuItems: z.array(z.object({
      label: z.string(),
      url: z.string()
    })),
    utilityNav: z.array(z.object({
      label: z.string(),
      url: z.string()
    })).optional()
  }),

  // Type aliases for canonicalization
  aliases: [
    'nav', 'navbar', 'nav-bar',
    'navigation', 'navigationbar', 'navigation-menu',
    'menu-bar', 'menubar',
    'top-nav', 'topnav',
    'site-header', 'siteheader',
    'global-header', 'globalheader',
    'header'
  ],

  // Processing rules for post-processor pipeline
  processing: {
    multiRowDetection: {
      enabled: true,
      utilityPatterns: [
        'Login', 'Sign Up', 'Sign In', 'Register',
        'Account', 'Profile', 'Settings',
        'Cart', 'Checkout'
      ]
    }
  }
})

/**
 * Example: Hero component with background promotion
 */
export const HeroDefExample = defineComponent({
  type: ComponentType.HeroSimple,
  category: ComponentCategory.Heroes,
  schema: z.object({
    heading: z.string(),
    subheading: z.string().optional(),
    backgroundImage: z.string().optional()
  }),

  aliases: ['hero', 'hero-section', 'jumbotron'],

  processing: {
    backgroundPromotion: {
      enabled: true,
      domSelectors: [
        '.hero-bg',
        '[data-hero-background]',
        '.hero-section[style*="background"]'
      ]
    }
  }
})

/**
 * Example: CTA with deduplication rules
 */
export const CTADefExample = defineComponent({
  type: ComponentType.CTASimple,
  category: ComponentCategory.CTA,
  schema: z.object({
    heading: z.string(),
    description: z.string().optional(),
    cta: z.object({
      text: z.string(),
      url: z.string()
    })
  }),

  aliases: ['cta', 'call-to-action', 'cta-banner'],

  processing: {
    deduplication: {
      enabled: true,
      deduplicateWith: [ComponentType.TwoColumn, ComponentType.Timeline],
      context: 'adjacent'
    }
  }
})

/**
 * Example: Card Grid
 */
export const CardGridDefExample = defineComponent({
  type: ComponentType.CardGrid,
  category: ComponentCategory.Content,
  schema: z.object({
    items: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      image: z.string().optional()
    }))
  }),

  aliases: ['card-grid', 'cards', 'card-list']
})

/**
 * Example: Component with normalization rules
 */
export const BlogPostDefExample = defineComponent({
  type: ComponentType.BlogPost,
  category: ComponentCategory.Blog,
  schema: z.object({
    heading: z.string(),
    body: z.string(),
    author: z.string().optional()
  }),

  aliases: ['blog-post', 'article', 'post'],

  normalization: {
    enabled: true,
    fieldTransforms: {
      heading: {
        from: 'title',
        to: 'heading',
        transform: 'titleCase'
      },
      body: {
        from: 'content',
        to: 'body',
        transform: 'sanitizeHtml'
      }
    }
  }
})

/**
 * Example: Component with combined fields
 */
export const FullExampleDef = defineComponent({
  type: ComponentType.NavBar,
  category: ComponentCategory.Navigation,
  schema: z.object({
    menuItems: z.array(z.object({
      label: z.string(),
      url: z.string()
    }))
  }),

  // All optional fields used together
  aliases: ['nav', 'navbar', 'navigation'],

  processing: {
    multiRowDetection: {
      enabled: true,
      utilityPatterns: ['Login', 'Sign Up']
    }
  },

  normalization: {
    enabled: true,
    fieldTransforms: {
      items: {
        from: 'menuItems',
        to: 'items',
        transform: 'normalizeMenuItems'
      }
    }
  },

  detection: {
    keywords: ['navigation', 'menu'],
    patterns: ['nav.*bar'],
    pageLocation: ['header']
  }
})
