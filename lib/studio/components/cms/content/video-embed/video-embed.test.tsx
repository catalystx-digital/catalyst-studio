import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoEmbed } from '.';
import { ComponentCategory, ComponentType } from '../../_core/types';

describe('VideoEmbed component', () => {
  const defaultProps = {
    id: 'video-embed',
    type: ComponentType.VideoEmbed,
    category: ComponentCategory.Content,
    content: {
      provider: 'youtube' as const,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Demo walkthrough',
      description: 'Short marketing overview video.',
      caption: '2 minute overview',
      allowFullScreen: true,
      autoPlay: true,
      muted: true,
      startTime: 5,
    },
  };

  it('renders iframe with converted YouTube embed URL', () => {
    render(<VideoEmbed {...defaultProps} />);
    const iframe = screen.getByTitle('Demo walkthrough');
    expect(iframe).toHaveAttribute(
      'src',
      expect.stringContaining('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    );
    expect(iframe).toHaveAttribute('src', expect.stringContaining('autoplay=1'));
    expect(iframe).toHaveAttribute('src', expect.stringContaining('mute=1'));
    expect(iframe).toHaveAttribute('src', expect.stringContaining('start=5'));
  });

  it('calls onLoad when iframe finishes loading', () => {
    const onLoad = jest.fn();
    render(<VideoEmbed {...defaultProps} onLoad={onLoad} />);

    const iframe = screen.getByTitle('Demo walkthrough');
    fireEvent.load(iframe);

    expect(onLoad).toHaveBeenCalled();
  });

  it('omits allowFullScreen attribute when disabled', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        allowFullScreen: false,
      },
    };
    render(<VideoEmbed {...props} />);
    const iframe = screen.getByTitle('Demo walkthrough');
    expect(iframe).not.toHaveAttribute('allowFullScreen');
  });

  it('renders descriptive text and caption', () => {
    render(<VideoEmbed {...defaultProps} />);
    expect(
      screen.getByText('Short marketing overview video.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 minute overview')).toBeInTheDocument();
  });

  it('invokes onError when configuration is invalid', () => {
    const onError = jest.fn();
    render(
      <VideoEmbed
        {...defaultProps}
        content={{ provider: 'youtube', url: '' }}
        onError={onError}
      />,
    );

    expect(onError).toHaveBeenCalled();
    expect(
      screen.getByText(
        /Unable to render video embed\. Please verify the configuration/i,
      ),
    ).toBeInTheDocument();
  });

  it('supports Vimeo conversion with aspect ratio class', () => {
    const props = {
      ...defaultProps,
      content: {
        provider: 'vimeo' as const,
        url: 'https://vimeo.com/123456',
        aspectRatio: '4:3' as const,
        autoPlay: true,
        muted: true,
        startTime: 5,
      },
    };
    const { container } = render(<VideoEmbed {...props} />);
    const iframe = screen.getByTitle('Embedded video');
    expect(iframe).toHaveAttribute(
      'src',
      'https://player.vimeo.com/video/123456?autoplay=1&muted=1#t=5s',
    );
    const wrapper = container.querySelector('.aspect-\\[4\\/3\\]');
    expect(wrapper).toBeInTheDocument();
  });
});
