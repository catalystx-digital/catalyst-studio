import { CMSComponentProps } from '../../_core/types';
import { type MenuItem } from '@/lib/studio/components/cms/_core/value-objects';

export interface MobileMenuContent {
  menuItems: MenuItem[];
  position?: 'left' | 'right';
  animation?: 'slide' | 'fade';
}

export interface MobileMenuProps extends Omit<CMSComponentProps, 'content'> {
  content: MobileMenuContent;
}
