'use client';

import React from 'react';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import type { HtmlBlockClientProps } from './html-block.types';

const HtmlBlockAnalyticsBridge: React.FC<HtmlBlockClientProps> = React.memo(
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

HtmlBlockAnalyticsBridge.displayName = 'HtmlBlockAnalyticsBridge';

export const HtmlBlockClient = withPerformanceTracking<HtmlBlockClientProps>(
  HtmlBlockAnalyticsBridge,
  ComponentType.HtmlBlock,
);
