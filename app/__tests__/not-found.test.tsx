import { render, screen, fireEvent } from '@testing-library/react';
import NotFound from '../not-found';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn()
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

import { headers } from 'next/headers';

describe('NotFound Component', () => {
  const mockHeaders = headers as jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console.log to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Hard 404', () => {
    beforeEach(() => {
      mockHeaders.mockReturnValue({
        get: (key: string) => {
          switch (key) {
            case 'x-404-type': return 'hard';
            case 'x-404-path': return '/nonexistent';
            default: return null;
          }
        }
      });
    });

    it('should render hard 404 content', () => {
      render(<NotFound />);

      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(screen.getByText(/doesn't exist or has been moved/)).toBeInTheDocument();
    });

    it('should display requested path', () => {
      render(<NotFound />);

      expect(screen.getByText('/nonexistent')).toBeInTheDocument();
      expect(screen.getByText(/Requested path:/)).toBeInTheDocument();
    });

    it('should log hard 404 on server', () => {
      render(<NotFound />);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('404 Page Rendered - Type: hard, Path: /nonexistent')
      );
    });
  });

  describe('Soft 404', () => {
    beforeEach(() => {
      mockHeaders.mockReturnValue({
        get: (key: string) => {
          switch (key) {
            case 'x-404-type': return 'soft';
            case 'x-404-path': return '/unpublished';
            case 'x-page-id': return 'page123';
            default: return null;
          }
        }
      });
    });

    it('should render soft 404 content', () => {
      render(<NotFound />);

      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Page Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/currently unpublished or unavailable/)).toBeInTheDocument();
    });

    it('should log soft 404 with page ID', () => {
      render(<NotFound />);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('404 Page Rendered - Type: soft, Path: /unpublished, PageId: page123')
      );
    });
  });

  describe('Navigation Options', () => {
    beforeEach(() => {
      mockHeaders.mockReturnValue({
        get: () => null
      });
    });

    it('should render navigation links', () => {
      render(<NotFound />);

      expect(screen.getByText('Go to Homepage')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should render suggested pages', () => {
      render(<NotFound />);

      expect(screen.getByText('Suggested Pages')).toBeInTheDocument();
      expect(screen.getByText('About Us')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();
      expect(screen.getByText('Sitemap')).toBeInTheDocument();
    });

    it('should have correct links', () => {
      render(<NotFound />);

      const homeLink = screen.getByText('Go to Homepage');
      expect(homeLink).toHaveAttribute('href', '/');

      const aboutLink = screen.getByText('About Us');
      expect(aboutLink).toHaveAttribute('href', '/about');
    });

    it('should handle back button click', () => {
      const mockBack = jest.fn();
      window.history.back = mockBack;

      render(<NotFound />);

      const backButton = screen.getByText('Go Back');
      fireEvent.click(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      mockHeaders.mockReturnValue({
        get: (key: string) => {
          switch (key) {
            case 'x-404-type': return 'soft';
            case 'x-404-path': return '/test';
            case 'x-page-id': return 'page456';
            default: return null;
          }
        }
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show debug info in development', () => {
      render(<NotFound />);

      expect(screen.getByText('Debug Info (Dev Only)')).toBeInTheDocument();
      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('soft')).toBeInTheDocument();
      expect(screen.getByText('Path:')).toBeInTheDocument();
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('Page ID:')).toBeInTheDocument();
      expect(screen.getByText('page456')).toBeInTheDocument();
    });
  });

  describe('Production Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      mockHeaders.mockReturnValue({
        get: () => null
      });
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should not show debug info in production', () => {
      render(<NotFound />);

      expect(screen.queryByText('Debug Info (Dev Only)')).not.toBeInTheDocument();
    });
  });
});