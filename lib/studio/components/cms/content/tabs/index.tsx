import React from 'react';
import { TabsProps } from './tabs.types';
import { TabsServer } from './tabs.server';
import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';

function TabsBase(props: TabsProps) {
  return <TabsServer {...props} />;
}

export const Tabs = withPerformanceTracking(TabsBase, ComponentType.Tabs);

export type { TabsProps, TabsContent, TabItem } from './tabs.types';