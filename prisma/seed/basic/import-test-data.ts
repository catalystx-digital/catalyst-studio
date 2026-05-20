import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates sample import test data for Story 18.8
 * Provides pre-analyzed website import results for testing import functionality
 * Uses actual ImportJob schema fields: templatesGenerated, detectionResults
 */

export async function createImportTestData(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  let totalImports = 0

  try {
    console.log('    📊 Creating import analysis scenarios...')

    // 1. Blog Website Import (High Confidence)
    console.log('      📝 Blog website import...')
    await prisma.importJob.create({
      data: {
        id: 'blog-import-test',
        websiteId,
        url: 'https://example-blog.com',
        status: 'completed',
        templatesGenerated: [
          { 
            type: 'navbar-modern', 
            confidence: 0.95,
            props: { logo: 'Blog Logo', links: ['Home', 'Blog', 'About', 'Contact'] }
          },
          { 
            type: 'hero-banner', 
            confidence: 0.9,
            props: { title: 'Welcome to Tech Blog', subtitle: 'Latest web development insights' }
          },
          { 
            type: 'posts-grid', 
            confidence: 0.88,
            props: { postsPerPage: 9, showExcerpt: true }
          },
          { 
            type: 'footer-comprehensive', 
            confidence: 0.92,
            props: { company: 'Tech Blog Inc.', socialLinks: true }
          }
        ],
        detectionResults: {
          websiteType: 'blog',
          confidence: 0.91,
          pages: [
            {
              url: 'https://example-blog.com/',
              title: 'Tech Blog - Latest in Web Development',
              componentsDetected: 4
            },
            {
              url: 'https://example-blog.com/blog/react-19',
              title: 'React 19 New Features',
              componentsDetected: 3
            }
          ],
          assets: {
            images: ['logo.png', 'hero-bg.jpg', 'react19.jpg'],
            styles: ['main.css', 'blog.css'],
            scripts: ['analytics.js', 'blog.js']
          }
        },
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:05:00Z'),
        createdAt: new Date('2025-01-01T10:00:00Z')
      }
    })
    totalImports++

    // 2. Portfolio Website Import (Medium Confidence)
    console.log('      🎨 Portfolio website import...')
    await prisma.importJob.create({
      data: {
        id: 'portfolio-import-test',
        websiteId,
        url: 'https://creative-portfolio.com',
        status: 'completed',
        templatesGenerated: [
          { 
            type: 'navbar-minimal', 
            confidence: 0.75,
            props: { logo: 'SJ', style: 'minimal' }
          },
          { 
            type: 'hero-video', 
            confidence: 0.7,
            props: { title: 'Creative Designer', hasVideo: true }
          },
          { 
            type: 'portfolio-grid', 
            confidence: 0.65,
            props: { columns: 3, filterEnabled: true }
          }
        ],
        detectionResults: {
          websiteType: 'portfolio',
          confidence: 0.7,
          pages: [
            {
              url: 'https://creative-portfolio.com/',
              title: 'Sarah Johnson - Creative Designer',
              componentsDetected: 3
            }
          ],
          assets: {
            images: ['hero-video-thumb.jpg', 'project1.jpg', 'project2.jpg'],
            styles: ['style.css'],
            scripts: ['portfolio.js']
          }
        },
        startedAt: new Date('2025-01-01T11:00:00Z'),
        completedAt: new Date('2025-01-01T11:08:00Z'),
        createdAt: new Date('2025-01-01T11:00:00Z')
      }
    })
    totalImports++

    // 3. E-commerce Website Import (Mixed Confidence)
    console.log('      🛒 E-commerce website import...')
    await prisma.importJob.create({
      data: {
        id: 'ecommerce-import-test',
        websiteId,
        url: 'https://fashionstore.example.com',
        status: 'completed',
        templatesGenerated: [
          { 
            type: 'store-nav-categories', 
            confidence: 0.8,
            props: { categories: ['Women', 'Men', 'Accessories', 'Sale'] }
          },
          { 
            type: 'hero-banner', 
            confidence: 0.75,
            props: { title: 'New Collection 2025', ctaButton: 'Shop Now' }
          },
          { 
            type: 'products-featured', 
            confidence: 0.6,
            props: { productCount: 8, showPrices: true }
          }
        ],
        detectionResults: {
          websiteType: 'e-commerce',
          confidence: 0.72,
          pages: [
            {
              url: 'https://fashionstore.example.com/',
              title: 'Fashion Store - Studio Clothing',
              componentsDetected: 5
            }
          ],
          assets: {
            images: ['logo.png', 'jacket.jpg', 'shoes.jpg'],
            styles: ['store.css', 'products.css'],
            scripts: ['ecommerce.js', 'cart.js']
          }
        },
        startedAt: new Date('2025-01-01T12:00:00Z'),
        completedAt: new Date('2025-01-01T12:15:00Z'),
        createdAt: new Date('2025-01-01T12:00:00Z')
      }
    })
    totalImports++

    // 4. Corporate Website Import (Low-Medium Confidence)
    console.log('      🏢 Corporate website import...')
    await prisma.importJob.create({
      data: {
        id: 'corporate-import-test',
        websiteId,
        url: 'https://innovatecorp.com',
        status: 'completed',
        templatesGenerated: [
          { 
            type: 'navbar-modern', 
            confidence: 0.6,
            props: { logo: 'InnovateCorp', navigation: 'full' }
          },
          { 
            type: 'hero-banner', 
            confidence: 0.55,
            props: { title: 'Business Solutions', corporate: true }
          },
          { 
            type: 'app-features-grid', 
            confidence: 0.5,
            props: { features: ['Consulting', 'Technology', 'Support'] }
          },
          { 
            type: 'testimonials-carousel', 
            confidence: 0.45,
            props: { autoplay: true, showRating: true }
          }
        ],
        detectionResults: {
          websiteType: 'corporate',
          confidence: 0.53,
          pages: [
            {
              url: 'https://innovatecorp.com/',
              title: 'InnovateCorp - Business Solutions',
              componentsDetected: 6
            }
          ],
          assets: {
            images: ['logo.svg', 'hero-image.jpg'],
            styles: ['main.css'],
            scripts: ['main.js']
          }
        },
        startedAt: new Date('2025-01-01T13:00:00Z'),
        completedAt: new Date('2025-01-01T13:20:00Z'),
        createdAt: new Date('2025-01-01T13:00:00Z')
      }
    })
    totalImports++

    // 5. Failed Import Scenario
    console.log('      ❌ Failed import scenario...')
    await prisma.importJob.create({
      data: {
        id: 'failed-import-test',
        websiteId,
        url: 'https://problematic-site.com',
        status: 'failed',
        templatesGenerated: [],
        detectionResults: {
          error: 'Failed to parse website structure',
          errorCode: 'PARSE_ERROR',
          errorDetails: 'The website contains malformed HTML that could not be processed'
        },
        errorMessage: 'Failed to parse website structure: malformed HTML detected',
        startedAt: new Date('2025-01-01T14:00:00Z'),
        createdAt: new Date('2025-01-01T14:00:00Z')
      }
    })
    totalImports++

    // 6. Processing Import Scenario
    console.log('      ⏳ Processing import scenario...')
    await prisma.importJob.create({
      data: {
        id: 'processing-import-test',
        websiteId,
        url: 'https://large-website.com',
        status: 'processing',
        templatesGenerated: [
          { 
            type: 'navbar-modern', 
            confidence: 0.8,
            props: { logo: 'Large Site', partial: true }
          },
          { 
            type: 'hero-banner', 
            confidence: 0.75,
            props: { title: 'Large Website', processing: true }
          }
        ],
        detectionResults: {
          websiteType: 'e-commerce',
          confidence: 0.0, // Still processing
          progress: 67,
          partial: {
            pagesAnalyzed: 15,
            totalPages: 23,
            currentPage: 'https://large-website.com/products/category-3'
          }
        },
        startedAt: new Date('2025-01-01T15:00:00Z'),
        createdAt: new Date('2025-01-01T15:00:00Z')
      }
    })
    totalImports++

    console.log(`    ✅ Created ${totalImports} import test scenarios`)
    return totalImports

  } catch (error) {
    console.error('❌ Error creating import test data:', error)
    throw error
  }
}