'use client'

import React, { useState } from 'react'
import { ChevronRight, ImageOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { CmsBadge, cmsBody, dsSpacing, resolveTheme, themeClass } from '../../_ui'
import { normalizeCmsImage } from '../../_utils/media-reference'
import { resolveSmartLinkHref } from '../../_utils/smart-link'
import type { CardItemProps, CardItemImage } from './card-item.types'

/**
 * Resolve image source from various input formats
 */
function resolveImageSrc(image: string | CardItemImage | undefined): { src: string; alt: string; srcSet?: string } | null {
  const normalizedImage = normalizeCmsImage(image)
  if (!normalizedImage) return null

  const srcSet = Array.isArray(normalizedImage.renditions) && normalizedImage.renditions.length > 0
    ? normalizedImage.renditions
        .filter(r => r.src && r.width)
        .map(r => `${r.src} ${r.width}w`)
        .join(', ')
    : undefined

  return {
    src: normalizedImage.src,
    alt: normalizedImage.alt || '',
    srcSet
  }
}

/**
 * Card image with error fallback
 */
function CardImage({ src, srcSet, alt, className }: { src: string; srcSet?: string; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/60 text-muted-foreground', className)} role="img" aria-label={alt}>
        <ImageOff className="h-8 w-8 opacity-50" />
      </div>
    )
  }

  // Explicit dimensions prevent layout shift (CLS). CSS handles actual sizing.
  // Using 4:3 base dimensions (600x450) for card images - actual display controlled by CSS.
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? '(max-width: 768px) 100vw, 50vw' : undefined}
      alt={alt}
      width={600}
      height={450}
      className={cn(className, 'transition-transform duration-300')}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export function CardItemClient({
  id,
  content,
  className,
  theme = 'auto',
  variant = 'default',
}: CardItemProps) {
  const { title, description, image, imageAlt, link, href, linkText, badge, actions } = content
  const resolvedTheme = resolveTheme(theme)
  const media = resolveImageSrc(image)
  const resolvedLink = resolveSmartLinkHref(link) ?? resolveSmartLinkHref(href)
  const clickable = Boolean(resolvedLink)

  const handleClick = () => {
    if (resolvedLink && typeof window !== 'undefined') {
      window.location.href = resolvedLink
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && resolvedLink) {
      event.preventDefault()
      handleClick()
    }
  }

  // Stitch design: horizontal cards with image LEFT, text RIGHT, muted background
  // Default to horizontal layout unless explicitly set to compact
  const isHorizontal = variant !== 'compact'

  return (
    <Card
      id={id}
      className={cn(
        themeClass(resolvedTheme),
        'cms-card-item flex h-full flex-col overflow-hidden shadow-sm',
        'bg-muted/30 border-0', // Light gray background, no border per Stitch design
        clickable && 'cursor-pointer hover:shadow-md transition-shadow',
        isHorizontal && 'md:flex-row',
        variant === 'compact' && 'max-w-sm',
        className
      )}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? 'button' : 'article'}
      tabIndex={clickable ? 0 : undefined}
    >
      {/* Image - comes FIRST for horizontal (image left per Stitch design) */}
      {media && (
        <div className={cn(
          'overflow-hidden',
          isHorizontal ? 'md:w-[45%] md:order-1' : 'order-first'
        )}>
          <AspectRatio ratio={isHorizontal ? 4 / 3 : 16 / 9}>
            <CardImage
              src={media.src}
              srcSet={media.srcSet}
              alt={media.alt || imageAlt || title}
              className="h-full w-full object-cover"
            />
          </AspectRatio>
        </div>
      )}

      {/* Content - comes SECOND for horizontal (text right per Stitch) */}
      <div className={cn(
        'flex flex-1 flex-col',
        isHorizontal && 'md:w-[55%] md:order-2'
      )}>
        <CardHeader className={cn('p-6 pb-4', dsSpacing.gap('sm'))}>
          {badge && (
            <CmsBadge variant="accent" className="w-fit">
              {badge}
            </CmsBadge>
          )}
          <CardTitle className="text-xl font-bold text-foreground line-clamp-2">{title}</CardTitle>
        </CardHeader>

        <CardContent className={cn('flex-1 px-6 pb-4', dsSpacing.gap('md'))}>
          {description && (
            <p className={cmsBody('md', undefined, 'line-clamp-3 text-muted-foreground')}>{description}</p>
          )}
        </CardContent>

        {/* Actions or Link */}
        {(actions && actions.length > 0) ? (
          <CardFooter className={cn('px-6 pb-6 pt-0 flex flex-wrap', dsSpacing.gap('sm'))}>
            {actions.map((action, index) => (
              <Button
                key={`${id}-action-${index}`}
                variant={action.variant === 'secondary' ? 'secondary' : action.variant === 'outline' ? 'outline' : 'default'}
                onClick={(e) => {
                  e.stopPropagation()
                  const actionHref = resolveSmartLinkHref(action.href) ?? resolveSmartLinkHref(action.url)
                  if (actionHref && typeof window !== 'undefined') {
                    window.location.href = actionHref
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </CardFooter>
        ) : resolvedLink && linkText ? (
          <CardFooter className="px-6 pb-6 pt-0">
            <a
              href={resolvedLink}
              className="inline-flex items-center gap-1 text-primary font-medium hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <span>{linkText}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </CardFooter>
        ) : null}
      </div>
    </Card>
  )
}
