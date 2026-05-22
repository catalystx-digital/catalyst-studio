import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const contentCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.TextBlock,
    componentType: ComponentType.TextBlock,
    summary: 'Text block for headings, subheadings, and rich body copy.',
    fragments: ['heading', 'subheading', 'rich-text'],
    cues: ['text block', 'rich text', 'content section'],
    sampleContent: {
      heading: 'Build content faster',
      subheading: 'Pair AI assistance with guardrails.',
      body: '<p>Our visual editor brings structured content and styling together so teams ship faster.</p>',
      alignment: 'left'
    }
  },
  {
    canonicalType: ComponentType.TwoColumn,
    componentType: ComponentType.TwoColumn,
    summary: 'Layout wrapper for side-by-side content. Use when visual separation exists between content sections. Wraps sidebar + content, image + text, or any two columns displayed horizontally. Supports nested components in each column.',
    fragments: ['left-column', 'right-column', 'sidebar-content', 'split-layout', 'flex-row', 'grid-cols-2'],
    cues: [
      'two column layout',
      'split content',
      'side-by-side',
      'sidebar with content',
      'navigation panel',
      'left nav',
      'sidemenu layout',
      'flex row',
      'grid columns',
      'visual separation'
    ],
    sampleContent: {
      columnRatio: '25-75',
      leftColumn: [
        {
          type: 'sidemenu',
          content: {
            title: 'Section Navigation',
            items: [
              { label: 'Overview', href: '/overview' },
              { label: 'Details', href: '/details' }
            ]
          }
        }
      ],
      rightColumn: [
        {
          type: 'breadcrumbs',
          content: {
            items: [
              { label: 'Home', href: '/' },
              { label: 'Section', href: '/section' }
            ]
          }
        },
        {
          type: 'html-block',
          content: {
            title: 'Page Content',
            bodyHtml: '<p>Main content area with rich HTML content.</p>'
          }
        }
      ]
    }
  },
  {
    canonicalType: ComponentType.ImageGallery,
    componentType: ComponentType.ImageGallery,
    summary: 'Image gallery section for media grids, photo collections, and captions.',
    fragments: ['image', 'caption', 'lightbox'],
    cues: ['image gallery', 'media grid', 'photo section'],
    sampleContent: {
      displayMode: 'grid',
      columns: 3,
      images: [
        {
          url: 'https://cdn.example.com/gallery/office-1.jpg',
          alt: 'Team working in modern office',
          caption: 'Collaboration in Catalyst Studio.'
        },
        {
          url: 'https://cdn.example.com/gallery/office-2.jpg',
          alt: 'Product manager reviewing designs'
        },
        {
          url: 'https://cdn.example.com/gallery/office-3.jpg',
          alt: 'Developer presenting results'
        }
      ],
      enableLightbox: true
    }
  },
  {
    canonicalType: ComponentType.VideoPlayer,
    componentType: ComponentType.VideoPlayer,
    summary: 'Video player for hosted video with poster image, captions, and playback controls.',
    fragments: ['video-player', 'play-button', 'caption'],
    cues: ['video player', 'product demo video', 'embedded video'],
    sampleContent: {
      title: 'Product walkthrough',
      description: 'Explore the editorial workflow in two minutes.',
      sources: [
        { url: 'https://videos.example.com/catalyst-demo.mp4', type: 'mp4' }
      ],
      posterImage: 'https://cdn.example.com/video/poster.jpg',
      controls: true,
      autoPlay: false
    }
  },
  {
    canonicalType: ComponentType.VideoEmbed,
    componentType: ComponentType.VideoEmbed,
    summary: 'Embed external video players such as YouTube or Vimeo with responsive aspect ratios.',
    fragments: ['embed-frame', 'responsive-wrapper'],
    cues: ['video embed', 'iframe video', 'external video'],
    sampleContent: {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=1234567890',
      title: 'Customer spotlight',
      allowFullScreen: true,
      aspectRatio: '16:9'
    }
  },
  {
    canonicalType: ComponentType.QuoteBlock,
    componentType: ComponentType.QuoteBlock,
    summary: 'Quote block for testimonials, pull quotes, or attributed statements.',
    fragments: ['quote', 'attribution'],
    cues: ['quote', 'testimonial quote', 'pull quote'],
    sampleContent: {
      heading: 'Customer spotlight',
      quote: 'Catalyst Studio helped our team ship new experiences 4x faster.',
      attribution: {
        author: 'Amelia Rogers',
        title: 'Director of Digital, Everlake Insurance',
        image: 'https://cdn.example.com/customers/amelia.jpg'
      },
      style: 'testimonial'
    }
  },
  {
    canonicalType: ComponentType.ContentFeed,
    componentType: ComponentType.ContentFeed,
    summary: 'News feed, blog listing, or article section displaying chronological content items. Use for any "Latest News", "Recent Posts", or similar sections with dated/linked articles. Supports both static imported items and dynamic provider queries.',
    fragments: ['news-listing', 'blog-feed', 'article-list', 'news-cards', 'post-grid'],
    cues: ['news', 'latest news', 'recent news', 'blog posts', 'articles', 'announcements', 'updates', 'whats new'],
    sampleContent: {
      heading: 'Latest News',
      layout: 'card-grid',
      limit: 6,
      items: [
        { id: 'feed-item-example-1', title: 'School Holidays Announced', href: '/news/holidays-2024', excerpt: 'Important dates for the upcoming term break...', date: '2024-02-20', category: 'Announcements' },
        { id: 'feed-item-example-2', title: 'Community Event Success', href: '/news/community-event', excerpt: 'Thank you to everyone who attended...', date: '2024-02-18', category: 'Events' }
      ]
    }
  },
  {
    canonicalType: ComponentType.HtmlBlock,
    componentType: ComponentType.HtmlBlock,
    summary: 'HTML content block for imported rich text, documentation, or long-form page body content.',
    fragments: ['html-content', 'rich-text', 'page-body', 'article-content'],
    cues: ['content page', 'documentation', 'resource page', 'information page', 'wysiwyg content'],
    sampleContent: {
      title: 'Advance Care Planning',
      bodyHtml: '<p>Advance care planning is a process of thinking about, discussing and documenting your values, beliefs and preferences for future healthcare.</p><h2>Why is it important?</h2><p>Having conversations now helps ensure your wishes are known if you cannot speak for yourself in the future.</p>',
      sourceUrl: '/advancecareplanning/'
    }
  }
]

export function registerContentCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of contentCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
