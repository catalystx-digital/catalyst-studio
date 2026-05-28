import React from 'react';
import { cmsHeading } from '../../_ui';
import type { ComponentTheme } from '../../_core/types';

interface FooterLogoProps {
  logo: unknown;
  alt?: string;
  theme?: ComponentTheme;
}

function resolveMediaString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ['url', 'src', 'originalUrl', 'href']) {
    const nested = resolveMediaString(record[key]);
    if (nested) return nested;
  }

  return undefined;
}

function resolveLogoPayload(logo: unknown): { src?: string; label?: string } | null {
  if (!logo) return null;
  if (typeof logo === 'string') return { src: logo };
  if (Array.isArray(logo)) return null;

  if (typeof logo === 'object') {
    const record = logo as Record<string, unknown>;
    const srcCandidate = ['src', 'url', 'originalUrl', 'href', 'image']
      .map(key => resolveMediaString(record[key]))
      .find(Boolean);
    const labelCandidate = ['alt', 'text', 'label', 'title', 'name']
      .map(key => record[key])
      .find(v => typeof v === 'string' && v.trim()) as string | undefined;

    if (srcCandidate || labelCandidate) {
      return { src: srcCandidate, label: labelCandidate };
    }
  }

  return null;
}

export function FooterLogo({ logo, alt, theme }: FooterLogoProps) {
  const resolved = resolveLogoPayload(logo);
  if (!resolved) return null;

  const { src, label } = resolved;
  const value = (src ?? label)?.trim();
  if (!value) return null;

  const isImage = Boolean(src) && (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('data:') ||
    /\.(svg|png|jpg|jpeg|webp)$/i.test(value)
  );

  if (isImage && src) {
    // width/height prevent CLS (layout shift). CSS h-10 w-auto handles actual sizing.
    return (
      <img
        src={value}
        alt={alt || label || 'Site logo'}
        width={150}
        height={40}
        loading="lazy"
        className="h-10 w-auto max-w-full"
      />
    );
  }

  // Text-only logo - render as monogram + text for professional appearance
  const firstLetter = value.charAt(0).toUpperCase();
  const restOfName = value.length > 1 ? value : null;

  return (
    <div className="flex items-center gap-2">
      {/* Monogram/initial badge */}
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
        {firstLetter}
      </span>
      {/* Full name text */}
      {restOfName && (
        <span className={cmsHeading(4, theme)}>{restOfName}</span>
      )}
    </div>
  );
}
