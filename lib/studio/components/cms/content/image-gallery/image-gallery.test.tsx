import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImageGallery } from './index';
import { ImageGalleryAdapter } from '../adapters';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('ImageGallery Component', () => {
  const defaultProps = {
    id: 'test-gallery',
    type: ComponentType.ImageGallery,
    category: ComponentCategory.Content,
    content: {
      images: [
        { url: '/image1.jpg', alt: 'Image 1', caption: 'First image', width: 1200, height: 800 },
        { url: '/image2.jpg', alt: 'Image 2', caption: 'Second image', width: 1000, height: 1400 },
        { url: '/image3.jpg', alt: 'Image 3', caption: 'Third image', width: 1600, height: 900 }
      ],
      displayMode: 'grid' as const,
      columns: 3 as const,
      showCaptions: true
    }
  };

  it('renders all images in grid mode', () => {
    render(<ImageGallery {...defaultProps} />);
    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    expect(screen.getByAltText('Image 3')).toBeInTheDocument();
  });

  it('renders captions when showCaptions is true', () => {
    render(<ImageGallery {...defaultProps} />);
    expect(screen.getByText('First image')).toBeInTheDocument();
    expect(screen.getByText('Second image')).toBeInTheDocument();
    expect(screen.getByText('Third image')).toBeInTheDocument();
  });

  it('does not render captions when showCaptions is false', () => {
    const propsWithoutCaptions = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showCaptions: false
      }
    };
    render(<ImageGallery {...propsWithoutCaptions} />);
    expect(screen.queryByText('First image')).not.toBeInTheDocument();
  });

  it('renders heading and subheading when provided', () => {
    const propsWithHeadings = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        heading: 'Gallery Title',
        subheading: 'Gallery Subtitle'
      }
    };
    render(<ImageGallery {...propsWithHeadings} />);
    expect(screen.getByText('Gallery Title')).toBeInTheDocument();
    expect(screen.getByText('Gallery Subtitle')).toBeInTheDocument();
  });

  it('applies correct column classes for grid mode', () => {
    const { container } = render(<ImageGallery {...defaultProps} />);
    const gallery = container.querySelector('[data-gallery-collection="grid"]');
    expect(gallery).toHaveClass('grid');
    expect(gallery?.className).toContain('grid-cols-1');
    expect(gallery?.className).toContain('sm:grid-cols-2');
    expect(gallery?.className).toContain('lg:grid-cols-3');
  });

  it('renders carousel mode with navigation dots', () => {
    const carouselProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        displayMode: 'carousel' as const
      }
    };
    render(<ImageGallery {...carouselProps} />);
    
    const dots = screen.getAllByLabelText(/Go to slide/i);
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-pressed', 'true');
    expect(dots[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies correct spacing classes', () => {
    const { container, rerender } = render(<ImageGallery {...defaultProps} />);
    const gallery = () =>
      container.querySelector('[data-gallery-collection]');

    expect(gallery()?.className).toContain('gap-6');

    const tightProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        spacing: 'tight' as const
      }
    };
    rerender(<ImageGallery {...tightProps} />);
    expect(gallery()?.className).toContain('gap-3');

    const looseProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        spacing: 'loose' as const
      }
    };
    rerender(<ImageGallery {...looseProps} />);
    expect(gallery()?.className).toContain('gap-10');
  });

  it('applies theme classes correctly', () => {
    const { rerender } = render(<ImageGallery {...defaultProps} />);
    const wrapper = screen.getByTestId('cms-image-gallery');
    expect(wrapper.className).toContain('cms-card');

    rerender(<ImageGallery {...defaultProps} theme="dark" />);
    expect(wrapper.className).toContain('theme-dark');
  });

  it('renders masonry layout when displayMode is masonry', () => {
    const masonryProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        displayMode: 'masonry' as const
      }
    };
    const { container } = render(<ImageGallery {...masonryProps} />);
    const gallery = container.querySelector('[data-gallery-collection]');
    expect(gallery?.className).toContain('columns-1');
    expect(gallery?.className).toContain('sm:columns-2');
    expect(gallery?.className).toContain('lg:columns-3');
    expect(gallery?.className).not.toContain('grid');
  });

  it('applies custom className and styles', () => {
    render(
      <ImageGallery
        {...defaultProps}
        className="custom-gallery"
        style={{ padding: '20px' }}
      />,
    );
    const wrapper = screen.getByTestId('cms-image-gallery');
    expect(wrapper).toHaveClass('custom-gallery');
    expect(wrapper).toHaveStyle({ padding: '20px' });
  });

  it('includes analytics data attributes', () => {
    const { rerender } = render(<ImageGallery {...defaultProps} analyticsId="gallery-001" />);
    const wrapper = screen.getByTestId('cms-image-gallery');
    expect(wrapper).toHaveAttribute('data-analytics-id', 'gallery-001');
    expect(wrapper).toHaveAttribute('data-component-type', 'image-gallery');
    expect(wrapper).toHaveAttribute('data-display-mode', 'grid');

    rerender(<ImageGallery {...defaultProps} content={{ ...defaultProps.content, displayMode: 'carousel' }} analyticsId="gallery-002" />);
    expect(wrapper).toHaveAttribute('data-display-mode', 'carousel');
  });

  it('sets correct loading attribute for images', () => {
    const { container } = render(<ImageGallery {...defaultProps} />);
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveAttribute('loading', 'eager');
    if (images.length > 2) {
      expect(images[2]).toHaveAttribute('loading', 'lazy');
    }
  });

  it('normalizes asset-backed images through the adapter', () => {
    render(
      <ImageGalleryAdapter
        id="gallery-adapter-test"
        type={ComponentType.ImageGallery}
        category={ComponentCategory.Content}
        content={{
          images: [
            {
              url: {
                mediaId: 'media-123',
                originalUrl: 'https://cdn.example.com/gallery.jpg'
              },
              alt: 'Gallery Asset'
            }
          ],
          displayMode: 'grid'
        }}
      />,
    );

    const image = screen.getByAltText('Gallery Asset');
    expect(image).toHaveAttribute('src', expect.stringContaining('https://cdn.example.com/gallery.jpg'));
  });
});
