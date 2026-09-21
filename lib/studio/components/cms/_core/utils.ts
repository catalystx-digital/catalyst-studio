import { ComponentType, ComponentCategory, CMSComponentProps, AIComponentMetadata } from './types';
import { COMPONENT_MAPPINGS, DEPRECATION_WARNING_PREFIX, DEPRECATION_TIMELINE } from './constants';

const issuedComponentIds = new Set<string>();
const byteToHex = Array.from({ length: 256 }, (_, index) =>
  (index + 0x100).toString(16).slice(1),
);

function createRandomIdentifier(): string {
  const cryptoObj =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buffer = cryptoObj.getRandomValues(new Uint8Array(16));

    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;

    return (
      byteToHex[buffer[0]] +
      byteToHex[buffer[1]] +
      byteToHex[buffer[2]] +
      byteToHex[buffer[3]] +
      '-' +
      byteToHex[buffer[4]] +
      byteToHex[buffer[5]] +
      '-' +
      byteToHex[buffer[6]] +
      byteToHex[buffer[7]] +
      '-' +
      byteToHex[buffer[8]] +
      byteToHex[buffer[9]] +
      '-' +
      byteToHex[buffer[10]] +
      byteToHex[buffer[11]] +
      byteToHex[buffer[12]] +
      byteToHex[buffer[13]] +
      byteToHex[buffer[14]] +
      byteToHex[buffer[15]]
    );
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function generateComponentId(namespace: string = 'cms'): string {
  let identifier = '';
  let attempts = 0;
  const baseNamespace =
    typeof namespace === 'string' ? namespace : String(namespace ?? 'cms');
  const normalizedNamespace = baseNamespace
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = normalizedNamespace.length > 0 ? normalizedNamespace : 'cms';

  do {
    const baseId = createRandomIdentifier();
    identifier = `${prefix}-${baseId}`;
    attempts += 1;

    if (attempts > 4) {
      identifier = `${prefix}-${baseId}-${Date.now()}`;
      break;
    }
  } while (issuedComponentIds.has(identifier));

  issuedComponentIds.add(identifier);
  return identifier;
}

export function resetComponentIdRegistry(): void {
  if (process.env.NODE_ENV !== 'production') {
    issuedComponentIds.clear();
  }
}

export function isComponentDeprecated(componentType: string): boolean {
  return componentType in COMPONENT_MAPPINGS;
}

export function getNewComponentType(legacyType: string): ComponentType | undefined {
  return COMPONENT_MAPPINGS[legacyType as keyof typeof COMPONENT_MAPPINGS];
}

export function showDeprecationWarning(componentType: string, alternativeType?: string) {
  const { warningLevel, endDate } = DEPRECATION_TIMELINE;
  
  if (warningLevel === 'silent') return;
  
  const message = `${DEPRECATION_WARNING_PREFIX} Component "${componentType}" is deprecated and will be removed on ${endDate.toLocaleDateString()}.${
    alternativeType ? ` Please use "${alternativeType}" instead.` : ''
  }`;
  
  if (warningLevel === 'error') {
    if (process.env.NODE_ENV === 'development') {
    console.error(message);
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
    console.warn(message);
    }
  }
}

export function validateComponentProps(props: Partial<CMSComponentProps>): string[] {
  const errors: string[] = [];
  
  if (!props.id) {
    errors.push('Component ID is required');
  }
  
  if (!props.type) {
    errors.push('Component type is required');
  }
  
  if (!props.category) {
    errors.push('Component category is required');
  }
  
  if (!props.content) {
    errors.push('Component content is required');
  }
  
  if (props.aiMetadata && props.aiMetadata.confidence !== undefined) {
    if (props.aiMetadata.confidence < 0 || props.aiMetadata.confidence > 1) {
      errors.push('AI confidence score must be between 0 and 1');
    }
  }
  
  return errors;
}

export function getCategoryFromType(type: ComponentType): ComponentCategory {
  const typeString = type.toLowerCase();
  
  if (
    typeString.includes('nav') ||
    typeString.includes('menu') ||
    typeString.includes('breadcrumb') ||
    typeString.includes('footer') ||
    typeString.includes('columnitem') ||
    typeString.includes('sociallinkitem')
  ) {
    return ComponentCategory.Navigation;
  }
  
  if (typeString.includes('hero')) {
    return ComponentCategory.Heroes;
  }
  
  if (typeString.includes('cta')) {
    return ComponentCategory.CTA;
  }
  
  if (typeString.includes('testimonial') || typeString.includes('review') || typeString.includes('logo')) {
    return ComponentCategory.SocialProof;
  }
  
  if (typeString.includes('contact') || typeString.includes('location')) {
    return ComponentCategory.Contact;
  }
  
  if (typeString.includes('team') || typeString.includes('mission') || typeString.includes('timeline')) {
    return ComponentCategory.About;
  }
  
  if (typeString.includes('blog')) {
    return ComponentCategory.Blog;
  }
  
  if (typeString.includes('pricing')) {
    return ComponentCategory.Pricing;
  }
  
  if (typeString.includes('feature')) {
    return ComponentCategory.Features;
  }
  
  if (typeString.includes('data') || typeString.includes('chart') || typeString.includes('statistic')) {
    return ComponentCategory.Data;
  }
  
  return ComponentCategory.Content;
}

/**
 * Infer a component category from a free-form component type NAME.
 *
 * Unlike `getCategoryFromType`, which classifies values of the known
 * `ComponentType` enum, this handles arbitrary AI-invented type strings
 * produced during greenfield bootstrap. Both the greenfield workflow and the
 * greenfield bootstrapper use this to fill `websiteComponentType.category`.
 *
 * Matching is first-match-wins substring matching in the branch order below,
 * so a name containing two keywords is classified by the EARLIER branch.
 *
 * ---------------------------------------------------------------------------
 * BEHAVIOUR DELTA (merged 2026-09-19)
 * ---------------------------------------------------------------------------
 * This is the greenfield WORKFLOW's implementation. The greenfield
 * BOOTSTRAPPER previously used a narrower copy that lacked the keywords
 * `carousel`, `slider`, `call-to-action`, `quote`, `bio`, `post`, `price` and
 * the whole `data`/`chart`/`graph` branch. Workflow-side behaviour is
 * unchanged; bootstrap-side categories change as follows. The value is
 * persisted to `websiteComponentType.category`, so existing rows keep their
 * old category and only newly bootstrapped sites see the new one.
 *
 * Verified changes for names in the `ComponentType` enum:
 *   quote-block    content -> social-proof
 *   author-bio     content -> about
 *   related-posts  content -> blog
 *   data-table     content -> data
 *   chart          content -> data
 *
 * Verified changes for plausible AI-invented names outside the enum:
 *   price-list, price-table          content -> pricing
 *   call-to-action-block             content -> cta
 *   image-carousel, logo-slider      content -> heroes
 *   post-list                        content -> blog
 *
 * NOTE: `hero-carousel` and `hero-slider` do NOT change - `hero` already
 * matched the Heroes branch in both copies.
 *
 * REORDERING RISK: the added keywords sit in EARLIER branches, so a compound
 * name that the old bootstrapper matched on a later branch can now land
 * earlier - e.g. `testimonial-carousel` social-proof -> heroes,
 * `feature-slider` features -> heroes, `pricing-carousel` pricing -> heroes.
 * None of these are in the `ComponentType` enum, but AI-generated names can
 * take these shapes.
 *
 * SUBSTRING RISK (inherited from the workflow copy, deliberately preserved):
 * `graph` also matches `paragraph` and `infographic`, `bio` also matches
 * `biography`, and `post` also matches `poster`.
 */
export function inferComponentCategoryFromTypeName(type: string): ComponentCategory {
  const t = type.toLowerCase();

  if (t.includes('nav') || t.includes('menu') || t.includes('header') || t.includes('footer')) {
    return ComponentCategory.Navigation;
  }
  if (t.includes('hero') || t.includes('banner') || t.includes('carousel') || t.includes('slider')) {
    return ComponentCategory.Heroes;
  }
  if (t.includes('form') || t.includes('contact')) {
    return ComponentCategory.Contact;
  }
  if (t.includes('cta') || t.includes('call-to-action')) {
    return ComponentCategory.CTA;
  }
  if (t.includes('feature')) {
    return ComponentCategory.Features;
  }
  if (t.includes('testimonial') || t.includes('review') || t.includes('quote')) {
    return ComponentCategory.SocialProof;
  }
  if (t.includes('about') || t.includes('team') || t.includes('bio')) {
    return ComponentCategory.About;
  }
  if (t.includes('blog') || t.includes('article') || t.includes('post')) {
    return ComponentCategory.Blog;
  }
  if (t.includes('pricing') || t.includes('price')) {
    return ComponentCategory.Pricing;
  }
  if (t.includes('data') || t.includes('chart') || t.includes('graph')) {
    return ComponentCategory.Data;
  }

  return ComponentCategory.Content;
}

export function mergeComponentProps(
  baseProps: CMSComponentProps,
  overrides: Partial<CMSComponentProps>
): CMSComponentProps {
  return {
    ...baseProps,
    ...overrides,
    content: {
      ...baseProps.content,
      ...(overrides.content || {})
    },
    aiMetadata: overrides.aiMetadata || baseProps.aiMetadata ? {
      keywords: [],
      patterns: [],
      commonNames: [],
      pageLocation: [],
      confidence: 0,
      ...(baseProps.aiMetadata || {}),
      ...(overrides.aiMetadata || {})
    } as AIComponentMetadata : undefined,
    analytics: overrides.analytics || baseProps.analytics ? {
      ...(baseProps.analytics || {}),
      ...(overrides.analytics || {})
    } : undefined
  };
}

export function sanitizeComponentContent(content: any): any {
  if (typeof content === 'string') {
    // Basic XSS prevention
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (Array.isArray(content)) {
    return content.map(sanitizeComponentContent);
  }
  
  if (content && typeof content === 'object') {
    const sanitized: any = {};
    for (const key in content) {
      if (content.hasOwnProperty(key)) {
        sanitized[key] = sanitizeComponentContent(content[key]);
      }
    }
    return sanitized;
  }
  
  return content;
}

export function getComponentDisplayName(type: ComponentType): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Read runtime CMSComponentProps.content without accepting legacy string mirrors.
 * Runtime content must already be canonical and projected from component.content.
 */
export function readRuntimeContent<T = unknown>(value: unknown): T | unknown {
  if (typeof value === 'string') {
    throw new Error('CMS runtime content must be canonical object content; string content is not accepted.');
  }
  return value;
}
