/**
 * Common Composition Patterns for Studio CMS Components
 * 
 * This file demonstrates best practices and common patterns for combining
 * studio CMS components to create complete page layouts and features.
 * 
 * NOTE: These are example patterns only - components would need proper
 * id, type, and category props in actual implementation.
 */

// @ts-nocheck - Example file for documentation purposes

import React from 'react';
import { ComponentCategory, ComponentType } from '../_core/types';

// Navigation Components
import { NavBar } from '../navigation/nav-bar';
import { Footer } from '../navigation/footer';
import { Breadcrumbs } from '../navigation/breadcrumbs';

// Hero Components  
import { HeroBanner } from '../heroes/hero-banner';
import { HeroSplit } from '../heroes/hero-split';

// Content Components
import { TwoColumn } from '../content/two-column';
import { CardGrid } from '../content/card-grid';
import { Tabs } from '../content/tabs';
import { Accordion } from '../content/accordion';

// Feature Components
import { FeatureGrid } from '../features/feature-grid';
import { FeatureShowcase } from '../features/feature-showcase';

// CTA Components
import { CTABanner } from '../cta/cta-banner';
import { CTANewsletter } from '../cta/cta-newsletter';

// Social Proof Components
import { TestimonialSlider } from '../social-proof/testimonial-slider';
import { LogoStrip } from '../social-proof/logo-strip';

/**
 * Pattern 1: Complete Landing Page Layout
 * 
 * Demonstrates how to compose multiple components for a typical landing page
 */
export function LandingPageExample() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <NavBar
        id="main-nav"
        type={ComponentType.NavBar}
        category={ComponentCategory.Navigation}
        content={{
          logo: { text: 'Brand', href: '/' },
          menuItems: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'About', href: '#about' }
          ],
          cta: { text: 'Get Started', href: '/signup', variant: 'primary' },
          sticky: true
        }}
      />

      {/* Hero Section */}
      <HeroBanner
        id="hero-banner"
        type={ComponentType.HeroBanner}
        category={ComponentCategory.Heroes}
        content={{
          heading: 'Build Something Amazing',
          subheading: 'The tools you need to succeed',
          description: 'Start your journey with our powerful platform.',
          cta: {
            primary: { text: 'Start Free Trial', href: '/trial' },
            secondary: { text: 'Watch Demo', href: '/demo' }
          },
          backgroundImage: '/hero-bg.jpg',
          overlay: true
        }}
      />

      {/* Logo Strip - Social Proof */}
      <LogoStrip
        logos={[
          { src: '/logos/company1.svg', alt: 'Company 1' },
          { src: '/logos/company2.svg', alt: 'Company 2' },
          { src: '/logos/company3.svg', alt: 'Company 3' },
          { src: '/logos/company4.svg', alt: 'Company 4' },
          { src: '/logos/company5.svg', alt: 'Company 5' }
        ]}
        variant="scroll"
        grayscale={true}
      />

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-balance">Key Features</h2>
          <FeatureGrid
            features={[
              {
                icon: '⚡',
                title: 'Lightning Fast',
                description: 'Optimized for speed and performance'
              },
              {
                icon: '🔒',
                title: 'Secure',
                description: 'Enterprise-grade security features'
              },
              {
                icon: '📊',
                title: 'Analytics',
                description: 'Deep insights into your data'
              },
              {
                icon: '🌍',
                title: 'Global',
                description: 'Available worldwide with CDN'
              }
            ]}
            columns={{ mobile: 1, tablet: 2, desktop: 4 }}
          />
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="ds-heading-2 text-foreground text-center mb-12">What Our Customers Say</h2>
          <TestimonialSlider
            testimonials={[
              {
                content: 'This platform transformed our business.',
                author: 'Jane Doe',
                role: 'CEO',
                company: 'Tech Corp',
                rating: 5
              },
              {
                content: 'Best investment we ever made.',
                author: 'John Smith',
                role: 'CTO',
                company: 'Startup Inc',
                rating: 5
              }
            ]}
            autoPlay={true}
            interval={5000}
          />
        </div>
      </section>

      {/* CTA Section */}
      <CTABanner
        content={{
          title: 'Ready to Get Started?',
          description: 'Join thousands of satisfied customers',
          primaryAction: { label: 'Start Free Trial', href: '/trial' }
        }}
      />

      {/* Footer */}
      <Footer
        content={{
          columns: [
            {
              title: 'Product',
              links: [
                { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' }
              ]
            },
            {
              title: 'Company',
              links: [
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' }
              ]
            }
          ],
          bottom: {
            copyright: '© 2024 Your Company. All rights reserved.'
          }
        }}
      />
    </div>
  );
}

