import React from 'react';
import { cn } from '@/lib/utils';
import { NavBarProps } from './nav-bar.types';
import { NavBarServer } from './nav-bar.server';
import { NavBarClient } from './nav-bar.client';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';

function NavBarComponent({ className, content, ...rest }: NavBarProps) {
  return (
    <header className={cn('nav-bar-container relative w-full')} data-component-type="navbar">
      <NavBarServer content={content} {...rest} className={className} />
      <NavBarClient content={content} {...rest} className={className} />
    </header>
  );
}

export const NavBar = withPerformanceTracking(NavBarComponent, ComponentType.NavBar);
export default NavBar;
