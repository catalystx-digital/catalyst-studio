import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoPlayer } from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('VideoPlayer Component', () => {
  const defaultProps = {
    id: 'test-video-player',
    type: ComponentType.VideoPlayer,
    category: ComponentCategory.Content,
    content: {
      sources: [
        { url: '/video.mp4', type: 'mp4' as const },
        { url: '/video.webm', type: 'webm' as const }
      ],
      posterImage: '/poster.jpg',
      title: 'Test Video',
      description: 'A test video description',
      controls: true
    }
  };

  it('renders video element with multiple sources', () => {
    const { container } = render(<VideoPlayer {...defaultProps} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    
    const sources = container.querySelectorAll('video source');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute('src', '/video.mp4');
    expect(sources[0]).toHaveAttribute('type', 'video/mp4');
    expect(sources[1]).toHaveAttribute('src', '/video.webm');
    expect(sources[1]).toHaveAttribute('type', 'video/webm');
  });

  it('renders title and description when provided', () => {
    render(<VideoPlayer {...defaultProps} />);
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('A test video description')).toBeInTheDocument();
  });

  it('sets video attributes correctly', () => {
    const propsWithAutoplay = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        autoPlay: true,
        muted: true,
        loop: true,
        controls: false
      }
    };
    
    const { container } = render(<VideoPlayer {...propsWithAutoplay} />);
    const video = container.querySelector('video');
    
    expect(video).toHaveAttribute('autoplay');
    // React sets muted as property not attribute
    expect(video).toHaveProperty('muted', true);
    expect(video).toHaveAttribute('loop');
    expect(video).not.toHaveAttribute('controls');
  });

  it('renders YouTube embed for YouTube sources', () => {
    const youtubeProps = {
      ...defaultProps,
      content: {
        sources: [
          { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'youtube' as const }
        ],
        title: 'YouTube Video'
      }
    };
    
    const { container } = render(<VideoPlayer {...youtubeProps} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src');
    expect(iframe?.src).toContain('youtube-nocookie.com/embed');
  });

  it('renders Vimeo embed for Vimeo sources', () => {
    const vimeoProps = {
      ...defaultProps,
      content: {
        sources: [
          { url: 'https://vimeo.com/123456789', type: 'vimeo' as const }
        ],
        title: 'Vimeo Video'
      }
    };
    
    const { container } = render(<VideoPlayer {...vimeoProps} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src');
    expect(iframe?.src).toContain('player.vimeo.com/video');
  });

  it('applies correct aspect ratio classes', () => {
    const { container, rerender } = render(<VideoPlayer {...defaultProps} />);
    let aspectContainer = container.querySelector('[data-aspect-ratio="16:9"]');
    expect(aspectContainer).toBeInTheDocument();

    const squareProps = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        aspectRatio: '1:1' as const
      }
    };
    rerender(<VideoPlayer {...squareProps} />);
    aspectContainer = container.querySelector('[data-aspect-ratio="1:1"]');
    expect(aspectContainer).toBeInTheDocument();
  });

  it('shows play button overlay when showPlayButton is true and not autoplaying', () => {
    const propsWithPlayButton = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showPlayButton: true,
        autoPlay: false,
        posterImage: '/poster.jpg'
      }
    };
    
    const { container } = render(<VideoPlayer {...propsWithPlayButton} />);
    const playButton = container.querySelector('[data-play-button]');
    expect(playButton).toBeInTheDocument();
    expect(playButton).toHaveAttribute('aria-label', 'Play video');
  });

  it('does not show play button when autoPlay is true', () => {
    const propsWithAutoPlay = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        showPlayButton: true,
        autoPlay: true
      }
    };
    
    const { container } = render(<VideoPlayer {...propsWithAutoPlay} />);
    const playButton = container.querySelector('[data-play-button]');
    expect(playButton).not.toBeInTheDocument();
  });

  it('renders fallback message when no sources provided', () => {
    const noSourcesProps = {
      ...defaultProps,
      content: {
        sources: [],
        fallbackMessage: 'No video available'
      }
    };
    
    render(<VideoPlayer {...noSourcesProps} />);
    expect(screen.getByText('No video available')).toBeInTheDocument();
  });

  it('applies theme classes correctly', () => {
    const { rerender } = render(<VideoPlayer {...defaultProps} />);
    const wrapper = screen.getByTestId('cms-video-player');
    expect(wrapper).toHaveClass('cms-card');

    rerender(<VideoPlayer {...defaultProps} theme="dark" />);
    expect(wrapper.className).toContain('theme-dark');
  });

  it('applies custom className and styles', () => {
    render(
      <VideoPlayer
        {...defaultProps}
        className="custom-video"
        style={{ padding: '20px' }}
      />,
    );
    const wrapper = screen.getByTestId('cms-video-player');
    expect(wrapper).toHaveClass('custom-video');
    expect(wrapper).toHaveStyle({ padding: '20px' });
  });

  it('includes analytics data attributes', () => {
    render(<VideoPlayer {...defaultProps} analyticsId="video-001" />);
    const wrapper = screen.getByTestId('cms-video-player');
    expect(wrapper).toHaveAttribute('data-analytics-id', 'video-001');
    expect(wrapper).toHaveAttribute('data-component-type', 'video-player');
  });
});
