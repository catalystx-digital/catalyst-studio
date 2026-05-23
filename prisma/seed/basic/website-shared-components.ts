import { PrismaClient, WebsiteSharedComponent, WebsiteComponentType } from '../../../lib/generated/prisma'

/**
 * Creates WebsiteSharedComponents for shared components like navigation, footer, etc.
 * These are reusable components that can be referenced across multiple pages
 */
export async function createWebsiteSharedComponents(
  prisma: PrismaClient,
  websiteId: string,
  componentTypes: WebsiteComponentType[]
): Promise<WebsiteSharedComponent[]> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sharedComponents: WebsiteSharedComponent[] = []

      // Find the navigation component type
      console.log(`    🔍 Looking for navigation type in ${componentTypes.length} component types:`, componentTypes.map(ct => ct.type))
      const navType = componentTypes.find(ct => ct.type === 'basic-navigation')
      if (!navType) {
        throw new Error(`Navigation component type not found. Available types: ${componentTypes.map(ct => ct.type).join(', ')}`)
      }

      // Create Main Navigation shared component
      const mainNav = await tx.websiteSharedComponent.create({
        data: {
          websiteId,
          websiteComponentTypeId: navType.id,
          name: 'Main Navigation',
          // Canonical props live in content; config holds metadata only.
          content: {
            links: [
              { label: 'Home', url: '/' },
              { label: 'Products', url: '/products' },
              { label: 'About', url: '/about' },
              { label: 'Blog', url: '/blog' },
              { label: 'Contact', url: '/contact' }
            ],
            style: 'horizontal',
            sticky: true,
            backgroundColor: '#ffffff',
            textColor: '#333333',
            logoUrl: '/logo.svg',
            logoAlt: 'Company Logo'
          },
          config: {
            type: 'basic-navigation',
            category: 'navigation'
          } as any,
          usageCount: 0,
          createdBy: 'seed-script'
        }
      })
      sharedComponents.push(mainNav)

      // Find the footer component type - should already exist from single-level-components
      const footerType = componentTypes.find(ct => ct.type === 'basic-footer')
      if (!footerType) {
        throw new Error('Footer component type not found - ensure single-level-components seed ran first')
      }

      // Create Footer shared component
      const footer = await tx.websiteSharedComponent.create({
        data: {
          websiteId,
          websiteComponentTypeId: footerType.id,
          name: 'Footer',
          content: {
            columns: [
              {
                title: 'Company',
                links: [
                  { label: 'About Us', url: '/about' },
                  { label: 'Careers', url: '/careers' },
                  { label: 'Press', url: '/press' },
                  { label: 'Contact', url: '/contact' }
                ]
              },
              {
                title: 'Products',
                links: [
                  { label: 'Features', url: '/features' },
                  { label: 'Pricing', url: '/pricing' },
                  { label: 'Enterprise', url: '/enterprise' },
                  { label: 'Customers', url: '/customers' }
                ]
              },
              {
                title: 'Resources',
                links: [
                  { label: 'Documentation', url: '/docs' },
                  { label: 'Blog', url: '/blog' },
                  { label: 'Support', url: '/support' },
                  { label: 'API', url: '/api' }
                ]
              }
            ],
            copyright: '© 2024 Test Company. All rights reserved.',
            socialLinks: [
              { platform: 'twitter', url: 'https://twitter.com/company' },
              { platform: 'linkedin', url: 'https://linkedin.com/company' },
              { platform: 'github', url: 'https://github.com/company' }
            ],
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff'
          },
          config: {
            type: 'basic-footer',
            category: 'footer'
          } as any,
          usageCount: 0,
          createdBy: 'seed-script'
        }
      })
      sharedComponents.push(footer)

      // Find the sidebar navigation component type - should already exist from single-level-components
      const sidebarType = componentTypes.find(ct => ct.type === 'basic-sidebar')
      if (!sidebarType) {
        throw new Error('Sidebar component type not found - ensure single-level-components seed ran first')
      }

      // Create Sidebar Navigation shared component
      const sidebarNav = await tx.websiteSharedComponent.create({
        data: {
          websiteId,
          websiteComponentTypeId: sidebarType.id,
          name: 'Sidebar Navigation',
          content: {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                items: [
                  { label: 'Introduction', url: '/docs/intro' },
                  { label: 'Installation', url: '/docs/install' },
                  { label: 'Quick Start', url: '/docs/quickstart' }
                ]
              },
              {
                label: 'Guides',
                items: [
                  { label: 'Basic Usage', url: '/docs/guides/basic' },
                  { label: 'Advanced Topics', url: '/docs/guides/advanced' },
                  { label: 'Best Practices', url: '/docs/guides/best-practices' }
                ]
              },
              {
                label: 'API Reference',
                items: [
                  { label: 'Components', url: '/docs/api/components' },
                  { label: 'Hooks', url: '/docs/api/hooks' },
                  { label: 'Utilities', url: '/docs/api/utils' }
                ]
              }
            ],
            collapsible: true,
            defaultExpanded: true,
            showSearch: true,
            backgroundColor: '#f5f5f5',
            textColor: '#333333'
          },
          config: {
            type: 'basic-sidebar',
            category: 'navigation'
          } as any,
          usageCount: 0,
          createdBy: 'seed-script'
        }
      })
      sharedComponents.push(sidebarNav)

      // Find the CTA banner component type - should already exist from single-level-components
      const ctaType = componentTypes.find(ct => ct.type === 'basic-cta-banner')
      if (!ctaType) {
        throw new Error('CTA banner component type not found - ensure single-level-components seed ran first')
      }

      // Create Call-to-Action Banner shared component
      const ctaBanner = await tx.websiteSharedComponent.create({
        data: {
          websiteId,
          websiteComponentTypeId: ctaType.id,
          name: 'Call-to-Action Banner',
          content: {
            title: 'Ready to Get Started?',
            description: 'Join thousands of satisfied customers and transform your business today.',
            primaryButton: {
              text: 'Start Free Trial',
              url: '/signup',
              variant: 'primary'
            },
            secondaryButton: {
              text: 'Schedule Demo',
              url: '/demo',
              variant: 'outline'
            },
            backgroundColor: '#4a90e2',
            textColor: '#ffffff',
            showDismiss: false,
            dismissKey: 'cta-banner-main',
            variant: 'centered',
            padding: 'large'
          },
          config: {
            type: 'basic-cta-banner',
            category: 'content'
          } as any,
          usageCount: 0,
          createdBy: 'seed-script'
        }
      })
      sharedComponents.push(ctaBanner)

      return sharedComponents
    })

    console.log(`✅ Created ${result.length} WebsiteSharedComponents`)
    return result
  } catch (error) {
    console.error('❌ Failed to create WebsiteSharedComponents:', error)
    throw error
  }
}
