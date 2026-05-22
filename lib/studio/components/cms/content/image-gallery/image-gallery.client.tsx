'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { sanitizeText } from '../../_core/security';
import { normalizeCmsImage } from '../../_utils/media-reference';
import type { GalleryImage, ImageGalleryProps } from './image-gallery.types';

// Duration to pause autoplay after manual navigation (ms)
const MANUAL_PAUSE_DURATION = 5000;

type PreparedGalleryImage = GalleryImage & { url: string };

export const ImageGalleryClient: React.FC<ImageGalleryProps> = ({
  id,
  content,
  onInteraction
}) => {
  const {
    images,
    displayMode,
    enableLightbox = true,
    autoPlay = false,
    autoPlayInterval = 5000,
    pauseOnHover = true,
  } = content;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const preparedImages = React.useMemo<PreparedGalleryImage[]>(
    () => images
      .map((image): PreparedGalleryImage | null => {
        const normalized = normalizeCmsImage(image);
        return normalized ? { ...image, url: normalized.src, alt: normalized.alt ?? image.alt } : null;
      })
      .filter((image): image is PreparedGalleryImage => Boolean(image)),
    [images],
  );

  // Interruptible animation state
  const [isHovering, setIsHovering] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation is paused when hovering (if pauseOnHover enabled) OR after manual navigation
  const shouldPause = (pauseOnHover && isHovering) || manualPause;

  // Temporarily pause autoplay after manual interaction
  const temporarilyPause = useCallback(() => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setManualPause(true);
    pauseTimeoutRef.current = setTimeout(() => {
      setManualPause(false);
      pauseTimeoutRef.current = null;
    }, MANUAL_PAUSE_DURATION);
  }, []);

  // Cleanup pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle carousel autoplay - now respects shouldPause for interruptibility
  useEffect(() => {
    if (displayMode === 'carousel' && autoPlay && preparedImages.length > 1 && !shouldPause) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % preparedImages.length);
      }, autoPlayInterval);

      return () => clearInterval(interval);
    }
  }, [displayMode, autoPlay, autoPlayInterval, preparedImages.length, shouldPause]);

  // Update carousel position
  useEffect(() => {
    if (displayMode === 'carousel') {
      const track = document.querySelector(
        `#${id} [data-gallery-track]`,
      ) as HTMLElement | null;
      if (track) {
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
      }

      const dots = document.querySelectorAll<HTMLElement>(
        `#${id} [data-gallery-dot]`,
      );
      dots.forEach((dot, index) => {
        dot.setAttribute('aria-pressed', index === currentSlide ? 'true' : 'false');
      });
    }
  }, [id, currentSlide, displayMode]);

  // Handle carousel navigation - pauses autoplay on user interaction
  useEffect(() => {
    if (displayMode !== 'carousel') return;

    const handleDotClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-gallery-dot]');
      if (target) {
        const dotIndex = target.getAttribute('data-index');
        if (dotIndex !== null) {
          const slideIndex = parseInt(dotIndex, 10);
          setCurrentSlide(slideIndex);
          temporarilyPause(); // Pause autoplay on manual navigation
          onInteraction?.('carousel-navigation', { slideIndex });
        }
      }
    };

    const handleKeyNavigation = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        temporarilyPause(); // Pause autoplay on manual navigation
        setCurrentSlide((prev) => (prev - 1 + preparedImages.length) % preparedImages.length);
      } else if (e.key === 'ArrowRight') {
        temporarilyPause(); // Pause autoplay on manual navigation
        setCurrentSlide((prev) => (prev + 1) % preparedImages.length);
      }
    };

    // Handle mouse hover for pause on hover
    const handleMouseEnter = () => {
      if (pauseOnHover) {
        setIsHovering(true);
      }
    };

    const handleMouseLeave = () => {
      if (pauseOnHover) {
        setIsHovering(false);
      }
    };

    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handleDotClick);
      element.addEventListener('keydown', handleKeyNavigation);
      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        element.removeEventListener('click', handleDotClick);
        element.removeEventListener('keydown', handleKeyNavigation);
        element.removeEventListener('mouseenter', handleMouseEnter);
        element.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [id, displayMode, preparedImages.length, onInteraction, pauseOnHover, temporarilyPause]);

  // Handle lightbox
  const openLightbox = useCallback((index: number) => {
    if (!enableLightbox) return;
    setLightboxIndex(index);
    setLightboxOpen(true);
    onInteraction?.('lightbox-open', { imageIndex: index });
  }, [enableLightbox, onInteraction]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    onInteraction?.('lightbox-close', { imageIndex: lightboxIndex });
  }, [lightboxIndex, onInteraction]);

  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    setLightboxIndex((prev) => {
      const newIndex = direction === 'next' 
        ? (prev + 1) % preparedImages.length
        : (prev - 1 + preparedImages.length) % preparedImages.length;
      onInteraction?.('lightbox-navigation', { direction, newIndex });
      return newIndex;
    });
  }, [preparedImages.length, onInteraction]);

  // Attach click handlers for grid/masonry images
  useEffect(() => {
    if (displayMode === 'carousel' || !enableLightbox) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const galleryItem = target.closest('[data-gallery-item]');
      if (galleryItem) {
        const index = parseInt(galleryItem.getAttribute('data-image-index') || '0', 10);
        openLightbox(index);
      }
    };

    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handleImageClick);
      return () => element.removeEventListener('click', handleImageClick);
    }
  }, [id, displayMode, enableLightbox, openLightbox]);

  // Render lightbox
  if (lightboxOpen && enableLightbox) {
    const currentImage = preparedImages[lightboxIndex];
    if (!currentImage) {
      return null;
    }

    return (
      <div className="cms-gallery-lightbox fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300">
        <button
          onClick={closeLightbox}
          className="absolute right-6 top-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-card hover:shadow-md"
          aria-label="Close lightbox"
        >
          <span className="text-3xl leading-none">&times;</span>
        </button>

        {preparedImages.length > 1 && (
          <>
            <button
              onClick={() => navigateLightbox('prev')}
              className="absolute left-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-card hover:shadow-md"
              aria-label="Previous image"
            >
              <span className="text-3xl leading-none">&#8249;</span>
            </button>
            <button
              onClick={() => navigateLightbox('next')}
              className="absolute right-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-card hover:shadow-md"
              aria-label="Next image"
            >
              <span className="text-3xl leading-none">&#8250;</span>
            </button>
          </>
        )}

        <div className="relative flex h-full max-h-[90vh] w-full max-w-6xl items-center justify-center p-8">
          <Image
            src={currentImage.url}
            alt={sanitizeText(currentImage.alt ?? '')}
            width={1200}
            height={800}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-300"
            priority
          />
        </div>

        {currentImage.caption && (
          <div className="absolute bottom-6 left-0 right-0 px-4 text-center">
            <p className="inline-flex rounded-full bg-card/90 px-6 py-3 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
              {sanitizeText(currentImage.caption as string)}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null; // Main rendering is done in server component
};
