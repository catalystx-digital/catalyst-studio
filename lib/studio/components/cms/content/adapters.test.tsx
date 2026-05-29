import React from 'react';
import { render } from '@testing-library/react';

import {
  AccordionAdapter,
  CardItemAdapter,
  ImageGalleryAdapter,
  TabsAdapter,
  TwoColumnAdapter
} from './adapters';
import { ComponentCategory, ComponentType } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';

jest.mock('./two-column', () => ({
  TwoColumn: jest.fn(() => null)
}));

jest.mock('./accordion', () => ({
  Accordion: jest.fn(() => null)
}));

jest.mock('./tabs', () => ({
  Tabs: jest.fn(() => null)
}));

jest.mock('./card-item', () => ({
  CardItem: jest.fn(() => null)
}));

jest.mock('./image-gallery', () => ({
  ImageGallery: jest.fn(() => null)
}));

const { TwoColumn } = require('./two-column') as { TwoColumn: jest.Mock };
const { Accordion } = require('./accordion') as { Accordion: jest.Mock };
const { Tabs } = require('./tabs') as { Tabs: jest.Mock };
const { CardItem } = require('./card-item') as { CardItem: jest.Mock };
const { ImageGallery } = require('./image-gallery') as { ImageGallery: jest.Mock };

const baseProps = (type: ComponentType, content: unknown): CMSComponentProps => ({
  id: `${type}-test`,
  type,
  category: ComponentCategory.Content,
  content,
  metadata: {},
  propsMeta: undefined
} as CMSComponentProps);

describe('content adapters canonical shape handling', () => {
  beforeEach(() => {
    TwoColumn.mockClear();
    Accordion.mockClear();
    Tabs.mockClear();
    CardItem.mockClear();
    ImageGallery.mockClear();
  });

  it('does not map legacy TwoColumn leftColumn/rightColumn into areas', () => {
    const content = {
      leftColumn: { type: 'text', heading: 'Left', body: 'Body' },
      rightColumn: { type: 'image', imageUrl: '/right.png' }
    };

    render(<TwoColumnAdapter {...baseProps(ComponentType.TwoColumn, content)} />);

    expect(TwoColumn).toHaveBeenCalledTimes(1);
    expect(TwoColumn.mock.calls[0][0].content).toEqual(content);
    expect(TwoColumn.mock.calls[0][0].content.areas).toBeUndefined();
  });

  it('does not map legacy Accordion items into areas.items', () => {
    const content = {
      heading: 'FAQ',
      items: [{ id: 'legacy-item', title: 'Legacy', content: 'Body' }]
    };

    render(<AccordionAdapter {...baseProps(ComponentType.Accordion, content)} />);

    expect(Accordion).toHaveBeenCalledTimes(1);
    expect(Accordion.mock.calls[0][0].content).toEqual(content);
    expect(Accordion.mock.calls[0][0].content.areas).toBeUndefined();
  });

  it('does not map legacy Tabs tabs into areas.items', () => {
    const content = {
      heading: 'Tabs',
      tabs: [{ id: 'legacy-tab', label: 'Legacy', content: 'Body' }]
    };

    render(<TabsAdapter {...baseProps(ComponentType.Tabs, content)} />);

    expect(Tabs).toHaveBeenCalledTimes(1);
    expect(Tabs.mock.calls[0][0].content).toEqual(content);
    expect(Tabs.mock.calls[0][0].content.areas).toBeUndefined();
  });

  it('does not coerce nested or legacy CardItem fields', () => {
    const content = {
      content: {
        title: 'Nested title',
        href: '/nested'
      },
      heading: 'Legacy heading',
      imageUrl: '/legacy.png'
    };

    render(<CardItemAdapter {...baseProps(ComponentType.CardItem, content)} />);

    expect(CardItem).toHaveBeenCalledTimes(1);
    expect(CardItem.mock.calls[0][0].content).toEqual(content);
    expect(CardItem.mock.calls[0][0].content.title).toBeUndefined();
    expect(CardItem.mock.calls[0][0].content.image).toBeUndefined();
  });

  it('preserves image gallery string URL entries at the adapter edge', () => {
    const content = {
      images: [
        'https://cdn.example.com/gallery/office-1.jpg',
        {
          src: {
            mediaId: 'media-gallery-2',
            mediaType: 'image',
            url: 'https://cdn.example.com/gallery/office-2.jpg',
            alt: 'Office detail'
          },
          caption: 'Brand detail'
        }
      ],
      displayMode: 'grid'
    };

    render(<ImageGalleryAdapter {...baseProps(ComponentType.ImageGallery, content)} />);

    expect(ImageGallery).toHaveBeenCalledTimes(1);
    expect(ImageGallery.mock.calls[0][0].content.images).toEqual([
      expect.objectContaining({
        url: 'https://cdn.example.com/gallery/office-1.jpg',
        alt: '',
        originalUrl: 'https://cdn.example.com/gallery/office-1.jpg'
      }),
      expect.objectContaining({
        url: 'https://cdn.example.com/gallery/office-2.jpg',
        alt: 'Office detail',
        caption: 'Brand detail',
        originalUrl: 'https://cdn.example.com/gallery/office-2.jpg'
      })
    ]);
  });
});
