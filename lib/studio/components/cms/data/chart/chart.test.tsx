import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import Chart from './index';
import {
  ComponentCategory,
  ComponentType,
} from '../../_core/types';
import type { ChartProps } from './chart.types';

jest.mock('../../_core/monitoring', () => ({
  withPerformanceTracking: (Component: any) => Component,
}));

describe('Chart (placeholder)', () => {
  const baseProps: ChartProps = {
    id: 'chart-1',
    type: ComponentType.Chart,
    category: ComponentCategory.Data,
    content: {
      title: 'Quarterly ARR',
      description: 'ARR grouped by quarter for <strong>2024</strong>.',
      type: 'bar',
      categories: ['Q1', 'Q2', 'Q3'],
      series: [
        {
          id: 'series-2024',
          name: '2024',
          values: [1.2, 1.8, 2.6],
          tone: 'accent',
        },
        {
          id: 'series-2023',
          name: '2023',
          values: [0.8, 1.3, 1.9],
          tone: 'positive',
        },
      ],
      unitLabel: 'M',
      footnote: 'Values rounded to nearest million.',
    },
  };

  it('renders title, legend, and bar series with badges', () => {
    render(<Chart {...baseProps} />);

    expect(
      screen.getByRole('heading', { name: 'Quarterly ARR' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Chart legend')).toBeInTheDocument();

    const badges = document.querySelectorAll('.cms-badge');
    expect(badges.length).toBeGreaterThan(0);

    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /2024 Q1 value 1\.2 M/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1.2 M')).toBeInTheDocument();
  });

  it('sanitizes content and strips unsafe markup', () => {
    const props: ChartProps = {
      ...baseProps,
      content: {
        ...baseProps.content,
        description: '<script>alert(1)</script><em>Safe text</em>',
        categories: ['<img src=x onerror=alert(1)>Q1'],
        series: [
          {
            name: '<b>Series</b>',
            values: ['2.5<script>alert(1)</script>'],
          },
        ],
      },
    };

    render(<Chart {...props} />);

    expect(screen.getByText('Safe text')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Series Q1 value/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('alert(1)')).not.toBeInTheDocument();
  });

  it('falls back gracefully when no data provided', () => {
    const props: ChartProps = {
      ...baseProps,
      content: {
        title: 'Empty data',
        data: [],
      },
    };

    render(<Chart {...props} />);

    expect(screen.getByText('Data unavailable or improperly configured.')).toBeInTheDocument();
  });

  it('emits analytics when clicking a bar series', () => {
    const onInteraction = jest.fn();

    render(<Chart {...baseProps} onInteraction={onInteraction} />);

    const target = screen.getByRole('button', {
      name: /2024 Q1 value 1\.2 M/,
    });
    fireEvent.click(target);

    expect(onInteraction).toHaveBeenCalledWith('chart-bar-click', {
      category: 'Q1',
      seriesId: 'series-2024',
      seriesName: '2024',
      value: 1.2,
    });
  });
});
