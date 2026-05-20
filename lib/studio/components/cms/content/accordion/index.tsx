import React from 'react';
import { AccordionProps } from './accordion.types';
import { AccordionServer } from './accordion.server';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';

function AccordionBase(props: AccordionProps) {
  return <AccordionServer {...props} />;
}

export const Accordion = withPerformanceTracking(AccordionBase, ComponentType.Accordion);

export type { AccordionProps, AccordionContent, AccordionItem } from './accordion.types';