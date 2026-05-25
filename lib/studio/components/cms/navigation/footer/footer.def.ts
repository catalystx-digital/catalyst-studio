/**
 * Footer Component Definition
 *
 * Site footer with navigation columns, branding, legal links, social icons, and optional newsletter signup.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { SocialLinkSchema, MenuItemSchema, LogoSchema, FooterColumnSchema, FooterNewsletterSchema } from '../../_core/value-objects'

/**
 * Footer component definition
 */
export const FooterDef = defineComponent({
  type: ComponentType.Footer,
  category: ComponentCategory.Navigation,

  // Aliases for component type resolution
  aliases: [
    'site-footer',
    'sitefooter',
    'global-footer',
    'globalfooter',
    'footer-menu',
    'footermenu',
  ],

  // Zod schema (single source of truth for props)
  schema: z.object({
    columns: z.array(FooterColumnSchema).optional().describe('Structured navigation columns displayed in the footer'),
    logo: LogoSchema.optional().describe('Logo configuration including image source, alt text, and optional fallback text'),
    description: z.string().optional().describe('Supporting copy or tagline shown near the logo'),
    socialLinks: z.array(SocialLinkSchema).optional().describe('Social media links rendered via platform icons'),
    legalLinks: z.array(MenuItemSchema).optional().describe('Secondary legal or policy links shown at the bottom'),
    newsletter: FooterNewsletterSchema.optional().describe('Newsletter signup form content displayed in the footer'),
    copyright: z.string().optional().describe('Copyright message displayed beneath the footer content'),
    backgroundColor: z.string().optional().describe('Custom background color value applied to the footer'),
    textColor: z.string().optional().describe('Custom text color value applied to footer content'),
  }),

  // Detection metadata
  detection: {
    keywords: ['footer', 'site footer', 'bottom', 'copyright', 'links', 'sitemap', 'legal'],
    patterns: [
      'footer',
      'site.*footer',
      'copyright',
      'legal.*links',
      'social.*links',
    ],
    commonNames: ['footer', 'site footer', 'page footer', 'bottom navigation'],
    pageLocation: ['footer'],
    confidence: 0.95,
    suggestedVariants: ['default', 'minimal', 'expanded'],
    industry: ['general'],
    semanticRole: 'contentinfo',
    accessibility: {
      role: 'contentinfo',
      ariaLabel: 'Site footer',
    },
  },

  // LLM extraction directives
  directives: [
    'Data requirements: Populate columns[] with one object for each visible footer column. For every column, include title (if displayed) and links[] populated with MenuItem objects using label, structured href, external flag, and nested children when present.',
    'Populate socialLinks[] with SocialLink objects including platform, url, and label. Populate legalLinks[] with MenuItem objects using structured href—never leave these arrays empty when links are visible.',
    'Capture newsletter heading/description/placeholder/buttonText, logo/logoAlt, description, and copyright when rendered. Omit deprecated summary-only fields.',
    'Mapping guidance: iterate each footer column and capture every anchor/link under it as MenuItem entries (label=textContent, href=SmartLink object, external=true when target="_blank" or absolute external domains). Social icon anchors map to SocialLink objects with platform inferred from class/icon and label text. Legal footer nav anchors map to legalLinks[].',
    'Logo must use the Logo shape: logo.src is a MediaReference object with mediaId, mediaType="image", and url. Relative paths like "/themes/logo.svg" must be resolved to https://... before returning.',
    'Every footer link/social/legal item must include an explicit external boolean where the schema supports it (false for same-domain links, true for off-site or target="_blank"). Missing structured href/external flags require re-fetching the footer before finalizing—do NOT rely on importer fallbacks.',
    'If any footer links/social/legal arrays are empty, fetch the footer section and re-extract before returning.',
    '*** footer column directives: ***',
    'Data requirements: Always enumerate links[] with MenuItem objects (label/href/description/icon/children/groups/external/panelOffset/panelWidth/panelAlign) when the column displays navigation. Returning a column without its links is incorrect.',
    'Do not emit type or id on footer columns or links; those fields are not in the FooterColumn or MenuItem contracts.',
    'Ensure link ordering matches the visual order in the column. Include nested child menu items in children[].',
    'Mapping guidance: capture every <a> tag inside the column in order, converting to MenuItem with label=textContent, href=SmartLink object, external based on target or absolute URL. Nest subordinate <ul>/<li> anchors inside children[].',
    '*** social link directives: ***',
    'Data requirements: Include platform, url, and label (if present). platform must be one of the lowercase enum values: facebook, twitter, linkedin, instagram, youtube, github, website. Convert labels like "LinkedIn" to platform: "linkedin"; preserve the display text in label.',
    'Do not emit id or type on social links; SocialLink supports platform, url, icon, and label only.',
    'Ensure URLs are verbatim, including https and query parameters.',
    'Mapping guidance: infer platform from icon classes or aria-label (e.g., facebook, instagram). Use anchor text or aria-label as label when provided.',
  ],

  // Sample content for AI tools and testing
  sample: {
    logo: {
      src: { mediaId: 'sample-footer-logo', mediaType: 'image', url: '/logo.svg' },
      alt: 'Company Logo',
      originalUrl: '/logo.svg',
    },
    description: 'Building the future of digital experiences',
    columns: [
      {
        title: 'Products',
        links: [
          { label: 'Features', href: { type: 'internal', pageId: 'features', path: '/features' } },
          { label: 'Pricing', href: { type: 'internal', pageId: 'pricing', path: '/pricing' } },
          { label: 'Security', href: { type: 'internal', pageId: 'security', path: '/security' } },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: { type: 'internal', pageId: 'about', path: '/about' } },
          { label: 'Blog', href: { type: 'internal', pageId: 'blog', path: '/blog' } },
          { label: 'Careers', href: { type: 'internal', pageId: 'careers', path: '/careers' } },
        ],
      },
    ],
    socialLinks: [
      { platform: 'twitter', url: 'https://twitter.com/company' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/company' },
      { platform: 'github', url: 'https://github.com/company' },
    ],
    legalLinks: [
      { label: 'Privacy Policy', href: { type: 'internal', pageId: 'privacy', path: '/privacy' } },
      { label: 'Terms of Service', href: { type: 'internal', pageId: 'terms', path: '/terms' } },
    ],
    newsletter: {
      heading: 'Subscribe to our newsletter',
      description: 'Get the latest updates delivered to your inbox',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
    },
    copyright: '© 2024 Company Name. All rights reserved.',
  },

  // Human-readable description
  description: 'Site footer with navigation columns, branding, legal links, social icons, and optional newsletter signup.',
})

// Export inferred TypeScript type
export type FooterContent = z.infer<typeof FooterDef.schema>
