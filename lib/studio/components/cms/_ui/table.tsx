"use client";

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { themeClass } from './classnames';

/**
 * CmsTable wrappers - Thin wrappers around shadcn Table components
 * Only add: theme class, responsive container, alignment props
 * All styling comes from shadcn
 */

type ThemeableProps = { theme?: ComponentTheme };

interface CmsTableContextValue { theme?: ComponentTheme }
const CmsTableContext = React.createContext<CmsTableContextValue>({});
const useCmsTableContext = () => React.useContext(CmsTableContext);

export interface CmsTableProps extends React.ComponentPropsWithoutRef<typeof Table>, ThemeableProps {
  responsive?: boolean;
  /** Optional variant styling - passed through for data attributes */
  variant?: string;
  /** Additional class name for the inner table element */
  tableClassName?: string;
}

export const CmsTable = React.forwardRef<React.ElementRef<typeof Table>, CmsTableProps>(
  ({ className, theme, variant: _variant, responsive = true, tableClassName, children, ...props }, ref) => (
    <CmsTableContext.Provider value={{ theme }}>
      <div className={cn(responsive && 'w-full overflow-x-auto', themeClass(theme), className)}>
        <Table ref={ref} className={tableClassName} {...props}>
          {children}
        </Table>
      </div>
    </CmsTableContext.Provider>
  ),
);
CmsTable.displayName = 'CmsTable';

export interface CmsTableHeaderProps extends React.ComponentPropsWithoutRef<typeof TableHeader>, ThemeableProps {
  sticky?: boolean;
}

export const CmsTableHeader = React.forwardRef<React.ElementRef<typeof TableHeader>, CmsTableHeaderProps>(
  ({ className, theme, sticky, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return (
      <TableHeader
        ref={ref}
        className={cn(sticky && 'sticky top-0 z-20', themeClass(theme ?? ctxTheme), className)}
        {...props}
      />
    );
  },
);
CmsTableHeader.displayName = 'CmsTableHeader';

export interface CmsTableBodyProps extends React.ComponentPropsWithoutRef<typeof TableBody>, ThemeableProps {}

export const CmsTableBody = React.forwardRef<React.ElementRef<typeof TableBody>, CmsTableBodyProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return <TableBody ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsTableBody.displayName = 'CmsTableBody';

export interface CmsTableFooterProps extends React.ComponentPropsWithoutRef<typeof TableFooter>, ThemeableProps {}

export const CmsTableFooter = React.forwardRef<React.ElementRef<typeof TableFooter>, CmsTableFooterProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return <TableFooter ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsTableFooter.displayName = 'CmsTableFooter';

export interface CmsTableRowProps extends React.ComponentPropsWithoutRef<typeof TableRow>, ThemeableProps {
  selected?: boolean;
}

export const CmsTableRow = React.forwardRef<React.ElementRef<typeof TableRow>, CmsTableRowProps>(
  ({ className, theme, selected, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return (
      <TableRow
        ref={ref}
        className={cn(selected && 'bg-muted', themeClass(theme ?? ctxTheme), className)}
        data-selected={selected || undefined}
        {...props}
      />
    );
  },
);
CmsTableRow.displayName = 'CmsTableRow';

export interface CmsTableHeadProps extends React.ComponentPropsWithoutRef<typeof TableHead>, ThemeableProps {
  align?: 'left' | 'center' | 'right';
}

export const CmsTableHead = React.forwardRef<React.ElementRef<typeof TableHead>, CmsTableHeadProps>(
  ({ className, theme, align, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return (
      <TableHead
        ref={ref}
        className={cn(
          align === 'center' && 'text-center',
          align === 'right' && 'text-right',
          themeClass(theme ?? ctxTheme),
          className,
        )}
        {...props}
      />
    );
  },
);
CmsTableHead.displayName = 'CmsTableHead';

export interface CmsTableCellProps extends React.ComponentPropsWithoutRef<typeof TableCell>, ThemeableProps {
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export const CmsTableCell = React.forwardRef<React.ElementRef<typeof TableCell>, CmsTableCellProps>(
  ({ className, theme, align, numeric, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return (
      <TableCell
        ref={ref}
        className={cn(
          align === 'center' && 'text-center',
          (align === 'right' || numeric) && 'text-right',
          themeClass(theme ?? ctxTheme),
          className,
        )}
        {...props}
      />
    );
  },
);
CmsTableCell.displayName = 'CmsTableCell';

export interface CmsTableCaptionProps extends React.ComponentPropsWithoutRef<typeof TableCaption>, ThemeableProps {}

export const CmsTableCaption = React.forwardRef<React.ElementRef<typeof TableCaption>, CmsTableCaptionProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsTableContext();
    return <TableCaption ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsTableCaption.displayName = 'CmsTableCaption';

export type CmsTableContainerRef = React.ElementRef<typeof Table>;
