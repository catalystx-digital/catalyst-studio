'use client'

/**
 * Design System Sample Preview Page
 *
 * Renders REAL CMS components with sample props to preview design system changes.
 * Loaded in an iframe by DesignSystemPreviewPane.
 * Receives design system CSS variables via postMessage.
 */

import React, { useEffect, useState } from 'react'
import { NavBar } from '@/lib/studio/components/cms/navigation/nav-bar'
import { HeroSimple } from '@/lib/studio/components/cms/heroes/hero-simple'
import { Footer } from '@/lib/studio/components/cms/navigation/footer'
import { FeatureGrid } from '@/lib/studio/components/cms/features/feature-grid'
import { CTASimple } from '@/lib/studio/components/cms/cta/cta-simple'

// Sample content for NavBar
const sampleNavBarContent = {
  logo: {
    text: 'Your Brand',
    href: '#',
  },
  menuItems: [
    { label: 'Home', href: '#' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'About', href: '#about' },
  ],
  cta: {
    label: 'Get Started',
    href: '#',
    variant: 'primary' as const,
  },
  sticky: false,
  transparent: false,
}

// Sample content for Hero
const sampleHeroContent = {
  heading: 'Welcome to Your Website',
  subheading: 'Experience the power of your design system in action. See how colors, typography, and spacing work together.',
  ctaButtons: [
    { label: 'Get Started', href: '#', variant: 'primary' as const },
    { label: 'Learn More', href: '#', variant: 'secondary' as const },
  ],
  alignment: 'center' as const,
}

// Sample content for Feature Grid
const sampleFeatureContent = {
  heading: 'Our Features',
  subheading: 'Everything you need to build amazing websites',
  features: [
    {
      title: 'Design System',
      description: 'Consistent colors, typography, and spacing across your entire site.',
      icon: 'palette',
    },
    {
      title: 'Components',
      description: 'Pre-built, customizable components for rapid development.',
      icon: 'blocks',
    },
    {
      title: 'Responsive',
      description: 'Looks great on every device, from mobile to desktop.',
      icon: 'smartphone',
    },
  ],
  columns: 3 as const,
}

// Sample content for CTA
const sampleCTAContent = {
  heading: 'Ready to Get Started?',
  body: 'Join thousands of satisfied customers today.',
  primaryButton: {
    label: 'Start Free Trial',
    href: '#',
  },
  secondaryButton: {
    label: 'Contact Sales',
    href: '#',
  },
  backgroundVariant: 'accent' as const,
}

// Sample content for Footer
const sampleFooterContent = {
  logo: {
    text: 'Your Brand',
  },
  copyright: '© 2024 Your Company. All rights reserved.',
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#' },
        { label: 'Pricing', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
  ],
}

export default function DesignSystemSamplePage() {
  const [cssVariables, setCssVariables] = useState<string>('')
  const [darkCssVariables, setDarkCssVariables] = useState<string>('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_DESIGN_SYSTEM') {
        const { css, darkCss } = event.data.payload
        if (css) setCssVariables(css)
        if (darkCss) setDarkCssVariables(darkCss)
        window.parent.postMessage({ type: 'DESIGN_SYSTEM_APPLIED', timestamp: Date.now() }, '*')
      }
    }

    window.addEventListener('message', handleMessage)
    setIsReady(true)
    window.parent.postMessage({ type: 'PREVIEW_READY', timestamp: Date.now() }, '*')

    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <>
      <style>
        {`
          :root {
            ${cssVariables}
          }
          @media (prefers-color-scheme: dark) {
            :root {
              ${darkCssVariables}
            }
          }
        `}
      </style>

      <style>
        {`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.5;
            background: hsl(var(--background, 0 0% 100%));
            color: hsl(var(--foreground, 240 10% 3.9%));
          }
          .preview-wrapper {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .preview-main {
            flex: 1;
          }
        `}
      </style>

      <div className="preview-wrapper">
        <NavBar content={sampleNavBarContent} />
        <main className="preview-main">
          <HeroSimple content={sampleHeroContent} />
          <FeatureGrid content={sampleFeatureContent} />
          <CTASimple content={sampleCTAContent} />
        </main>
        <Footer content={sampleFooterContent} />
      </div>

      {!isReady && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'hsl(var(--background, 0 0% 100%))',
          color: 'hsl(var(--muted-foreground, 240 3.8% 46.1%))',
        }}>
          Loading preview...
        </div>
      )}
    </>
  )
}
