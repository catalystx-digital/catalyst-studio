import React from 'react';
import { render } from '@testing-library/react';

import { CardGridAdapter } from '../adapters';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { CMSComponentProps } from '../../_core/types';
import type { CardGridContent } from './card-grid.types';

jest.mock('react-error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  useErrorHandler: () => undefined
}));

jest.mock('../card-grid', () => ({
  CardGrid: jest.fn(() => null)
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CardGrid } = require('../card-grid') as { CardGrid: jest.Mock };

const baseProps: CMSComponentProps = {
  id: 'card-grid',
  type: ComponentType.CardGrid,
  category: ComponentCategory.Content,
  content: {},
  metadata: {},
  propsMeta: undefined
} as CMSComponentProps;

describe('CardGridAdapter', () => {
  beforeEach(() => {
    CardGrid.mockClear();
  });

  it('normalizes nested card content structures', () => {
    const content: CardGridContent = {
      heading: "What's On",
      cards: [
        {
          type: 'card-item',
          content: {
            title: 'Skechers : The Go Walk 8 Has Arrived',
            href: '/Stores/Retail-Stores/Skechers/Articles/2025/09/Skechers--The-Go-Walk-8-Has-Arrived',
            type: 'Offer',
            dates: '18 Sep - 9 Nov',
            location: 'Optus',
            image: {
              src: 'https://cdn.example.com/skechers.png',
              alt: 'GW8U800x800'
            }
          }
        }
      ],
      columns: 3
    };

    render(
      <CardGridAdapter
        {...baseProps}
        content={content}
      />
    );

    expect(CardGrid).toHaveBeenCalledTimes(1);
    const adapterProps = CardGrid.mock.calls[0][0] as { content: CardGridContent };
    const card = adapterProps.content.cards[0];

    expect(card.title).toBe('Skechers : The Go Walk 8 Has Arrived');
    expect(card.link).toBe('/Stores/Retail-Stores/Skechers/Articles/2025/09/Skechers--The-Go-Walk-8-Has-Arrived');
    expect(card.image).toEqual({
      src: 'https://cdn.example.com/skechers.png',
      alt: 'GW8U800x800'
    });
    expect(card.metadata?.category).toBe('Offer');
    expect(card.metadata?.date).toBe('18 Sep - 9 Nov');
    expect(card.metadata?.tags).toEqual(['Optus']);
  });
});
