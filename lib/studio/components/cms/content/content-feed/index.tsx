import React from 'react';

import { withPerformanceTracking } from '@/lib/studio/components/cms/_core/monitoring';
import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types';
import type { ContentFeedProps } from './content-feed.types';
import { ContentFeedServer } from './content-feed.server';

function ContentFeedBase(props: ContentFeedProps) {
  return <ContentFeedServer {...props} />;
}

export const ContentFeed = withPerformanceTracking(ContentFeedBase, ComponentType.ContentFeed);

export type { ContentFeedProps, ContentFeedContent, ContentFeedItem } from './content-feed.types';
