import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const heroCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.HeroWithImage,
    componentType: ComponentType.HeroWithImage,
    summary: 'Hero section pairing narrative copy with a prominent supporting image.',
    fragments: ['hero-heading', 'hero-subheading', 'hero-image', 'cta-button'],
    cues: ['hero image', 'above the fold', 'marketing hero'],
    sampleContent: {
      heading: 'Transform Your Digital Experiences',
      subheading: 'Design, launch, and iterate omnichannel sites in minutes.',
      body: 'Catalyst Studio unifies content, design, and AI workflows so your team ships faster.',
      image: {
        src: 'https://cdn.example.com/hero/scene.jpg',
        alt: 'Team collaborating on a product launch'
      },
      ctaButtons: [
        { label: 'Book a Demo', href: '/contact', variant: 'default' },
        { label: 'View Pricing', href: '/pricing', variant: 'outline' }
      ]
    }
  },
  {
    canonicalType: ComponentType.HeroSplit,
    componentType: ComponentType.HeroSplit,
    summary: 'Split layout hero balancing narrative copy with media on either side.',
    fragments: ['hero-heading', 'hero-media', 'cta-button'],
    cues: ['split hero', 'two-column hero', 'product spotlight'],
    sampleContent: {
      heading: 'Meet the Ridge Carbon Wallet',
      subheading: 'Durable essentials engineered for everyday carry.',
      body: 'Carbon fiber panels keep cards secure while the RFID-blocking design protects your identity.',
      media: {
        type: 'image',
        src: 'https://cdn.example.com/products/ridge-wallet.jpg',
        alt: 'Carbon wallet resting on desk accessories'
      },
      mediaPosition: 'right',
      ctaButtons: [
        { label: 'Shop Now', href: '/products/ridge-carbon', variant: 'default' },
        { label: 'Compare Wallets', href: '/products#compare', variant: 'outline' }
      ]
    }
  },
  {
    canonicalType: ComponentType.HeroCarousel,
    componentType: ComponentType.HeroCarousel,
    summary: 'Carousel hero rotating featured stories or promotions.',
    fragments: ['hero-slide', 'carousel-controls'],
    cues: ['carousel', 'rotating hero', 'slideshow'],
    sampleContent: {
      slides: [
        {
          heading: 'Spring Collection Drop',
          subheading: 'Limited-edition styles inspired by city skylines.',
          image: {
            src: 'https://cdn.example.com/hero/spring-drop.jpg',
            alt: 'Model wearing spring fashion'
          },
          cta: { label: 'Explore Collection', href: '/collections/spring' }
        },
        {
          heading: 'Members Save 20%',
          subheading: 'Unlock early access and exclusive drops.',
          image: {
            src: 'https://cdn.example.com/hero/members.jpg',
            alt: 'Close-up of loyalty card'
          },
          cta: { label: 'Join Loyalty', href: '/loyalty' }
        }
      ],
      autoplay: true,
      intervalMs: 6000
    }
  },
  {
    canonicalType: ComponentType.HeroVideo,
    componentType: ComponentType.HeroVideo,
    summary: 'Hero block featuring autoplay or lightboxed marketing video.',
    fragments: ['hero-heading', 'video-embed', 'cta-button'],
    cues: ['hero video', 'product demo', 'autoplay hero'],
    sampleContent: {
      heading: 'See Catalyst Studio in Motion',
      subheading: 'Two-minute walkthrough of the collaborative editing workflow.',
      body: 'Watch product teams and marketers co-create pages and launch updates without developer bottlenecks.',
      video: {
        url: 'https://videos.example.com/catalyst-demo.mp4',
        poster: 'https://cdn.example.com/video/poster.jpg',
        autoplay: false
      },
      ctaButtons: [{ label: 'Start Free Trial', href: '/signup', variant: 'default' }]
    }
  },
  {
    canonicalType: ComponentType.HeroBanner,
    componentType: ComponentType.HeroBanner,
    summary: 'Fullscreen banner hero with headline, subcopy, and background media.',
    fragments: ['hero-heading', 'background-image', 'cta-button'],
    cues: ['hero banner', 'full-bleed hero'],
    sampleContent: {
      heading: 'Launch with confidence',
      subheading: 'Give every team the guardrails they need to ship on-brand experiences.',
      body: 'Secure, composable infrastructure with prebuilt workflows for governance.',
      backgroundImage: 'https://cdn.example.com/hero/banner-bg.jpg',
      ctaButtons: [
        { label: 'Request Access', href: '/request-access', variant: 'default' }
      ]
    }
  },
  {
    canonicalType: ComponentType.HeroSimple,
    componentType: ComponentType.HeroSimple,
    summary: 'Compact hero with headline, subcopy, and primary action.',
    fragments: ['hero-heading', 'supporting-copy', 'cta-button'],
    cues: ['simple hero', 'compact hero', 'landing hero'],
    sampleContent: {
      heading: 'Ship pages in minutes',
      subheading: 'Use our AI-assisted editor to launch campaigns faster with built-in guardrails.',
      body: 'Catalyst Studio pairs structured components with best-practice templates so every team can move quickly.',
      ctaButtons: [
        { label: 'Start building', href: '/signup', variant: 'default' }
      ]
    }
  },
  {
    canonicalType: ComponentType.HeroMinimal,
    componentType: ComponentType.HeroMinimal,
    summary: 'Minimal hero with understated typography and optional supporting links.',
    fragments: ['hero-heading', 'supporting-copy', 'link-group'],
    cues: ['minimal hero', 'headline strip', 'lightweight hero'],
    sampleContent: {
      eyebrow: 'Product update',
      heading: 'Catalyst 3.0 is here',
      subheading: 'New modular APIs and guardrails for global teams.',
      supportingLinks: [
        { label: 'View release notes', href: '/release-notes' },
        { label: 'Join the webinar', href: '/events/launch-webinar' }
      ]
    }
  }
]

export function registerHeroCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of heroCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}

