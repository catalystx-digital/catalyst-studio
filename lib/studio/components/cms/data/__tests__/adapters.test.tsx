import React from 'react';
import { render } from '@testing-library/react';

import { StatisticsAdapter, DataTableAdapter, TimelineAdapter, ChartAdapter } from '../adapters';
import { ComponentCategory, ComponentType } from '../../_core/types';

jest.mock('../statistics', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('../data-table', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('../timeline', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('../chart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const StatisticsMock = require('../statistics').default as jest.Mock;
const DataTableMock = require('../data-table').default as jest.Mock;
const TimelineMock = require('../timeline').default as jest.Mock;
const ChartMock = require('../chart').default as jest.Mock;

describe('Data adapters', () => {
  beforeEach(() => {
    StatisticsMock.mockClear();
    DataTableMock.mockClear();
    TimelineMock.mockClear();
    ChartMock.mockClear();
  });

  it('passes canonical statistics content through without coercion', () => {
    const content = {
      layout: 'row',
      stats: [{ id: '', value: '12.5', label: 'Active Users' }],
    };

    render(
      <StatisticsAdapter
        id="stats-1"
        type={ComponentType.Statistics}
        category={ComponentCategory.Data}
        variant="card"
        theme="dark"
        content={content}
      />,
    );

    expect(StatisticsMock).toHaveBeenCalledTimes(1);
    const props = StatisticsMock.mock.calls[0][0];
    expect(props.variant).toBe('card');
    expect(props.theme).toBe('dark');
    expect(props.content).toBe(content);
    expect(props.content.stats[0]).toEqual({ id: '', value: '12.5', label: 'Active Users' });
  });

  it('passes canonical table content through without synthetic row or option defaults', () => {
    const content = {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ id: '', name: 'Alice' }],
    };

    render(
      <DataTableAdapter
        id="table-1"
        type={ComponentType.DataTable}
        category={ComponentCategory.Data}
        variant="spacious"
        content={content}
      />,
    );

    expect(DataTableMock).toHaveBeenCalledTimes(1);
    const props = DataTableMock.mock.calls[0][0];
    expect(props.variant).toBe('spacious');
    expect(props.content).toBe(content);
    expect(props.content.rows[0]).toEqual({ id: '', name: 'Alice' });
    expect(props.content.pagination).toBeUndefined();
  });

  it('passes canonical timeline content through without date, action, or layout coercion', () => {
    const content = {
      events: [
        {
          id: '',
          title: '',
          actions: [{ label: 'Learn more', href: '/learn' }],
        },
      ],
      footerCta: { title: 'Contact us', link: '/contact' },
    };

    render(
      <TimelineAdapter
        id="timeline-1"
        type={ComponentType.Timeline}
        category={ComponentCategory.Data}
        variant="compact"
        content={content}
      />,
    );

    expect(TimelineMock).toHaveBeenCalledTimes(1);
    const props = TimelineMock.mock.calls[0][0];
    expect(props.variant).toBe('compact');
    expect(props.content).toBe(content);
    expect(props.content.events[0]).toEqual({
      id: '',
      title: '',
      actions: [{ label: 'Learn more', href: '/learn' }],
    });
    expect(props.content.events[0].date).toBeUndefined();
    expect(props.content.layout).toBeUndefined();
    expect(props.content.footerCta).toEqual({ title: 'Contact us', link: '/contact' });
  });

  it('passes canonical chart content through unchanged', () => {
    const content = {
      type: 'bar',
      categories: ['Q1'],
      series: [{ id: '', name: 'Series', values: ['2.5'] }],
    };

    render(
      <ChartAdapter
        id="chart-1"
        type={ComponentType.Chart}
        category={ComponentCategory.Data}
        content={content}
      />,
    );

    expect(ChartMock).toHaveBeenCalledTimes(1);
    const props = ChartMock.mock.calls[0][0];
    expect(props.content).toBe(content);
    expect(props.content.series[0]).toEqual({ id: '', name: 'Series', values: ['2.5'] });
  });

  it('rejects string runtime content instead of parsing legacy mirrors', () => {
    expect(() =>
      render(
        <StatisticsAdapter
          id="stats-legacy"
          type={ComponentType.Statistics}
          category={ComponentCategory.Data}
          content={'{"stats":[]}' as never}
        />,
      ),
    ).toThrow('CMS runtime content must be canonical object content; string content is not accepted.');
  });

  it('rejects legacy variant aliases instead of mapping them', () => {
    expect(() =>
      render(
        <StatisticsAdapter
          id="stats-legacy-variant"
          type={ComponentType.Statistics}
          category={ComponentCategory.Data}
          variant="detailed"
          content={{ stats: [] }}
        />,
      ),
    ).toThrow('Statistics variant "detailed" is not a canonical statistics variant.');

    expect(() =>
      render(
        <DataTableAdapter
          id="table-legacy-variant"
          type={ComponentType.DataTable}
          category={ComponentCategory.Data}
          variant="expanded"
          content={{ columns: [], rows: [] }}
        />,
      ),
    ).toThrow('DataTable variant "expanded" is not a canonical data table variant.');
  });
});
