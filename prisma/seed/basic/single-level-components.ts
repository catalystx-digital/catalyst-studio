import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates single-level component types without nesting
 * Tests basic component type creation and properties
 */
export async function createSingleLevelComponents(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const components = []
  
  // Test Case 1: Simple text component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-text',
      category: 'content',
      version: '1.0.0',
      defaultConfig: {
        alignment: 'left',
        fontSize: 'medium'
      },
      placeholderData: {
        text: 'This is a simple text component',
        html: '<p>This is a simple text component</p>'
      },
      aiMetadata: {
        detectionPatterns: ['text', 'paragraph'],
        confidence: 0.95
      },
      confidence: 0.95,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 2: Button component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-button',
      category: 'forms',
      version: '1.0.0',
      defaultConfig: {
        variant: 'primary',
        size: 'medium',
        disabled: false
      },
      placeholderData: {
        label: 'Click Me',
        href: '/action',
        target: '_self'
      },
      aiMetadata: {
        detectionPatterns: ['button', 'cta'],
        confidence: 0.9
      },
      confidence: 0.9,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 3: Image component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-image',
      category: 'media',
      version: '1.0.0',
      defaultConfig: {
        width: 800,
        height: 600,
        lazy: true
      },
      placeholderData: {
        src: '/images/placeholder.jpg',
        alt: 'Placeholder image',
        caption: 'This is a placeholder'
      },
      aiMetadata: {
        detectionPatterns: ['image', 'media'],
        confidence: 0.92
      },
      confidence: 0.92,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 4: List component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-list',
      category: 'content',
      version: '1.0.0',
      defaultConfig: {
        ordered: false,
        style: 'bullets'
      },
      placeholderData: {
        items: [
          'First item',
          'Second item',
          'Third item',
          'Fourth item'
        ]
      },
      aiMetadata: {
        detectionPatterns: ['list', 'items'],
        confidence: 0.88
      },
      confidence: 0.88,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 5: Navigation component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-navigation',
      category: 'navigation',
      version: '1.0.0',
      defaultConfig: {
        position: 'top',
        sticky: true
      },
      placeholderData: {
        logo: '/logo.svg',
        items: [
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' },
          { label: 'Services', href: '/services' },
          { label: 'Contact', href: '/contact' }
        ]
      },
      aiMetadata: {
        detectionPatterns: ['navigation', 'menu', 'global'],
        confidence: 0.96
      },
      confidence: 0.96,
      isGlobal: true,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 6: Hero component type
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-hero',
      category: 'heroes',
      version: '1.0.0',
      defaultConfig: {
        height: 'full',
        overlay: true
      },
      placeholderData: {
        title: 'Welcome to Our Site',
        subtitle: 'Your journey starts here',
        backgroundImage: '/images/hero-bg.jpg',
        cta: {
          label: 'Get Started',
          href: '/start'
        }
      },
      aiMetadata: {
        detectionPatterns: ['hero', 'banner', 'landing'],
        confidence: 0.91
      },
      confidence: 0.91,
      isGlobal: false,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 7: Footer component type (needed for shared components)
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-footer',
      category: 'navigation',
      version: '1.0.0',
      defaultConfig: {
        columns: 3,
        showSocial: true,
        showNewsletter: true
      },
      placeholderData: {
        copyright: '© 2024 Company Name',
        columns: []
      },
      aiMetadata: {
        detectionPatterns: ['footer', 'bottom', 'site-footer'],
        confidence: 0.94
      },
      confidence: 0.94,
      isGlobal: true,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 8: Sidebar component type (needed for shared components)
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-sidebar',
      category: 'navigation',
      version: '1.0.0',
      defaultConfig: {
        position: 'left',
        collapsible: true,
        width: 250
      },
      placeholderData: {
        items: []
      },
      aiMetadata: {
        detectionPatterns: ['sidebar', 'side-nav', 'aside'],
        confidence: 0.89
      },
      confidence: 0.89,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))
  
  // Test Case 9: CTA Banner component type (needed for shared components)
  components.push(await prisma.websiteComponentType.create({
    data: {
      type: 'basic-cta-banner',
      category: 'content',
      version: '1.0.0',
      defaultConfig: {
        variant: 'centered',
        showDismiss: false
      },
      placeholderData: {
        title: 'Call to Action',
        description: 'This is a call to action banner',
        buttonText: 'Learn More'
      },
      aiMetadata: {
        detectionPatterns: ['cta', 'banner', 'call-to-action'],
        confidence: 0.87
      },
      confidence: 0.87,
      websiteId,
      createdBy: 'basic-seed'
    }
  }))

  console.log(`✅ Created ${components.length} WebsiteComponentTypes`)
  
  return components.length
}