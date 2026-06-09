import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CardGrid } from './index';
import { CardGridProps } from './card-grid.types';

const mockContent: CardGridProps['content'] = {
  heading: 'Our Services',
  subheading: 'Explore what we offer',
  cards: [
    {
      id: '1',
      title: 'Web Development',
      description: 'Build modern web applications with cutting-edge technologies.',
      image: '/images/web-dev.jpg',
      imageAlt: 'Web Development',
      link: '/services/web-development',
      linkText: 'Learn More',
      badge: 'Popular'
    },
    {
      id: '2',
      title: 'Mobile Apps',
      description: 'Native and cross-platform mobile application development.',
      image: '/images/mobile-apps.jpg',
      link: '/services/mobile-apps',
      metadata: {
        author: 'John Doe',
        date: '2024-01-15',
        category: 'Development'
      }
    },
    {
      id: '3',
      title: 'UI/UX Design',
      description: 'Create beautiful and intuitive user experiences.',
      icon: '🎨',
      actions: [
        { label: 'View Portfolio', url: '/portfolio', variant: 'primary' },
        { label: 'Contact', url: '/contact', variant: 'outline' }
      ]
    }
  ],
  columns: 3,
  gap: 'medium'
};

describe('CMSComponent: CardGrid', () => {
  it('renders with required props', () => {
    render(<CardGrid content={mockContent} />);
    
    expect(screen.getByText('Our Services')).toBeInTheDocument();
    expect(screen.getByText('Explore what we offer')).toBeInTheDocument();
    expect(screen.getByText('Web Development')).toBeInTheDocument();
  });

  it('renders all cards correctly', () => {
    render(<CardGrid content={mockContent} />);
    
    mockContent.cards.forEach(card => {
      expect(screen.getByText(card.title)).toBeInTheDocument();
      if (card.description) {
        expect(screen.getByText(card.description)).toBeInTheDocument();
      }
    });
  });

  it('renders card badges', () => {
    render(<CardGrid content={mockContent} />);
    
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('renders card metadata', () => {
    render(<CardGrid content={mockContent} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15').closest('div')).not.toHaveClass('text-[11px]', 'bg-muted/40');
  });

  it('renders card actions', () => {
    render(<CardGrid content={mockContent} />);
    
    expect(screen.getByText('View Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('renders card icons when no image', () => {
    render(<CardGrid content={mockContent} />);
    
    expect(screen.getByText('🎨')).toBeInTheDocument();
  });

  it('renders filter chips when provided', () => {
    const contentWithFilters = {
      ...mockContent,
      filters: [
        { id: 'filter-chip-events', label: 'Events', href: '/events', isActive: true },
        { id: 'filter-chip-offers', label: 'Offers' }
      ]
    };

    render(<CardGrid content={contentWithFilters} />);

    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Offers')).toBeInTheDocument();
  });

  it('resolves structured card and filter hrefs to renderable links', () => {
    const { container } = render(
      <CardGrid
        content={{
          ...mockContent,
          cards: [
            {
              id: 'structured-card',
              title: 'Structured Card',
              description: 'Uses href from the component definition defaults.',
              href: { type: 'internal', pageId: 'structured-card', path: '/structured-card' },
            },
          ],
          filters: [
            {
              id: 'filter-chip-structured',
              label: 'Structured',
              href: { type: 'internal', pageId: 'structured-filter', path: '/structured-filter' },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Learn more about Structured Card' })).toHaveAttribute('href', '/structured-card');
    expect(screen.getByRole('link', { name: 'Structured' })).toHaveAttribute('href', '/structured-filter');
  });

  it('handles card click with link', () => {
    const navigateHandler = jest.fn();
    window.addEventListener('cms:navigate', navigateHandler);

    render(<CardGrid content={mockContent} />);
    
    const card = screen.getByText('Web Development').closest('.cms-card-grid-card')!;
    fireEvent.click(card);
    
    expect(navigateHandler).toHaveBeenCalledTimes(1);
    expect(navigateHandler.mock.calls[0][0].detail).toBe('/services/web-development');

    window.removeEventListener('cms:navigate', navigateHandler);
  });

  it('calls onCardClick callback', () => {
    const onCardClick = jest.fn();
    render(<CardGrid content={mockContent} onCardClick={onCardClick} />);

    const card = screen.getByText('Web Development').closest('.cms-card-grid-card')!;
    fireEvent.click(card);

    expect(onCardClick).toHaveBeenCalledWith('1');
  });

  it('handles keyboard navigation for non-linked callback cards', () => {
    const onCardClick = jest.fn();
    render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'callback-card',
              title: 'Callback card',
              description: 'Uses callback interaction only.',
            },
          ],
        }}
        onCardClick={onCardClick}
      />
    );

    const card = screen.getByRole('button', { name: /Callback card/ });
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onCardClick).toHaveBeenCalledWith('callback-card');

    onCardClick.mockClear();
    fireEvent.keyDown(card, { key: ' ' });

    expect(onCardClick).toHaveBeenCalledWith('callback-card');
  });

  it('applies responsive grid columns', () => {
    const { container } = render(<CardGrid content={mockContent} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('applies gap spacing correctly', () => {
    const { container } = render(<CardGrid content={mockContent} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('ds-gap-lg');
  });

  it('handles different column configurations', () => {
    const fourColumnContent = { ...mockContent, columns: 4 as const };
    const { container } = render(<CardGrid content={fourColumnContent} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('lg:grid-cols-4');
  });

  it('handles horizontal card style', () => {
    const horizontalContent = { ...mockContent, cardStyle: 'horizontal' as const };
    const { container } = render(<CardGrid content={horizontalContent} />);
    
    const card = container.querySelector('.cms-card-grid-card');
    expect(card).toHaveClass('md:flex-row');
  });

  it('honors explicit vertical card style for imported grids', () => {
    const verticalContent = { ...mockContent, cardStyle: 'vertical' as const };
    const { container } = render(<CardGrid content={verticalContent} />);

    const card = container.querySelector('.cms-card-grid-card');
    expect(card).not.toHaveClass('md:flex-row');
  });

  it('renders imported small icon images as icons instead of full aspect-ratio media', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'Services',
          cards: [
            {
              id: 'icon-card',
              title: 'Digital strategy',
              image: {
                src: 'https://assets.example.com/icon-digital.png?w=48&fm=webp',
                alt: 'Digital Strategy',
              },
              href: '/digital-strategy',
            },
          ],
          columns: 1,
          cardStyle: 'horizontal',
        }}
      />,
    );

    const image = container.querySelector('img')!;
    expect(image).toHaveClass('h-16', 'w-16', 'object-contain');
    expect(image).toHaveAttribute('alt', '');
    expect(container.querySelector('.aspect-\\[16\\/9\\]')).not.toBeInTheDocument();
  });

  it('does not treat small transformed photo URLs as icons', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'photo-card',
              title: 'Small source photo',
              image: {
                src: 'https://assets.example.com/photo.jpg?w=80&h=60&fm=webp',
                alt: 'Small source photo',
              },
              href: '/photo',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const image = container.querySelector('img')!;
    expect(image).not.toHaveClass('h-16', 'w-16', 'object-contain');
    expect(image).toHaveClass('h-full', 'w-full', 'object-cover');
    expect(image).toHaveAttribute('alt', '');
  });

  it('renders title-only icon cards compactly without empty content space', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'How we do it',
          cards: [
            {
              id: 'compact-icon-card',
              title: 'Agile-focused delivery',
              image: {
                src: 'https://assets.example.com/icon-agile.png?w=48&fm=webp',
                alt: 'Agile Focused Delivery Icon',
              },
              href: '/agile-project-management',
            },
          ],
          columns: 1,
          cardStyle: 'vertical',
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    expect(card.querySelector('.p-\\[var\\(--component-padding\\)\\].flex-1')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Agile Focused Delivery Icon' })).toHaveClass('h-16', 'w-16');
    expect(screen.getByRole('link', { name: 'Learn more about Agile-focused delivery' }).closest('[class*="justify-center"]')).toBeInTheDocument();
  });

  it('renders title-only link cards as intentional quick-link cards', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'Quick Links',
          cards: [
            {
              id: 'quick-link',
              title: 'Your guide to the Example Health',
              href: '/guide',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    expect(card).toHaveClass('bg-card/95', 'border-border/70', 'min-h-24', 'justify-between');
    expect(screen.getByRole('link', { name: 'Learn more about Your guide to the Example Health' }).closest('[class*="justify-start"]')).toBeInTheDocument();
  });

  it('renders headingless simple linked grids with a compact quick-link treatment', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'guide',
              title: 'Your guide to the Example Health',
              image: {
                src: 'https://assets.example.com/guide-icon.png',
                alt: 'Your guide to the Example Health',
              },
              href: '/info/',
            },
            {
              id: 'kids',
              title: 'Kids Health Info',
              href: '/kidsinfo/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    const cards = container.querySelectorAll('.cms-card-grid-card');
    expect(cards[0]).toHaveClass('border-l-4', 'border-l-primary/70', 'min-h-24', 'sm:min-h-28');
    expect(cards[0].querySelector('img')).toHaveClass('h-full', 'w-full', 'object-contain');
    const firstFooter = screen.getByRole('link', { name: 'Learn more about Your guide to the Example Health' }).closest('[class*="justify-start"]');
    expect(firstFooter).toBeInTheDocument();
    expect(firstFooter).toHaveClass('px-4', 'pb-4', 'sm:px-5', 'sm:pb-5');
    expect(screen.getByRole('link', { name: 'Learn more about Kids Health Info' })).toHaveAttribute('href', '/kidsinfo/');
  });

  it('uses high contrast CTA styling for dark card surfaces', () => {
    const { container, rerender } = render(
      <CardGrid
        theme="dark"
        content={{
          cards: [
            {
              id: 'guide',
              title: 'Your guide to the Example Health',
              href: '/info/',
            },
            {
              id: 'kids',
              title: 'Kids Health Info',
              href: '/kidsinfo/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    const quickLinkCta = screen.getByRole('link', { name: 'Learn more about Your guide to the Example Health' });
    expect(quickLinkCta).toHaveClass('text-card-foreground/85', 'hover:text-card-foreground');

    rerender(
      <CardGrid
        theme="dark"
        content={{
          heading: 'Latest projects',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const darkMediaCta = screen.getByRole('link', { name: 'Learn more about Product redesign' });
    expect(darkMediaCta).toHaveClass('text-card-foreground/85', 'hover:text-card-foreground');

    rerender(
      <CardGrid
        content={{
          heading: 'Inherited themed projects',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const inheritedMediaCta = screen.getByRole('link', { name: 'Learn more about Product redesign' });
    expect(inheritedMediaCta).toHaveClass('text-card-foreground/85', 'hover:text-card-foreground');

    rerender(
      <CardGrid
        theme="light"
        content={{
          heading: 'Latest projects',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const lightMediaCta = screen.getByRole('link', { name: 'Learn more about Product redesign' });
    expect(lightMediaCta).not.toHaveClass('text-card-foreground/85', 'hover:text-card-foreground');
  });

  it('wraps heading and cards in the shared section container for imported rhythm', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'Resources',
          subheading: 'Useful links and updates',
          cards: [
            {
              id: 'guide',
              title: 'Guide',
              href: '/guide/',
            },
          ],
        }}
      />,
    );

    const section = container.querySelector('section.cms-card-grid');
    const inner = section?.firstElementChild;
    expect(inner).toHaveClass('mx-auto', 'max-w-7xl', 'ds-gap-lg');
    expect(section?.querySelector('header')).toHaveClass('max-w-3xl');
    expect(screen.getByText('Useful links and updates')).toHaveClass('max-w-2xl');
  });

  it('uses reduced mobile section heading scale while restoring design-system scale on desktop', () => {
    render(
      <CardGrid
        content={{
          heading: 'Some of our latest projects',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              href: '/work/product-redesign/',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Some of our latest projects' })).toHaveClass(
      'text-3xl',
      'sm:text-4xl',
      'lg:ds-heading-2',
    );
    expect(screen.getByRole('heading', { name: 'Some of our latest projects' })).not.toHaveClass('ds-heading-2');
  });

  it('keeps headed project grids on the standard card treatment', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'Latest projects',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
            {
              id: 'project-two',
              title: 'Commerce build',
              href: '/work/commerce-build/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card')!;
    expect(firstCard).not.toHaveClass('border-l-4', 'border-l-primary/70');
    expect(firstCard.querySelector('img')).toHaveClass('h-full', 'w-full', 'object-cover');
  });

  it('uses high-contrast readable treatment for background-image cards', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'emergency-status',
              title: 'Emergency Department status',
              description: 'View the page for a real time guide to how busy we are.',
              image: {
                src: 'https://assets.example.com/emergency-status.jpg',
                alt: 'Emergency Department status',
              },
              href: '/emergency/status/',
            },
          ],
          imagePosition: 'background',
          columns: 1,
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    const overlay = card.querySelector('.bg-gradient-to-t')!;
    expect(card).toHaveClass('theme-dark');
    expect(overlay).toHaveClass('from-black/90', 'via-black/65', 'to-black/25');
    expect(screen.getByText('Emergency Department status')).toHaveClass('text-white', 'drop-shadow-sm');
    expect(screen.getByText('View the page for a real time guide to how busy we are.')).toHaveClass(
      'text-white/85',
      'drop-shadow-sm',
    );
    expect(screen.getByRole('link', { name: 'Learn more about Emergency Department status' })).toHaveClass(
      'text-white/90',
      'hover:text-white',
      'drop-shadow-sm',
    );
  });

  it('bases custom background contrast on the sanitized rendered color', () => {
    const { container, rerender } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'alert-red',
              title: 'Imported red tile',
              href: '/red-tile/',
              backgroundColor: '#ff8080',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    expect(card).toHaveClass('theme-dark', 'text-white');
    expect(screen.getByRole('link', { name: 'Learn more about Imported red tile' })).toHaveClass(
      'text-card-foreground/85',
      'hover:text-card-foreground',
    );

    rerender(
      <CardGrid
        theme="light"
        content={{
          cards: [
            {
              id: 'dark-tile',
              title: 'Explicit light dark tile',
              href: '/dark-tile/',
              backgroundColor: '#111111',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const lightSectionDarkCard = container.querySelector('.cms-card-grid-card')!;
    expect(lightSectionDarkCard).toHaveClass('theme-dark', 'text-white');
    expect(screen.getByRole('link', { name: 'Learn more about Explicit light dark tile' })).toHaveClass(
      'text-card-foreground/85',
      'hover:text-card-foreground',
    );
  });

  it('uses compact mobile media density for standard project cards while preserving desktop ratio', () => {
    const { container } = render(
      <CardGrid
        content={{
          heading: 'Latest projects',
          imageAspectRatio: '1:1',
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              description: 'A full digital ecosystem redesign for a major venue.',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card')!;
    const mediaWrapper = firstCard.querySelector('img')?.parentElement;
    const header = firstCard.querySelector('[class*="p-\\[var\\(--component-padding\\)\\]"]');
    const footer = screen.getByRole('link', { name: 'Learn more about Product redesign' }).closest('div');

    expect(firstCard).not.toHaveClass('border-l-4', 'border-l-primary/70');
    expect(mediaWrapper).toHaveClass('aspect-[16/10]', 'sm:aspect-square');
    expect(header).toHaveClass('px-4', 'py-4', 'sm:px-6', 'sm:py-6');
    expect(screen.getByText('Product redesign')).toHaveClass('text-lg', 'sm:text-xl');
    expect(screen.getByText('A full digital ecosystem redesign for a major venue.')).toHaveClass('line-clamp-2', 'sm:line-clamp-3');
    expect(footer).toHaveClass('px-4', 'pb-4', 'sm:px-6', 'sm:pb-6');
  });

  it('uses desktop horizontal composition for sparse standard media grids', () => {
    const { container, rerender } = render(
      <CardGrid
        content={{
          heading: 'Telehealth appointments',
          cards: [
            {
              id: 'telehealth',
              title: 'Access to telehealth',
              description: 'Attend appointments from home with a secure video consultation.',
              image: {
                src: 'https://assets.example.com/telehealth.jpg',
                alt: 'Telehealth appointment',
              },
              href: '/telehealth/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    expect(container.querySelector('.cms-card-grid-card')).toHaveClass('md:flex-row');

    rerender(
      <CardGrid
        content={{
          heading: 'Support Us',
          imagePosition: 'left',
          cards: [
            {
              id: 'donate',
              title: 'Donate today',
              description: 'Help support children and families.',
              image: {
                src: 'https://assets.example.com/donate.jpg',
                alt: 'Donate today',
              },
              href: '/donate/',
            },
            {
              id: 'fundraise',
              title: 'Start fundraising',
              description: 'Create a fundraiser for the hospital.',
              image: {
                src: 'https://assets.example.com/fundraise.jpg',
                alt: 'Start fundraising',
              },
              href: '/fundraise/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    const cards = container.querySelectorAll('.cms-card-grid-card');
    expect(cards[0]).toHaveClass('md:flex-row');
    expect(cards[1]).toHaveClass('md:flex-row');
  });

  it('keeps larger project grids, feed grids, and quick links out of sparse media composition', () => {
    const { container, rerender } = render(
      <CardGrid
        content={{
          heading: 'Latest projects',
          cards: [
            {
              id: 'project-one',
              title: 'Project one',
              description: 'Project summary one.',
              image: { src: 'https://assets.example.com/project-one.jpg', alt: 'Project one' },
            },
            {
              id: 'project-two',
              title: 'Project two',
              description: 'Project summary two.',
              image: { src: 'https://assets.example.com/project-two.jpg', alt: 'Project two' },
            },
            {
              id: 'project-three',
              title: 'Project three',
              description: 'Project summary three.',
              image: { src: 'https://assets.example.com/project-three.jpg', alt: 'Project three' },
            },
          ],
          columns: 3,
        }}
      />,
    );

    expect(container.querySelector('.cms-card-grid-card')).not.toHaveClass('md:flex-row');

    rerender(
      <CardGrid
        content={{
          density: 'feed',
          heading: 'Latest posts',
          cards: [
            {
              id: 'post-one',
              title: 'Post one',
              description: 'Post summary one.',
              image: { src: 'https://assets.example.com/post-one.jpg', alt: 'Post one' },
            },
          ],
          columns: 1,
        }}
      />,
    );

    expect(container.querySelector('.cms-card-grid-card')).not.toHaveClass('md:flex-row');

    rerender(
      <CardGrid
        content={{
          cards: [
            {
              id: 'guide',
              title: 'Your guide',
              href: '/guide/',
            },
            {
              id: 'portal',
              title: 'Portal',
              href: '/portal/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    expect(container.querySelector('.cms-card-grid-card')).not.toHaveClass('md:flex-row');
    expect(container.querySelector('.cms-card-grid-card')).toHaveClass('border-l-4', 'border-l-primary/70');
  });

  it('does not override explicit compact or right-image media grid composition', () => {
    const { container, rerender } = render(
      <CardGrid
        content={{
          heading: 'Compact feature',
          cardStyle: 'compact',
          cards: [
            {
              id: 'compact-project',
              title: 'Compact project',
              description: 'A compact card should keep compact composition.',
              image: {
                src: 'https://assets.example.com/compact.jpg',
                alt: 'Compact project',
              },
            },
          ],
          columns: 1,
        }}
      />,
    );

    const compactCard = container.querySelector('.cms-card-grid-card')!;
    expect(compactCard).not.toHaveClass('md:flex-row');
    expect(compactCard).toHaveClass('md:max-w-md');

    rerender(
      <CardGrid
        content={{
          heading: 'Right media feature',
          cardStyle: 'horizontal',
          imagePosition: 'right',
          cards: [
            {
              id: 'right-media',
              title: 'Right media project',
              description: 'A right media card should keep its image order.',
              image: {
                src: 'https://assets.example.com/right-media.jpg',
                alt: 'Right media project',
              },
            },
          ],
          columns: 1,
        }}
      />,
    );

    const rightMediaCard = container.querySelector('.cms-card-grid-card')!;
    const mediaColumn = rightMediaCard.querySelector('img')?.closest('.group');
    expect(rightMediaCard).toHaveClass('md:flex-row');
    expect(mediaColumn).toHaveClass('md:order-last');
  });

  it('uses feed density only for feed-like card grids', () => {
    const { container } = render(
      <CardGrid
        content={{
          density: 'feed',
          heading: 'Latest posts',
          imageAspectRatio: '16:9',
          cards: [
            {
              id: 'feed-post',
              title: 'AI does not change your strategy',
              description: 'Strategy Director Emma Andrews lifts the lid on how AI changes delivery.',
              image: {
                src: 'https://assets.example.com/post.jpg',
                alt: 'AI strategy',
              },
              href: '/insights/ai-strategy/',
              metadata: {
                date: '2026-05-18',
                tags: ['Pinned'],
              },
            },
          ],
          columns: 1,
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    const mediaWrapper = card.querySelector('img')?.parentElement;
    const footer = screen.getByRole('link', { name: 'Learn more about AI does not change your strategy' }).closest('div');

    expect(mediaWrapper).toHaveClass('aspect-[5/2]', 'sm:aspect-[16/9]');
    expect(screen.getByText('AI does not change your strategy')).toHaveClass('text-base', 'sm:text-lg');
    expect(screen.getByText('Strategy Director Emma Andrews lifts the lid on how AI changes delivery.')).toHaveClass('ds-body-sm', 'line-clamp-2');
    expect(screen.getByText('2026-05-18')).toHaveClass('text-[11px]');
    expect(screen.getByText('2026-05-18').closest('div')).toHaveClass(
      'px-2',
      'py-0',
      'text-[11px]',
      'bg-muted/40',
      'text-muted-foreground',
      'border-border/50',
    );
    expect(screen.getByText('Pinned').closest('div')).toHaveClass(
      'px-2',
      'py-0',
      'text-[11px]',
      'bg-muted/40',
      'text-muted-foreground',
      'border-border/50',
    );
    expect(footer).toHaveClass('px-4', 'pb-3', 'sm:px-5', 'sm:pb-4');
  });

  it('uses feed density for existing editorial card grids without compressing project grids', () => {
    const { container, rerender } = render(
      <CardGrid
        content={{
          heading: 'Health News',
          cards: [
            {
              id: 'news-1',
              title: 'Hospital story',
              description: 'A summary for a hospital news article.',
              image: { src: 'https://assets.example.com/news-1.jpg', alt: 'Hospital story' },
              href: '/news/story/',
            },
            {
              id: 'news-2',
              title: 'Research update',
              description: 'A summary for a research update.',
              image: { src: 'https://assets.example.com/news-2.jpg', alt: 'Research update' },
              href: '/news/research/',
            },
            {
              id: 'news-3',
              title: 'Community story',
              description: 'A summary for a community story.',
              image: { src: 'https://assets.example.com/news-3.jpg', alt: 'Community story' },
              href: '/news/community/',
            },
          ],
          columns: 3,
        }}
      />,
    );

    expect(screen.getByText('Hospital story')).toHaveClass('text-base', 'sm:text-lg');
    expect(screen.getByText('A summary for a hospital news article.')).toHaveClass('ds-body-sm', 'line-clamp-2');
    expect(container.querySelector('.cms-card-grid-card img')?.parentElement).toHaveClass('aspect-[5/2]');

    rerender(
      <CardGrid
        content={{
          heading: 'Latest projects',
          cards: [
            {
              id: 'project-1',
              title: 'Digital project',
              description: 'A project summary should keep the richer card treatment.',
              image: { src: 'https://assets.example.com/project.jpg', alt: 'Digital project' },
              href: '/work/project/',
            },
            {
              id: 'project-2',
              title: 'Commerce project',
              description: 'Another project summary.',
              image: { src: 'https://assets.example.com/project-2.jpg', alt: 'Commerce project' },
              href: '/work/project-2/',
            },
            {
              id: 'project-3',
              title: 'Strategy project',
              description: 'A strategy project summary.',
              image: { src: 'https://assets.example.com/project-3.jpg', alt: 'Strategy project' },
              href: '/work/project-3/',
            },
          ],
          columns: 3,
        }}
      />,
    );

    expect(screen.getByText('Digital project')).toHaveClass('text-lg', 'sm:text-xl');
    expect(screen.getByText('A project summary should keep the richer card treatment.')).toHaveClass('ds-body-md', 'sm:line-clamp-3');
  });

  it('lets editorial-looking grids explicitly opt out of feed density', () => {
    render(
      <CardGrid
        content={{
          heading: 'Customer Stories',
          density: 'default',
          cards: [
            {
              id: 'story-1',
              title: 'Featured customer story',
              description: 'A rich story card should keep the standard treatment when density is default.',
              image: { src: 'https://assets.example.com/story-1.jpg', alt: 'Featured customer story' },
              href: '/stories/featured/',
            },
            {
              id: 'story-2',
              title: 'Another customer story',
              description: 'Another rich story card.',
              image: { src: 'https://assets.example.com/story-2.jpg', alt: 'Another customer story' },
              href: '/stories/another/',
            },
            {
              id: 'story-3',
              title: 'Third customer story',
              description: 'A third rich story card.',
              image: { src: 'https://assets.example.com/story-3.jpg', alt: 'Third customer story' },
              href: '/stories/third/',
            },
          ],
          columns: 3,
        }}
      />,
    );

    expect(screen.getByText('Featured customer story')).toHaveClass('text-lg', 'sm:text-xl');
    expect(screen.getByText('A rich story card should keep the standard treatment when density is default.')).toHaveClass(
      'ds-body-md',
      'sm:line-clamp-3',
    );
  });

  it('keeps horizontal media cards compact on mobile and horizontal on desktop', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              description: 'A compact horizontal project summary.',
              image: {
                src: 'https://assets.example.com/project.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
          ],
          cardStyle: 'horizontal',
          imageAspectRatio: '4:3',
          columns: 1,
        }}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card')!;
    const mediaWrapper = firstCard.querySelector('img')?.parentElement;
    expect(firstCard).toHaveClass('md:flex-row');
    expect(mediaWrapper).toHaveClass('aspect-[16/10]', 'sm:aspect-[4/3]', 'md:rounded-none');
  });

  it('keeps headingless photographic link grids on the standard card treatment', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'project',
              title: 'Product redesign',
              image: {
                src: 'https://assets.example.com/work/product-redesign-feature.jpg',
                alt: 'Product redesign',
              },
              href: '/work/product-redesign/',
            },
            {
              id: 'project-two',
              title: 'Brand platform',
              image: {
                src: 'https://assets.example.com/work/brand-platform-tile.webp',
                alt: 'Brand platform',
              },
              href: '/work/brand-platform/',
            },
          ],
          columns: 2,
        }}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card')!;
    expect(firstCard).not.toHaveClass('border-l-4', 'border-l-primary/70');
    expect(firstCard.querySelector('img')).toHaveClass('h-full', 'w-full', 'object-cover');
    expect(firstCard.querySelector('img')?.parentElement).toHaveClass('aspect-[2/1]', 'sm:aspect-[16/9]');
  });

  it('does not expose linked cards as duplicate named buttons', () => {
    const { container } = render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'kids-health-info',
              title: 'Kids Health Info',
              image: {
                src: 'https://assets.example.com/kids-health-info.png',
                alt: 'Kids Health Info',
              },
              href: '/kidsinfo/',
            },
          ],
          columns: 1,
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /Kids Health Info Kids Health Info/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn more about Kids Health Info' })).toHaveAttribute('href', '/kidsinfo/');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('keeps linked cards keyboard-accessible when explicit actions are present', () => {
    render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'linked-action-card',
              title: 'Research program',
              href: '/research',
              actions: [
                {
                  label: 'Apply now',
                  href: '/research/apply',
                  variant: 'primary',
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /Research program/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Learn more about Research program' })).toHaveAttribute('href', '/research');
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeInTheDocument();
  });

  it('can disable first-card feature spanning for feed-like grids', () => {
    const { container } = render(
      <CardGrid
        content={{
          ...mockContent,
          cards: [
            ...mockContent.cards,
            { id: '4', title: 'Fourth item', description: 'More content' },
            { id: '5', title: 'Fifth item', description: 'More content' },
          ],
          columns: 3,
          featureFirstCard: false,
        }}
      />,
    );

    const firstCard = container.querySelector('.cms-card-grid-card');
    expect(firstCard).not.toHaveClass('md:col-span-2');
  });

  it('applies theme and variant classes', () => {
    const { container } = render(
      <CardGrid 
        content={mockContent} 
        theme="dark" 
        variant="detailed"
        className="custom-class"
      />
    );
    
    const grid = container.querySelector('.custom-class');
    expect(grid).toBeInTheDocument();
    
    const cards = container.querySelectorAll('.cms-card-grid-card');
    cards.forEach(card => {
      expect(card).toHaveClass('theme-dark');
    });
  });

  it('handles action button clicks', () => {
    const navigateHandler = jest.fn();
    window.addEventListener('cms:navigate', navigateHandler);

    render(<CardGrid content={mockContent} />);
    
    const portfolioButton = screen.getByText('View Portfolio');
    fireEvent.click(portfolioButton);
    
    expect(navigateHandler).toHaveBeenCalledTimes(1);
    expect(navigateHandler.mock.calls[0][0].detail).toBe('/portfolio');

    window.removeEventListener('cms:navigate', navigateHandler);
  });

  it('resolves structured action hrefs', () => {
    const navigateHandler = jest.fn();
    window.addEventListener('cms:navigate', navigateHandler);

    render(
      <CardGrid
        content={{
          cards: [
            {
              id: 'structured-action-card',
              title: 'Structured Action Card',
              actions: [
                {
                  label: 'Open Guide',
                  href: { type: 'internal', pageId: 'guide', path: '/guides/open' },
                  variant: 'primary',
                },
              ],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('Open Guide'));

    expect(navigateHandler).toHaveBeenCalledTimes(1);
    expect(navigateHandler.mock.calls[0][0].detail).toBe('/guides/open');

    window.removeEventListener('cms:navigate', navigateHandler);
  });

  it('prevents event propagation on action clicks', () => {
    const onCardClick = jest.fn();
    render(<CardGrid content={mockContent} onCardClick={onCardClick} />);
    
    const portfolioButton = screen.getByText('View Portfolio');
    fireEvent.click(portfolioButton);
    
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('performs within 50ms threshold', async () => {
    const startTime = performance.now();
    render(<CardGrid content={mockContent} />);
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    expect(renderTime).toBeLessThan(50);
  });

  it('handles missing optional properties gracefully', () => {
    const minimalContent = {
      cards: [
        { id: '1', title: 'Card 1' },
        { id: '2', title: 'Card 2' }
      ]
    };
    
    render(<CardGrid content={minimalContent} />);
    
    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Card 2')).toBeInTheDocument();
  });
});
