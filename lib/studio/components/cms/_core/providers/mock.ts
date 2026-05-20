import {
  ContentResource,
  registerContentProvider,
  ContentResult,
  ContentQuery,
  BlogPostFilters,
  TeamMemberFilters,
  BlogPostProvider,
  TeamMemberProvider,
  ContentFeedProvider,
  ContentFeedFilters
} from '../data-providers';
import type { BlogPost } from '../../blog/blog-list/blog-list.types';
import type { TeamMemberData } from '../../about/team-grid/team-grid.types';
import type { ContentFeedItem } from '../../content/content-feed/content-feed.types';

const mockBlogPosts: BlogPost[] = [
  {
    id: 'mock-blog-1',
    title: 'Announcing Catalyst Studio',
    excerpt: 'Get a first look at the features shipping with Catalyst Studio and how teams can accelerate content production.',
    thumbnail: '/mock/blog/studio-launch.jpg',
    author: { name: 'Catalyst Team', avatar: '/mock/authors/catalyst-team.jpg' },
    publishDate: '2024-01-04',
    readingTime: 6,
    categories: ['Product', 'Announcements'],
    tags: ['release', 'studio'],
    slug: 'announcing-catalyst-studio',
    views: 312,
    likes: 44
  },
  {
    id: 'mock-blog-2',
    title: 'Designing a Scalable Component Library',
    excerpt: 'A step-by-step guide to designing component systems that scale across teams without sacrificing craft.',
    thumbnail: '/mock/blog/component-library.jpg',
    author: { name: 'Casey Brooks', avatar: '/mock/authors/casey.jpg' },
    publishDate: '2023-12-15',
    readingTime: 8,
    categories: ['Design'],
    tags: ['design systems', 'workflows'],
    slug: 'designing-a-scalable-component-library',
    views: 198,
    likes: 29
  },
  {
    id: 'mock-blog-3',
    title: 'Building Faster Marketing Sites with Visual Editing',
    excerpt: 'See how marketing teams ship pages in hours instead of weeks using Catalyst Studio’s visual editing toolkit.',
    thumbnail: '/mock/blog/visual-editing.jpg',
    author: { name: 'Lina Chen', avatar: '/mock/authors/lina.jpg' },
    publishDate: '2023-12-01',
    readingTime: 5,
    categories: ['Marketing', 'Case Study'],
    tags: ['visual editing', 'go-to-market'],
    slug: 'building-faster-marketing-sites',
    views: 264,
    likes: 36
  },
  {
    id: 'mock-blog-4',
    title: 'From Draft to Launch: Editorial Workflows that Scale',
    excerpt: 'Learn how automation and role-based workflows keep content moving even as teams grow.',
    thumbnail: '/mock/blog/editorial-workflow.jpg',
    author: { name: 'Amir Shah', avatar: '/mock/authors/amir.jpg' },
    publishDate: '2023-11-20',
    readingTime: 7,
    categories: ['Operations'],
    tags: ['workflow', 'automation'],
    slug: 'editorial-workflows-that-scale',
    views: 174,
    likes: 21
  },
  {
    id: 'mock-blog-5',
    title: 'Telemetry-Driven UX Decisions',
    excerpt: 'An inside look at metrics that inform our product roadmap and how you can adopt them for your organization.',
    thumbnail: '/mock/blog/telemetry.jpg',
    author: { name: 'Catalyst Analytics', avatar: '/mock/authors/analytics.jpg' },
    publishDate: '2023-11-02',
    readingTime: 4,
    categories: ['Product', 'Analytics'],
    tags: ['telemetry', 'ux'],
    slug: 'telemetry-driven-ux-decisions',
    views: 146,
    likes: 18
  }
];

const mockTeamMembers: TeamMemberData[] = [
  {
    id: 'mock-team-1',
    name: 'Maya Patel',
    title: 'Head of Product',
    department: 'Product',
    photo: '/mock/team/maya.jpg',
    bio: 'Maya leads the Catalyst roadmap, bringing 12 years of product experience across SaaS and design tooling.',
    linkedin: 'https://www.linkedin.com/in/example-maya',
    twitter: 'https://twitter.com/examplemaya'
  },
  {
    id: 'mock-team-2',
    name: 'Owen Kelly',
    title: 'Design Systems Lead',
    department: 'Design',
    photo: '/mock/team/owen.jpg',
    bio: 'Owen champions inclusive design practices and runs design reviews across the Catalyst platform.',
    linkedin: 'https://www.linkedin.com/in/example-owen'
  },
  {
    id: 'mock-team-3',
    name: 'Sofia Martinez',
    title: 'Engineering Director',
    department: 'Engineering',
    photo: '/mock/team/sofia.jpg',
    bio: 'Sofia steers engineering execution, specializing in performant rendering pipelines and developer experience.',
    linkedin: 'https://www.linkedin.com/in/example-sofia'
  },
  {
    id: 'mock-team-4',
    name: 'Ethan Wright',
    title: 'Lead Solutions Architect',
    department: 'Customer Success',
    photo: '/mock/team/ethan.jpg',
    bio: 'Ethan partners with customer teams to implement Catalyst Studio in highly regulated environments.',
    linkedin: 'https://www.linkedin.com/in/example-ethan'
  },
  {
    id: 'mock-team-5',
    name: 'Priya Desai',
    title: 'Head of Enablement',
    department: 'Go-To-Market',
    photo: '/mock/team/priya.jpg',
    bio: 'Priya creates onboarding programs and training curricula that help customers get value in days, not months.',
    linkedin: 'https://www.linkedin.com/in/example-priya'
  }
];

