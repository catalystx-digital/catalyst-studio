'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { dsSpacing } from '../../_ui';
import type { ComponentTheme } from '../../_core/types';
import { safeString } from '../../_core/safe-string';
import type { CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

interface HeroCTAProps {
  buttons?: Array<{ label: string; href: string; variant?: string; icon?: React.ReactNode }>;
  alignment?: 'left' | 'center' | 'right';
  theme?: ComponentTheme;
  onCtaClick?: (button: { label: string; href: string; variant?: string; icon?: React.ReactNode }, index: number) => void;
  className?: string;
}

const CTA_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'link'> = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
  link: 'link',
  text: 'link',
};

const ALIGNMENT_CLASSES: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

export function HeroCTA({ buttons, alignment = 'center', theme, onCtaClick, className }: HeroCTAProps) {
  // Filter out buttons without labels (defensive rendering for malformed data)
  const validButtons = buttons?.filter((button) => button.label?.trim());
  if (!validButtons?.length) return null;

  return (
    <div className={cn('flex flex-wrap', dsSpacing.gap('md'), ALIGNMENT_CLASSES[alignment], className)}>
      {validButtons.map((button, index) => {
        const variant = button.variant ? CTA_VARIANT_MAP[button.variant] ?? 'default' : 'default';
        return (
          <Button
            key={`${safeString(button.href)}-${index}`}
            asChild
            variant={variant}
            size="lg"
            onClick={() => onCtaClick?.(button, index)}
          >
            <a href={safeString(button.href)}>
              {button.icon && <span className="mr-2" aria-hidden="true">{button.icon}</span>}
              {safeString(button.label)}
            </a>
          </Button>
        );
      })}
    </div>
  );
}
