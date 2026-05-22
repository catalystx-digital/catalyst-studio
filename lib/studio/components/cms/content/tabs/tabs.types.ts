import type { ReactNode } from 'react';

import type { CMSComponentProps } from '../../_core/types';

export interface TabHighlight {
  id?: string;
  label?: string;
  text: string;
  icon?: string;
}

export interface TabMedia {
  type?: 'image';
  src: string;
  alt?: string;
}

export interface TabCta {
  label: string;
  href: string;
  variant?: 'accent' | 'secondary' | 'outline' | 'neutral';
}

export interface TabItem {
  id: string;
  label: string;
  content?: string | ReactNode;
  description?: string;
  eyebrow?: string;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
  highlights?: Array<string | TabHighlight>;
  media?: TabMedia;
  cta?: TabCta;
}

export interface TabsContent {
  heading?: string;
  subheading?: string;
  tabs: TabItem[];
  defaultTab?: string;
  defaultActiveTab?: string;
  orientation?: 'horizontal' | 'vertical';
  align?: 'left' | 'center' | 'right' | 'justified';
}

export interface TabsProps extends Omit<CMSComponentProps, 'content'> {
  content: TabsContent;
  animated?: boolean;
  onTabChange?: (tabId: string) => void;
}

export interface TabsServerProps extends TabsProps {}

export interface TabsClientProps extends TabsServerProps {
  animated?: boolean;
}
