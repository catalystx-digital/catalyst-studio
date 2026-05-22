import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentType, ComponentCategory } from '../../_core/types';
import type { CMSComponentProps } from '../../_core/types';

const renderCMSComponents = jest.fn(async (components: CMSComponentProps[]) => {
  if (!Array.isArray(components)) {
    return [];
  }

  return components.map((component) => (
    <div data-testid="mock-cms-component" key={component.id}>
      {component.content?.heading ?? component.content?.title ?? component.id}
    </div>
  ));
});

jest.mock('../../_factory/renderer.server', () => ({
  renderCMSComponents: (...args: Parameters<typeof renderCMSComponents>) =>
    renderCMSComponents(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TwoColumnServer } = require('./two-column.server') as typeof import('./two-column.server');

const childComponent = (id: string, heading: string): CMSComponentProps => ({
  id,
  type: ComponentType.TextBlock,
  category: ComponentCategory.Content,
  content: {
    heading,
    body: `<p>${heading} body</p>`,
  },
  metadata: {},
  propsMeta: undefined,
} as CMSComponentProps);

describe('TwoColumn Component', () => {
  beforeEach(() => {
    renderCMSComponents.mockClear();
  });

  const defaultProps = {
    id: 'test-two-column',
    type: ComponentType.TwoColumn,
    category: ComponentCategory.Content,
    content: {
      leftColumn: [childComponent('left-text', 'Left Heading')],
      rightColumn: [childComponent('right-text', 'Right Heading')],
      columnRatio: '50-50' as const,
    },
  };

  const renderServer = async (props = defaultProps) => {
    const element = await TwoColumnServer(props);
    return render(element as React.ReactElement);
  };

  it('renders canonical child component arrays in both columns', async () => {
    await renderServer();

    await waitFor(() => {
      expect(renderCMSComponents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'left-text', theme: 'auto' }),
        ]),
      );
      expect(renderCMSComponents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'right-text', theme: 'auto' }),
        ]),
      );
    });
  });

  it('does not render legacy object columns', async () => {
    await renderServer({
      ...defaultProps,
      content: {
        leftColumn: {
          type: 'text',
          heading: 'Legacy Left',
          body: '<p>Legacy body</p>',
        },
        rightColumn: {
          type: 'image',
          imageUrl: '/legacy.jpg',
          imageAlt: 'Legacy image',
        },
      } as any,
    });

    expect(screen.queryByText('Legacy Left')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Legacy image')).not.toBeInTheDocument();
    expect(renderCMSComponents).not.toHaveBeenCalled();
  });

  it('does not fall back to areas slots', async () => {
    await renderServer({
      ...defaultProps,
      content: {
        areas: {
          left: [childComponent('legacy-left', 'Legacy Area Left')],
          right: [childComponent('legacy-right', 'Legacy Area Right')],
        },
      } as any,
    });

    expect(screen.queryByText('Legacy Area Left')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy Area Right')).not.toBeInTheDocument();
    expect(renderCMSComponents).not.toHaveBeenCalled();
  });

  it('applies correct column ratio classes', async () => {
    await renderServer();
    expect(screen.getByTestId('two-column-grid')).toHaveClass('lg:grid-cols-2');
  });

  it('applies theme classes correctly', async () => {
    const { container, unmount } = await renderServer();
    expect(container.firstChild).toHaveClass('cms-two-column');

    unmount();
    const darkElement = await TwoColumnServer({ ...defaultProps, theme: 'dark' });
    const darkRender = render(darkElement as React.ReactElement);
    expect(darkRender.container.firstChild).toHaveClass('theme-dark');
  });

  it('applies gap classes based on gap prop', async () => {
    const { unmount } = await renderServer({
      ...defaultProps,
      content: { ...defaultProps.content, gap: 'small' },
    });
    expect(screen.getByTestId('two-column-grid')).toHaveClass('ds-gap-md');

    unmount();
    await renderServer({
      ...defaultProps,
      content: { ...defaultProps.content, gap: 'large' },
    });
    expect(screen.getAllByTestId('two-column-grid').at(-1)).toHaveClass('ds-gap-2xl');
  });

  it('applies vertical alignment classes', async () => {
    const { unmount } = await renderServer({
      ...defaultProps,
      content: { ...defaultProps.content, verticalAlignment: 'center' },
    });
    expect(screen.getByTestId('two-column-grid')).toHaveClass('items-center');

    unmount();
    await renderServer({
      ...defaultProps,
      content: { ...defaultProps.content, verticalAlignment: 'bottom' },
    });
    expect(screen.getAllByTestId('two-column-grid').at(-1)).toHaveClass('items-end');
  });

  it('applies custom className and styles', async () => {
    const { container } = await renderServer({
      ...defaultProps,
      className: 'custom-class',
      style: { padding: '20px' },
    });
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveStyle({ padding: '20px' });
  });

  it('includes analytics data attributes', async () => {
    const { container } = await renderServer({
      ...defaultProps,
      analyticsId: 'two-col-001',
    });
    expect(container.firstChild).toHaveAttribute('data-analytics-id', 'two-col-001');
    expect(container.firstChild).toHaveAttribute('data-component-type', 'two-column');
  });
});
