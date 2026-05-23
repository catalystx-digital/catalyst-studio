import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates sample websites for Story 18.8 testing
 * Provides 3 different website configurations:
 * 1. Simple website (5-10 pages with basic components)
 * 2. Medium complexity (10-15 pages with nested components)
 * 3. Complex website (15+ pages with global components)
 */

interface ComponentInstance {
  id: string
  type: string
  parentId: string | null
  position: number
  props: Record<string, any>
  content: {
    text?: string
    images?: string[]
    links?: Array<{url: string, label: string}>
  }
  styles: {
    desktop?: Record<string, any>
    tablet?: Record<string, any>
    mobile?: Record<string, any>
  }
  metadata: {
    locked?: boolean
    visible?: boolean
    aiGenerated?: boolean
    isGlobal?: boolean
  }
}

export async function createSampleWebsites(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  let totalPages = 0

  try {
    // 1. Simple Website (5-10 pages with basic components)
    console.log('  📝 Creating Simple Website...')
    const simpleWebsite = await createSimpleWebsite(prisma, websiteId)
    totalPages += simpleWebsite.pageCount
    console.log(`    ✅ Simple website: ${simpleWebsite.pageCount} pages`)

    // 2. Medium Complexity Website (10-15 pages with nested components)
    console.log('  🔧 Creating Medium Complexity Website...')
    const mediumWebsite = await createMediumWebsite(prisma, websiteId)
    totalPages += mediumWebsite.pageCount
    console.log(`    ✅ Medium website: ${mediumWebsite.pageCount} pages`)

    // 3. Complex Website (15+ pages with global components)
    console.log('  🏗️ Creating Complex Website...')
    const complexWebsite = await createComplexWebsite(prisma, websiteId)
    totalPages += complexWebsite.pageCount
    console.log(`    ✅ Complex website: ${complexWebsite.pageCount} pages`)

    console.log(`✅ Sample websites created: ${totalPages} total pages`)
    return totalPages

  } catch (error) {
    console.error('❌ Error creating sample websites:', error)
    throw error
  }
}

async function createSimpleWebsite(prisma: PrismaClient, websiteId: string) {
  const pages = [
    {
      id: 'simple-home',
      title: 'Home',
      slug: 'home',
      components: [
        createComponent('hero-banner-1', 'hero-banner', null, 0, {
          title: 'Welcome to Our Simple Site',
          subtitle: 'Clean and straightforward design'
        }),
        createComponent('about-section-1', 'content-rich-text', null, 1, {
          title: 'About Us',
          content: 'We provide simple solutions for your needs.'
        })
      ]
    },
    {
      id: 'simple-about',
      title: 'About',
      slug: 'about',
      components: [
        createComponent('about-header-1', 'header-basic', null, 0, {
          title: 'About Our Company',
          subtitle: 'Our story and values'
        }),
        createComponent('team-section-1', 'team-grid', null, 1, {
          members: [
            { name: 'John Doe', role: 'CEO', image: '/images/john.jpg' },
            { name: 'Jane Smith', role: 'CTO', image: '/images/jane.jpg' }
          ]
        })
      ]
    },
    {
      id: 'simple-contact',
      title: 'Contact',
      slug: 'contact',
      components: [
        createComponent('contact-header-1', 'header-centered', null, 0, {
          title: 'Get In Touch',
          subtitle: 'We would love to hear from you'
        }),
        createComponent('contact-form-1', 'contact-form', null, 1, {
          fields: ['name', 'email', 'message'],
          submitText: 'Send Message'
        })
      ]
    },
    {
      id: 'simple-services',
      title: 'Services',
      slug: 'services',
      components: [
        createComponent('services-header-1', 'header-basic', null, 0, {
          title: 'Our Services',
          subtitle: 'What we offer'
        }),
        createComponent('features-grid-1', 'app-features-grid', null, 1, {
          features: [
            { title: 'Web Design', description: 'Beautiful websites' },
            { title: 'SEO', description: 'Search optimization' },
            { title: 'Support', description: '24/7 customer support' }
          ]
        })
      ]
    },
    {
      id: 'simple-blog',
      title: 'Blog',
      slug: 'blog',
      components: [
        createComponent('blog-header-1', 'header-basic', null, 0, {
          title: 'Latest Blog Posts',
          subtitle: 'Stay updated with our news'
        }),
        createComponent('blog-posts-1', 'posts-grid', null, 1, {
          posts: [
            { title: 'First Post', excerpt: 'Our first blog post', date: '2025-01-01' },
            { title: 'Second Post', excerpt: 'More great content', date: '2025-01-02' }
          ]
        })
      ]
    }
  ]

  // Create content type for simple website
  const contentType = await prisma.contentType.create({
    data: {
      id: 'simple-page-type',
      key: 'simple-page',
      name: 'Simple Page',
      pluralName: 'Simple Pages',
      displayField: 'title',
      category: 'page',
      fields: {
        title: { type: 'string', required: true },
        content: { type: 'rich-text' },
        seo: { type: 'object' }
      },
      websiteId
    }
  })

  // Create pages
  for (const pageData of pages) {
    await prisma.websitePage.create({
      data: {
        id: pageData.id,
        title: pageData.title,
        type: 'page',
        contentTypeId: contentType.id,
        websiteId,
        content: {
          components: pageData.components
        } as any,
        metadata: {
          seo: {
            title: pageData.title,
            description: `${pageData.title} page for simple website`
          }
        },
        status: 'published'
      }
    })
  }

  return { pageCount: pages.length }
}

