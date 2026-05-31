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
              title: 'Your guide to the RCH',
              href: '/guide',
            },
          ],
          columns: 1,
        }}
      />,
    );

    const card = container.querySelector('.cms-card-grid-card')!;
    expect(card).toHaveClass('bg-card/95', 'border-border/70', 'min-h-24', 'justify-between');
    expect(screen.getByRole('link', { name: 'Learn more about Your guide to the RCH' }).closest('[class*="justify-start"]')).toBeInTheDocument();
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
