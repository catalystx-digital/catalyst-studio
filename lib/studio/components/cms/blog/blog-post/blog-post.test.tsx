import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';
import BlogPost from './index';
import { ComponentCategory, ComponentType } from '../../_core/types';
import type { BlogPostProps } from './blog-post.types';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('BlogPost rich text rendering', () => {
  const baseProps: BlogPostProps = {
    id: 'blog-post-test',
    type: ComponentType.BlogPost,
    category: ComponentCategory.Blog,
    content: {
      title: 'Design tokens for long-form content',
      subtitle: 'Ensure shadcn typography stays aligned',
      excerpt: 'This article explains how to compose markdown with Cms wrappers.',
      bodyHtml: `
        <h2>Introduction</h2>
        <p>This is a <strong>sample</strong> body with <em>rich</em> text.</p>
        <ul><li>First point</li><li>Second point</li></ul>
        <blockquote>Design systems love consistency.</blockquote>
        <pre><code>console.log('tokens');</code></pre>
        <table><thead><tr><th>Token</th><th>Value</th></tr></thead><tbody><tr><td>Heading</td><td>200</td></tr></tbody></table>
        <script>alert('xss')</script>
      `,
      heroImage: {
        src: 'https://example.com/hero.jpg',
        alt: 'Hero banner',
        caption: 'Marketing insights',
        credit: 'Catalyst Studio',
      },
      author: {
        name: 'Jamie Lee',
        title: 'Editor in Chief',
        bio: 'Jamie curates CMS best practices.',
        image: 'https://example.com/avatar.jpg',
      },
      publishDate: '2024-05-01',
      updatedDate: '2024-05-02',
      tags: ['Tokens', 'Design'],
      categories: ['Guides'],
      relatedLinks: [{ label: 'Design docs', url: 'https://example.com/docs' }],
      attachments: [{ label: 'Download PDF', url: 'https://example.com/guide.pdf' }],
    },
    showAuthor: true,
    showShareActions: true,
    shareActions: [
      { label: 'Share on LinkedIn', icon: 'Linkedin', url: 'https://linkedin.com/share' },
    ],
  };

  it('renders markdown elements and strips unsafe tags', async () => {
    const { container } = render(<BlogPost {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Design tokens for long-form content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Introduction' })).toBeInTheDocument();

    expect(container.querySelector('p strong')).toHaveTextContent('sample');
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent("console.log('tokens');");
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
