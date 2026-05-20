import { PrismaClient } from '../../lib/generated/prisma'

/**
 * Creates comprehensive component types for Story 18.4 & 18.8
 * Covers all 30 categories needed for the Section Picker
 * Updated to match exact category names from story requirements
 */
export async function createStory184Components(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  const components = []
  
  // All 30 categories from story requirements - Story 18.8 Complete Update
  const componentDefinitions = [
    // 1. Blank Section
    {
      type: 'blank-section',
      category: 'Blank Section',
      defaultConfig: {
        name: 'Blank Section',
        description: 'Empty section to start from scratch'
      }
    },
    // 2. Navbar
    {
      type: 'navbar-modern',
      category: 'Navbar',
      defaultConfig: {
        name: 'Modern Navigation Bar',
        description: 'Responsive navigation with dropdown support'
      },
      isGlobal: true
    },
    {
      type: 'navbar-minimal',
      category: 'Navbar',
      defaultConfig: {
        name: 'Minimal Navigation',
        description: 'Simple clean navigation bar'
      },
      isGlobal: true
    },
    // 3. Footer
    {
      type: 'footer-comprehensive',
      category: 'Footer',
      defaultConfig: {
        name: 'Comprehensive Footer',
        description: 'Full footer with multiple columns'
      },
      isGlobal: true
    },
    {
      type: 'footer-simple',
      category: 'Footer',
      defaultConfig: {
        name: 'Simple Footer',
        description: 'Minimal footer with copyright'
      },
      isGlobal: true
    },
    // 4. Hero Header
    {
      type: 'hero-banner',
      category: 'Hero Header',
      defaultConfig: {
        name: 'Hero Banner',
        description: 'Large hero section with CTA'
      }
    },
    {
      type: 'hero-video',
      category: 'Hero Header',
      defaultConfig: {
        name: 'Video Hero',
        description: 'Hero section with background video'
      }
    },
    // 5. Header
    {
      type: 'header-basic',
      category: 'Header',
      defaultConfig: {
        name: 'Basic Header',
        description: 'Standard page header'
      }
    },
    {
      type: 'header-centered',
      category: 'Header',
      defaultConfig: {
        name: 'Centered Header',
        description: 'Center-aligned header section'
      }
    },
    // 6. Feature
    {
      type: 'feature-card',
      category: 'Feature',
      defaultConfig: {
        name: 'Feature Card',
        description: 'Single feature highlight'
      }
    },
    {
      type: 'feature-split',
      category: 'Feature',
      defaultConfig: {
        name: 'Split Feature',
        description: 'Feature with image and text split'
      }
    },
    // 7. Application Features
    {
      type: 'app-features-grid',
      category: 'Application Features',
      defaultConfig: {
        name: 'App Features Grid',
        description: 'Application feature showcase'
      }
    },
    {
      type: 'app-features-showcase',
      category: 'Application Features',
      defaultConfig: {
        name: 'App Feature Showcase',
        description: 'Detailed app feature display'
      }
    },
    // 8. Metrics
    {
      type: 'metrics-dashboard',
      category: 'Metrics',
      defaultConfig: {
        name: 'Metrics Dashboard',
        description: 'Key performance metrics'
      }
    },
    {
      type: 'metrics-counter',
      category: 'Metrics',
      defaultConfig: {
        name: 'Metrics Counter',
        description: 'Animated number counters'
      }
    },
    // 9. Testimonials
    {
      type: 'testimonials-grid',
      category: 'Testimonials',
      defaultConfig: {
        name: 'Testimonials Grid',
        description: 'Customer testimonials grid'
      }
    },
    {
      type: 'testimonials-carousel',
      category: 'Testimonials',
      defaultConfig: {
        name: 'Testimonials Carousel',
        description: 'Sliding testimonials'
      }
    },
    // 10. Pricing
    {
      type: 'pricing-table',
      category: 'Pricing',
      defaultConfig: {
        name: 'Pricing Table',
        description: 'Pricing plans comparison'
      }
    },
    {
      type: 'pricing-cards',
      category: 'Pricing',
      defaultConfig: {
        name: 'Pricing Cards',
        description: 'Individual pricing cards'
      }
    },
    // 11. Contact
    {
      type: 'contact-form',
      category: 'Contact',
      defaultConfig: {
        name: 'Contact Form',
        description: 'Contact form with fields'
      }
    },
    {
      type: 'contact-info',
      category: 'Contact',
      defaultConfig: {
        name: 'Contact Information',
        description: 'Contact details display'
      }
    },
    // 12. Team
    {
      type: 'team-grid',
      category: 'Team',
      defaultConfig: {
        name: 'Team Grid',
        description: 'Team members grid'
      }
    },
    {
      type: 'team-carousel',
      category: 'Team',
      defaultConfig: {
        name: 'Team Carousel',
        description: 'Team members slider'
      }
    },
    // 13. Content
    {
      type: 'content-rich-text',
      category: 'Content',
      defaultConfig: {
        name: 'Rich Text Content',
        description: 'Rich formatted content section'
      }
    },
    {
      type: 'content-two-column',
      category: 'Content',
      defaultConfig: {
        name: 'Two Column Content',
        description: 'Split content layout'
      }
    },
    // 14. Blog
    {
      type: 'blog-featured',
      category: 'Blog',
      defaultConfig: {
        name: 'Featured Blog Post',
        description: 'Featured blog post display'
      }
    },
    {
      type: 'blog-recent',
      category: 'Blog',
      defaultConfig: {
        name: 'Recent Blog Posts',
        description: 'Latest blog posts section'
      }
    },
    // 15. Posts
    {
      type: 'posts-grid',
      category: 'Posts',
      defaultConfig: {
        name: 'Posts Grid',
        description: 'Blog posts in grid layout'
      }
    },
    {
      type: 'posts-list',
      category: 'Posts',
      defaultConfig: {
        name: 'Posts List',
        description: 'Blog posts in list layout'
      }
    },
    // 16. Careers
    {
      type: 'careers-overview',
      category: 'Careers',
      defaultConfig: {
        name: 'Careers Overview',
        description: 'Career opportunities overview'
      }
    },
    {
      type: 'careers-benefits',
      category: 'Careers',
      defaultConfig: {
        name: 'Career Benefits',
        description: 'Employee benefits section'
      }
    },
    // 17. Career Posts
    {
      type: 'career-posts-list',
      category: 'Career Posts',
      defaultConfig: {
        name: 'Job Listings',
        description: 'Available job positions'
      }
    },
    {
      type: 'career-posts-featured',
      category: 'Career Posts',
      defaultConfig: {
        name: 'Featured Job',
        description: 'Highlighted job opening'
      }
    },
    // 18. Terms
    {
      type: 'terms-content',
      category: 'Terms',
      defaultConfig: {
        name: 'Terms of Service',
        description: 'Terms and conditions content'
      }
    },
    {
      type: 'terms-privacy',
      category: 'Terms',
      defaultConfig: {
        name: 'Privacy Policy',
        description: 'Privacy policy content'
      }
    },
    // 19. FAQ
    {
      type: 'faq-accordion',
      category: 'FAQ',
      defaultConfig: {
        name: 'FAQ Accordion',
        description: 'Collapsible FAQ items'
      }
    },
    {
      type: 'faq-list',
      category: 'FAQ',
      defaultConfig: {
        name: 'FAQ List',
        description: 'Simple Q&A list'
      }
    },
    // 20. Newsletter
    {
      type: 'newsletter-signup',
      category: 'Newsletter',
      defaultConfig: {
        name: 'Newsletter Signup',
        description: 'Email newsletter subscription'
      }
    },
    {
      type: 'newsletter-archive',
      category: 'Newsletter',
      defaultConfig: {
        name: 'Newsletter Archive',
        description: 'Past newsletter issues'
      }
    },
    // 21. Stats
    {
      type: 'stats-counters',
      category: 'Stats',
      defaultConfig: {
        name: 'Statistics Counters',
        description: 'Animated statistics display'
      }
    },
    {
      type: 'stats-progress',
      category: 'Stats',
      defaultConfig: {
        name: 'Progress Stats',
        description: 'Progress bar statistics'
      }
    },
    // 22. 404 Page
    {
      type: '404-creative',
      category: '404 Page',
      defaultConfig: {
        name: 'Creative 404',
        description: 'Creative not found page'
      }
    },
    {
      type: '404-minimal',
      category: '404 Page',
      defaultConfig: {
        name: 'Minimal 404',
        description: 'Simple not found page'
      }
    },
    // 23. Call-to-Action
    {
      type: 'cta-banner',
      category: 'Call-to-Action',
      defaultConfig: {
        name: 'CTA Banner',
        description: 'Call-to-action banner'
      }
    },
    {
      type: 'cta-popup',
      category: 'Call-to-Action',
      defaultConfig: {
        name: 'CTA Popup',
        description: 'Popup call-to-action'
      }
    },
    // 24. Logo Clouds
    {
      type: 'logo-clouds-grid',
      category: 'Logo Clouds',
      defaultConfig: {
        name: 'Logo Cloud Grid',
        description: 'Partner/client logos grid'
      }
    },
    {
      type: 'logo-clouds-ticker',
      category: 'Logo Clouds',
      defaultConfig: {
        name: 'Logo Cloud Ticker',
        description: 'Scrolling logo banner'
      }
    },
    // 25. Waiting List
    {
      type: 'waiting-list-signup',
      category: 'Waiting List',
      defaultConfig: {
        name: 'Waiting List Signup',
        description: 'Early access waiting list'
      }
    },
    {
      type: 'waiting-list-progress',
      category: 'Waiting List',
      defaultConfig: {
        name: 'Waiting List Progress',
        description: 'Waiting list with progress indicator'
      }
    },
    // 26. Coming Soon
    {
      type: 'coming-soon-countdown',
      category: 'Coming Soon',
      defaultConfig: {
        name: 'Coming Soon Countdown',
        description: 'Countdown to launch'
      }
    },
    {
      type: 'coming-soon-notification',
      category: 'Coming Soon',
      defaultConfig: {
        name: 'Coming Soon Notification',
        description: 'Launch notification signup'
      }
    },
    // 27. Link in Bio
    {
      type: 'link-bio-grid',
      category: 'Link in Bio',
      defaultConfig: {
        name: 'Bio Links Grid',
        description: 'Social media link collection'
      }
    },
    {
      type: 'link-bio-card',
      category: 'Link in Bio',
      defaultConfig: {
        name: 'Bio Link Card',
        description: 'Card-style bio links'
      }
    },
    // 28. Portfolio
    {
      type: 'portfolio-grid',
      category: 'Portfolio',
      defaultConfig: {
        name: 'Portfolio Grid',
        description: 'Portfolio items grid'
      }
    },
    {
      type: 'portfolio-masonry',
      category: 'Portfolio',
      defaultConfig: {
        name: 'Portfolio Masonry',
        description: 'Masonry portfolio layout'
      }
    },
    // 29. Store Navigation
    {
      type: 'store-nav-categories',
      category: 'Store Navigation',
      defaultConfig: {
        name: 'Store Categories',
        description: 'Product category navigation'
      }
    },
    {
      type: 'store-nav-breadcrumb',
      category: 'Store Navigation',
      defaultConfig: {
        name: 'Store Breadcrumb',
        description: 'E-commerce breadcrumb navigation'
      }
    },
    // 30. Product Overview
    {
      type: 'product-overview-detailed',
      category: 'Product Overview',
      defaultConfig: {
        name: 'Detailed Product Overview',
        description: 'Comprehensive product information'
      }
    },
    {
      type: 'product-overview-quick',
      category: 'Product Overview',
      defaultConfig: {
        name: 'Quick Product Overview',
        description: 'Brief product summary'
      }
    }
  ]
  
  // Create all component types (60 components across 30 categories)
  for (const def of componentDefinitions) {
    const component = await prisma.websiteComponentType.create({
      data: {
        type: def.type,
        category: def.category,
        version: '1.0.0',
        defaultConfig: def.defaultConfig,
        placeholderData: {
          sampleData: `Placeholder content for ${def.type}`,
          category: def.category,
          type: def.type,
          story: '18.8-seed-data'
        },
        aiMetadata: {
          detectionPatterns: [def.category.toLowerCase(), def.type],
          confidence: 0.85,
          category: def.category
        },
        confidence: 0.85,
        isGlobal: def.isGlobal || false,
        websiteId,
        createdBy: 'story-18.8-seed'
      }
    })
    components.push(component)
  }
  
  console.log(`✅ Created ${components.length} WebsiteComponentTypes for Story 18.8 (all 30 categories)`)
  
  return components.length
}