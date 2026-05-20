import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { synthesizeStoreFeatureList } from './commerce-synthesis'
import { registerCanonicalComponent } from './registry'

let registered = false

export function registerExperienceCanonicalComponents(): void {
  if (registered) {
    return
  }

  registerCanonicalComponent({
    canonicalType: ComponentType.FeatureGrid,
    componentType: ComponentType.FeatureGrid,
    summary: 'Feature highlights arranged in a responsive grid with optional headings.',
    fragments: ['feature-card', 'icon-text', 'supporting-copy'],
    cues: ['feature grid', 'benefit highlights', 'columns of features'],
    sampleContent: {
      heading: 'Why teams choose Catalyst',
      subheading: 'From ideation to launch, we remove friction across the content lifecycle.',
      features: [
        {
          icon: 'sparkles',
          title: 'AI-assisted authoring',
          description: 'Convert briefs into production-ready layouts using guided prompts.'
        },
        {
          icon: 'clock',
          title: 'Faster approvals',
          description: 'Stakeholders review inline with real-time commenting and version history.'
        },
        {
          icon: 'shield-check',
          title: 'Enterprise security',
          description: 'SOC 2 Type II compliant infrastructure and continuous monitoring.'
        }
      ],
      columns: 3
    },
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.FeatureList,
    componentType: ComponentType.FeatureList,
    summary: 'Vertical list of feature callouts with icons and descriptive copy.',
    fragments: ['feature-item', 'icon-list'],
    cues: ['feature list', 'benefit list', 'bulleted features'],
    sampleContent: {
      heading: 'Everything you need to launch faster',
      items: [
        {
          icon: 'bolt',
          title: 'Visual editor',
          description: 'Design responsive layouts with drag-and-drop precision.'
        },
        {
          icon: 'globe',
          title: 'Localization ready',
          description: 'Translate content to 25+ languages with built-in workflows.'
        }
      ],
      layout: 'vertical'
    },
    synthesizer: synthesizeStoreFeatureList
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.FeatureComparison,
    componentType: ComponentType.FeatureComparison,
    summary: 'Matrix comparing plans or products across structured capabilities.',
    fragments: ['comparison-table', 'plan-column'],
    cues: ['comparison table', 'plan matrix', 'feature comparison'],
    sampleContent: {
      heading: 'Compare plans',
      products: [
        { name: 'Starter', price: '$29/mo' },
        { name: 'Growth', price: '$79/mo', recommended: true, cta: { text: 'Choose Growth', url: '/pricing/growth' } },
        { name: 'Enterprise', price: 'Contact us' }
      ],
      features: [
        { name: 'Unlimited pages', values: [true, true, true] },
        { name: 'Custom domains', values: [false, true, true] },
        { name: 'Advanced analytics', values: [false, true, true] }
      ]
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.CardGrid,
    componentType: ComponentType.CardGrid,
    summary: 'Grid of cards for features, case studies, or resources.',
    fragments: ['card', 'image', 'card-cta'],
    cues: ['cards', 'tile grid', 'resource cards'],
    sampleContent: {
      heading: 'Customer stories',
      cards: [
        {
          id: 'everlake',
          title: 'Everlake improves conversions by 28%',
          description: 'Insurance provider rebuilt their digital quote flow in under six weeks.',
          image: 'https://cdn.example.com/case-studies/everlake.jpg',
          link: '/customers/everlake',
          metadata: { industry: 'Insurance' }
        },
        {
          id: 'zenware',
          title: 'Zenware launches 12 microsites in one quarter',
          description: 'Integrated product marketing pipeline with automated QA gates.',
          link: '/customers/zenware',
          metadata: { industry: 'SaaS' }
        }
      ],
      columns: 2
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.Testimonials,
    componentType: ComponentType.Testimonials,
    summary: 'Carousel or grid of customer testimonials with author metadata.',
    fragments: ['testimonial-quote', 'author-card'],
    cues: ['testimonial', 'customer quote', 'social proof'],
    sampleContent: {
      testimonials: [
        {
          id: 'alicia-m',
          quote: 'Catalyst cut our launch cycle from weeks to days?our marketing team finally iterates at the pace of ideas.',
          author: 'Alicia Mendoza',
          role: 'VP Marketing, LumaSoft',
          avatar: 'https://cdn.example.com/avatars/alicia.jpg'
        },
        {
          id: 'sam-r',
          quote: 'The built-in approval workflows eliminated endless review threads and screenshots.',
          author: 'Sam Reid',
          role: 'Digital Director, Northwind Retail'
        }
      ],
      showNavigation: true
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.LogoCloud,
    componentType: ComponentType.LogoCloud,
    summary: 'Logo strip showcasing notable customers or partners.',
    fragments: ['logo-strip'],
    cues: ['logo strip', 'customer logos', 'trusted by'],
    sampleContent: {
      heading: 'Trusted by experience-driven teams',
      logos: [
        { id: 'acme', src: 'https://cdn.example.com/logos/acme.svg', alt: 'Acme' },
        { id: 'northwind', src: 'https://cdn.example.com/logos/northwind.svg', alt: 'Northwind' },
        { id: 'globex', src: 'https://cdn.example.com/logos/globex.svg', alt: 'Globex' },
        { id: 'initech', src: 'https://cdn.example.com/logos/initech.svg', alt: 'Initech' }
      ]
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.Reviews,
    componentType: ComponentType.Reviews,
    summary: 'Collection of short-form customer reviews with ratings.',
    fragments: ['review-card', 'star-rating'],
    cues: ['reviews', 'star rating', 'customer feedback'],
    sampleContent: {
      heading: '4.8 rating across 250+ reviews',
      reviews: [
        {
          id: 'review-1',
          rating: 5,
          reviewText: 'Intuitive interface and fast publishing keeps our editors happy.',
          author: 'Priya S.',
          date: '2024-04-12'
        },
        {
          id: 'review-2',
          rating: 4,
          reviewText: 'Analytics integration gave leadership the visibility they needed.',
          author: 'Dylan K.',
          date: '2024-03-04'
        }
      ]
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.PricingTable,
    componentType: ComponentType.PricingTable,
    summary: 'Pricing matrix comparing subscription plans with feature availability.',
    fragments: ['pricing-plan', 'plan-comparison'],
    cues: ['pricing table', 'plans and pricing', 'tier comparison'],
    sampleContent: {
      title: 'Choose the plan that fits',
      subtitle: 'Flexible pricing for teams of any size.',
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          description: 'Launch a marketing site in days.',
          price: 29,
          currency: 'USD',
          period: 'monthly',
          features: ['5 published pages', 'Basic analytics'],
          ctaText: 'Start Starter',
          ctaUrl: '/signup/starter'
        },
        {
          id: 'growth',
          name: 'Growth',
          description: 'Collaborative workflows for growing teams.',
          price: 79,
          currency: 'USD',
          period: 'monthly',
          features: ['Unlimited pages', 'Advanced roles'],
          highlighted: true,
          ctaText: 'Start Growth',
          ctaUrl: '/signup/growth'
        }
      ],
      features: [
        { name: 'Unlimited editors', values: [false, true] },
        { name: 'Custom integrations', values: [false, true] }
      ],
      showComparison: true
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.PricingCard,
    componentType: ComponentType.PricingCard,
    summary: 'Standalone pricing option card with feature checklist.',
    fragments: ['pricing-card', 'feature-checklist'],
    cues: ['pricing card', 'subscription card'],
    sampleContent: {
      name: 'Enterprise',
      description: 'Dedicated support and governance.',
      price: 199,
      currency: 'USD',
      period: 'monthly',
      features: [
        { text: 'Unlimited workspaces', included: true },
        { text: 'SAML SSO', included: true },
        { text: 'Onboarding concierge', included: true }
      ],
      ctaText: 'Talk to sales',
      ctaUrl: '/contact/sales',
      badge: 'Most Flexible',
      highlighted: true
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.Accordion,
    componentType: ComponentType.Accordion,
    summary: 'Expandable FAQ or detail list with accessible toggles.',
    fragments: ['accordion-item'],
    cues: ['faq', 'expandable section', 'accordion'],
    sampleContent: {
      heading: 'Frequently asked questions',
      items: [
        {
          id: 'faq-implementation',
          title: 'How long does implementation take?',
          content: 'Most teams launch their first production experience within two weeks.'
        },
        {
          id: 'faq-security',
          title: 'What security certifications do you hold?',
          content: 'We maintain SOC 2 Type II and regularly complete enterprise vendor assessments.'
        }
      ],
      allowMultiple: false
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.Tabs,
    componentType: ComponentType.Tabs,
    summary: 'Tabbed interface organizing content into switchable panels.',
    fragments: ['tab-list', 'tab-panel'],
    cues: ['tabs', 'tabbed content'],
    sampleContent: {
      heading: 'Platform capabilities',
      tabs: [
        {
          id: 'creation',
          label: 'Create',
          content: 'Generate responsive layouts with AI-assisted starter content.'
        },
        {
          id: 'collaborate',
          label: 'Collaborate',
          content: 'Comment, assign tasks, and capture approvals in context.'
        }
      ],
      defaultTab: 'creation'
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.DataTable,
    componentType: ComponentType.DataTable,
    summary: 'Structured table with sortable columns for specifications or metrics.',
    fragments: ['table-header', 'table-row'],
    cues: ['data table', 'spec sheet', 'feature matrix'],
    sampleContent: {
      title: 'Technical specifications',
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' }
      ],
      rows: [
        { id: 'storage', metric: 'Storage', value: '2 TB SSD' },
        { id: 'bandwidth', metric: 'Bandwidth', value: 'Unlimited' }
      ],
      pagination: { enabled: false },
      sorting: { enabled: false }
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.FeatureShowcase,
    componentType: ComponentType.FeatureShowcase,
    summary: 'Interactive showcase with alternating media and narrative sections.',
    fragments: ['showcase-section', 'media', 'feature-list', 'cta-button'],
    cues: ['feature showcase', 'product walkthrough', 'interactive sections'],
    sampleContent: {
      heading: 'Experience the modular workflow',
      subheading: 'Guide prospects through highlights with storytelling sections.',
      sections: [
        {
          image: {
            src: 'https://cdn.example.com/showcase/editor-collaboration.jpg',
            alt: 'Cross-functional team collaborating in the editor'
          },
          title: 'Collaborate in real time',
          description: 'Invite stakeholders to comment inline and approve changes instantly.',
          features: [
            { icon: 'message-circle', text: 'Commenting and approvals' },
            { icon: 'shield-check', text: 'Role-based guardrails' }
          ],
          cta: { text: 'See collaboration tools', url: '/platform/collaboration' },
          imagePosition: 'right'
        },
        {
          image: {
            src: 'https://cdn.example.com/showcase/publishing-automation.jpg',
            alt: 'Automated publishing pipeline'
          },
          title: 'Automate publishing',
          description: 'Automate QA, localization, and approvals before every launch.',
          features: [
            { icon: 'bolt', text: 'Workflow automation' },
            { icon: 'globe', text: 'Localization at scale' }
          ],
          imagePosition: 'left'
        }
      ]
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.PricingComparison,
    componentType: ComponentType.PricingComparison,
    summary: 'Side-by-side pricing comparison summarizing plan tiers and capabilities.',
    fragments: ['comparison-summary', 'plan-column', 'feature-row'],
    cues: ['pricing comparison', 'plan matrix', 'tiered pricing'],
    sampleContent: {
      heading: 'Compare plans',
      description: 'Choose the plan that matches your team size and governance needs.',
      plans: [
        { name: 'Starter', price: '', unit: 'per month', highlighted: false, cta: { text: 'Start Starter', url: '/signup/starter' } },
        { name: 'Growth', price: '', unit: 'per month', highlighted: true, badge: 'Most popular', cta: { text: 'Choose Growth', url: '/signup/growth' } },
        { name: 'Enterprise', price: 'Contact us', unit: '', highlighted: false, cta: { text: 'Talk to sales', url: '/contact/sales' } }
      ],
      features: [
        { name: 'Unlimited published pages', values: ['?', '?', '?'] },
        { name: 'Custom workflows', values: ['?', '?', '?'] },
        { name: 'Dedicated success manager', values: ['?', '?', '?'] }
      ]
    }
  })

  registerCanonicalComponent({
    canonicalType: ComponentType.CaseStudy,
    componentType: ComponentType.CaseStudy,
    summary: 'Customer success spotlight with metrics, narrative, and testimonial.',
    fragments: ['customer-logo', 'impact-metric', 'testimonial'],
    cues: ['case study', 'customer story', 'success story'],
    sampleContent: {
      customer: 'Everlake Insurance',
      logo: 'https://cdn.example.com/customers/everlake.svg',
      headline: 'Everlake accelerated launches by 4x',
      excerpt: 'The marketing team rebuilt twelve microsites with Catalyst guardrails in under two months.',
      metrics: [
        { label: 'Launch velocity', value: '4x faster' },
        { label: 'Conversion lift', value: '+28%' }
      ],
      testimonial: {
        quote: 'Catalyst Studio let us operationalize fast experiments without sacrificing governance.',
        author: 'Amelia Rogers',
        title: 'Director of Digital Experience'
      },
      cta: { text: 'Read the full story', url: '/customers/everlake' }
    }
  })

  registered = true
}




