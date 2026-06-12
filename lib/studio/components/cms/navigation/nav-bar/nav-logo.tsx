'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { validateImageUrl } from '../../_utils/url-validation';
import type { NavBarProps } from './nav-bar.types';

type LogoConfig = NonNullable<NavBarProps['content']['logo']>;

interface NavLogoProps {
  logo: LogoConfig | undefined;
  onInteraction?: (event: string, payload: Record<string, unknown>) => void;
}

const isRemoteAsset = (src: string) => /^(https?:|data:|blob:)/i.test(src);

const isLikelyDarkLogoAsset = (logo: { src?: string; originalUrl?: unknown }) => {
  const haystack = [
    typeof logo.src === 'string' ? logo.src : '',
    typeof logo.originalUrl === 'string' ? logo.originalUrl : '',
  ].join(' ').toLowerCase();
  return /(?:^|[/?_.-])(?:black|dark|midnight|ink)(?:[/?_.-]|$)/.test(haystack);
};

const isDarkRgb = (value: string) => {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return false;
  const [, r, g, b] = match.map(Number);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.35;
};

const normalizeStaticSrc = (src: string) => {
  if (!src) return '';
  if (src.startsWith('/')) return src;
  if (src.startsWith('./')) return src.slice(1);
  return `/${src}`;
};

const resolveLogoHref = (href: LogoConfig['href']) => {
  if (typeof href !== 'string') {
    return undefined;
  }
  const trimmed = href.trim();
  return trimmed || undefined;
};

export function NavLogo({ logo, onInteraction }: NavLogoProps) {
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [invertDarkLogo, setInvertDarkLogo] = useState(false);
  const normalizedLogo = useMemo(() => {
    if (!logo) return null;

    const rawSrc =
      typeof logo.src === 'string'
        ? logo.src
        : typeof (logo as { src?: { url?: string; src?: string; originalUrl?: string } })?.src?.url === 'string'
          ? (logo as { src?: { url?: string; src?: string; originalUrl?: string } }).src?.url
          : typeof (logo as { src?: { url?: string; src?: string; originalUrl?: string } })?.src?.src === 'string'
            ? (logo as { src?: { url?: string; src?: string; originalUrl?: string } }).src?.src
            : typeof (logo as { src?: { url?: string; src?: string; originalUrl?: string } })?.src?.originalUrl === 'string'
              ? (logo as { src?: { url?: string; src?: string; originalUrl?: string } }).src?.originalUrl
              : undefined;
    const sanitizedSrc = rawSrc ? validateImageUrl(rawSrc) : undefined;

    const normalizedRenditions = Array.isArray(logo.renditions)
      ? logo.renditions
          .map(rendition => {
            if (!rendition || typeof rendition !== 'object') return null;
            const candidateSrc =
              typeof rendition.src === 'string' ? validateImageUrl(rendition.src) : undefined;
            if (!candidateSrc) return null;
            return {
              src: candidateSrc,
              width: typeof rendition.width === 'number' ? rendition.width : null,
              height: typeof rendition.height === 'number' ? rendition.height : null,
            };
          })
          .filter((entry): entry is { src: string; width: number | null; height: number | null } =>
            Boolean(entry),
          )
          .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
      : undefined;

    const fallbackSrc =
      sanitizedSrc ||
      (normalizedRenditions && normalizedRenditions.length > 0
        ? normalizedRenditions[normalizedRenditions.length - 1]?.src
        : undefined);

    const srcSet =
      normalizedRenditions && normalizedRenditions.length > 0
        ? normalizedRenditions
            .filter(rendition => typeof rendition.width === 'number' && rendition.width > 0)
            .map(rendition => `${rendition.src} ${rendition.width}w`)
            .join(', ')
        : undefined;

    return {
      ...logo,
      src: fallbackSrc,
      srcSet,
      sizes: srcSet ? '(max-width: 768px) 40vw, 200px' : undefined,
    };
  }, [logo]);

  const label = (normalizedLogo?.alt || normalizedLogo?.text || 'Logo').trim();
  const logoSrc = normalizedLogo?.src ?? '';
  const hasImage = logoSrc.length > 0;
  const isRemote = hasImage ? isRemoteAsset(logoSrc) : false;
  const resolvedSrc = hasImage
    ? isRemote
      ? logoSrc
      : normalizeStaticSrc(logoSrc)
    : '';
  const shouldMeasureContrast = hasImage && isLikelyDarkLogoAsset({
    src: resolvedSrc,
    originalUrl: normalizedLogo?.originalUrl,
  });

  useEffect(() => {
    if (!shouldMeasureContrast) {
      setInvertDarkLogo(false);
      return;
    }

    const image = logoImageRef.current;
    const surface = image?.closest('nav, header, [data-component-type="navbar"]');
    const backgroundColor = surface ? getComputedStyle(surface).backgroundColor : '';
    setInvertDarkLogo(isDarkRgb(backgroundColor));
  }, [shouldMeasureContrast, resolvedSrc]);

  if (!normalizedLogo) return null;

  let media: React.ReactNode = null;

  if (hasImage && resolvedSrc) {
    const width = normalizedLogo.width || 150;
    const height = normalizedLogo.height || 40;
    const logoStyle: React.CSSProperties = {
      width,
      height,
      maxWidth: 'min(12rem, 40vw)',
      objectFit: 'contain',
      ...(invertDarkLogo ? { filter: 'invert(1) brightness(1.1)' } : {}),
    };
    if (isRemote) {
      media = (
        <img
          ref={logoImageRef}
          src={resolvedSrc}
          srcSet={normalizedLogo.srcSet}
          sizes={normalizedLogo.sizes}
          alt={label}
          width={width}
          height={height}
          className="block shrink-0"
          style={logoStyle}
          loading="eager"
          data-original-url={normalizedLogo.originalUrl}
        />
      );
    } else {
      media = (
        <Image
          ref={logoImageRef}
          src={resolvedSrc}
          alt={label}
          width={width}
          height={height}
          priority
          sizes={normalizedLogo.sizes}
          data-original-url={normalizedLogo.originalUrl}
        />
      );
    }
  } else if (label) {
    // Extract first letter for monogram-style logo
    const firstLetter = label.charAt(0).toUpperCase();
    const restOfName = label.length > 1 ? label : null;

    media = (
      <div className="flex items-center gap-2">
        {/* Monogram/initial badge */}
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
          {firstLetter}
        </span>
        {/* Full name text */}
        {restOfName && (
          <span className="text-xl font-semibold tracking-tight">{restOfName}</span>
        )}
      </div>
    );
  }

  if (!media) return null;

  const href = resolveLogoHref(normalizedLogo.href);

  if (!href) {
    return (
      <div className="flex items-center" aria-label={label}>
        {media}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center"
      aria-label={label}
      onClick={() => onInteraction?.('logo_click', { href, hasImage })}
    >
      {media}
    </Link>
  );
}
