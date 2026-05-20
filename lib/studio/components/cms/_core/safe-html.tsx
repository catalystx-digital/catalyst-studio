'use client'

import React from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { cn } from '@/lib/utils'

/**
 * SafeHtml Component
 *
 * Renders sanitized HTML content safely without requiring dangerouslySetInnerHTML
 * in consuming code. Uses DOMPurify internally for XSS protection.
 *
 * Story 10.10: Contact & Forms Components
 *
 * @example
 * ```tsx
 * <SafeHtml
 *   html="<p>User generated <strong>content</strong></p>"
 *   className="prose"
 *   tag="div"
 * />
 * ```
 */

export interface SafeHtmlProps {
  /** HTML string to sanitize and render */
  html: string
  /** Optional CSS classes for the container */
  className?: string
  /** Container element type (default: 'div') */
  tag?: 'div' | 'span' | 'p' | 'article' | 'section'
  /** Additional props passed to the container element */
  [key: string]: any
}

export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  className,
  tag = 'div',
  ...restProps
}) => {
  // Sanitize all HTML content
  const content = React.useMemo(() => {
    if (!html || typeof html !== 'string') return ''

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
        'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    })
  }, [html, tag])

  // Create container element
  const Container = tag

  return (
    <Container
      className={cn(className)}
      dangerouslySetInnerHTML={{ __html: content }}
      {...restProps}
    />
  )
}

export default SafeHtml
