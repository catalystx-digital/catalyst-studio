import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ImageGallery } from './index';
import { ImageGalleryAdapter } from '../adapters';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { MediaIngestService } from '@/lib/studio/import/services/media-ingest-service';
import { normalizeComponentContent } from '@/lib/studio/import/services/page-builder/component-helpers';
import type { ImportDetectionResult } from '@/lib/studio/import/web-detection';
import type { MediaRepository } from '@/lib/studio/media/media-repository';
import type { MediaStorageProvider } from '@/lib/studio/media/storage/media-storage-provider';
import type { ImageGalleryContent } from './image-gallery.types';

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

  it.each(['grid', 'masonry'] as const)('renders one wide image at its natural ratio in one %s column', (displayMode) => {
    const { container } = render(
      <ImageGallery
        {...defaultProps}
        content={{
          ...defaultProps.content,
          displayMode,
          images: [{ src: { mediaId: 'media-wide', mediaType: 'image', url: '/wide.jpg', width: 2000, height: 500 }, alt: 'Wide image' }],
        }}
      />,
    );
    const gallery = container.querySelector('[data-gallery-collection]');
    const ratioWrapper = container.querySelector('[data-radix-aspect-ratio-wrapper]');

    expect(gallery).toHaveAttribute('data-columns', '1');
    expect(gallery).toHaveClass(displayMode === 'grid' ? 'grid-cols-1' : 'columns-1');
    expect(gallery?.className).not.toMatch(/(?:sm|lg|xl):(?:grid-cols|columns)-[2-6]/);
    expect(ratioWrapper).toHaveStyle({ paddingBottom: '25%' });
    expect(container.querySelector('[data-gallery-item]')).toHaveStyle({ maxWidth: '2000px' });
    expect(screen.getByAltText('Wide image')).toHaveAttribute('sizes', 'min(100vw, 2000px)');
  });

  it('preserves an ingested image ratio through content normalization and rendering', async () => {
    const imageUrl = 'https://example.com/wide.jpg';
    const repository = {
      resolveByOriginalUrl: jest.fn().mockResolvedValue({
        media: { id: 'media-wide', storageKey: 'site/wide.jpg', contentType: 'image/jpeg', checksum: 'wide', width: 2000, height: 500 },
      }),
      findByChecksum: jest.fn(),
      createMediaAsset: jest.fn(),
      upsertSourceLink: jest.fn(),
    } as unknown as MediaRepository;
    const storageProvider = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      getPublicUrl: jest.fn(),
      getSignedUrl: jest.fn(),
    } as unknown as MediaStorageProvider;
    const detection: ImportDetectionResult = {
      components: [{
        component: 'image-gallery',
        type: 'image-gallery',
        confidence: 0.9,
        content: { images: [{ src: { mediaId: 'detected:wide', mediaType: 'image', url: imageUrl }, alt: 'Ingested wide image' }] },
      }],
      pageTemplate: { templateKey: 'gallery' },
      processingTime: 100,
      modelUsed: 'test-model',
      pageUrl: 'https://example.com',
    };
    const service = new MediaIngestService({ repository, storageProvider, backend: 'FILE' });
    const ingested = await service.ingest({ websiteId: 'site-1', detectionResults: [detection], designTokens: null });
    const rewritten = ingested.detections[0].components?.[0].content as Record<string, unknown>;
    const normalized = normalizeComponentContent(rewritten, { parentCanonicalType: 'image-gallery' });

    expect(normalized.content.images).toEqual([expect.objectContaining({ width: 2000, height: 500 })]);
    const { container } = render(<ImageGallery {...defaultProps} content={normalized.content as ImageGalleryContent} />);
    expect(container.querySelector('[data-radix-aspect-ratio-wrapper]')).toHaveStyle({ paddingBottom: '25%' });
  });

  it('caps a single portrait at its intrinsic width', () => {
    const { container } = render(
      <ImageGallery {...defaultProps} content={{ ...defaultProps.content, images: [{ url: '/portrait.jpg', alt: 'Portrait', width: 200, height: 300 }] }} />,
    );

    expect(container.querySelector('[data-gallery-item]')).toHaveStyle({ maxWidth: '200px' });
    expect(container.querySelector('[data-gallery-item]')).toHaveClass('mx-auto', 'w-full');
    expect(screen.getByAltText('Portrait')).toHaveAttribute('sizes', 'min(100vw, 200px)');
  });

  it('keeps a single image full width when intrinsic width is unknown', () => {
    const { container } = render(
      <ImageGallery {...defaultProps} content={{ ...defaultProps.content, images: [{ url: '/unknown.jpg', alt: 'Unknown width' }] }} />,
    );

    expect(container.querySelector('[data-gallery-item]')).not.toHaveAttribute('style');
    expect(screen.getByAltText('Unknown width')).toHaveAttribute('sizes', '100vw');
  });

  it.each([3, 4])('keeps %i dimensionless images at the default ratio and three columns', imageCount => {
    const { container } = render(
      <ImageGallery
        {...defaultProps}
        content={{
          ...defaultProps.content,
          images: Array.from({ length: imageCount }, (_, index) => ({ url: `/plain-${index + 1}.jpg`, alt: `Plain ${index + 1}` })),
        }}
      />,
    );
    const gallery = container.querySelector('[data-gallery-collection]');

    expect(gallery).toHaveAttribute('data-columns', '3');
    expect(gallery).toHaveClass('lg:grid-cols-3');
    expect(container.querySelector('[data-radix-aspect-ratio-wrapper]')).toHaveStyle({ paddingBottom: '75%' });
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