function sliceByLimit<T>(items: T[], limit?: number): T[] {
  if (!limit || limit < 0) {
    return [...items];
  }
  return items.slice(0, limit);
}

const blogProvider: BlogPostProvider = {
  fetch(query: ContentQuery<BlogPostFilters>): ContentResult<BlogPost> {
    const { filters, limit, sort } = query;
    const excludeIds = new Set(filters?.excludeIds ?? []);
    const categories = filters?.categories;
    const tags = filters?.tags;

    const filtered = mockBlogPosts.filter(post => {
      if (excludeIds.has(post.id)) return false;
      const matchesCategory = !categories || categories.length === 0 || categories.some(cat => post.categories.includes(cat));
      const matchesTag = !tags || tags.length === 0 || tags.some(tag => post.tags.includes(tag));
      return matchesCategory && matchesTag;
    });

    const [sortField, sortDirection] = sort?.[0]
      ? [sort[0].field, sort[0].direction ?? 'desc']
      : ['date', 'desc'];

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'popularity':
          return direction * (((a.views ?? 0) + (a.likes ?? 0)) - ((b.views ?? 0) + (b.likes ?? 0)));
        case 'readingTime':
          return direction * ((a.readingTime ?? 0) - (b.readingTime ?? 0));
        case 'date':
        default:
          return direction * (new Date(a.publishDate ?? '').getTime() - new Date(b.publishDate ?? '').getTime());
      }
    });

    const items = sliceByLimit(sorted, limit);

    return {
      items,
      total: sorted.length,
      hasMore: items.length < sorted.length
    };
  }
};

const teamProvider: TeamMemberProvider = {
  fetch(query: ContentQuery<TeamMemberFilters>): ContentResult<TeamMemberData> {
    const { filters, limit } = query;
    const excludeIds = new Set(filters?.excludeIds ?? []);

    const filtered = mockTeamMembers.filter(member => {
      if (excludeIds.has(member.id)) return false;
      const departmentMatch = !filters?.department || member.department?.toLowerCase() === filters.department.toLowerCase();
      const roleMatch = !filters?.role || member.title.toLowerCase().includes(filters.role.toLowerCase());
      const locationMatch = !filters?.location || (member as any).location?.toLowerCase() === filters.location.toLowerCase();
      return departmentMatch && roleMatch && locationMatch;
    });

    const items = sliceByLimit(filtered, limit);

    return {
      items,
      total: filtered.length,
      hasMore: items.length < filtered.length
    };
  }
};

registerContentProvider(ContentResource.BlogPosts, blogProvider);
registerContentProvider(ContentResource.TeamMembers, teamProvider);

const mockFeedItems: ContentFeedItem[] = [
  {
    id: 'feed-1',
    title: 'Dynamic feed placeholder',
    summary: 'Auto-updating content pulled from your CMS.',
    publishDate: '2024-01-01',
    href: '/news/feed-1',
    categories: ['News'],
  },
  {
    id: 'feed-2',
    title: 'Second feed item',
    summary: 'Demonstrates sorting and pinned behavior.',
    publishDate: '2024-01-02',
    href: '/news/feed-2',
    categories: ['Updates'],
  },
  {
    id: 'feed-3',
    title: 'Third feed item',
    summary: 'Used for pagination fixtures.',
    publishDate: '2024-01-03',
    href: '/news/feed-3',
    categories: ['Updates'],
  },
];

const contentFeedProvider: ContentFeedProvider = {
  fetch(query: ContentQuery<ContentFeedFilters>) {
    const excludeIds = new Set(query.filters?.excludeIds ?? []);
    const filtered = mockFeedItems.filter(item => !item.id || !excludeIds.has(item.id));
    const limit = query.limit ?? filtered.length;
    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
      hasMore: filtered.length > limit,
    };
  },
};

export {
  blogProvider as mockBlogContentProvider,
  teamProvider as mockTeamContentProvider,
  contentFeedProvider as mockContentFeedProvider,
};
