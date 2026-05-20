'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useWebsiteContext } from '@/lib/context/website-context';

interface BreadcrumbItem {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/studio/site-builder': 'Pages',
  '/studio/content-types': 'Page Templates',
  '/studio/deployment': 'Publish',
  '/studio/design-system': 'Colors & Styles',
  '/studio/preview': 'Preview',
  '/studio/settings': 'Settings',
  '/studio/team': 'Team',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const websiteId = searchParams?.get('websiteId') ?? null;

  let websiteContext: ReturnType<typeof useWebsiteContext> | null = null;
  try {
    websiteContext = useWebsiteContext();
  } catch {
    // Context not available
  }

  const websiteName = websiteContext?.website?.name ?? 'Website';

  // Build breadcrumb trail
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', href: '/dashboard' },
  ];

  // Add website name if we're in a website context
  if (websiteId && pathname?.startsWith('/studio')) {
    breadcrumbs.push({
      label: websiteName,
      href: `/studio/site-builder?websiteId=${websiteId}`,
    });
  }

  // Add current page
  const currentLabel = pathname ? ROUTE_LABELS[pathname] : null;
  if (currentLabel && currentLabel !== 'Dashboard' && pathname) {
    // Don't add if it's the same as website link (Pages)
    if (!(pathname === '/studio/site-builder' && websiteId)) {
      breadcrumbs.push({
        label: currentLabel,
        href: websiteId ? `${pathname}?websiteId=${websiteId}` : pathname,
      });
    }
  }

  // Don't render if only dashboard
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center">
          {index > 0 && <ChevronRight className="mx-2 h-4 w-4" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
