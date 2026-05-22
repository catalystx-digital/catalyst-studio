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

  it('preserves nested legacy card content without adapter coercion', () => {
    const content = {
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
    } as unknown as CardGridContent;

    render(
      <CardGridAdapter
        {...baseProps}
        content={content}
      />
    );

    expect(CardGrid).toHaveBeenCalledTimes(1);
    const adapterProps = CardGrid.mock.calls[0][0] as { content: CardGridContent };
    const card = adapterProps.content.cards[0];

    expect(card.title).toBeUndefined();
    expect((card as any).content.title).toBe('Skechers : The Go Walk 8 Has Arrived');
    expect((card as any).content.href).toBe('/Stores/Retail-Stores/Skechers/Articles/2025/09/Skechers--The-Go-Walk-8-Has-Arrived');
    expect((card as any).content.image).toEqual({
      src: 'https://cdn.example.com/skechers.png',
      alt: 'GW8U800x800'
    });
    expect(card.metadata).toBeUndefined();
  });

  it('rejects stringified content instead of parsing legacy JSON', () => {
    expect(() => render(
      <CardGridAdapter
        {...baseProps}
        content={'{"heading":"Legacy heading","cards":[]}' as unknown as CardGridContent}
      />
    )).toThrow('CMS runtime content must be canonical object content; string content is not accepted.');
  });
});
