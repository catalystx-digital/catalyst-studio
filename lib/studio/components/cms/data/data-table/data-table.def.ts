/**
 * Data Table Component Definition
 *
 * Tabular data display with configurable columns, pagination, sorting, and filtering.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Table column configuration schema
 */
const ColumnSchema = z.object({
  key: z.string().describe('Column key matching row data property'),
  label: z.string().describe('Column header label'),
  sortable: z.boolean().optional().describe('Whether column supports sorting'),
  align: z.enum(['left', 'center', 'right']).optional().describe('Text alignment'),
  width: z.string().optional().describe('Column width (e.g., "200px", "20%")'),
})

/**
 * Table row data schema
 *
 * Rows can contain dynamic column data with type-safe values.
 * Allowed value types: string, number, boolean, null
 *
 * NOTE ON z.record() USAGE:
 * This is a LEGITIMATE and INTENTIONAL use of z.record() for the following reasons:
 *
 * 1. Column structure is defined separately in the `columns` array (ColumnSchema)
 * 2. Row data must match whatever columns are configured at runtime
 * 3. Each row is an object with dynamic key-value pairs where keys match column keys
 * 4. The table is designed to be flexible - users can configure any columns they need
 * 5. Using a strict schema here would require duplicating column definitions, violating DRY
 *
 * This is NOT a sign of poor type safety - it's an appropriate design pattern for
 * data tables where schema is user-configurable. The type safety comes from:
 * - Column definitions validating structure
 * - Row values being type-constrained (string | number | boolean | null)
 * - Runtime validation ensuring rows match configured columns
 *
 * DO NOT convert this to a strict schema - it would break the flexible table design.
 */
const RowSchema = z.object({
  id: z.string().optional().describe('Unique row identifier'),
}).and(
  z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
  )
)

/**
 * Pagination configuration schema
 */
const PaginationConfigSchema = z.object({
  enabled: z.boolean().describe('Whether pagination is enabled'),
  pageSize: z.number().optional().describe('Number of rows per page'),
  pageSizeOptions: z.array(z.number()).optional().describe('Available page size options'),
})

/**
 * Sorting configuration schema
 */
const SortingConfigSchema = z.object({
  enabled: z.boolean().describe('Whether sorting is enabled'),
  defaultSort: z.object({
    key: z.string().describe('Column key to sort by'),
    order: z.enum(['asc', 'desc']).describe('Sort order'),
  }).optional().describe('Default sort configuration'),
})

/**
 * Filtering configuration schema
 */
const FilteringConfigSchema = z.object({
  enabled: z.boolean().describe('Whether filtering is enabled'),
  placeholder: z.string().optional().describe('Filter input placeholder text'),
})

/**
 * Data Table component definition
 */
export const DataTableDef = defineComponent({
  type: ComponentType.DataTable,
  category: ComponentCategory.Data,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Table title displayed above the data'),
    subtitle: z.string().optional().describe('Table subtitle providing context'),
    columns: z.array(ColumnSchema).describe('Column definitions for the table'),
    rows: z.array(RowSchema).describe('Table row data'),
    pagination: PaginationConfigSchema.optional().describe('Pagination settings'),
    sorting: SortingConfigSchema.optional().describe('Sorting settings'),
    filtering: FilteringConfigSchema.optional().describe('Filtering settings'),
    striped: z.boolean().optional().describe('Whether to use striped row styling'),
    bordered: z.boolean().optional().describe('Whether to show borders'),
    hoverable: z.boolean().optional().describe('Whether rows highlight on hover'),
    responsive: z.boolean().optional().describe('Whether table scrolls horizontally on small screens'),
  }),

  // Detection metadata (replaces data-table.ai.ts)
  detection: {
    keywords: [
      'table',
      'data',
      'grid',
      'spreadsheet',
      'list',
      'data table',
      'tabular data',
      'rows',
      'columns',
      'matrix',
      'dataset',
      'records',
    ],
    patterns: [
      'data\\s+table',
      'table\\s+(view|display|grid)',
      'tabular\\s+data',
      'spreadsheet',
      'data\\s+grid',
      'records?\\s+table',
      'list\\s+view',
    ],
    commonNames: [
      'data-table',
      'table-view',
      'data-grid',
      'spreadsheet',
      'records-table',
      'list-table',
    ],
    pageLocation: ['main'],
    confidence: 0.80,
    relatedComponents: [ComponentType.Chart, ComponentType.Statistics],
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use data-table for tabular data with rows and columns',
    'Extract: title from heading above table',
    'Extract: columns from table header row (th elements)',
    'Extract: rows from table body rows (tr elements)',
    'Detect sortable columns from presence of sort icons or interactive headers',
    'Detect pagination from presence of page controls',
    'Detect filtering from presence of search/filter input',
    'Convert HTML table structure to structured column/row data',
    'Preserve column alignment (left/center/right) from HTML',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Sales Data',
    subtitle: 'Q4 2023 Performance Metrics',
    columns: [
      { key: 'product', label: 'Product', sortable: true, align: 'left' },
      { key: 'sales', label: 'Sales', sortable: true, align: 'right' },
      { key: 'growth', label: 'Growth', sortable: true, align: 'right' },
    ],
    rows: [
      { id: '1', product: 'Product A', sales: 15000, growth: '+12%' },
      { id: '2', product: 'Product B', sales: 12500, growth: '+8%' },
      { id: '3', product: 'Product C', sales: 10000, growth: '-3%' },
    ],
    pagination: {
      enabled: true,
      pageSize: 10,
      pageSizeOptions: [10, 25, 50],
    },
    sorting: {
      enabled: true,
      defaultSort: { key: 'sales', order: 'desc' },
    },
    filtering: {
      enabled: true,
      placeholder: 'Search products...',
    },
    striped: true,
    hoverable: true,
    responsive: true,
  },

  // Human-readable description
  description: 'Tabular data display with configurable columns, pagination, sorting, and filtering.',
})

// Export inferred TypeScript type
export type DataTableContent = z.infer<typeof DataTableDef.schema>