/**
 * Pattern 2: Product Feature Showcase
 * 
 * Demonstrates alternating content layout for feature presentation
 */
export function FeatureShowcaseExample() {
  const features = [
    {
      title: 'Powerful Analytics',
      description: 'Get deep insights into your data with our advanced analytics platform.',
      image: '/feature1.jpg',
      highlights: ['Real-time data', 'Custom dashboards', 'Export reports']
    },
    {
      title: 'Team Collaboration',
      description: 'Work together seamlessly with built-in collaboration tools.',
      image: '/feature2.jpg',
      highlights: ['Shared workspaces', 'Comments', 'Version control']
    },
    {
      title: 'Automation',
      description: 'Automate repetitive tasks and focus on what matters.',
      image: '/feature3.jpg',
      highlights: ['Workflow builder', 'Triggers', 'Integrations']
    }
  ];

  return (
    <div className="py-20">
      {features.map((feature, index) => (
        <TwoColumn
          key={index}
          left={
            index % 2 === 0 ? (
              <div>
                <h3 className="ds-heading-3 text-foreground mb-4">{feature.title}</h3>
                <p className="text-muted-foreground mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.highlights.map((highlight, i) => (
                    <li key={i} className="flex items-center">
                      <span className="mr-2">✓</span> {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <img src={feature.image} alt={feature.title} className="rounded-lg" />
            )
          }
          right={
            index % 2 === 0 ? (
              <img src={feature.image} alt={feature.title} className="rounded-lg" />
            ) : (
              <div>
                <h3 className="ds-heading-3 text-foreground mb-4">{feature.title}</h3>
                <p className="text-muted-foreground mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.highlights.map((highlight, i) => (
                    <li key={i} className="flex items-center">
                      <span className="mr-2">✓</span> {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
          ratio="50:50"
          gap="large"
        />
      ))}
    </div>
  );
}

/**
 * Pattern 3: Documentation/Help Center Layout
 * 
 * Combines navigation, search, and content organization components
 */
export function DocumentationExample() {
  return (
    <div className="min-h-screen">
      <NavBar
        content={{
          logo: { text: 'Docs', href: '/' },
          menuItems: [
            { label: 'Guides', href: '/guides' },
            { label: 'API', href: '/api' },
            { label: 'Examples', href: '/examples' }
          ]
        }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Documentation', href: '/docs' },
            { label: 'Getting Started' }
          ]}
        />

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <Accordion
              items={[
                {
                  title: 'Getting Started',
                  content: (
                    <ul className="space-y-2">
                      <li><a href="#intro">Introduction</a></li>
                      <li><a href="#install">Installation</a></li>
                      <li><a href="#setup">Setup</a></li>
                    </ul>
                  )
                },
                {
                  title: 'Core Concepts',
                  content: (
                    <ul className="space-y-2">
                      <li><a href="#components">Components</a></li>
                      <li><a href="#routing">Routing</a></li>
                      <li><a href="#state">State Management</a></li>
                    </ul>
                  )
                }
              ]}
              allowMultiple={true}
            />
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <Tabs
              tabs={[
                {
                  label: 'Overview',
                  content: (
                    <div className="prose max-w-none">
                      <h1>Getting Started</h1>
                      <p>Welcome to our documentation...</p>
                    </div>
                  )
                },
                {
                  label: 'Quick Start',
                  content: (
                    <div className="prose max-w-none">
                      <h2>Quick Start Guide</h2>
                      <p>Get up and running in minutes...</p>
                    </div>
                  )
                },
                {
                  label: 'Examples',
                  content: (
                    <CardGrid
                      cards={[
                        {
                          title: 'Basic Setup',
                          description: 'Learn the basics',
                          link: { href: '/examples/basic' }
                        },
                        {
                          title: 'Advanced Features',
                          description: 'Explore advanced topics',
                          link: { href: '/examples/advanced' }
                        }
                      ]}
                      columns={{ mobile: 1, tablet: 2, desktop: 2 }}
                    />
                  )
                }
              ]}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Pattern 4: Responsive Design Example
 * 
 * Shows how components adapt to different screen sizes
 */
export function ResponsiveLayoutExample() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero that stacks on mobile */}
      <HeroSplit
        content={{
          content: {
            title: 'Responsive Design',
            subtitle: 'Works on all devices',
            description: 'Our components adapt seamlessly to any screen size.'
          },
          media: {
            type: 'image',
            src: '/responsive.jpg',
            alt: 'Responsive design'
          },
          reverse: false // Image on right on desktop, stacks on mobile
        }}
      />

      {/* Grid that adjusts columns based on screen size */}
      <CardGrid
        cards={[
          { title: 'Card 1', description: 'Content...' },
          { title: 'Card 2', description: 'Content...' },
          { title: 'Card 3', description: 'Content...' },
          { title: 'Card 4', description: 'Content...' },
          { title: 'Card 5', description: 'Content...' },
          { title: 'Card 6', description: 'Content...' }
        ]}
        columns={{
          mobile: 1,   // 1 column on mobile
          tablet: 2,   // 2 columns on tablet
          desktop: 3   // 3 columns on desktop
        }}
      />

      {/* Feature grid with responsive columns */}
      <FeatureGrid
        features={[
          { icon: '📱', title: 'Mobile First', description: 'Designed for mobile' },
          { icon: '💻', title: 'Desktop Ready', description: 'Perfect on desktop' },
          { icon: '📟', title: 'Tablet Optimized', description: 'Great on tablets' },
          { icon: '🖥️', title: 'Wide Screen', description: 'Supports 4K displays' }
        ]}
        columns={{
          mobile: 1,
          tablet: 2,
          desktop: 4
        }}
      />
    </div>
  );
}

/**
 * Pattern 5: Newsletter Signup Flow
 * 
 * Demonstrates CTA and form components working together
 */
export function NewsletterFlowExample() {
  const handleSubscribe = async (email: string) => {
    // Handle newsletter subscription
    if (process.env.NODE_ENV === 'development') {
    console.log('Subscribing:', email);
    }
    // Add your subscription logic here
  };

  return (
    <section className="py-20 bg-gradient-to-r from-primary/80 via-primary/35 to-destructive/45">
      <div className="container mx-auto px-4 text-center theme-inverted text-foreground">
        <h2 className="ds-heading-2 mb-4">Stay Updated</h2>
        <p className="ds-body-xl mb-8 text-muted-foreground">Get the latest news and updates delivered to your inbox</p>
        
        <CTANewsletter
          title=""
          placeholder="Enter your email"
          buttonText="Subscribe"
          onSubmit={handleSubscribe}
          gdprText="We respect your privacy. Unsubscribe at any time."
          successMessage="Thanks for subscribing!"
          errorMessage="Please enter a valid email address."
        />

        <div className="mt-12">
          <p className="ds-body-sm text-muted-foreground/80 mb-4">Join 10,000+ subscribers</p>
          <LogoStrip
            logos={[
              { src: '/subscriber1.svg', alt: 'Subscriber' },
              { src: '/subscriber2.svg', alt: 'Subscriber' },
              { src: '/subscriber3.svg', alt: 'Subscriber' }
            ]}
            grayscale={false}
            maxHeight={40}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Pattern 6: Performance Optimized Layout
 * 
 * Demonstrates lazy loading and performance best practices
 */
export function PerformanceOptimizedExample() {
  return (
    <div>
      {/* Critical above-the-fold content loads immediately */}
      <NavBar
        content={{
          logo: { text: 'Fast Site', href: '/' },
          menuItems: [
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' }
          ]
        }}
        loading="eager"
      />

      <HeroBanner
        content={{
          heading: 'Performance First',
          subheading: 'Optimized for Core Web Vitals'
        }}
        loading="eager"
      />

      {/* Below-the-fold content uses lazy loading */}
      <div className="mt-20">
        <FeatureShowcase
          features={[
            {
              id: '1',
              title: 'Lazy Loaded',
              description: 'This component loads when scrolled into view',
              media: { type: 'image', src: '/feature.jpg' }
            }
          ]}
          loading="lazy"
        />

        <TestimonialSlider
          testimonials={[
            {
              content: 'Loads on demand',
              author: 'User',
              rating: 5
            }
          ]}
          loading="lazy"
        />
      </div>
    </div>
  );
}
