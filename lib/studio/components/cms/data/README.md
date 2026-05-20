# Data Display Components

## Overview
The data display category provides 4 components for visualizing structured datasets, key metrics, and timelines. These components help present complex information in an accessible and engaging format.

## Components

All data components ship with aligned props metadata (`*.propsmeta.ts`) and AI metadata to support authoring surfaces, import detection, and export diagnostics.

### DataTable
Sortable and filterable data table with advanced features.
- **Use Case**: Product listings, user management, reports, analytics
- **Features**: Sorting, filtering, pagination, column resizing, export
- **Import**: `@/lib/studio/components/cms/data/data-table`

### Statistics
Display component for key metrics and statistics.
- **Use Case**: Dashboards, KPI displays, performance metrics, achievements
- **Features**: Animated counters, trend indicators, comparisons
- **Import**: `@/lib/studio/components/cms/data/statistics`

### Chart
Token-aware data visualization card that renders multi-series bar charts with Shadcn/Tailwind wrappers and provides graceful placeholders for other chart types.
- **Use Case**: KPI callouts, comparisons, executive summaries
- **Features**: Legend analytics hooks, tone-aware badges, fallback summaries
- **Import**: `@/lib/studio/components/cms/data/chart`

### Timeline
Visual timeline for displaying chronological events.
- **Use Case**: Company history, project milestones, roadmaps, process steps
- **Features**: Vertical/horizontal layouts, interactive events, animation controls
- **Import**: `@/lib/studio/components/cms/data/timeline`

## Usage Example

```tsx
import { DataTable } from '@/lib/studio/components/cms/data/data-table';
import { Statistics } from '@/lib/studio/components/cms/data/statistics';
import { Timeline } from '@/lib/studio/components/cms/data/timeline';

export function DataDashboard() {
  const tableData = {
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'status', label: 'Status', filterable: true },
      { key: 'revenue', label: 'Revenue', sortable: true, type: 'currency' },
      { key: 'date', label: 'Date', sortable: true, type: 'date' }
    ],
    rows: [
      { id: 1, name: 'Project A', status: 'Active', revenue: 125000, date: '2024-01-15' },
      { id: 2, name: 'Project B', status: 'Completed', revenue: 89000, date: '2024-02-20' }
    ]
  };

  const stats = [
    {
      label: 'Total Revenue',
      value: 2500000,
      format: 'currency',
      trend: { direction: 'up', value: 12.5 },
      icon: 'dollar'
    },
    {
      label: 'Active Users',
      value: 15234,
      format: 'number',
      trend: { direction: 'up', value: 8.3 },
      icon: 'users'
    },
    {
      label: 'Conversion Rate',
      value: 3.24,
      format: 'percentage',
      trend: { direction: 'down', value: 0.5 },
      icon: 'chart'
    }
  ];

  const milestones = [
    {
      date: '2020-01',
      title: 'Company Founded',
      description: 'Started with a small team of 3',
      icon: 'flag'
    },
    {
      date: '2021-06',
      title: 'First Million Users',
      description: 'Reached significant milestone',
      icon: 'users'
    },
    {
      date: '2023-12',
      title: 'Global Expansion',
      description: 'Launched in 25 new countries',
      icon: 'globe'
    }
  ];

  return (
    <div>
      <Statistics
        items={stats}
        layout="grid"
        animate={true}
      />
      
      <DataTable
        data={tableData}
        pagination={{ pageSize: 10 }}
        searchable={true}
        exportable={['csv', 'excel']}
      />
      
      <Timeline
        events={milestones}
        orientation="vertical"
        showConnectors={true}
      />
    </div>
  );
}
```

## DataTable Features

### Column Types
- **text**: Standard text display
- **number**: Numeric with formatting
- **currency**: Currency formatting
- **date**: Date/time formatting
- **boolean**: Checkmark/cross display
- **badge**: Status badges
- **actions**: Action buttons

### Advanced Features
```tsx
<DataTable
  // Sorting
  defaultSort={{ column: 'date', direction: 'desc' }}
  multiSort={true}
  
  // Filtering
  filters={[
    { column: 'status', type: 'select', options: ['Active', 'Pending', 'Completed'] },
    { column: 'revenue', type: 'range', min: 0, max: 1000000 }
  ]}
  
  // Selection
  selectable={true}
  onSelectionChange={(selected) => console.log(selected)}
  
  // Customization
  rowClassName={(row) => row.status === 'urgent' ? 'bg-red-50' : ''}
  emptyMessage="No data available"
/>
```

## Statistics Configuration

### Display Formats
```tsx
const formats = {
  number: (value) => value.toLocaleString(),
  currency: (value) => `$${value.toLocaleString()}`,
  percentage: (value) => `${value}%`,
  custom: (value) => `${value} units`
};
```

### Animation Options
```tsx
<Statistics
  items={stats}
  animation={{
    duration: 2000,
    easing: 'easeOutCubic',
    delay: 100,
    startFrom: 0
  }}
  updateInterval={30000} // Refresh every 30 seconds
/>
```

## Timeline Variants

### Orientations
- **Vertical**: Default, scrollable
- **Horizontal**: Good for process steps
- **Alternating**: Zigzag layout
- **Compact**: Minimal spacing

### Interaction Modes
```tsx
<Timeline
  events={events}
  expandable={true}
  onEventClick={(event) => showDetails(event)}
  highlightCurrent={true}
  scrollToToday={true}
/>
```

## Performance Optimization

### Large Datasets
- Virtual scrolling for tables
- Pagination strategies
- Server-side filtering/sorting
- Lazy loading of details

### Real-time Updates
- WebSocket integration
- Optimistic updates
- Delta updates only
- Debounced refreshes

## Visualization Options
- Chart integration (Chart.js, D3)
- Sparklines in tables
- Heat maps
- Progress indicators

## Export Functionality
```tsx
const exportOptions = {
  csv: {
    filename: 'data-export.csv',
    headers: true,
    separator: ','
  },
  excel: {
    filename: 'data-export.xlsx',
    sheetName: 'Data',
    includeHeaders: true
  },
  pdf: {
    filename: 'data-export.pdf',
    orientation: 'landscape',
    pageSize: 'A4'
  }
};
```

## Accessibility
- Table headers with scope
- Keyboard navigation
- Screen reader announcements
- High contrast mode support

## Related Documentation
- [Component Catalog](../_docs/catalog-index.md)
- [Data Visualization Guide](../_docs/data-viz.md)
- [API Reference](../_docs/api-reference.md)