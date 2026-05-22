import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const ctaCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.CTASimple,
    componentType: ComponentType.CTASimple,
    summary: 'Simple call-to-action block with heading, supporting copy, and primary or secondary buttons.',
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
    summary: 'Call-to-action form for newsletter signup, lead capture, or access requests.',
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
    summary: 'Full-width call-to-action banner with headline, supporting copy, and action buttons.',
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
    summary: 'Button group section for multiple related calls to action or navigation choices.',
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
