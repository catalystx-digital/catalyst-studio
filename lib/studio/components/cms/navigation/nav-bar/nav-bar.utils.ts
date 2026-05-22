import { MenuItem } from './nav-bar.types';
import { resolveHref } from './nav-bar.transform';

const NORMALIZATION_BASE_URL = 'https://cms.nav';

export function normalizePathname(value: string | null | undefined): string {
  if (!value) {
    return '/';
  }

  const [path] = value.split('?');
  const trimmed = path?.replace(/\/+$/, '') ?? '/';
  return trimmed.length > 0 ? trimmed : '/';
}

function toAbsoluteHref(href: string): string {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (href.startsWith('/')) {
    return `${NORMALIZATION_BASE_URL}${href}`;
  }

  if (href.startsWith('?')) {
    return `${NORMALIZATION_BASE_URL}/${href}`;
  }

  if (href.startsWith('./')) {
    return `${NORMALIZATION_BASE_URL}/${href.slice(2)}`;
  }

  return `${NORMALIZATION_BASE_URL}/${href}`;
}

export function extractPathname(href?: string): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith('#')) {
    return null;
  }

  try {
    const absolute = toAbsoluteHref(href);
    const url = new URL(absolute);
    return normalizePathname(url.pathname);
  } catch {
    return null;
  }
}

export function buildHrefActiveChecker(currentPath: string) {
  return (href?: string): boolean => {
    const targetPath = extractPathname(href);
    if (!targetPath) {
      return false;
    }

    if (targetPath === '/') {
      return currentPath === '/';
    }

    return (
      currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
    );
  };
}

export function buildMenuItemActiveChecker(
  isHrefActive: (href?: string) => boolean,
) {
  const visit = (menuItem: MenuItem): boolean => {
    if (isHrefActive(resolveHref(menuItem.href))) {
      return true;
    }

    if (
      Array.isArray(menuItem.children) &&
      (menuItem.children as MenuItem[]).some((child: MenuItem) => visit(child))
    ) {
      return true;
    }

    if (
      Array.isArray(menuItem.groups) &&
      (menuItem.groups as Array<{ items: MenuItem[] }>).some((group) =>
        group.items.some((child: MenuItem) => visit(child))
      )
    ) {
      return true;
    }

    return false;
  };

  return visit;
}
