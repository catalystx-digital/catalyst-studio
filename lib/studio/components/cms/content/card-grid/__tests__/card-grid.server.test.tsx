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
});
