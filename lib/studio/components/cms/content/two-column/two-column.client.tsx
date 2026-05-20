'use client';

import React from 'react';
import { TwoColumnProps } from './two-column.types';

export const TwoColumnClient: React.FC<TwoColumnProps> = ({ id, onInteraction }) => {
  // Track interactions with column content
  React.useEffect(() => {
    if (!onInteraction) return;

    const handleInteraction = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const column = target.closest('[data-column]');
      
      if (column) {
        const columnSide = column.getAttribute('data-column');
        onInteraction('column-interaction', { 
          column: columnSide,
          element: target.tagName.toLowerCase()
        });
      }
    };

    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handleInteraction);
      return () => element.removeEventListener('click', handleInteraction);
    }
  }, [id, onInteraction]);

  return null; // Client component only adds interactivity
};