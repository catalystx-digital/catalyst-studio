import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../../_ui';
import { sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import { HtmlBlockProps } from './html-block.types';

export const HtmlBlockServer: React.FC<HtmlBlockProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}) => {
  const { title, bodyHtml } = content;

  const sanitizedBody = DOMPurify.sanitize(bodyHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'ul', 'ol', 'li',
      'a', 'strong', 'em', 'br', 'span',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'figure', 'figcaption',
      'div', 'section', 'article',
      'hr', 'dl', 'dt', 'dd',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'width', 'height', 'title'],
  });

  const titleText = title ? sanitizeText(title) : null;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-html-block', className)}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('xl'))}
      style={style}
      data-analytics-id={analyticsId}
      data-component-type="html-block"
      data-variant={variant}
    >
      <Card className={cn(CARD_TONES.default, themeClass(theme), 'w-full')}>
        {titleText && (
          <CardHeader
            className={cn(
              'flex flex-col gap-2 p-[var(--component-padding)]',
              themeClass(theme),
              dsSpacing.gap('sm'),
              'pb-0',
            )}
          >
            <h1
              className={cmsHeading(1, theme)}
              data-testid="cms-html-block-title"
            >
              {titleText}
            </h1>
          </CardHeader>
        )}

        <CardContent
          className={cn('p-[var(--component-padding)]', themeClass(theme), titleText && 'pt-0')}
        >
          <SafeHtml html={sanitizedBody} className={cn(
              'cms-html-block-body prose prose-neutral dark:prose-invert max-w-none',
              dsSpacing.spaceY('md'),
              cmsBody('md', theme, cn(
                'max-w-none leading-relaxed',
                '[&_strong]:text-foreground',
                '[&_em]:text-muted-foreground',
                '[&_a]:text-primary [&_a]:underline [&_a]:transition-colors [&_a]:duration-200',
                '[&_a:hover]:text-primary/80 [&_a:hover]:underline-offset-4',
                '[&_ul]:list-disc [&_ol]:list-decimal [&_ul,_ol]:pl-5',
                '[&_li]:mb-2 [&_li:last-child]:mb-0',
                '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/30 [&_blockquote]:rounded-r-lg [&_blockquote]:shadow-sm [&_blockquote]:pl-4 [&_blockquote]:italic',
                '[&_img]:rounded-lg [&_img]:shadow-md [&_img]:max-w-full [&_img]:h-auto',
                '[&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold',
                '[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-medium',
                '[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-lg [&_h4]:font-medium',
                '[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto',
                '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
                '[&_table]:w-full [&_table]:border-collapse',
                '[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2 [&_th]:text-left',
                '[&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2',
              )),
            )} />
        </CardContent>
      </Card>
    </CmsSection>
  );
};
