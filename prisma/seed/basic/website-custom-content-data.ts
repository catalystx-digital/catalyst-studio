import { PrismaClient, WebsiteCustomContentData, ContentType } from '../../../lib/generated/prisma'

/**
 * Creates WebsiteCustomContentData records for blog posts, products, team members
 * These are pure data records with no routing information
 */
export async function createWebsiteCustomContentData(
  prisma: PrismaClient,
  websiteId: string,
  contentTypes: ContentType[]
): Promise<WebsiteCustomContentData[]> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const customData: WebsiteCustomContentData[] = []

      // Find or create blog post content type
      let blogContentType = contentTypes.find(ct => ct.key === 'blog_post' && ct.category === 'component')
      if (!blogContentType) {
        blogContentType = await tx.contentType.create({
          data: {
            key: 'blog_post',
            name: 'Blog Post',
            pluralName: 'Blog Posts',
            category: 'component', // Must be 'component' for WebsiteCustomContentData
            displayField: 'title',
            websiteId,
            fields: [
              { name: 'title', type: 'text', required: true, label: 'Title' },
              { name: 'slug', type: 'text', required: true, label: 'Slug' },
              { name: 'author', type: 'text', required: true, label: 'Author' },
              { name: 'publishDate', type: 'date', required: false, label: 'Publish Date' },
              { name: 'content', type: 'richtext', required: true, label: 'Content' },
              { name: 'excerpt', type: 'text', required: false, label: 'Excerpt' },
              { name: 'tags', type: 'array', required: false, label: 'Tags' },
              { name: 'featuredImage', type: 'image', required: false, label: 'Featured Image' }
            ]
          }
        })
      }

      // Create Blog Post 1 - Published
      const blogPost1 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'First Blog Post',
          contentTypeId: blogContentType.id,
          data: {
            title: 'First Blog Post',
            author: 'John Doe',
            publishDate: '2024-01-15',
            content: '<h2>Introduction</h2><p>Welcome to our first blog post! This article explores the exciting world of web development and shares insights from our journey.</p><h3>Key Topics</h3><ul><li>Modern JavaScript frameworks</li><li>Best practices for React development</li><li>Performance optimization techniques</li></ul><p>Stay tuned for more updates!</p>',
            excerpt: 'Welcome to our first blog post exploring web development insights.',
            tags: ['technology', 'web development', 'javascript', 'react'],
            featuredImage: '/images/blog/post1.jpg'
          },
          status: 'published',
          publishedAt: new Date('2024-01-15'),
          createdBy: 'seed-script'
        }
      })
      customData.push(blogPost1)

      // Create Blog Post 2 - Draft
      const blogPost2 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Understanding TypeScript Benefits',
          contentTypeId: blogContentType.id,
          data: {
            title: 'Understanding TypeScript Benefits',
            author: 'Jane Smith',
            publishDate: '2024-02-01',
            content: '<h2>Why TypeScript?</h2><p>TypeScript has become an essential tool in modern web development. In this post, we\'ll explore its key benefits.</p><h3>Type Safety</h3><p>One of the primary advantages is compile-time type checking...</p>',
            excerpt: 'Discover the key benefits of using TypeScript in your projects.',
            tags: ['typescript', 'programming', 'javascript', 'type-safety'],
            featuredImage: '/images/blog/post2.jpg'
          },
          status: 'draft',
          createdBy: 'seed-script'
        }
      })
      customData.push(blogPost2)

      // Create Blog Post 3 - Archived with special characters and unicode
      const blogPost3 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'International Dev Conference 2023 你好 مرحبا 🌍',
          contentTypeId: blogContentType.id,
          data: {
            title: 'International Dev Conference 2023 你好 مرحبا 🌍',
            author: 'Mike Chen & Sarah "Dev" Johnson',
            publishDate: '2023-12-15',
            content: '<h2>Conference Highlights 会议亮点</h2><p>The conference brought together developers from around the world 世界各地的开发者 🚀</p><blockquote>"The best conference I\'ve attended!" - Attendee</blockquote><p>Topics covered: AI/ML, Cloud Computing & DevOps</p>',
            excerpt: 'Recap of the International Dev Conference with speakers from 30+ countries',
            tags: ['conference', 'international', '多语言', 'networking', '🎉'],
            featuredImage: '/images/blog/conference.jpg'
          },
          status: 'archived',
          createdBy: 'seed-script'
        }
      })
      customData.push(blogPost3)

      // Find or create product content type
      let productContentType = contentTypes.find(ct => ct.key === 'product' && ct.category === 'component')
      if (!productContentType) {
        productContentType = await tx.contentType.create({
          data: {
            key: 'product',
            name: 'Product',
            pluralName: 'Products',
            category: 'component', // Must be 'component' for WebsiteCustomContentData
            displayField: 'name',
            websiteId,
            fields: [
              { name: 'name', type: 'text', required: true, label: 'Product Name' },
              { name: 'sku', type: 'text', required: true, label: 'SKU' },
              { name: 'price', type: 'number', required: true, label: 'Price' },
              { name: 'description', type: 'richtext', required: true, label: 'Description' },
              { name: 'category', type: 'text', required: true, label: 'Category' },
              { name: 'inStock', type: 'boolean', required: false, label: 'In Stock' },
              { name: 'images', type: 'array', required: false, label: 'Images' },
              { name: 'specifications', type: 'json', required: false, label: 'Specifications' }
            ]
          }
        })
      }

      // Create Product 1 - Studio Widget (Published)
      const product1 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Studio Widget',
          contentTypeId: productContentType.id,
          data: {
            name: 'Studio Widget',
            sku: 'WID-001',
            price: 99.99,
            description: '<p>High-quality widget designed for professional use. Features advanced functionality and studio materials.</p><ul><li>Durable construction</li><li>5-year warranty</li><li>Free shipping</li></ul>',
            category: 'Widgets',
            inStock: true,
            images: ['/images/products/widget1.jpg', '/images/products/widget1-alt.jpg'],
            specifications: {
              dimensions: '10x5x3 inches',
              weight: '2.5 lbs',
              material: 'Aluminum',
              color: 'Silver',
              warranty: '5 years'
            }
          },
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'seed-script'
        }
      })
      customData.push(product1)

      // Create Product 2 - Standard Gadget (Published)
      const product2 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Standard Gadget',
          contentTypeId: productContentType.id,
          data: {
            name: 'Standard Gadget',
            sku: 'GAD-002',
            price: 49.99,
            description: '<p>Reliable gadget for everyday use. Perfect balance of features and affordability.</p>',
            category: 'Gadgets',
            inStock: true,
            images: ['/images/products/gadget1.jpg'],
            specifications: {
              dimensions: '6x4x2 inches',
              weight: '1 lb',
              material: 'Plastic',
              color: 'Black',
              warranty: '1 year'
            }
          },
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'seed-script'
        }
      })
      customData.push(product2)

      // Create Product 3 - Deluxe Tool (Draft)
      const product3 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Deluxe Tool Set',
          contentTypeId: productContentType.id,
          data: {
            name: 'Deluxe Tool Set',
            sku: 'TOOL-003',
            price: 199.99,
            description: '<p>Professional-grade tool set with everything you need. Includes 50+ high-quality tools.</p>',
            category: 'Tools',
            inStock: false,
            images: ['/images/products/toolset.jpg'],
            specifications: {
              pieces: 52,
              case: 'Hard plastic carry case',
              material: 'Chrome vanadium steel',
              warranty: '10 years'
            }
          },
          status: 'draft',
          createdBy: 'seed-script'
        }
      })
      customData.push(product3)

      // Create Product 4 - Special Edition with Unicode (Published)
      const product4 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Special Edition Device™ Plus® 🔥',
          contentTypeId: productContentType.id,
          data: {
            name: 'Special Edition Device™ Plus® 🔥',
            sku: 'SPEC-004-™',
            price: 299.99,
            description: '<p>Limited edition device with exclusive features & design. Only 1000 units available worldwide! 限定版 🎯</p><p>Features "next-gen" technology with <strong>advanced AI</strong> capabilities.</p>',
            category: 'Special Edition',
            inStock: true,
            images: ['/images/products/special.jpg'],
            specifications: {
              edition: 'Limited ™',
              features: ['AI-powered', 'Voice control', '5G enabled'],
              languages: ['English', '中文', 'العربية', 'Español'],
              special: '© 2024 Special Features'
            }
          },
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'seed-script'
        }
      })
      customData.push(product4)

      // Find or create team member content type
      let teamContentType = contentTypes.find(ct => ct.key === 'team_member' && ct.category === 'component')
      if (!teamContentType) {
        teamContentType = await tx.contentType.create({
          data: {
            key: 'team_member',
            name: 'Team Member',
            pluralName: 'Team Members',
            category: 'component', // Must be 'component' for WebsiteCustomContentData
            displayField: 'name',
            websiteId,
            fields: [
              { name: 'name', type: 'text', required: true, label: 'Name' },
              { name: 'position', type: 'text', required: true, label: 'Position' },
              { name: 'department', type: 'text', required: false, label: 'Department' },
              { name: 'bio', type: 'richtext', required: false, label: 'Biography' },
              { name: 'email', type: 'email', required: false, label: 'Email' },
              { name: 'phone', type: 'text', required: false, label: 'Phone' },
              { name: 'photo', type: 'image', required: false, label: 'Photo' },
              { name: 'socialLinks', type: 'json', required: false, label: 'Social Links' }
            ]
          }
        })
      }

      // Create Team Member 1 (Published)
      const teamMember1 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Alice Johnson',
          contentTypeId: teamContentType.id,
          data: {
            name: 'Alice Johnson',
            position: 'CEO & Founder',
            department: 'Executive',
            bio: '<p>Alice founded the company in 2015 with a vision to revolutionize the industry. With over 15 years of experience in technology and business leadership, she has led the company to consistent growth and innovation.</p><p>Prior to founding the company, Alice worked at several Fortune 500 companies in leadership roles.</p>',
            email: 'alice.johnson@company.com',
            phone: '+1 (555) 123-4567',
            photo: '/images/team/alice.jpg',
            socialLinks: {
              linkedin: 'https://linkedin.com/in/alice-johnson',
              twitter: 'https://twitter.com/alicej',
              github: null
            }
          },
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'seed-script'
        }
      })
      customData.push(teamMember1)

      // Create Team Member 2 with minimal data and special characters (Published)
      const teamMember2 = await tx.websiteCustomContentData.create({
        data: {
          websiteId,
          title: 'Bob "The Builder" Smith Jr.',
          contentTypeId: teamContentType.id,
          data: {
            name: 'Bob "The Builder" Smith Jr.',
            position: 'CTO & Co-founder',
            department: 'Engineering',
            bio: '<p>Bob leads our technical team with expertise in cloud architecture & DevOps. He\'s passionate about building scalable solutions.</p>',
            email: null, // Testing null optional field
            phone: null, // Testing null optional field
            photo: '/images/team/bob.jpg',
            socialLinks: {
              linkedin: 'https://linkedin.com/in/bob-smith',
              twitter: null,
              github: 'https://github.com/bobsmith'
            }
          },
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'seed-script'
        }
      })
      customData.push(teamMember2)

      return customData
    })

    console.log(`✅ Created ${result.length} WebsiteCustomContentData records`)
    return result
  } catch (error) {
    console.error('❌ Failed to create WebsiteCustomContentData:', error)
    throw error
  }
}