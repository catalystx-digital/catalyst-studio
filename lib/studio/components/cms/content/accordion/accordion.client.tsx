'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  cmsBody,
  cmsHeading,
} from '../../_ui';
import { AccordionClientProps } from './accordion.types';

const ROOT_VARIANT_CLASSES: Record<
  NonNullable<AccordionClientProps['variant']>,
  string
> = {
  default: '',
  minimal: 'border-none bg-transparent shadow-none',
  detailed: 'shadow-md shadow-black/5',
  compact: 'divide-y divide-border-default/40 rounded-lg',
  expanded: 'space-y-3 divide-y-0',
  segmented: '',
};

const TRIGGER_VARIANT_CLASSES: Record<
  NonNullable<AccordionClientProps['variant']>,
  string
> = {
  default: 'px-4 hover:bg-muted/40 transition-colors duration-200',
  minimal:
    'px-0 py-3 hover:bg-transparent data-[state=open]:bg-transparent [&>svg]:text-muted-foreground',
  detailed: 'px-6 py-4 text-base hover:bg-muted/50 transition-colors duration-200',
  compact: 'px-3 py-2 text-sm hover:bg-muted/40 transition-colors duration-200',
  expanded: 'px-5 py-4 text-base font-semibold hover:bg-muted/30 transition-colors duration-200',
  segmented: 'px-4 hover:bg-muted/40 transition-colors duration-200',
};

const CONTENT_VARIANT_CLASSES: Record<
  NonNullable<AccordionClientProps['variant']>,
  string
> = {
  default: 'px-4',
  minimal: 'px-0',
  detailed: 'px-6',
  compact: 'px-3',
  expanded: 'px-5',
  segmented: 'px-4',
};

const EMPTY_STATE_CLASSES =
  'cms-accordion-empty rounded-xl border border-dashed border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground backdrop-blur-sm';

function toValueSet(value: string | string[] | null | undefined): Set<string> {
  if (Array.isArray(value)) {
    return new Set(value.filter(Boolean));
  }
  if (typeof value === 'string' && value.length > 0) {
    return new Set([value]);
  }
  return new Set();
}

export function AccordionClient({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  animated = true,
  onItemToggle,
  onAllToggle,
}: AccordionClientProps) {
  const items = useMemo(
    () => (Array.isArray(content.items) ? content.items : []),
    [content.items],
  );

  if (items.length === 0) {
    return (
      <div className={cn(EMPTY_STATE_CLASSES, className)}>
        No accordion items available.
      </div>
    );
  }

  const allowMultiple = Boolean(content.allowMultiple);
  const defaultOpens = useMemo(() => {
    const defaults = new Set<string>();
    items.forEach((item) => {
      if (item.defaultOpen) {
        defaults.add(item.id);
      }
    });
    if (Array.isArray(content.defaultOpenItems)) {
      content.defaultOpenItems.forEach((id) => {
        if (typeof id === 'string') {
          defaults.add(id);
        }
      });
    }
    return defaults;
  }, [content.defaultOpenItems, items]);

  const [openItems, setOpenItems] = useState<Set<string>>(
    () => new Set(defaultOpens),
  );
  const openSetRef = React.useRef<Set<string>>(new Set(defaultOpens));

  useEffect(() => {
    const nextDefaults = new Set(defaultOpens);
    openSetRef.current = new Set(nextDefaults);
    setOpenItems(new Set(nextDefaults));
  }, [defaultOpens]);

  const handleValueChange = useCallback(
    (value: string | string[]) => {
      const nextSet = toValueSet(value);
      const previousSet = openSetRef.current;

      items.forEach((item) => {
        const wasOpen = previousSet.has(item.id);
        const isOpen = nextSet.has(item.id);
        if (wasOpen !== isOpen) {
          onItemToggle?.(item.id, isOpen);
        }
      });

      if (items.length > 0) {
        if (nextSet.size === items.length) {
          onAllToggle?.(true);
        } else if (nextSet.size === 0) {
          onAllToggle?.(false);
        }
      }

      const nextSetClone = new Set(nextSet);
      openSetRef.current = nextSetClone;
      setOpenItems(new Set(nextSetClone));
    },
    [items, onAllToggle, onItemToggle],
  );

  const accordionSelectionProps = allowMultiple
    ? ({
        type: 'multiple' as const,
        value: Array.from(openItems),
      })
    : ({
        type: 'single' as const,
        value: Array.from(openItems)[0] ?? undefined,
        collapsible: true as const,
      });

  const hasCustomIndicator = Boolean(content.expandIcon || content.collapseIcon);

  return (
    <Accordion
      {...accordionSelectionProps}
      onValueChange={handleValueChange}
      className={cn('w-full', ROOT_VARIANT_CLASSES[variant], className)}
      data-animated={animated ? 'true' : 'false'}
      role="region"
      aria-label="Accordion"
    >
      {items.map((item) => {
        const isOpen = openItems.has(item.id);
        return (
          <AccordionItem
            key={item.id}
            value={item.id}
            className={cn(
              'cms-accordion-item',
              variant === 'expanded' && 'rounded-xl bg-muted/60 p-1',
              isOpen && variant !== 'minimal' && 'bg-muted/30 border-l-4 border-l-primary/60 shadow-sm',
            )}
          >
            <AccordionTrigger
              className={cn(
                'cms-accordion-trigger',
                TRIGGER_VARIANT_CLASSES[variant],
                hasCustomIndicator && '[&>svg]:hidden',
              )}
            >
              <span className="flex flex-1 items-center gap-3">
                {item.icon && (
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                )}
                <span className={cn('flex-1 text-left', cmsHeading(5))}>
                  {item.title}
                </span>
              </span>
              {hasCustomIndicator && (
                <span
                  aria-hidden="true"
                  className="ml-3 inline-flex h-5 w-5 items-center justify-center text-base"
                >
                  {isOpen
                    ? content.collapseIcon ?? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      )
                    : content.expandIcon ?? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent
              className={cn(
                'cms-accordion-content space-y-3 text-left leading-relaxed',
                cmsBody('sm'),
                CONTENT_VARIANT_CLASSES[variant],
                animated
                  ? 'data-[state=open]:animate-fade-in overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out'
                  : 'transition-none data-[state=open]:animate-none data-[state=closed]:animate-none',
              )}
            >
              {item.content}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
