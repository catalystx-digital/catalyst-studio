import React from 'react';

import { cmsComponentFactory } from './factory';
import { initializeCMSComponents } from './initialize';
import type {
  CMSComponentProps,
  ComponentPerformanceMetrics,
} from '../_core/types';
import { performanceMonitor } from '../_core/monitoring';

type RenderOptions = {
  onMetrics?: (metrics: ComponentPerformanceMetrics) => void;
};

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

async function renderComponent(
  componentProps: CMSComponentProps,
  options: RenderOptions,
): Promise<React.ReactNode> {
  const start = now();

  try {
    const Component = await cmsComponentFactory.loadComponent(
      componentProps.type,
    );

    const element = <Component {...componentProps} />;

    const renderTime = now() - start;
    const metrics: ComponentPerformanceMetrics = {
      componentId: componentProps.id,
      componentType: componentProps.type,
      renderTime,
      mountTime: renderTime,
      updateCount: 0,
      timestamp: Date.now(),
    };

    options.onMetrics?.(metrics);
    performanceMonitor?.trackComponentRender(componentProps.type, renderTime);

    return element;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      if (process.env.NODE_ENV === 'development') {
      console.error(
        `Failed to render CMS component "${componentProps.type}":`,
        error,
      );
      }
    }

    throw error;
  }
}

export async function renderCMSComponents(
  components: CMSComponentProps[],
  options: RenderOptions = {},
): Promise<React.ReactNode[]> {
  if (!Array.isArray(components) || components.length === 0) {
    return [];
  }

  await initializeCMSComponents();

  return Promise.all(
    components.map(async (component) => {
      const node = await renderComponent(component, options);
      return (
        <React.Fragment key={component.id}>
          {node}
        </React.Fragment>
      );
    }),
  );
}
