'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { sanitizeText } from '@/lib/studio/components/cms/_core/security';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CmsTable,
  CmsTableBody,
  CmsTableCell,
  CmsTableHead,
  CmsTableHeader,
  CmsTableRow,
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
  resolveTheme,
} from '../../_ui';
import { DataTableProps, TableColumn } from './data-table.types';

const TABLE_DENSITY_CLASS_MAP: Record<
  NonNullable<DataTableProps['variant']>,
  string
> = {
  default: '',
  compact: 'text-sm [&_td]:py-2 [&_th]:h-10 [&_th]:py-0',
  spacious: 'text-base [&_td]:py-4 [&_th]:h-14',
};

const DataTableComponent: React.FC<DataTableProps> = ({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}) => {
  const {
    title,
    subtitle,
    columns,
    rows,
    pagination = { enabled: false },
    sorting = { enabled: true },
    filtering = { enabled: false },
    striped = false,
    bordered = true,
    hoverable = true,
    responsive = true,
  } = content;

  const [sortKey, setSortKey] = useState<string | null>(
    sorting.defaultSort?.key || null,
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    sorting.defaultSort?.order || 'asc',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pagination.pageSize || 10);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!filtering.enabled || !searchTerm) return rows;

    return rows.filter((row) =>
      columns.some((column) => {
        const value = row[column.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      }),
    );
  }, [rows, columns, searchTerm, filtering.enabled]);

  const sortedData = useMemo(() => {
    if (!sorting.enabled || !sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return sortOrder === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortKey, sortOrder, sorting.enabled]);

  const paginatedData = useMemo(() => {
    if (!pagination.enabled) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize, pagination.enabled]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const resolvedTheme = resolveTheme(theme);

  const handleSort = (key: string) => {
    if (!sorting.enabled) return;

    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const formatCellValue = (column: TableColumn, value: unknown): string => {
    if (column.formatter) {
      return column.formatter(value);
    }
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const getSortIcon = (column: TableColumn) => {
    if (!column.sortable) return null;

    if (sortKey !== column.key) {
      return <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />;
    }

    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
    ) : (
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
    );
  };

  const tableDensityClass = TABLE_DENSITY_CLASS_MAP[variant] ?? '';
  const tableVariant = variant === 'spacious' ? 'expanded' : variant;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={tableVariant}
      className={cn('cms-data-table', className)}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('xl'))}
      data-theme={resolvedTheme}
      data-variant={variant}
    >
      <div className={cn('flex w-full flex-col', dsSpacing.gap('lg'))}>
      {(title || subtitle) && (
        <div className={cn('flex flex-col', dsSpacing.gap('sm'))}>
          {title && <h2 className={cmsHeading(2, resolvedTheme)}>{sanitizeText(title)}</h2>}
          {subtitle && (
            <p className={cmsBody('md', resolvedTheme)}>{sanitizeText(subtitle)}</p>
          )}
        </div>
      )}

      {filtering.enabled && (
        <div className="w-full">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={filtering.placeholder || 'Search...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>
      )}

      <CmsTable
        theme={resolvedTheme}
        variant={tableVariant}
        responsive={responsive}
        className={cn(
          'transition-shadow duration-200',
          bordered ? 'border border-border/40 shadow-sm hover:shadow-md' : 'border-0 bg-transparent shadow-none',
        )}
        tableClassName={cn(tableDensityClass)}
      >
        <CmsTableHeader
          sticky={responsive}
          theme={resolvedTheme}
          className="backdrop-blur-sm"
        >
          <CmsTableRow theme={resolvedTheme} className="bg-gradient-to-r from-card to-muted/40">
            {columns.map((column) => {
              const isSortable = sorting.enabled && column.sortable;
              const isActiveSort = sortKey === column.key;

              return (
                <CmsTableHead
                  key={column.key}
                  theme={resolvedTheme}
                  align={column.align}
                  className={cn(
                    'group font-semibold',
                    isSortable && 'cursor-pointer select-none transition-colors duration-200 hover:text-primary',
                    column.width && `w-[${column.width}]`,
                    isActiveSort && 'text-primary',
                  )}
                  onClick={() => isSortable && handleSort(column.key)}
                  aria-label={
                    isSortable ? `Sort by ${column.label}` : column.label
                  }
                  aria-sort={
                    isActiveSort
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className={cn('flex items-center', dsSpacing.gap('xs'))}>
                    {sanitizeText(column.label)}
                    {isSortable && (
                      <span
                        className={cn(
                          'inline-flex items-center transition-[color,transform] duration-200',
                          isActiveSort
                            ? 'text-primary scale-110'
                            : 'text-muted-foreground group-hover:text-primary',
                          dsSpacing.ml('xs'),
                        )}
                      >
                        {getSortIcon(column)}
                      </span>
                    )}
                  </div>
                </CmsTableHead>
              );
            })}
          </CmsTableRow>
        </CmsTableHeader>
        <CmsTableBody theme={resolvedTheme}>
          {paginatedData.length === 0 ? (
            <CmsTableRow theme={resolvedTheme}>
              <CmsTableCell
                theme={resolvedTheme}
                align="center"
                className={cn(dsSpacing.py('xl'), 'text-muted-foreground')}
                colSpan={columns.length}
              >
                No data available
              </CmsTableCell>
            </CmsTableRow>
          ) : (
            paginatedData.map((row, rowIndex) => (
              <CmsTableRow
                key={row.id}
                theme={resolvedTheme}
                className={cn(
                  'transition-[background-color,box-shadow] duration-200',
                  striped && rowIndex % 2 === 1 && 'bg-muted/60',
                  hoverable
                    ? 'hover:bg-muted/70 hover:shadow-sm'
                    : 'hover:bg-transparent',
                )}
              >
                {columns.map((column) => (
                  <CmsTableCell
                    key={`${row.id}-${column.key}`}
                    theme={resolvedTheme}
                    align={column.align}
                  >
                    {sanitizeText(formatCellValue(column, row[column.key]))}
                  </CmsTableCell>
                ))}
              </CmsTableRow>
            ))
          )}
        </CmsTableBody>
      </CmsTable>

      {pagination.enabled && totalPages > 1 && (
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center sm:justify-between',
            dsSpacing.gap('md'),
          )}
        >
          <div
            className={cn(
              'flex flex-wrap items-center text-sm text-muted-foreground',
              dsSpacing.gap('sm'),
            )}
          >
            <span className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
              {sortedData.length} results
            </span>
            {pagination.pageSizeOptions && (
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  aria-label="Select page size"
                  className="w-[120px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pagination.pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className={cn('flex flex-wrap items-center', dsSpacing.gap('xs'))}>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <div className={cn('flex items-center', dsSpacing.gap('xxs'))}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="min-w-[2.5rem]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </CmsSection>
  );
};

const DataTable = withPerformanceTracking(
  DataTableComponent,
  ComponentType.DataTable,
);
export default DataTable;
