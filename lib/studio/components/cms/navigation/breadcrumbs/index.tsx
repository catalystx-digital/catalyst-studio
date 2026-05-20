import React from 'react';
import { BreadcrumbsProps } from './breadcrumbs.types';
import { BreadcrumbsServer } from './breadcrumbs.server';
import { BreadcrumbsClient } from './breadcrumbs.client';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';

function BreadcrumbsComponent(props: BreadcrumbsProps) {
  const containerClass = `breadcrumbs-container ${props.className || ''}`.trim();
  return (
    <div className={containerClass}>
      <BreadcrumbsServer {...props} />
      <BreadcrumbsClient {...props} />
    </div>
  );
}

export const Breadcrumbs = withPerformanceTracking(BreadcrumbsComponent, ComponentType.Breadcrumbs);
export default Breadcrumbs;