# Blog Components

A comprehensive collection of blog and article components for content management systems.

## Components

### BlogList
Displays a collection of blog posts with grid/list layouts, pagination, filtering, and sorting capabilities.
Auto loads content from the configured provider and lets editors pin specific posts when needed.

**Features:**
- Grid and list view modes
- Pagination support
- Category and tag filtering
- Sort by date, popularity, or reading time
- Responsive design (1-4 columns)
- Performance threshold: <50ms render time

### BlogCard
Individual blog post preview card with thumbnail, excerpt, metadata, and hover effects.

**Features:**
- Featured badge support
- Reading time calculation
- Author information with avatar
- Category/tag display
- Social engagement stats (views, likes, comments)
- Multiple image aspect ratios
- Hover animations

### ArticleHeader
Blog post title with comprehensive metadata display.

**Features:**
- Featured image support (above, below, or background)
- Breadcrumb navigation
- Author details with avatar
- Publish and update dates
- Reading time display
- Category and tag badges
- Social share buttons
- Responsive design

### AuthorBio
Author information box with photo, bio, social links, and statistics.

**Features:**
- Author photo and title
- Expandable bio content
- Social media links
- Article/follower statistics
- Expertise tags
- Multiple layouts (horizontal, vertical, compact)
- Follow button support

### RelatedPosts
Displays a grid of suggested articles based on categories or tags. Auto-selection is preferred, with optional manual overrides for spotlight posts.

**Features:**
- Manual or automatic selection
- Grid, list, or carousel display modes
- 3-6 related posts
- Thumbnail and excerpt support
- Category-based or tag-based suggestions
- Responsive grid layout

## Usage

### Import Components

```typescript
import BlogListWithPerformance from '@/lib/studio/components/cms/blog/blog-list';
import BlogCardWithPerformance from '@/lib/studio/components/cms/blog/blog-card';
import ArticleHeaderWithPerformance from '@/lib/studio/components/cms/blog/article-header';
import AuthorBioWithPerformance from '@/lib/studio/components/cms/blog/author-bio';
import RelatedPostsWithPerformance from '@/lib/studio/components/cms/blog/related-posts';
```

### Component Registration

All blog components are automatically registered with the CMS component factory through the `register.ts` file.

### Example Usage

```tsx
// Blog List
<BlogListWithPerformance
  id="blog-list-1"
  type={ComponentType.BlogList}
  category={ComponentCategory.Blog}
  content={{
    posts: blogPosts,
    title: "Latest Articles",
    viewMode: "grid",
    columns: 3,
    showPagination: true,
    postsPerPage: 9
  }}
  onPostClick={(post) => navigateToPost(post.slug)}
/>

// Article Header
<ArticleHeaderWithPerformance
  id="article-header-1"
  type={ComponentType.ArticleHeader}
  category={ComponentCategory.Blog}
  content={{
    title: "Understanding React Hooks",
    author: { name: "Jane Developer", avatar: "/jane.jpg" },
    publishDate: "2024-01-15",
    readingTime: 10,
    categories: ["React", "JavaScript"],
    featuredImage: {
      src: "/featured.jpg",
      alt: "React Hooks"
    }
  }}
/>
```

## Security Features

All blog components include built-in security features:
- HTML sanitization using DOMPurify
- Text sanitization for user-generated content
- URL validation for social links
- XSS prevention

## Performance

All components are wrapped with performance tracking and meet the following thresholds:
- Render time: <50ms
- Bundle size: <10KB per component
- Lazy loading support for images
- Optimized with Next.js Image component

## Accessibility

All components follow WCAG 2.1 AA standards:
- Proper ARIA attributes
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- Semantic HTML structure

## Testing

Each component includes comprehensive unit tests with >80% coverage:
- Render tests
- Performance tests
- Accessibility audits
- Security sanitization tests
- Responsive behavior tests
- User interaction tests

## Utilities

### Reading Time Calculator
```typescript
import { calculateReadingTime, formatReadingTime } from '@/lib/studio/components/cms/blog/utils';

const minutes = calculateReadingTime(articleText);
const formatted = formatReadingTime(minutes); // "5 min read"
```

## AI Detection

All components include AI metadata for automatic detection and placement:
- Keyword matching
- Pattern recognition
- Confidence scoring
- Page location suggestions
- Related component recommendations
