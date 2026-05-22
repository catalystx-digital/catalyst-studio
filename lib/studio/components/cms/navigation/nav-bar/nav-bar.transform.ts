import { type MenuItem, type CTAButton, type SmartLink } from '@/lib/studio/components/cms/_core/value-objects';

type MenuItemGroup = NonNullable<MenuItem['groups']>[number];

const VALID_ALIGNMENTS = new Set(['start', 'center', 'end']);

// Input types for unsafe data transformation
type UnknownRecord = Record<string, unknown>;

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
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const link = raw as SmartLink;
  if (link.type === 'internal') {
    return typeof link.path === 'string' && link.path.trim() ? link.path.trim() : undefined;
  }
  if (link.type === 'external') {
    return typeof link.url === 'string' && link.url.trim() ? link.url.trim() : undefined;
  }
  if (link.type === 'email' || link.type === 'phone' || link.type === 'anchor') {
    return typeof link.href === 'string' && link.href.trim() ? link.href.trim() : undefined;
  }

  return undefined;
}

function normalizeMenuGroups(input: unknown): MenuItemGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const sourceRecord = entry as UnknownRecord;

      const titleRaw = sourceRecord.title;
      const descriptionRaw = sourceRecord.description;
      const title =
        typeof titleRaw === 'string' && titleRaw.trim().length > 0
          ? titleRaw.trim()
          : undefined;
      const description =
        typeof descriptionRaw === 'string' && descriptionRaw.trim().length > 0
          ? descriptionRaw.trim()
          : undefined;

      const items = normalizeMenuItems(sourceRecord.items);

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
 * Items require canonical label and SmartLink href values.
 */
export function normalizeMenuItems(input: unknown): MenuItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const sourceRecord = entry as UnknownRecord;

      const labelRaw = sourceRecord.label;
      const label = typeof labelRaw === 'string' ? labelRaw.trim() : '';
      const href = sourceRecord.href as SmartLink | undefined;
      const resolvedHref = resolveHref(href);

      if (!label || !resolvedHref) {
        return null;
      }

      const description =
        typeof sourceRecord.description === 'string'
          ? sourceRecord.description.trim()
          : undefined;

      const icon = typeof sourceRecord.icon === 'string' ? sourceRecord.icon : undefined;
      const external = typeof sourceRecord.external === 'boolean'
        ? sourceRecord.external
        : href?.type === 'external' && href.openInNewTab === true;

      const children = normalizeMenuItems(sourceRecord.children);
      const groups = normalizeMenuGroups(sourceRecord.groups);
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

export function normalizeCTA(raw: unknown): CTAButton | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const sourceRecord = raw as UnknownRecord;

  const label = typeof sourceRecord.label === 'string' ? sourceRecord.label.trim() : '';
  const href = sourceRecord.href as SmartLink | undefined;
  const resolvedHref = resolveHref(href);

  if (!label || !resolvedHref) {
    return undefined;
  }

  const variant = sourceRecord.variant;
  const external = typeof sourceRecord.external === 'boolean'
    ? sourceRecord.external
    : href?.type === 'external' && href.openInNewTab === true;

  return {
    label,
    href,
    variant: variant as CTAButton['variant'],
    external
  };
}
