import { CMSComponentProps } from '../../_core/types';
import { type Link } from '../../_core/value-objects';

export interface BreadcrumbItem {
  label: string;
  href: Link | string;
}

export interface BreadcrumbsContent {
  items: BreadcrumbItem[];
  separator?: '/' | '>' | '→' | '•';
  showHome?: boolean;
  homeLabel?: string;
}

export interface BreadcrumbsProps extends CMSComponentProps {
  content: BreadcrumbsContent;
}