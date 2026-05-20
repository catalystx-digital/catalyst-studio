'use client';

import { cn } from '@/lib/utils';

export type WebsiteStatus = 'draft' | 'published' | 'pending' | 'error';

interface WebsiteStatusBadgeProps {
  status: WebsiteStatus;
  className?: string;
}

const statusConfig: Record<WebsiteStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-700/50 text-gray-300 border-gray-600',
  },
  published: {
    label: 'Published',
    className: 'bg-green-900/30 text-green-300 border-green-700/50',
  },
  pending: {
    label: 'Changes pending',
    className: 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50',
  },
  error: {
    label: 'Error',
    className: 'bg-red-900/30 text-red-300 border-red-700/50',
  },
};

export function WebsiteStatusBadge({ status, className }: WebsiteStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft;

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Determine website status based on website data
 */
export function getWebsiteStatus(website: {
  publishedAt?: string | null;
  updatedAt?: string;
  lastDeploymentStatus?: string | null;
}): WebsiteStatus {
  // Check for deployment error
  if (website.lastDeploymentStatus === 'failed') {
    return 'error';
  }

  // Check if never published
  if (!website.publishedAt) {
    return 'draft';
  }

  // Check if has unpublished changes
  const publishedDate = new Date(website.publishedAt).getTime();
  const updatedDate = new Date(website.updatedAt || 0).getTime();

  if (updatedDate > publishedDate) {
    return 'pending';
  }

  return 'published';
}
