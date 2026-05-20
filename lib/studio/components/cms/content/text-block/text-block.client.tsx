'use client';

import React from 'react';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import type { TextBlockClientProps } from './text-block.types';

const TextBlockAnalyticsBridge: React.FC<TextBlockClientProps> = React.memo(
  ({ id, onInteraction }) => {
    React.useEffect(() => {
      if (!onInteraction) return;

      const element = document.getElementById(id);
      if (!element) return;

      const handleLinkClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest<HTMLAnchorElement>('a');
        if (!anchor) return;

        onInteraction('link-click', {
          href: anchor.href,
          text: anchor.textContent ?? '',
        });
      };

      element.addEventListener('click', handleLinkClick);

      return () => {
        element.removeEventListener('click', handleLinkClick);
      };
    }, [id, onInteraction]);

    return null;
  },
);

TextBlockAnalyticsBridge.displayName = 'TextBlockAnalyticsBridge';

export const TextBlockClient = withPerformanceTracking<TextBlockClientProps>(
  TextBlockAnalyticsBridge,
  ComponentType.TextBlock,
);
