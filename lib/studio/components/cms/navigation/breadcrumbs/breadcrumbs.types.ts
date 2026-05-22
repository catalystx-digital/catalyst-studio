import { CMSComponentProps } from '../../_core/types';
import { type Link, type SmartLink } from '../../_core/value-objects';

export interface BreadcrumbItem {
  label: string;
  href?: Link['href'] | SmartLink | string;
}

export interface BreadcrumbsContent {
  items: BreadcrumbItem[];
  separator?: '/' | '>' | '→' | '•';
  showHome?: boolean;
  homeLabel?: string;
}

export interface BreadcrumbsProps extends Omit<CMSComponentProps, 'content'> {
  content: BreadcrumbsContent;
}
