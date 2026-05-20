import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { synthesizeBlogList, synthesizeBlogPost } from './blog-synthesis'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const blogCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: 'blog-post',
    componentType: ComponentType.BlogPost,
    summary:
      'Use for article detail templates that combine hero, body content, and author metadata into a single component.',
    fragments: ['article-header', 'author-bio', 'text-block', 'rich-text', 'image-gallery', 'quote-block'],
    cues: ['article detail', 'news story', 'blog post', 'press release'],
    sampleContent: {
      title: 'Barc x Farmgate Meats Launch Local Market',
      subtitle: 'Regional butchers partner with Bathurst City Centre to open a new farm-to-market concept.',
      excerpt: 'Regional retailers join forces to deliver a fresh market experience for local customers.',
      publishDate: '2024-07-12',
      readingTime: '6 min read',
      bodyHtml: '<p>Opening paragraph describing the partnership.</p><p>Support details and quotes.</p>',
      categories: ['Retail'],
      tags: ['Local news', 'Partnership'],
      heroImage: { src: 'https://example.com/images/hero.jpg', alt: 'Farmgate Meats storefront' },
      author: { name: 'Jane Smith', title: 'Food Editor' }
    },
    synthesizer: synthesizeBlogPost
  },
  {
    canonicalType: 'blog-list',
    componentType: ComponentType.BlogList,
    summary:
      'Use for blog index templates. Aggregate teaser cards into posts[] sorted chronologically with optional pagination metadata.',
    fragments: ['blog-card', 'card-grid', 'article-preview', 'article-teaser'],
    cues: ['blog index', 'news list', 'resources overview', 'stories overview'],
    sampleContent: {
      title: 'Latest Articles',
      description: 'Fresh stories from Bathurst City Centre.',
      posts: [
        {
          id: 'barc-x-farmgate-meats',
          title: 'Barc x Farmgate Meats Launch Local Market',
          excerpt: 'Regional butchers partner with the centre to open a new farm-to-market concept.',
          slug: 'barc-x-farmgate-meats',
          publishDate: '2024-07-12',
          author: { name: 'Jane Smith' },
          categories: ['Retail'],
          tags: ['Food'],
          featured: true
        },
        {
          id: 'school-holiday-guide',
          title: 'School Holiday Guide',
          excerpt: 'Activities and offers to entertain the family this winter.',
          slug: 'school-holiday-guide',
          publishDate: '2024-06-22',
          author: { name: 'Team Bathurst' },
          categories: ['Lifestyle'],
          tags: ['Family'],
          featured: false
        }
      ],
      showPagination: false
    },
    synthesizer: synthesizeBlogList
  },
  {
    canonicalType: ComponentType.ArticleHeader,
    componentType: ComponentType.ArticleHeader,
    summary: 'Article header with title, author metadata, publishing info, and hero media.',
    fragments: ['headline', 'author-meta', 'publish-date', 'hero-media'],
    cues: ['article header', 'post header', 'blog hero'],
    sampleContent: {
      title: 'Bathurst unveils new community market',
      subtitle: 'Local makers and growers open a permanent hub in the city center.',
      author: { name: 'Sofia Martinez', title: 'Community Reporter' },
      publishDate: '2024-07-12',
      readTimeMinutes: 5,
      categories: ['Community'],
      tags: ['Local partnerships', 'Events'],
      heroImage: { src: 'https://cdn.example.com/articles/bathurst-market.jpg', alt: 'Visitors exploring the Bathurst community market' }
    }
  },
  {
    canonicalType: ComponentType.AuthorBio,
    componentType: ComponentType.AuthorBio,
    summary: 'Author biography module with avatar, role, links, and optional social proof.',
    fragments: ['author-avatar', 'author-name', 'author-links'],
    cues: ['author bio', 'about the author', 'writer bio'],
    sampleContent: {
      name: 'Sofia Martinez',
      title: 'Community Reporter',
      bio: 'Sofia covers regional retail and community partnerships for Bathurst City Centre.',
      avatar: 'https://cdn.example.com/authors/sofia-martinez.jpg',
      socialLinks: [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/sofia-martinez/' },
        { label: 'Twitter', url: 'https://twitter.com/sofiawrites' }
      ]
    }
  },
  {
    canonicalType: ComponentType.RelatedPosts,
    componentType: ComponentType.RelatedPosts,
    summary: 'Related article rail highlighting additional content to continue the reading journey.',
    fragments: ['related-card', 'card-list'],
    cues: ['related posts', 'more stories', 'you might also like'],
    sampleContent: {
      heading: 'More stories from the center',
      posts: [
        { id: 'artisan-food-trail', title: 'Artisan Food Trail launches this spring', href: '/articles/artisan-food-trail', publishDate: '2024-06-18' },
        { id: 'winter-festival', title: 'Winter festival brings live music downtown', href: '/articles/winter-festival', publishDate: '2024-05-30' },
        { id: 'makers-program', title: 'Makers-in-residence program expands', href: '/articles/makers-program', publishDate: '2024-05-15' }
      ],
      layout: 'grid'
    }
  }
]

export function registerBlogCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of blogCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
