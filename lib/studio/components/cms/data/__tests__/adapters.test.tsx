import React from 'react';
import { render } from '@testing-library/react';

import { StatisticsAdapter, DataTableAdapter, TimelineAdapter } from '../adapters';
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

const StatisticsMock = require('../statistics').default as jest.Mock;
const DataTableMock = require('../data-table').default as jest.Mock;
const TimelineMock = require('../timeline').default as jest.Mock;

describe('Data adapters', () => {
  beforeEach(() => {
    StatisticsMock.mockClear();
    DataTableMock.mockClear();
    TimelineMock.mockClear();
  });

  it('normalizes statistics content and maps variant', () => {
    render(
      <StatisticsAdapter
        id="stats-1"
        type={ComponentType.Statistics}
        category={ComponentCategory.Data}
        variant="detailed"
        theme="dark"
        content={{
          layout: 'row',
          stats: [{ id: '', value: '12.5', label: 'Active Users' }],
        }}
      />,
    );

    expect(StatisticsMock).toHaveBeenCalledTimes(1);
    const props = StatisticsMock.mock.calls[0][0];
    expect(props.variant).toBe('card');
    expect(props.theme).toBe('dark');
    expect(props.content.stats[0].id).toMatch(/^stat-/);
    expect(props.content.stats[0].value).toBeCloseTo(12.5);
  });

  it('maps component variant to table density options', () => {
    render(
      <DataTableAdapter
        id="table-1"
        type={ComponentType.DataTable}
        category={ComponentCategory.Data}
        variant="expanded"
        content={{
          columns: [{ key: 'name', label: 'Name' }],
          rows: [{ id: '', name: 'Alice' }],
        }}
      />,
    );

    expect(DataTableMock).toHaveBeenCalledTimes(1);
    const props = DataTableMock.mock.calls[0][0];
    expect(props.variant).toBe('spacious');
    expect(props.content.rows[0].id).toMatch(/^row-/);
    expect(props.content.pagination).toEqual({ enabled: false });
  });

  it('coerces timeline events and variant mapping', () => {
    render(
      <TimelineAdapter
        id="timeline-1"
        type={ComponentType.Timeline}
        category={ComponentCategory.Data}
        variant="compact"
        content={{
          events: [
            {
              id: '',
              title: 'Launch',
            },
          ],
        }}
      />,
    );

    expect(TimelineMock).toHaveBeenCalledTimes(1);
    const props = TimelineMock.mock.calls[0][0];
    expect(props.variant).toBe('compact');
    expect(props.content.events[0].id).toMatch(/^event-/);
    expect(props.content.events[0].title).toBe('Launch');
    expect(props.content.layout).toBe('vertical');
  });
});
