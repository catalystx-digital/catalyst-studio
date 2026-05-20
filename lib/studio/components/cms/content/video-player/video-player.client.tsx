'use client';

import React, { useEffect, useState, useRef } from 'react';
import { sanitizeText } from '../../_core/security';
import { VideoPlayerProps } from './video-player.types';

export const VideoPlayerClient: React.FC<VideoPlayerProps> = ({ 
  id, 
  content,
  onInteraction,
  onError 
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(content.autoPlay || false);
  const [hasError, setHasError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Handle play button click for native videos
  useEffect(() => {
    const handlePlayClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const playButton = target.closest('[data-play-button]');
      
      if (playButton) {
        const video = document.querySelector(`#${id}-video`) as HTMLVideoElement;
        if (video) {
          video.play();
          setIsPlaying(true);
          
          // Hide play overlay
          const overlay = document.querySelector(`#${id} [data-play-overlay]`) as HTMLElement;
          if (overlay) {
            overlay.style.display = 'none';
          }
          
          onInteraction?.('play', { source: 'button' });
        }
      }
    };

    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handlePlayClick);
      return () => element.removeEventListener('click', handlePlayClick);
    }
  }, [id, onInteraction]);

  // Track video events
  useEffect(() => {
    const video = document.querySelector(`#${id}-video`) as HTMLVideoElement;
    if (!video) return;

    videoRef.current = video;

    const handlePlay = () => {
      setIsPlaying(true);
      onInteraction?.('play', { currentTime: video.currentTime });
    };

    const handlePause = () => {
      setIsPlaying(false);
      onInteraction?.('pause', { currentTime: video.currentTime });
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onInteraction?.('ended', { duration: video.duration });
    };

    const handleTimeUpdate = () => {
      // Track viewing progress at 25%, 50%, 75%, 90%
      const progress = (video.currentTime / video.duration) * 100;
      const milestones = [25, 50, 75, 90];
      
      milestones.forEach(milestone => {
        const key = `progress_${milestone}`;
        if (progress >= milestone && !video.dataset[key]) {
          video.dataset[key] = 'true';
          onInteraction?.('progress', { milestone, currentTime: video.currentTime });
        }
      });
    };

    const handleError = (e: Event) => {
      if (process.env.NODE_ENV === 'development') {
      console.error('Video playback error:', e);
      }
      setHasError(true);
      
      // Set timeout for fallback (5-10 seconds as per requirements)
      errorTimeoutRef.current = setTimeout(() => {
        showFallback();
      }, 5000);
      
      onError?.(new Error('Video playback failed'));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [id, onInteraction, onError]);

  // Handle error fallback
  const showFallback = () => {
    const container = document.querySelector(`#${id} [data-video-container]`) as HTMLElement;
    if (!container) return;

    const hasFallback = container.dataset.hasFallback === 'true';
    
    const fallbackText = sanitizeText(
      content.fallbackMessage || 'Video playback failed',
    );

    if (hasFallback && content.fallbackImage) {
      const wrapper = document.createElement('div');
      wrapper.className =
        'relative flex h-full w-full items-center justify-center rounded-xl border border-border/40 bg-muted/80';

      const img = document.createElement('img');
      img.src = content.fallbackImage;
      img.alt = sanitizeText(content.title || 'Video unavailable');
      img.className = 'h-full w-full rounded-xl object-cover';

      const overlay = document.createElement('div');
      overlay.className =
        'absolute inset-0 flex items-center justify-center rounded-xl bg-background/70';

      const message = document.createElement('p');
      message.className = 'text-base font-medium text-foreground';
      message.textContent = fallbackText;

      overlay.appendChild(message);
      wrapper.appendChild(img);
      wrapper.appendChild(overlay);

      container.replaceChildren(wrapper);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className =
        'flex h-full w-full items-center justify-center rounded-xl border border-border/40 bg-muted/80';

      const message = document.createElement('p');
      message.className = 'text-base text-muted-foreground';
      message.textContent = fallbackText;

      wrapper.appendChild(message);
      container.replaceChildren(wrapper);
    }
    
    onInteraction?.('fallback-shown', { hasError: true });
  };

  // Handle fullscreen for embedded videos
  useEffect(() => {
    const handleFullscreen = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const video = document.querySelector(`#${id}-video`) as HTMLVideoElement;
        const iframe = document.querySelector(`#${id} iframe`) as HTMLIFrameElement;
        
        if (video && document.activeElement === video) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            video.requestFullscreen();
          }
          onInteraction?.('fullscreen-toggle', { isFullscreen: !document.fullscreenElement });
        } else if (iframe && document.activeElement === iframe) {
          iframe.requestFullscreen();
          onInteraction?.('fullscreen-toggle', { isFullscreen: true });
        }
      }
    };

    document.addEventListener('keydown', handleFullscreen);
    return () => document.removeEventListener('keydown', handleFullscreen);
  }, [id, onInteraction]);

  return null; // Client component only adds interactivity
};
