import { type MenuItem, type MenuItemGroup, type CTAButton } from '@/lib/studio/components/cms/_core/value-objects';

const VALID_ALIGNMENTS = new Set(['start', 'center', 'end']);

// Input types for unsafe data transformation
type UnknownRecord = Record<string, unknown>;

interface PotentialWrapper {
  content?: unknown;
}

interface PotentialLink {
  href?: unknown;
  url?: unknown;
  originalUrl?: unknown;
}

function parseOffset(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseWidth(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function parseAlign(value: unknown): 'start' | 'center' | 'end' | undefined {
  if (typeof value === 'string' && VALID_ALIGNMENTS.has(value)) {
    return value as 'start' | 'center' | 'end';
  }
  return undefined;
}

export function resolveHref(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (raw && typeof raw === 'object') {
    const potentialLink = raw as PotentialLink;
    const candidate = potentialLink.href ?? potentialLink.url ?? potentialLink.originalUrl;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }

  return undefined;
}

function normalizeMenuGroups(input: unknown): MenuItemGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      // Unwrap potential content wrapper
      const wrapper = entry && typeof entry === 'object' && 'content' in entry
        ? (entry as PotentialWrapper)
        : null;
      const source = wrapper?.content ?? entry;

      if (!source || typeof source !== 'object') {
        return null;
      }

      const sourceRecord = source as UnknownRecord;
      const entryRecord = entry as UnknownRecord;

      const titleRaw = sourceRecord.title ?? sourceRecord.heading;
      const descriptionRaw = sourceRecord.description ?? sourceRecord.subheading;
      const title =
        typeof titleRaw === 'string' && titleRaw.trim().length > 0
          ? titleRaw.trim()
          : undefined;
      const description =
        typeof descriptionRaw === 'string' && descriptionRaw.trim().length > 0
          ? descriptionRaw.trim()
          : undefined;

      const itemsSource =
        sourceRecord.items ??
        sourceRecord.links ??
        sourceRecord.children ??
        entryRecord.items;
      const items = normalizeMenuItems(itemsSource);

      if (items.length === 0) {
        return null;
      }

      const result: MenuItemGroup = {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        items,
      };

      return result;
    })
    .filter((group): group is MenuItemGroup => group !== null);
}

/**
 * Normalizes raw menu item data into standardized MenuItem[] format.
 *
 * IMPORTANT: Items require BOTH label AND href to be valid.
 * When LLM extraction fails to provide valid hrefs, items are filtered out.
 * The caller should handle empty arrays by providing fallback navigation.
 */
export function normalizeMenuItems(input: unknown): MenuItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(entry => {
      // Unwrap potential content wrapper
      const wrapper = entry && typeof entry === 'object' && 'content' in entry
        ? (entry as PotentialWrapper)
        : null;
      const source = wrapper?.content ?? entry;

      if (!source || typeof source !== 'object') {
        return null;
      }

      const sourceRecord = source as UnknownRecord;
      const entryRecord = entry as UnknownRecord;

      const labelRaw = sourceRecord.label ?? sourceRecord.text ?? '';
      const label = typeof labelRaw === 'string' ? labelRaw.trim() : '';

      // Try multiple href sources - LLM sometimes puts href in different fields
      let href = resolveHref(sourceRecord.href);
      if (!href) {
        href = resolveHref(sourceRecord.url);
      }
      if (!href) {
        href = resolveHref(sourceRecord.link);
      }
      // Generate href from label if we have label but no href
      if (!href && label) {
        href = buildHrefFromLabel(label);
      }

      if (!label || !href) {
        return null;
      }

      const description =
        typeof sourceRecord.description === 'string'
          ? sourceRecord.description.trim()
          : undefined;

      const icon = typeof sourceRecord.icon === 'string' ? sourceRecord.icon : undefined;
      const external = typeof sourceRecord.external === 'boolean'
        ? sourceRecord.external
        : typeof sourceRecord.target === 'string' && sourceRecord.target.toLowerCase() === '_blank';

      const childrenSource = sourceRecord.children ?? entryRecord.children;
      const children = normalizeMenuItems(childrenSource);
      const groupsSource =
        sourceRecord.groups ??
        sourceRecord.sections ??
        sourceRecord.collections;
      const groups = normalizeMenuGroups(groupsSource);
      const panelOffset = parseOffset(sourceRecord.panelOffset);
      const panelWidth = parseWidth(sourceRecord.panelWidth);
      const panelAlign = parseAlign(sourceRecord.panelAlign);

      const result: MenuItem = {
        label,
        href,
        description,
        icon,
        external,
        children: children.length > 0 ? children : undefined,
        groups: groups.length > 0 ? groups : undefined,
        ...(panelOffset !== undefined ? { panelOffset } : {}),
        ...(panelWidth !== undefined ? { panelWidth } : {}),
        ...(panelAlign ? { panelAlign } : {})
      };

      return result;
    })
    .filter((item): item is MenuItem => item !== null);
}

/**
 * Builds a URL-friendly href from a menu label.
 * Used as fallback when LLM extraction misses the href.
 */
function buildHrefFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  if (!slug || slug === 'home') {
    return '/';
  }
  return '/' + slug;
}

export function normalizeCTA(raw: unknown): CTAButton | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  // Unwrap potential content wrapper
  const wrapper = 'content' in raw ? (raw as PotentialWrapper) : null;
  const source = wrapper?.content ?? raw;

  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const sourceRecord = source as UnknownRecord;

  const text = typeof sourceRecord.text === 'string' ? sourceRecord.text.trim() : '';
  const href = resolveHref(sourceRecord.href);

  if (!text || !href) {
    return undefined;
  }

  const variant = sourceRecord.variant;
  const external = typeof sourceRecord.external === 'boolean'
    ? sourceRecord.external
    : typeof sourceRecord.target === 'string' && sourceRecord.target.toLowerCase() === '_blank';

  return {
    text,
    href,
    variant,
    external
  };
}
