import type { SnapshotPage } from '@/lib/studio/headless/site-snapshot/types';
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance';

type PageKind =
  | 'landing'
  | 'article'
  | 'listing'
  | 'institutional'
  | 'agency'
  | 'generic';

type PageDensity = 'compact' | 'balanced' | 'spacious';
type PageTone = 'neutral' | 'brand' | 'editorial';

export interface CmsPresentationContext {
  pageKind: PageKind;
  density: PageDensity;
  tone: PageTone;
  componentCount: number;
  hasHero: boolean;
  hasNavigation: boolean;
  hasFooter: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lowerText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.toLowerCase();
}

function collectText(value: unknown, parts: string[] = []): string[] {
  if (typeof value === 'string') {
    parts.push(value);
    return parts;
  }

  if (Array.isArray(value)) {
    value.forEach(entry => collectText(entry, parts));
    return parts;
  }

  if (isRecord(value)) {
    Object.values(value).forEach(entry => collectText(entry, parts));
  }

  return parts;
}

function componentHasType(components: ComponentInstance[], prefixes: string[]): boolean {
  return components.some(component => prefixes.some(prefix => component.type.startsWith(prefix)));
}

function countCards(component: ComponentInstance): number {
  const content = isRecord(component.content) ? component.content : {};
  const cards = content.cards;
  const items = content.items;

  if (Array.isArray(cards)) {
    return cards.length;
  }

  if (Array.isArray(items)) {
    return items.length;
  }

  return 0;
}

function inferPageKind(page: SnapshotPage, components: ComponentInstance[]): PageKind {
  const metadata = isRecord(page.metadata) ? page.metadata : {};
  const templateKey = lowerText(page.templateKey);
  const title = lowerText(page.title);
  const importSource = lowerText(metadata.importSource);
  const pageTag = lowerText(metadata.pageTag ?? metadata.pageType ?? metadata.skeleton);
  const contentText = lowerText(
    collectText(components.map(component => component.content))
      .join(' ')
      .slice(0, 5000)
  );
  const pageHaystack = `${templateKey} ${title} ${importSource} ${pageTag}`;
  const nonUrlHaystack = `${templateKey} ${title} ${pageTag} ${contentText}`;
  const haystack = `${pageHaystack} ${contentText}`;

  if (haystack.match(/\b(hospital|health|university|school|government|council|foundation|institution)\b/)) {
    return 'institutional';
  }

  if (
    nonUrlHaystack.match(/\b(agency|studio|portfolio|case-study|case studies|digital experiences|latest projects|what we deliver)\b/)
  ) {
    return 'agency';
  }

  if (pageHaystack.match(/\b(article|blog|news|post|story)\b/)) {
    return 'article';
  }

  const cardTotal = components.reduce((sum, component) => sum + countCards(component), 0);
  if (cardTotal >= 8 || componentHasType(components, ['content-feed', 'blog-list'])) {
    return 'listing';
  }

  if (componentHasType(components, ['hero-'])) {
    return 'landing';
  }

  return 'generic';
}

function inferDensity(components: ComponentInstance[]): PageDensity {
  if (components.length <= 3) {
    return 'spacious';
  }

  const cardTotal = components.reduce((sum, component) => sum + countCards(component), 0);
  if (components.length >= 8 || cardTotal >= 10) {
    return 'compact';
  }

  return 'balanced';
}

function inferTone(pageKind: PageKind, components: ComponentInstance[]): PageTone {
  if (pageKind === 'article') {
    return 'editorial';
  }

  if (componentHasType(components, ['hero-', 'cta-', 'logo-cloud'])) {
    return 'brand';
  }

  return 'neutral';
}

export function buildCmsPresentationContext(page: SnapshotPage): CmsPresentationContext {
  const components = Array.isArray(page.components) ? page.components : [];
  const pageKind = inferPageKind(page, components);

  return {
    pageKind,
    density: inferDensity(components),
    tone: inferTone(pageKind, components),
    componentCount: components.length,
    hasHero: componentHasType(components, ['hero-']),
    hasNavigation: componentHasType(components, ['navbar', 'nav-', 'mega']),
    hasFooter: componentHasType(components, ['footer']),
  };
}

export function cmsPresentationAttributes(context: CmsPresentationContext): Record<string, string | number> {
  return {
    'data-cms-page-kind': context.pageKind,
    'data-cms-density': context.density,
    'data-cms-tone': context.tone,
    'data-cms-component-count': context.componentCount,
    'data-cms-has-hero': String(context.hasHero),
    'data-cms-has-navigation': String(context.hasNavigation),
    'data-cms-has-footer': String(context.hasFooter),
  };
}
