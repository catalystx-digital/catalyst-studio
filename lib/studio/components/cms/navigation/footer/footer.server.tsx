import React from 'react';
import { cn } from '@/lib/utils';
import { cmsBody, cmsHeading, dsSpacing, resolveTheme, themeClass } from '../../_ui';
import { FooterClient } from './footer.client';
import { FooterLink, resolveLinkHref } from './footer-link';
import { FooterLogo } from './footer-logo';
import { sanitizeText } from '../../_core/security';
import type { FooterProps } from './footer.types';

// Grid columns based on column count
const COLUMN_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
};

export function FooterServer({ content, className, style, theme, onInteraction }: FooterProps) {
  const columns = Array.isArray(content.columns) ? content.columns : [];
  const legalLinks = Array.isArray(content.legalLinks) ? content.legalLinks : [];
  const currentYear = new Date().getFullYear();
  const hasCustomBackground = typeof content.backgroundColor === 'string' && content.backgroundColor.trim().length > 0;
  const resolvedTheme = hasCustomBackground ? 'dark' : resolveTheme(theme);
  const footerStyle: React.CSSProperties = {
    ...(hasCustomBackground ? { backgroundColor: content.backgroundColor } : {}),
    ...(typeof content.textColor === 'string' && content.textColor.trim() ? { color: content.textColor } : {}),
    ...style,
  };

  const hasInteractiveSection =
    (Array.isArray(content.socialLinks) && content.socialLinks.length > 0) ||
    Boolean(content.newsletter);

  // Organization name for copyright and schema
  const orgName = sanitizeText(
    content.logoAlt ||
    content.siteName ||
    (typeof content.logo === 'object' && content.logo
      ? ((content.logo as Record<string, unknown>).text as string) ||
        ((content.logo as Record<string, unknown>).alt as string)
      : undefined) ||
    'Organization Name',
  );

  // Schema.org markup
  const socialUrls = Array.isArray(content.socialLinks)
    ? content.socialLinks.map(l => resolveLinkHref(l?.url)).filter(Boolean)
    : [];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: orgName,
    url: '/',
    ...(typeof content.logo === 'string' ? { logo: content.logo } : {}),
    ...(socialUrls.length > 0 ? { sameAs: socialUrls } : {}),
  };

  const gridClass = COLUMN_GRID[columns.length] ?? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <footer
      className={cn('cms-footer', themeClass(resolvedTheme), hasCustomBackground ? 'text-white' : 'bg-muted/50', className)}
      style={footerStyle}
      role="contentinfo"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        suppressHydrationWarning
      />

      <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

      <div className={cn('container mx-auto px-4 sm:px-6 lg:px-8', dsSpacing.py('lg'))}>
        <div className={cn('flex flex-col', dsSpacing.gap('lg'))}>
          {/* Branding */}
          {(content.logo || content.description) && (
            <div className={cn('flex flex-col text-center md:text-left', dsSpacing.gap('sm'))}>
              <FooterLogo logo={content.logo} alt={content.logoAlt} theme={resolvedTheme} />
              {content.description && (
                <p className={cmsBody('sm', resolvedTheme, 'max-w-2xl')}>{content.description}</p>
              )}
            </div>
          )}

          {/* Link columns */}
          {columns.length > 0 && (
            <div className={cn('grid', gridClass, dsSpacing.gap('xl'))}>
              {columns.map((column, i) => (
                <div key={`col-${i}`} className={cn('flex flex-col', dsSpacing.gap('sm'))}>
                  {column.title && (
                    <h3 className={cn('text-foreground font-semibold text-sm uppercase tracking-wider')}>
                      {column.title}
                    </h3>
                  )}
                  {Array.isArray(column.links) && column.links.length > 0 && (
                    <ul className={cn('flex flex-col', dsSpacing.gap('xs'))}>
                      {column.links.map((link, j) => (
                        <li key={`link-${i}-${j}`}>
                          <FooterLink href={link?.href} label={link?.label} theme={resolvedTheme} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Interactive section */}
          {hasInteractiveSection && (
            <FooterClient content={content} onInteraction={onInteraction} theme={resolvedTheme} />
          )}

          {/* Legal/copyright */}
          <div className="border-t border-border/30 pt-6 mt-6">
            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
              <p className={cmsBody('sm', resolvedTheme, 'text-muted-foreground')}>
                {content.copyright || `© ${currentYear} ${orgName}. All rights reserved.`}
              </p>

              {legalLinks.length > 0 && (
                <nav aria-label="Legal links" className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {legalLinks.map((link, i) => (
                    <FooterLink
                      key={`legal-${i}`}
                      href={link?.href}
                      label={link?.label}
                      theme={resolvedTheme}
                      className="text-xs"
                    />
                  ))}
                </nav>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
