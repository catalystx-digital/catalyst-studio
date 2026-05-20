import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { CTABannerDef } from '@/lib/studio/components/cms/cta/cta-banner/cta-banner.def'
import { CTASimpleDef } from '@/lib/studio/components/cms/cta/cta-simple/cta-simple.def'
import { CTAButtonGroupDef } from '@/lib/studio/components/cms/cta/cta-button-group/cta-button-group.def'
import { CTANewsletterDef } from '@/lib/studio/components/cms/cta/cta-newsletter/cta-newsletter.def'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const ctaCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.CTASimple,
    componentType: ComponentType.CTASimple,
    summary: CTASimpleDef.description,
    fragments: ['eyebrow', 'heading', 'supporting-copy', 'primary-button'],
    cues: ['call to action', 'cta block', 'promo banner'],
    sampleContent: {
      eyebrow: 'Ready to move faster?',
      heading: 'See Catalyst Studio in action',
      body: 'Ship new campaigns in days, not weeks. Talk with our team to get a tailored walkthrough.',
      primaryButton: { text: 'Book a demo', url: '/contact', variant: 'default' },
      secondaryButton: { text: 'View pricing', url: '/pricing', variant: 'outline' },
      alignment: 'left',
      backgroundVariant: 'surface'
    }
  },
  {
    canonicalType: ComponentType.CTAWithForm,
    componentType: ComponentType.CTAWithForm,
    summary: CTANewsletterDef.description,
    fragments: ['form-heading', 'input-field', 'submit-button'],
    cues: ['newsletter signup', 'lead capture form', 'cta form'],
    sampleContent: {
      heading: 'Stay in the loop',
      subheading: 'Join our newsletter for product updates and best practices.',
      placeholder: 'Enter your work email',
      buttonText: 'Subscribe',
      successMessage: 'Thanks for subscribing!',
      layout: 'horizontal'
    }
  },
  {
    canonicalType: ComponentType.CTABanner,
    componentType: ComponentType.CTABanner,
    summary: CTABannerDef.description,
    fragments: ['headline', 'supporting-copy', 'primary-button', 'secondary-button'],
    cues: ['cta banner', 'full-width cta', 'promo strip'],
    sampleContent: {
      heading: 'Launch your next experience',
      subheading: 'See how teams ship new campaigns in days, not weeks.',
      primaryButton: { text: 'Start free trial', url: '/signup', variant: 'default' },
      secondaryButton: { text: 'Talk to sales', url: '/contact/sales', variant: 'outline' },
      alignment: 'center',
      fullWidth: true
    }
  },
  {
    canonicalType: ComponentType.CTAButtonGroup,
    componentType: ComponentType.CTAButtonGroup,
    summary: CTAButtonGroupDef.description,
    fragments: ['button-group', 'cta-button'],
    cues: ['button group', 'cta buttons', 'link group'],
    sampleContent: {
      heading: 'Choose your path',
      buttons: [
        { text: 'Schedule a demo', url: '/contact', variant: 'default' },
        { text: 'Explore docs', url: '/docs', variant: 'outline' }
      ],
      alignment: 'center',
      orientation: 'horizontal'
    }
  }
]

export function registerCtaCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of ctaCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}

