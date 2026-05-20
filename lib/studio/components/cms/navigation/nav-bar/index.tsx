import React from 'react';
import { cn } from '@/lib/utils';
import { NavBarProps } from './nav-bar.types';
import { NavBarServer } from './nav-bar.server';
import { NavBarClient } from './nav-bar.client';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';

function NavBarComponent({ className, content, ...rest }: NavBarProps) {
  // Default to sticky + transparent for modern header behavior
  const sticky = content.sticky !== false;
  const transparent = content.transparent !== false;

  return (
    <header className={cn(
      'nav-bar-container w-full',
      // When sticky+transparent, position absolute to overlay the hero
      sticky && transparent ? 'absolute top-0 left-0 right-0 z-50' : 'relative'
    )}>
      <NavBarServer content={content} {...rest} className={className} />
      <NavBarClient content={content} {...rest} className={className} />
    </header>
  );
}

export const NavBar = withPerformanceTracking(NavBarComponent, ComponentType.NavBar);
export default NavBar;