async function createMediumWebsite(prisma: PrismaClient, websiteId: string) {
  const pages = [
    {
      id: 'medium-home',
      title: 'Home',
      slug: 'home-medium',
      components: [
        createComponent('hero-section-1', 'hero-banner', null, 0, {
          title: 'Professional Business Solutions',
          subtitle: 'Comprehensive services for growing companies'
        }),
        createComponent('features-section-1', 'app-features-grid', null, 1, {}),
        // Nested component example
        createComponent('testimonials-section-1', 'testimonials-carousel', null, 2, {}),
        createComponent('cta-section-1', 'cta-banner', 'testimonials-section-1', 0, {
          text: 'Ready to get started?',
          buttonText: 'Contact Us Now'
        })
      ]
    },
    {
      id: 'medium-products',
      title: 'Products',
      slug: 'products',
      components: [
        createComponent('products-header-1', 'header-basic', null, 0, {
          title: 'Our Product Line',
          subtitle: 'Discover our comprehensive offerings'
        }),
        createComponent('products-grid-1', 'products-grid', null, 1, {
          products: [
            { name: 'Product A', price: '$99', features: ['Feature 1', 'Feature 2'] },
            { name: 'Product B', price: '$199', features: ['Studio Feature', 'Support'] }
          ]
        }),
        createComponent('pricing-section-1', 'pricing-table', null, 2, {})
      ]
    },
    // Add 8 more medium complexity pages...
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `medium-page-${i + 3}`,
      title: `Page ${i + 3}`,
      slug: `page-${i + 3}`,
      components: [
        createComponent(`header-${i + 3}`, 'header-centered', null, 0, {
          title: `Page ${i + 3} Title`,
          subtitle: `Subtitle for page ${i + 3}`
        }),
        createComponent(`content-${i + 3}`, 'content-two-column', null, 1, {
          // Updated to content[] shape with type discriminator
          leftColumn: [
            {
              type: 'text',
              heading: `Page ${i + 3} Left`,
              body: `Left content for page ${i + 3}`
            }
          ],
          rightColumn: [
            {
              type: 'text',
              heading: `Page ${i + 3} Right`,
              body: `Right content for page ${i + 3}`
            }
          ]
        }),
        // Add nested component
        createComponent(`nested-${i + 3}`, 'feature-card', `content-${i + 3}`, 0, {
          title: `Nested feature ${i + 3}`,
          description: `This is nested inside content-${i + 3}`
        })
      ]
    }))
  ]

  // Create content type
  const contentType = await prisma.contentType.create({
    data: {
      id: 'medium-page-type',
      key: 'medium-page',
      name: 'Medium Page',
      pluralName: 'Medium Pages',
      displayField: 'title',
      category: 'page',
      fields: {
        title: { type: 'string', required: true },
        content: { type: 'rich-text' },
        components: { type: 'array' },
        seo: { type: 'object' }
      },
      websiteId
    }
  })

  // Create pages
  for (const pageData of pages) {
    await prisma.websitePage.create({
      data: {
        id: pageData.id,
        title: pageData.title,
        type: 'page',
        contentTypeId: contentType.id,
        websiteId,
        content: {
          components: pageData.components
        } as any,
        metadata: {
          seo: {
            title: pageData.title,
            description: `${pageData.title} page for medium complexity website`
          }
        },
        status: 'published'
      }
    })
  }

  return { pageCount: pages.length }
}

