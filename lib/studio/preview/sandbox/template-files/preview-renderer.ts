/**
 * Preview Renderer Template for Sandbox
 *
 * Simplified component renderer that covers the most common CMS component types.
 * Each component is self-contained with inline Tailwind styles.
 */

export const previewRendererTemplate = `
'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface ComponentConfig {
  type: string
  props: Record<string, unknown>
}

interface PreviewRendererProps {
  components: ComponentConfig[]
}

// ============================================================================
// NAVIGATION COMPONENTS
// ============================================================================

function NavBar({ props }: { props: Record<string, unknown> }) {
  const logo = props.logo as { src?: string; alt?: string; text?: string } | undefined
  const menuItems = (props.menuItems || props.navItems || props.links || []) as Array<{ label?: string; text?: string; href?: string; url?: string }>
  const cta = props.cta as { label?: string; text?: string; href?: string; url?: string } | undefined

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logo?.src && (
            <Image src={logo.src} alt={logo.alt || 'Logo'} width={120} height={40} className="h-10 w-auto" />
          )}
          {logo?.text && <span className="text-xl font-bold">{logo.text}</span>}
          {!logo?.src && !logo?.text && <span className="text-xl font-bold">Logo</span>}
        </div>
        <div className="hidden md:flex items-center gap-6">
          {menuItems.map((item, i) => (
            <Link key={i} href={item.href || item.url || '#'} className="text-muted-foreground hover:text-foreground transition-colors">
              {item.label || item.text || 'Link'}
            </Link>
          ))}
        </div>
        {cta && (
          <Link href={cta.href || cta.url || '#'} className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {cta.label || cta.text || 'Get Started'}
          </Link>
        )}
      </div>
    </nav>
  )
}

function Footer({ props }: { props: Record<string, unknown> }) {
  const logo = props.logo as { src?: string; text?: string } | undefined
  const columns = (props.columns || props.links || []) as Array<{ title?: string; links?: Array<{ label?: string; text?: string; href?: string }> }>
  const copyright = (props.copyright || props.copyrightText || \`© \${new Date().getFullYear()} All rights reserved.\`) as string
  const socialLinks = (props.socialLinks || []) as Array<{ platform?: string; url?: string; icon?: string }>

  return (
    <footer className="bg-muted/30 border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            {logo?.src ? (
              <Image src={logo.src} alt="Logo" width={120} height={40} className="h-10 w-auto mb-4" />
            ) : (
              <span className="text-xl font-bold">{logo?.text || 'Company'}</span>
            )}
          </div>
          {columns.map((col, i) => (
            <div key={i}>
              <h4 className="font-semibold mb-4">{col.title || 'Links'}</h4>
              <ul className="space-y-2">
                {col.links?.map((link, j) => (
                  <li key={j}>
                    <Link href={link.href || '#'} className="text-muted-foreground hover:text-foreground transition-colors">
                      {link.label || link.text || 'Link'}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center mt-8 pt-8 border-t border-border">
          <p className="text-muted-foreground text-sm">{copyright}</p>
          {socialLinks.length > 0 && (
            <div className="flex gap-4 mt-4 md:mt-0">
              {socialLinks.map((social, i) => (
                <Link key={i} href={social.url || '#'} className="text-muted-foreground hover:text-foreground">
                  {social.platform || 'Social'}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

// ============================================================================
// HERO COMPONENTS
// ============================================================================

function HeroSimple({ props }: { props: Record<string, unknown> }) {
  const headline = (props.headline || props.title || 'Welcome') as string
  const subheadline = (props.subheadline || props.subtitle || props.description || '') as string
  const cta = props.cta as { label?: string; text?: string; href?: string } | undefined
  const backgroundImage = (props.backgroundImage || props.image) as { src?: string } | string | undefined
  const bgSrc = typeof backgroundImage === 'string' ? backgroundImage : backgroundImage?.src

  return (
    <section className="relative min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      {bgSrc && (
        <Image src={bgSrc} alt="" fill className="object-cover opacity-20" />
      )}
      <div className="container mx-auto px-4 py-20 text-center relative z-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">{headline}</h1>
        {subheadline && <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">{subheadline}</p>}
        {cta && (
          <Link href={cta.href || '#'} className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-md text-lg hover:bg-primary/90 transition-colors">
            {cta.label || cta.text || 'Learn More'}
          </Link>
        )}
      </div>
    </section>
  )
}

function HeroBanner({ props }: { props: Record<string, unknown> }) {
  return <HeroSimple props={props} />
}

function HeroWithImage({ props }: { props: Record<string, unknown> }) {
  const headline = (props.headline || props.title || 'Welcome') as string
  const subheadline = (props.subheadline || props.subtitle || '') as string
  const image = (props.image || props.heroImage) as { src?: string; alt?: string } | string | undefined
  const imageSrc = typeof image === 'string' ? image : image?.src
  const cta = props.cta as { label?: string; href?: string } | undefined

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">{headline}</h1>
            {subheadline && <p className="text-xl text-muted-foreground mb-8">{subheadline}</p>}
            {cta && (
              <Link href={cta.href || '#'} className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-md hover:bg-primary/90">
                {cta.label || 'Get Started'}
              </Link>
            )}
          </div>
          {imageSrc && (
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <Image src={imageSrc} alt={(typeof image !== 'string' && image?.alt) || ''} fill className="object-cover" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// CONTENT COMPONENTS
// ============================================================================

function TextBlock({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || props.heading || '') as string
  const content = (props.content || props.text || props.body || '') as string

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        {title && <h2 className="text-3xl font-bold mb-6">{title}</h2>}
        <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </section>
  )
}

function TwoColumn({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || '') as string
  const leftContent = (props.leftContent || props.left || '') as string
  const rightContent = (props.rightContent || props.right || '') as string
  const image = (props.image) as { src?: string } | string | undefined
  const imageSrc = typeof image === 'string' ? image : image?.src

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto px-4">
        {title && <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: leftContent || '' }} />
          {imageSrc ? (
            <div className="relative aspect-video rounded-lg overflow-hidden">
              <Image src={imageSrc} alt="" fill className="object-cover" />
            </div>
          ) : (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: rightContent || '' }} />
          )}
        </div>
      </div>
    </section>
  )
}

function CardGrid({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || props.heading || '') as string
  const cards = (props.cards || props.items || []) as Array<{
    title?: string
    description?: string
    image?: { src?: string } | string
    link?: { href?: string; label?: string }
  }>

  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        {title && <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>}
        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card, i) => {
            const imgSrc = typeof card.image === 'string' ? card.image : card.image?.src
            return (
              <div key={i} className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
                {imgSrc && (
                  <div className="relative aspect-video">
                    <Image src={imgSrc} alt={card.title || ''} fill className="object-cover" />
                  </div>
                )}
                <div className="p-6">
                  {card.title && <h3 className="text-xl font-semibold mb-2">{card.title}</h3>}
                  {card.description && <p className="text-muted-foreground">{card.description}</p>}
                  {card.link && (
                    <Link href={card.link.href || '#'} className="text-primary hover:underline mt-4 inline-block">
                      {card.link.label || 'Learn more'} →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FeatureGrid({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || '') as string
  const subtitle = (props.subtitle || '') as string
  const features = (props.features || props.items || []) as Array<{
    title?: string
    description?: string
    icon?: string
  }>

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto px-4">
        {title && <h2 className="text-3xl font-bold mb-4 text-center">{title}</h2>}
        {subtitle && <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">{subtitle}</p>}
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="text-center p-6">
              {feature.icon && <div className="text-4xl mb-4">{feature.icon}</div>}
              {feature.title && <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>}
              {feature.description && <p className="text-muted-foreground">{feature.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// CTA COMPONENTS
// ============================================================================

function CTASimple({ props }: { props: Record<string, unknown> }) {
  const headline = (props.headline || props.title || 'Ready to get started?') as string
  const subheadline = (props.subheadline || props.description || '') as string
  const cta = props.cta as { label?: string; text?: string; href?: string } | undefined

  return (
    <section className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">{headline}</h2>
        {subheadline && <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">{subheadline}</p>}
        {cta && (
          <Link href={cta.href || '#'} className="inline-block bg-background text-foreground px-8 py-3 rounded-md hover:bg-background/90 transition-colors">
            {cta.label || cta.text || 'Get Started'}
          </Link>
        )}
      </div>
    </section>
  )
}

function CTABanner({ props }: { props: Record<string, unknown> }) {
  return <CTASimple props={props} />
}

// ============================================================================
// TESTIMONIAL & SOCIAL PROOF
// ============================================================================

function Testimonials({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || 'What our customers say') as string
  const testimonials = (props.testimonials || props.items || []) as Array<{
    quote?: string
    text?: string
    author?: string
    name?: string
    role?: string
    company?: string
    avatar?: { src?: string } | string
  }>

  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => {
            const avatarSrc = typeof t.avatar === 'string' ? t.avatar : t.avatar?.src
            return (
              <div key={i} className="bg-card p-6 rounded-lg shadow-sm border border-border">
                <p className="text-muted-foreground mb-4 italic">"{t.quote || t.text}"</p>
                <div className="flex items-center gap-3">
                  {avatarSrc && (
                    <Image src={avatarSrc} alt={t.author || t.name || ''} width={40} height={40} className="rounded-full" />
                  )}
                  <div>
                    <p className="font-semibold">{t.author || t.name}</p>
                    {(t.role || t.company) && (
                      <p className="text-sm text-muted-foreground">{t.role}{t.company ? \`, \${t.company}\` : ''}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// PRICING
// ============================================================================

function PricingTable({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || 'Pricing') as string
  const plans = (props.plans || props.tiers || props.items || []) as Array<{
    name?: string
    price?: string
    period?: string
    description?: string
    features?: string[]
    cta?: { label?: string; href?: string }
    featured?: boolean
  }>

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div key={i} className={\`bg-card p-8 rounded-lg border-2 \${plan.featured ? 'border-primary' : 'border-border'}\`}>
              {plan.name && <h3 className="text-xl font-bold mb-2">{plan.name}</h3>}
              {plan.price && (
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">/{plan.period}</span>}
                </div>
              )}
              {plan.description && <p className="text-muted-foreground mb-6">{plan.description}</p>}
              {plan.features && (
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <span className="text-primary">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              {plan.cta && (
                <Link href={plan.cta.href || '#'} className={\`block text-center py-2 rounded-md \${plan.featured ? 'bg-primary text-primary-foreground' : 'bg-muted'}\`}>
                  {plan.cta.label || 'Choose Plan'}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// CONTACT
// ============================================================================

function ContactForm({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || 'Contact Us') as string
  const description = (props.description || '') as string

  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <h2 className="text-3xl font-bold mb-4 text-center">{title}</h2>
        {description && <p className="text-muted-foreground text-center mb-8">{description}</p>}
        <form className="space-y-6 bg-card p-8 rounded-lg shadow-sm border border-border">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input type="text" className="w-full px-4 py-2 rounded-md border border-border bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input type="email" className="w-full px-4 py-2 rounded-md border border-border bg-background" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea rows={4} className="w-full px-4 py-2 rounded-md border border-border bg-background" />
          </div>
          <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 transition-colors">
            Send Message
          </button>
        </form>
      </div>
    </section>
  )
}

// ============================================================================
// FAQ
// ============================================================================

function FAQ({ props }: { props: Record<string, unknown> }) {
  const title = (props.title || 'Frequently Asked Questions') as string
  const items = (props.items || props.questions || props.faqs || []) as Array<{
    question?: string
    answer?: string
  }>

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl font-bold mb-12 text-center">{title}</h2>
        <div className="space-y-4">
          {items.map((item, i) => (
            <details key={i} className="group bg-card rounded-lg border border-border">
              <summary className="flex justify-between items-center cursor-pointer p-6 font-medium">
                {item.question}
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="px-6 pb-6 text-muted-foreground">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// FALLBACK COMPONENT
// ============================================================================

function FallbackComponent({ type, props }: { type: string; props: Record<string, unknown> }) {
  return (
    <section className="bg-muted/20 py-8 border-y border-dashed border-border">
      <div className="container mx-auto px-4">
        <div className="text-center text-muted-foreground">
          <p className="text-sm uppercase tracking-wider mb-2">Component Preview</p>
          <p className="font-mono text-lg">{type}</p>
          {Object.keys(props).length > 0 && (
            <details className="mt-4 text-left max-w-2xl mx-auto">
              <summary className="cursor-pointer text-sm">View props</summary>
              <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(props, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

// ============================================================================
// COMPONENT MAP & RENDERER
// ============================================================================

const componentMap: Record<string, React.ComponentType<{ props: Record<string, unknown> }>> = {
  // Navigation
  'nav-bar': NavBar,
  'navbar': NavBar,
  'navigation': NavBar,
  'header': NavBar,
  'footer': Footer,

  // Heroes
  'hero-simple': HeroSimple,
  'hero-banner': HeroBanner,
  'hero-with-image': HeroWithImage,
  'hero-split': HeroWithImage,
  'hero-carousel': HeroWithImage,
  'hero-video': HeroWithImage,
  'hero-minimal': HeroSimple,
  'hero': HeroSimple,

  // Content
  'text-block': TextBlock,
  'text': TextBlock,
  'content': TextBlock,
  'rich-text': TextBlock,
  'two-column': TwoColumn,
  'two-column-section': TwoColumn,
  'card-grid': CardGrid,
  'cards': CardGrid,
  'content-feed': CardGrid,
  'blog-list': CardGrid,
  'feature-grid': FeatureGrid,
  'features': FeatureGrid,
  'feature-list': FeatureGrid,
  'feature-showcase': FeatureGrid,

  // CTA
  'cta-simple': CTASimple,
  'cta-banner': CTABanner,
  'cta': CTASimple,
  'call-to-action': CTASimple,

  // Social Proof
  'testimonials': Testimonials,
  'testimonial-grid': Testimonials,
  'reviews': Testimonials,

  // Pricing
  'pricing-table': PricingTable,
  'pricing': PricingTable,

  // Contact
  'contact-form': ContactForm,
  'contact': ContactForm,

  // FAQ
  'faq': FAQ,
  'accordion': FAQ,
}

export function PreviewRenderer({ components }: PreviewRendererProps) {
  if (!components || components.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No components to display</p>
      </div>
    )
  }

  return (
    <>
      {components.map((component, index) => {
        const Component = componentMap[component.type.toLowerCase()]

        if (Component) {
          return <Component key={index} props={component.props} />
        }

        return <FallbackComponent key={index} type={component.type} props={component.props} />
      })}
    </>
  )
}
`
