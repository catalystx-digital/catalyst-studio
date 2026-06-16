import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardGridServer } from '../card-grid.server';

describe('CardGridServer', () => {
  it('renders data URI images without using Next.js image optimisation', () => {
    const markup = renderToStaticMarkup(
      <CardGridServer
        content={{
          heading: 'Sample grid',
          cards: [
            {
              id: 'card-1',
              title: 'Primary card',
              image: {
                src: 'data:image/png;base64,AAA',
                alt: 'Inline data image'
              }
            }
          ]
        }}
      />
    );

    expect(markup).toContain('<img');
    expect(markup).toContain('data:image/png;base64,AAA');
    expect(markup).not.toContain('__next_image');
  });

  it('renders canonical MediaReference image URLs', () => {
    const markup = renderToStaticMarkup(
      <CardGridServer
        content={{
          heading: 'Sample grid',
          cards: [
            {
              id: 'card-1',
              title: 'Primary card',
              image: {
                src: { mediaId: 'media-1', mediaType: 'image', url: '/images/card.jpg' },
                alt: 'Canonical media image',
              },
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('/images/card.jpg');
    expect(markup).toContain('Canonical media image');
  });

  it('treats imported media object icons as card images', () => {
    const markup = renderToStaticMarkup(
      <CardGridServer
        content={{
          heading: 'Sample grid',
          cards: [
            {
              id: 'card-1',
              title: 'Platform knowledge',
              icon: {
                src: 'https://cdn.example.com/icon-platform.png',
                mediaId: 'media-icon',
                originalUrl: 'https://cdn.example.com/icon-platform.png',
              },
            } as any,
          ],
        }}
      />,
    );

    expect(markup).toContain('https://cdn.example.com/icon-platform.png');
    expect(markup).toContain('Platform knowledge');
    expect(markup).not.toContain('[object Object]');
  });

  it('keeps string icons as icon text', () => {
    const markup = renderToStaticMarkup(
      <CardGridServer
        content={{
          heading: 'Sample grid',
          cards: [
            {
              id: 'card-1',
              title: 'Strategy',
              icon: '*',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('>*</span>');
    expect(markup).not.toContain('<img');
  });
});
