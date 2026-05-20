"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS = Icons as unknown as Record<string, LucideIcon>;
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

type IconElementProps = {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function normalizeIconName(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>();
  const pascal = toPascalCase(trimmed);
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  if (pascal) {
    candidates.add(pascal);
    candidates.add(`${pascal}Icon`);
  }

  candidates.add(capitalized);
  candidates.add(trimmed);

  if (trimmed.endsWith('Icon')) {
    candidates.add(trimmed.replace(/Icon$/, ''));
  }

  return Array.from(candidates);
}

interface ResolveCmsIconOptions {
  className?: string;
  fallback?: unknown;
}

function createTextNode(value: string, className?: string): React.ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-center leading-none',
        className,
      )}
    >
      {value}
    </span>
  );
}

export function resolveCmsIcon(
  icon: unknown,
  options: ResolveCmsIconOptions = {},
): React.ReactNode | undefined {
  const { className, fallback } = options;

  if (!icon) {
    return fallback !== undefined
      ? resolveCmsIcon(fallback, { className })
      : undefined;
  }

  if (React.isValidElement(icon)) {
    const element = icon as React.ReactElement<IconElementProps>;
    return React.cloneElement(element, {
      className: cn(className, element.props.className),
      'aria-hidden': true,
    });
  }

  if (typeof icon === 'function') {
    const IconComponent = icon as LucideIcon;
    return <IconComponent className={className} aria-hidden="true" />;
  }

  if (typeof icon === 'string') {
    const trimmed = icon.trim();
    if (!trimmed) {
      return fallback !== undefined
        ? resolveCmsIcon(fallback, { className })
        : undefined;
    }

    const iconNames = normalizeIconName(trimmed);
    for (const candidate of iconNames) {
      const IconComponent = ICONS[candidate];
      if (IconComponent) {
        return <IconComponent className={className} aria-hidden="true" />;
      }
    }

    if (EMOJI_REGEX.test(trimmed) || Array.from(trimmed).length <= 2) {
      return createTextNode(trimmed, className);
    }

    if (fallback !== undefined) {
      return resolveCmsIcon(fallback, { className });
    }

    return createTextNode(trimmed.slice(0, 1).toUpperCase(), className);
  }

  if (fallback !== undefined) {
    return resolveCmsIcon(fallback, { className });
  }

  return undefined;
}
