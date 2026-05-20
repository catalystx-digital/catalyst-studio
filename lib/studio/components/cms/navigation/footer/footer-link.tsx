import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { cmsBody, focusRing } from '../../_ui';
import type { ComponentTheme } from '../../_core/types';

export interface FooterLinkProps {
  href: unknown;
  label?: string;
  external?: boolean;
  theme?: ComponentTheme;
  className?: string;
}

export function resolveLinkHref(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const candidate = record.originalUrl ?? record.url ?? record.href;
    if (typeof candidate === 'string') {
      return candidate.trim() || undefined;
    }
  }

  return undefined;
}

function isExternalLink(href: string, explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  return /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

export function FooterLink({ href: rawHref, label, external, theme, className }: FooterLinkProps) {
  const href = resolveLinkHref(rawHref);
  if (!href || !label) return null;

  const linkClasses = cn(
    cmsBody('sm', theme, 'text-muted-foreground'),
    'hover:text-foreground transition-colors rounded-sm',
    focusRing,
    className,
  );

  const isExternal = isExternalLink(href, external);

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClasses}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={linkClasses}>
      {label}
    </Link>
  );
}