async function createComplexWebsite(prisma: PrismaClient, websiteId: string) {
  // First create global components that will be shared across pages
  // Find existing navbar component type
  const navbarType = await prisma.websiteComponentType.findFirst({
    where: { 
      websiteId,
      type: 'navbar-modern'
    }
  })

  if (!navbarType) {
    throw new Error('Navbar component type not found - ensure component types are created first')
  }

  const globalNavbarContent = {
    logo: '/images/logo.png',
    links: [
      { url: '/', label: 'Home' },
      { url: '/about', label: 'About' },
      { url: '/services', label: 'Services' },
      { url: '/portfolio', label: 'Portfolio' },
      { url: '/blog', label: 'Blog' },
      { url: '/contact', label: 'Contact' }
    ]
  }

  const globalNavbar = await prisma.websiteSharedComponent.create({
    data: {
      id: 'global-navbar-complex',
      name: 'Main Navigation',
      websiteComponentTypeId: navbarType.id,
      websiteId,
      content: globalNavbarContent as any,
      config: {
        type: 'navbar-modern',
        category: navbarType.category
      } as any,
      usageCount: 0
    }
  })

  const footerType = await prisma.websiteComponentType.findFirst({
    where: { 
      websiteId,
      type: 'footer-comprehensive'
    }
  })

  if (!footerType) {
    throw new Error('Footer component type not found - ensure component types are created first')
  }

  const globalFooterContent = {
    companyInfo: {
      name: 'Complex Corp',
      address: '123 Business St',
      phone: '(555) 123-4567'
    },
    links: [
      { section: 'Company', links: ['About', 'Team', 'Careers'] },
      { section: 'Services', links: ['Web Design', 'SEO', 'Consulting'] },
      { section: 'Support', links: ['Help', 'Contact', 'FAQ'] }
    ]
  }

  const globalFooter = await prisma.websiteSharedComponent.create({
    data: {
      id: 'global-footer-complex',
      name: 'Main Footer',
      websiteComponentTypeId: footerType.id,
      websiteId,
      content: globalFooterContent as any,
      config: {
        type: 'footer-comprehensive',
        category: footerType.category
      } as any,
      usageCount: 0
    }
  })

  // Create 17 complex pages with rich content and global components
  const pages = [
    {
      id: 'complex-home',
      title: 'Home',
      slug: 'home-complex',
      components: [
        // Reference global navbar
        createGlobalComponent(globalNavbar.id, 0),
        createComponent('hero-complex-1', 'hero-video', null, 1, {
          title: 'Transform Your Business',
          subtitle: 'Enterprise-grade solutions for modern companies',
          videoUrl: '/videos/hero.mp4'
        }),
        createComponent('metrics-section-1', 'metrics-dashboard', null, 2, {
          metrics: [
            { label: 'Happy Clients', value: '500+' },
            { label: 'Projects Completed', value: '1,200+' },
            { label: 'Years Experience', value: '15+' }
          ]
        }),
        // Deeply nested component structure
        createComponent('services-overview', 'app-features-grid', null, 3, {}),
        createComponent('service-web', 'feature-card', 'services-overview', 0, {
          title: 'Web Development',
          description: 'Custom web applications'
        }),
        createComponent('service-mobile', 'feature-card', 'services-overview', 1, {
          title: 'Mobile Development',
          description: 'iOS and Android apps'
        }),
        createComponent('service-consulting', 'feature-card', 'services-overview', 2, {
          title: 'Consulting',
          description: 'Strategic technology guidance'
        }),
        // Reference global footer
        createGlobalComponent(globalFooter.id, 4)
      ]
    },
    // Add 16 more complex pages...
    ...Array.from({ length: 16 }, (_, i) => ({
      id: `complex-page-${i + 1}`,
      title: `Complex Page ${i + 1}`,
      slug: `complex-${i + 1}`,
      components: [
        createGlobalComponent(globalNavbar.id, 0),
        createComponent(`header-${i + 1}`, 'header-basic', null, 1, {
          title: `Complex Page ${i + 1}`,
          subtitle: `Advanced content for page ${i + 1}`
        }),
        createComponent(`main-content-${i + 1}`, 'content-two-column', null, 2, {
          leftColumn: [
            {
              type: 'text',
              heading: `Section ${i + 1} Left`,
              body: `Detailed left column content for section ${i + 1}.`
            }
          ],
          rightColumn: [
            {
              type: 'text',
              heading: `Section ${i + 1} Right`,
              body: `Complementary right column content for section ${i + 1}.`
            }
          ],
          columnRatio: '50-50'
        }),
        // Multiple levels of nesting
        createComponent(`section-a-${i + 1}`, 'feature-split', `main-content-${i + 1}`, 0, {}),
        createComponent(`subsection-1-${i + 1}`, 'testimonials-grid', `section-a-${i + 1}`, 0, {}),
        createComponent(`card-1-${i + 1}`, 'feature-card', `subsection-1-${i + 1}`, 0, {
          title: `Feature ${i + 1}-1`,
          description: `Nested feature card ${i + 1}-1`
        }),
        createComponent(`card-2-${i + 1}`, 'feature-card', `subsection-1-${i + 1}`, 1, {
          title: `Feature ${i + 1}-2`,
          description: `Nested feature card ${i + 1}-2`
        }),
        createGlobalComponent(globalFooter.id, 3)
      ]
    }))
  ]

  // Create content type
  const contentType = await prisma.contentType.create({
    data: {
      id: 'complex-page-type',
      key: 'complex-page',
      name: 'Complex Page',
      pluralName: 'Complex Pages',
      displayField: 'title',
      category: 'page',
      fields: {
        title: { type: 'string', required: true },
        content: { type: 'rich-text' },
        components: { type: 'array' },
        globalComponents: { type: 'array' },
        seo: { type: 'object' }
      },
      websiteId
    }
  })

  // Create pages
  for (const pageData of pages) {
    await prisma.websitePage.create({
      data: {
        id: pageData.id,
        title: pageData.title,
        type: 'page',
        contentTypeId: contentType.id,
        websiteId,
        content: {
          components: pageData.components,
          globalComponents: [globalNavbar.id, globalFooter.id]
        } as any,
        metadata: {
          seo: {
            title: pageData.title,
            description: `${pageData.title} page for complex website with global components`
          }
        },
        status: 'published'
      }
    })
  }

  // Update usage count for global components
  await prisma.websiteSharedComponent.update({
    where: { id: globalNavbar.id },
    data: { usageCount: pages.length }
  })

  await prisma.websiteSharedComponent.update({
    where: { id: globalFooter.id },
    data: { usageCount: pages.length }
  })

  return { pageCount: pages.length }
}

function createComponent(
  id: string,
  type: string,
  parentId: string | null,
  position: number,
  props: Record<string, any> = {}
): ComponentInstance {
  return {
    id,
    type,
    parentId,
    position,
    props,
    content: {
      text: props.text || `Sample content for ${type}`,
      images: props.images || [],
      links: props.links || []
    },
    styles: {
      desktop: { padding: '20px', margin: '10px' },
      tablet: { padding: '15px', margin: '8px' },
      mobile: { padding: '10px', margin: '5px' }
    },
    metadata: {
      locked: false,
      visible: true,
      aiGenerated: true,
      isGlobal: false
    }
  }
}

function createGlobalComponent(globalId: string, position: number): ComponentInstance {
  return {
    id: `global-ref-${globalId}-${position}`,
    type: 'global-component-reference',
    parentId: null,
    position,
    props: {
      globalComponentId: globalId
    },
    content: {},
    styles: {},
    metadata: {
      locked: true,
      visible: true,
      aiGenerated: false,
      isGlobal: true
    }
  }
}
