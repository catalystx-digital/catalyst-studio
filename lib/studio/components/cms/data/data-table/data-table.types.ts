import { ComponentCategory, ComponentTheme, ComponentType } from '@/lib/studio/components/cms/_core/types';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  formatter?: (value: any) => string; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface TableRow {
  id: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface DataTableContent {
  title?: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: TableRow[];
  pagination?: {
    enabled: boolean;
    pageSize?: number;
    pageSizeOptions?: number[];
  };
  sorting?: {
    enabled: boolean;
    defaultSort?: {
      key: string;
      order: 'asc' | 'desc';
    };
  };
  filtering?: {
    enabled: boolean;
    placeholder?: string;
  };
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  responsive?: boolean;
}

export interface DataTableProps {
  id: string;
  type: ComponentType.DataTable;
  category: ComponentCategory.Data;
  content: DataTableContent;
  className?: string;
  theme?: ComponentTheme;
  variant?: 'default' | 'compact' | 'spacious';
  loading?: 'eager' | 'lazy';
  aiMetadata?: {
    keywords?: string[];
    confidence?: number;
  };
}
