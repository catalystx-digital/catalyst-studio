import React from 'react';
import { MobileMenuProps } from './mobile-menu.types';
import { MobileMenuClient } from './mobile-menu.client';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';

function MobileMenuComponent(props: MobileMenuProps) {
  return <MobileMenuClient {...props} />;
}

export const MobileMenu = withPerformanceTracking(MobileMenuComponent, ComponentType.MobileMenu);
export default MobileMenu;