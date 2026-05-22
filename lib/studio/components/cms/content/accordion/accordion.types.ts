import type { ReactNode } from 'react';

import type { CMSComponentProps } from '../../_core/types';

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionContent {
  heading?: ReactNode;
  subheading?: ReactNode;
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpenItems?: string[];
  expandIcon?: ReactNode;
  collapseIcon?: ReactNode;
}

export interface AccordionProps extends Omit<CMSComponentProps, 'content'> {
  content: AccordionContent;
  animated?: boolean;
  onItemToggle?: (itemId: string, isOpen: boolean) => void;
  onAllToggle?: (allOpen: boolean) => void;
}

export interface AccordionServerProps
  extends Omit<AccordionProps, 'onItemToggle' | 'onAllToggle'> {}

export interface AccordionClientProps extends AccordionServerProps {
  animated?: boolean;
  onItemToggle?: (itemId: string, isOpen: boolean) => void;
  onAllToggle?: (allOpen: boolean) => void;
}
