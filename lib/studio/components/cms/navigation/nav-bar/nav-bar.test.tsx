import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavBar from './index';
import { usePathname } from 'next/navigation';
import { ComponentType, ComponentCategory } from '../../_core/types';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.Mock;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === 'undefined') {
  // @ts-expect-error - test environment polyfill
  global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth'
)

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = jest.fn()
  }

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      if (this instanceof HTMLElement) {
        if (this.classList.contains('cms-navigation-viewport')) {
          return 320
        }
        if (this.classList.contains('cms-navigation-menu')) {
          return 960
        }
      }
      return 120
    }
  })
})

afterAll(() => {
  if (originalOffsetWidthDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'offsetWidth',
      originalOffsetWidthDescriptor
    )
  }
})

describe('NavBar Component', () => {
  const defaultProps = {
    id: 'navbar-test',
    type: ComponentType.NavBar,
    category: ComponentCategory.Navigation,
    content: {
      logo: {
        text: 'MyApp',
        href: '/'
      },
      menuItems: [
        { label: 'Home', href: { type: 'internal' as const, path: '/' } },
        { label: 'About', href: { type: 'internal' as const, path: '/about' } },
        {
          label: 'Services',
          href: { type: 'internal' as const, path: '/services' },
          groups: [
            {
              title: 'Offerings',
              description: 'Delivery and implementation packages.',
              items: [
                {
                  label: 'Web Design',
                  href: { type: 'internal' as const, path: '/services/web-design' },
                  description: 'Custom marketing sites and brand refreshes.'
                },
                {
                  label: 'Development',
                  href: { type: 'internal' as const, path: '/services/development' },
                  description: 'Full-stack builds with headless CMS integrations.'
                }
              ]
            },
            {
              title: 'Advisory',
              items: [
                {
                  label: 'Strategy workshop',
                  href: { type: 'internal' as const, path: '/services/workshop' },
                  description: 'Align roadmaps, KPIs, and content operations.'
                }
              ]
            }
          ]
        }
      ],
      cta: {
        label: 'Contact Us',
        href: { type: 'internal' as const, path: '/contact' }
      }
    }
  };

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('renders without crashing', () => {
    render(<NavBar {...defaultProps} />);
    const navigations = screen.getAllByRole('navigation');
    expect(navigations.length).toBeGreaterThan(0);
    expect(navigations[0]).toHaveAttribute('aria-label', 'Primary navigation');
  });

  it('does not render a blank navbar shell for empty imported content', () => {
    const { container } = render(
      <NavBar
        {...defaultProps}
        content={{
          menuItems: [],
          utilityNav: [],
          styles: {
            rootRow: {
              backgroundColor: '#ffffff',
            },
          },
        }}
      />
    );

    expect(container.querySelector('.nav-bar-container')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
  });

  it('renders logo correctly', () => {
    render(<NavBar {...defaultProps} />);
    expect(screen.getAllByText('MyApp').length).toBeGreaterThan(0);
  });

  it('renders menu items', () => {
    render(<NavBar {...defaultProps} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
  });

  it('renders CTA button', () => {
    render(<NavBar {...defaultProps} />);
    const ctaButton = screen.getByText('Contact Us');
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton.closest('a')).toHaveAttribute('href', '/contact');
  });

  it('applies active styling to the current page', async () => {
    mockUsePathname.mockReturnValue('/services/web-design');
    render(<NavBar {...defaultProps} />);

    const servicesTrigger = screen
      .getAllByRole('button')
      .find(button => button.textContent?.includes('Services'));
    expect(servicesTrigger).toBeDefined();
    if (!servicesTrigger) {
      throw new Error('Services trigger not found');
    }
    expect(servicesTrigger).toHaveAttribute('data-active', 'true');

    fireEvent.click(servicesTrigger);
    const activeLink = await screen.findByRole('link', { name: /Web Design/i });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  it('toggles mobile menu', () => {
    render(<NavBar {...defaultProps} />);
    
    // Get the toggle button
    const mobileMenuButton = screen.getByRole('button', { name: /open menu/i });
    expect(mobileMenuButton).toBeInTheDocument();
    
    // Click to open mobile menu
    fireEvent.click(mobileMenuButton);
    
    // Close button should now be visible
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
  });

  it('handles sticky navigation', () => {
    const stickyProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        sticky: true
      }
    };
    
    const { container } = render(<NavBar {...stickyProps} />);
    const clientDiv = container.querySelector('.nav-bar-client');
    expect(clientDiv).toHaveClass('sticky', 'top-0', 'z-50');
  });

  it('keeps transparent positioning on the desktop nav layer only', () => {
    const transparentProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        transparent: true
      }
    };
    
    const { container } = render(<NavBar {...transparentProps} />);
    const header = container.querySelector('.nav-bar-container');
    const desktopNav = container.querySelector('.nav-bar-server');
    expect(header).toHaveClass('relative');
    expect(header).toHaveAttribute('data-component-type', 'navbar');
    expect(desktopNav).toHaveClass('fixed', 'top-0', 'left-0', 'right-0', 'z-50');
  });

  it('calls onInteraction when desktop menu items are clicked', async () => {
    const onInteraction = jest.fn();
    const propsWithHandler = {
      ...defaultProps,
      onInteraction
    };
    
    render(<NavBar {...propsWithHandler} />);
    
    const homeLink = screen.getAllByText('Home')[0];
    fireEvent.click(homeLink);

    expect(onInteraction).toHaveBeenCalledWith('nav_click', expect.objectContaining({
      label: 'Home',
      href: '/',
      surface: 'desktop',
    }));

    // Open dropdown and click child link
    fireEvent.click(screen.getByRole('button', { name: /Services/i }));
    const childLink = await screen.findByRole('link', { name: /Web Design/i });
    fireEvent.click(childLink);

    expect(onInteraction).toHaveBeenCalledWith('nav_click', expect.objectContaining({
      label: 'Web Design',
      parentLabel: 'Services',
      depth: 1,
      surface: 'desktop',
    }));
  });

  it('renders logo image when provided resolved media source', () => {
    const onInteraction = jest.fn();
    const mediaLogoProps = {
      ...defaultProps,
      onInteraction,
      content: {
        ...defaultProps.content,
        logo: {
          ...(defaultProps.content.logo ?? {}),
          alt: 'Telecommunication Industry Ombudsman',
          src: {
            mediaId: 'cmhnxwfvt002bv8asdmn1padf',
            originalUrl: 'https://www.tio.com.au/themes/custom/tio/logo.svg',
            src: 'https://cdn.example.com/assets/logo.svg'
          }
        }
      }
    };

    render(<NavBar {...mediaLogoProps} />);

    const logoImage = screen.getAllByRole('img', { name: 'Telecommunication Industry Ombudsman' })[0];
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('src', 'https://cdn.example.com/assets/logo.svg');
    expect(logoImage).toHaveStyle({ width: '150px', height: '40px' });

    const logoLink = logoImage.closest('a');
    expect(logoLink).toHaveAttribute('href', '/');

    if (logoLink) {
      fireEvent.click(logoLink);
    }

    expect(onInteraction).toHaveBeenCalledWith(
      'logo_click',
      expect.objectContaining({
        href: '/',
        hasImage: true
      })
    );
  });

  it('renders logo image from canonical MediaReference url', () => {
    const mediaLogoProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          ...(defaultProps.content.logo ?? {}),
          alt: 'Example Agency Logo',
          src: {
            mediaId: 'logo-media',
            mediaType: 'image' as const,
            url: 'https://agency.example.com/_astro/example-agency-logo-midnight.svg',
          },
        },
      },
    };

    render(<NavBar {...mediaLogoProps} />);

    const logoImage = screen.getAllByRole('img', { name: 'Example Agency Logo' })[0];
    expect(logoImage).toBeInTheDocument();
    expect(logoImage).toHaveAttribute('src', 'https://agency.example.com/_astro/example-agency-logo-midnight.svg');
  });

  it('inverts likely dark logo assets on dark navbar surfaces', async () => {
    const mediaLogoProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          ...(defaultProps.content.logo ?? {}),
          alt: 'Example Agency Logo',
          src: {
            mediaId: 'logo-media',
            mediaType: 'image' as const,
            url: 'https://agency.example.com/assets/lockup-black.svg',
          },
          originalUrl: '/assets/lockup-black.svg',
          width: 120,
          height: 32,
        },
        styles: {
          rootRow: {
            backgroundColor: '#050505',
            textColor: '#ffffff',
          },
        },
      },
    };

    render(<NavBar {...mediaLogoProps} />);

    const logoImage = screen.getAllByRole('img', { name: 'Example Agency Logo' })[0];
    await waitFor(() => {
      expect(logoImage).toHaveStyle({ filter: 'invert(1) brightness(1.1)' });
    });
  });

  it('applies source-captured single-row navbar surface colors', () => {
    const mediaLogoProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          ...(defaultProps.content.logo ?? {}),
          alt: 'Example Agency Logo',
          src: {
            mediaId: 'detected:example-agency-logo-midnight',
            mediaType: 'image' as const,
            url: 'https://agency.example.com/_astro/example-agency-logo-midnight.svg',
          },
        },
        styles: {
          rootRow: {
            backgroundColor: '#ffffff',
            textColor: '#111827',
            borderColor: '#e5e7eb',
          },
        },
      },
    };

    const { container } = render(<NavBar {...mediaLogoProps} />);

    const desktopNav = container.querySelector('.nav-bar-server');
    const mobileNav = container.querySelector('.nav-bar-client');
    expect(desktopNav).toHaveStyle({ backgroundColor: '#ffffff', color: '#111827', borderColor: '#e5e7eb' });
    expect(mobileNav).toHaveStyle({ backgroundColor: '#ffffff', color: '#111827', borderColor: '#e5e7eb' });
  });

  it('derives readable foreground when source row evidence only includes background color', () => {
    const propsWithBackgroundOnly = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        styles: {
          rootRow: {
            backgroundColor: '#ffffff',
          },
        },
      },
    };

    const { container } = render(<NavBar {...propsWithBackgroundOnly} />);

    const desktopNav = container.querySelector('.nav-bar-server');
    const mobileNav = container.querySelector('.nav-bar-client');
    expect(desktopNav).toHaveStyle({ backgroundColor: '#ffffff', color: '#111827' });
    expect(mobileNav).toHaveStyle({ backgroundColor: '#ffffff', color: '#111827' });
  });

  it('derives readable foreground for 4-digit hex row backgrounds', () => {
    const propsWithShortHexBackground = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        styles: {
          rootRow: {
            backgroundColor: '#ffff',
          },
        },
      },
    };

    const { container } = render(<NavBar {...propsWithShortHexBackground} />);

    expect(container.querySelector('.nav-bar-server')).toHaveStyle({ color: '#111827' });
  });

  it('uses the Logo schema string href for logo clicks', () => {
    const onInteraction = jest.fn();
    const propsWithLogoHref = {
      ...defaultProps,
      onInteraction,
      content: {
        ...defaultProps.content,
        logo: {
          ...defaultProps.content.logo,
          href: '/brand',
        },
      },
    };

    render(<NavBar {...propsWithLogoHref} />);

    const logoLink = screen.getAllByRole('link', { name: 'MyApp' })[0];
    expect(logoLink).toHaveAttribute('href', '/brand');

    fireEvent.click(logoLink);
    expect(onInteraction).toHaveBeenCalledWith('logo_click', expect.objectContaining({
      href: '/brand',
    }));
  });

  it('does not silently coerce invalid logo href values into links', () => {
    const propsWithInvalidLogoHref = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          ...defaultProps.content.logo,
          href: { type: 'internal', path: '/legacy-logo' } as unknown as string,
        },
      },
    };

    render(<NavBar {...propsWithInvalidLogoHref} />);

    const links = screen.queryAllByRole('link');
    expect(links.some(link => link.textContent?.includes('MyApp'))).toBe(false);
    expect(screen.getAllByText('MyApp').length).toBeGreaterThan(0);
  });

  it('does not silently coerce a blank logo href into the home page', () => {
    const propsWithBlankLogoHref = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          ...defaultProps.content.logo,
          href: '   ',
        },
      },
    };

    render(<NavBar {...propsWithBlankLogoHref} />);

    const links = screen.queryAllByRole('link');
    expect(links.some(link => link.textContent?.includes('MyApp'))).toBe(false);
    expect(screen.getAllByText('MyApp').length).toBeGreaterThan(0);
  });

  it('tracks mobile menu interactions', () => {
    const onInteraction = jest.fn();
    render(<NavBar {...defaultProps} onInteraction={onInteraction} />);

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    const sheet = screen.getByRole('dialog');
    const aboutLink = within(sheet).getByRole('link', { name: 'About' });
    fireEvent.click(aboutLink);

    expect(onInteraction).toHaveBeenCalledWith('nav_click', expect.objectContaining({
      label: 'About',
      surface: 'mobile',
      depth: 0,
    }));
  });

  it('emits interactions for CTA and logo clicks', () => {
    const onInteraction = jest.fn();
    render(<NavBar {...defaultProps} onInteraction={onInteraction} />);

    fireEvent.click(screen.getAllByText('Contact Us')[0]);
    expect(onInteraction).toHaveBeenCalledWith('cta_click', expect.objectContaining({
      label: 'Contact Us',
      href: '/contact',
    }));

    fireEvent.click(screen.getAllByRole('link', { name: 'MyApp' })[0]);
    expect(onInteraction).toHaveBeenCalledWith('logo_click', expect.objectContaining({
      href: '/',
    }));
  });

  it('renders logo image when provided', () => {
    const propsWithLogoImage = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        logo: {
          src: '/logo.png',
          text: 'MyApp',
          alt: 'MyApp',
          href: '/'
        }
      }
    };
    
    render(<NavBar {...propsWithLogoImage} />);
    const logoImg = screen.getAllByAltText('MyApp')[0];
    expect(logoImg).toBeInTheDocument();
    // Next.js Image component modifies src, so we just check it exists
  });

  it('applies custom className', () => {
    const propsWithClass = {
      ...defaultProps,
      className: 'custom-navbar'
    };
    
    const { container } = render(<NavBar {...propsWithClass} />);
    const nav = container.querySelector('.nav-bar-server');
    expect(nav).toHaveClass('custom-navbar');
  });

  it('aligns the submenu viewport relative to the active trigger', async () => {
    const { container } = render(<NavBar {...defaultProps} />);

    const root = container.querySelector('.cms-navigation-menu') as HTMLElement;
    Object.defineProperty(root, 'getBoundingClientRect', {
      value: () => ({
        width: 960,
        height: 64,
        top: 0,
        left: 0,
        right: 960,
        bottom: 64,
        x: 0,
        y: 0,
        toJSON: () => ({})
      })
    });

    const trigger = screen.getByRole('button', { name: 'Services' }) as HTMLButtonElement;
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({
        width: 120,
        height: 40,
        top: 0,
        left: 200,
        right: 320,
        bottom: 40,
        x: 200,
        y: 0,
        toJSON: () => ({})
      })
    });

    fireEvent.pointerEnter(trigger);
    fireEvent.click(trigger);
    await screen.findByRole('link', { name: /Web Design/i });

    fireEvent.pointerEnter(trigger);
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve(undefined))
      } else {
        setTimeout(resolve, 0)
      }
    });

    const wrapper = container.querySelector('.cms-navigation-viewport-wrapper') as HTMLElement;
    expect(wrapper).toBeInTheDocument();

    const viewport = container.querySelector('.cms-navigation-viewport-wrapper > div') as HTMLElement;
    expect(viewport.className).toContain(
      'origin-[var(--radix-navigation-menu-content-transform-origin)]'
    );

    const offset = wrapper.style.getPropertyValue('--cms-navigation-viewport-offset');
    expect(offset).toBe('200px');
  });

  it('includes motion utilities on desktop navigation content', () => {
    const { container } = render(<NavBar {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));

    const content = container.querySelector('.cms-navigation-content');
    expect(content).toBeInTheDocument();
    const className = content?.className ?? '';
    expect(className).toContain('data-[motion=from-start]:animate-in');
    expect(className).toContain('data-[motion=to-end]:slide-out-to-right-52');
  });

  describe('Search functionality', () => {
    const searchProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        search: {
          enabled: true,
          placeholder: 'Search the site...',
          action: '/search'
        }
      }
    };

    beforeEach(() => {
      // Clear localStorage before each test
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
      }
    });

    it('renders search icon when search.enabled is true', () => {
      render(<NavBar {...searchProps} />);

      const searchButton = screen.getAllByRole('button', { name: /open search/i })[0];
      expect(searchButton).toBeInTheDocument();
    });

    it('does not render search icon when search.enabled is false', () => {
      const noSearchProps = {
        ...defaultProps,
        content: {
          ...defaultProps.content,
          search: {
            enabled: false
          }
        }
      };

      render(<NavBar {...noSearchProps} />);

      const searchButton = screen.queryByRole('button', { name: /open search/i });
      expect(searchButton).not.toBeInTheDocument();
    });

    it('opens inline search input when search icon is clicked (simple mode)', () => {
      render(<NavBar {...searchProps} />);

      const searchButton = screen.getAllByRole('button', { name: /open search/i })[0];
      fireEvent.click(searchButton);

      // In simple mode (showSuggestions: false), an inline input should appear
      const searchInput = screen.getByPlaceholderText('Search the site...');
      expect(searchInput).toBeInTheDocument();
    });

    it('closes search input when close button is clicked', () => {
      render(<NavBar {...searchProps} />);

      // Open search
      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);

      // Close search
      const closeButton = screen.getByRole('button', { name: /close search/i });
      fireEvent.click(closeButton);

      // Search input should be gone, open button should be back
      expect(screen.queryByPlaceholderText('Search the site...')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /open search/i }).length).toBeGreaterThan(0);
    });

    it('closes search input when Escape key is pressed', () => {
      render(<NavBar {...searchProps} />);

      // Open search
      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);

      const searchInput = screen.getByPlaceholderText('Search the site...');
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      // Search input should be gone
      expect(screen.queryByPlaceholderText('Search the site...')).not.toBeInTheDocument();
    });

    it('calls onInteraction when search is opened', () => {
      const onInteraction = jest.fn();
      render(<NavBar {...searchProps} onInteraction={onInteraction} />);

      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);

      expect(onInteraction).toHaveBeenCalledWith('search_open', {});
    });

    it('calls onInteraction when search is closed', () => {
      const onInteraction = jest.fn();
      render(<NavBar {...searchProps} onInteraction={onInteraction} />);

      // Open then close
      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);
      fireEvent.click(screen.getByRole('button', { name: /close search/i }));

      expect(onInteraction).toHaveBeenCalledWith('search_close', {});
    });

    it('renders search panel with suggestions when showSuggestions is true', () => {
      const suggestionsProps = {
        ...defaultProps,
        content: {
          ...defaultProps.content,
          search: {
            enabled: true,
            placeholder: 'Search products...',
            showSuggestions: true,
            suggestions: [
              { text: 'Web Design', category: 'Services' },
              { text: 'Development', category: 'Services' },
              { text: 'About Us', category: 'Pages' }
            ]
          }
        }
      };

      render(<NavBar {...suggestionsProps} />);

      // Click search icon to open panel
      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);

      // Search panel should be visible with suggestions
      expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
      expect(screen.getByText('Web Design')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('About Us')).toBeInTheDocument();
    });

    it('groups suggestions by category in search panel', () => {
      const suggestionsProps = {
        ...defaultProps,
        content: {
          ...defaultProps.content,
          search: {
            enabled: true,
            showSuggestions: true,
            suggestions: [
              { text: 'Web Design', category: 'Services' },
              { text: 'Contact Page', category: 'Pages' }
            ]
          }
        }
      };

      render(<NavBar {...suggestionsProps} />);

      fireEvent.click(screen.getAllByRole('button', { name: /open search/i })[0]);

      // Category headings should appear
      expect(screen.getAllByText('Services').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pages').length).toBeGreaterThan(0);
    });

    it('renders search in mobile menu', () => {
      render(<NavBar {...searchProps} />);

      // Open mobile menu
      const mobileMenuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(mobileMenuButton);

      // Search icon should be visible in mobile view as well
      const searchButtons = screen.getAllByRole('button', { name: /open search/i });
      expect(searchButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
