# About/Team Components

## Overview
The about category provides 3 components for presenting company information and team members. These components help build trust and establish credibility with your audience.

## Components

> **Note:** The legacy standalone timeline component has been removed. Use `@/lib/studio/components/cms/data/timeline` for chronological layouts, including AboutSection's timeline mode.

### TeamGrid
-Grid layout for displaying team members. Auto fills from the team directory and supports optional spotlight overrides.
- **Use Case**: Team pages, department overviews, board members
- **Features**: Responsive grid, filter by role, social links, hybrid auto/manual population
- **Import**: `@/lib/studio/components/cms/about/team-grid`

### TeamMember
Individual team member card with details.
- **Use Case**: Team member profiles, speaker cards, author bios
- **Features**: Photo, bio, contact info, social links
- **Import**: `@/lib/studio/components/cms/about/team-member`

### AboutSection
Company information and story section.
- **Use Case**: About us pages, company history, mission statements
- **Features**: Timeline layout (via data timeline), statistics, rich content, media support
- **Import**: `@/lib/studio/components/cms/about/about-section`

## Usage Example

```tsx
import { TeamGrid } from '@/lib/studio/components/cms/about/team-grid';
import { AboutSection } from '@/lib/studio/components/cms/about/about-section';

export function AboutPage() {
  const teamMembers = [
    {
      id: '1',
      name: 'Jane Smith',
      role: 'CEO & Founder',
      photo: '/team/jane.jpg',
      bio: 'Jane founded the company with a vision...',
      social: {
        linkedin: 'https://linkedin.com/in/janesmith',
        twitter: 'https://twitter.com/janesmith'
      }
    },
    {
      id: '2',
      name: 'John Doe',
      role: 'CTO',
      photo: '/team/john.jpg',
      bio: 'John leads our technology initiatives...',
      social: {
        linkedin: 'https://linkedin.com/in/johndoe',
        github: 'https://github.com/johndoe'
      }
    }
  ];

  return (
    <div>
      <AboutSection
        title="Our Story"
        content="Founded in 2020, we've grown from a small startup..."
        stats={[
          { label: 'Employees', value: '150+' },
          { label: 'Customers', value: '10,000+' },
          { label: 'Countries', value: '25' }
        ]}
        timeline={[
          { year: '2020', event: 'Company founded' },
          { year: '2021', event: 'Series A funding' },
          { year: '2023', event: 'Global expansion' }
        ]}
      />
      
      <TeamGrid
        title="Meet Our Team"
        members={teamMembers}
        columns={3}
        filter={true}
      />
    </div>
  );
}
```

## Configuration Options

### TeamGrid Layouts
- **Grid**: Standard grid layout (2-4 columns)
- **Carousel**: Sliding carousel for large teams
- **Filtered**: With role/department filters
- **Expanded**: Detailed view with full bios

### TeamMember Variants
- **Compact**: Photo and name only
- **Standard**: Photo, name, role, brief bio
- **Detailed**: Full profile with contact info
- **Card**: Hover-reveal details

### AboutSection Styles
- **Corporate**: Professional, clean design
- **Startup**: Modern, dynamic layout
- **Creative**: Bold, artistic presentation
- **Minimal**: Clean, text-focused

## Data Structure

### Team Member Schema
```typescript
interface TeamMember {
  id: string;
  name: string;
  role: string;
  department?: string;
  photo: string;
  photoAlt?: string;
  bio?: string;
  email?: string;
  phone?: string;
  location?: string;
  social?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    website?: string;
  };
  skills?: string[];
  languages?: string[];
}
```

### Company Info Schema
```typescript
interface CompanyInfo {
  name: string;
  founded: string;
  mission: string;
  vision: string;
  values: string[];
  stats: Array<{
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
  }>;
  timeline: Array<{
    year: string;
    event: string;
    description?: string;
  }>;
}
```

## Best Practices

### Images
- Use consistent aspect ratios for team photos
- Optimize images (WebP with fallbacks)
- Provide meaningful alt text
- Consider lazy loading for large teams

### Content
- Keep bios concise (50-150 words)
- Focus on achievements and expertise
- Include relevant keywords for SEO
- Update information regularly

### Performance
- Lazy load team member images
- Paginate large team lists
- Use skeleton loaders while loading
- Implement search/filter for large teams

## SEO Optimization
- Use structured data (Person schema)
- Include meta tags for team pages
- Optimize URLs (/team/member-name)
- Add OpenGraph tags for sharing

## Accessibility
- Provide alt text for all images
- Use semantic HTML structure
- Ensure keyboard navigation
- Add ARIA labels for social links

## Related Components
- Mission statement component
- Company values display
- Office locations map
- Career opportunities section

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Content Strategy](../_docs/content-strategy.md)
- [API Reference](../_docs/api-reference.md)
