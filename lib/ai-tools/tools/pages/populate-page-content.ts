/**
 * AI Tool for Populating Page Content
 *
 * Populates content for an existing WebsiteStructure created during IA phase.
 * Used by greenfield workflow to generate page content after site structure is established.
 *
 * Key features:
 * - Finds WebsiteStructure by websiteId + slug
 * - Creates WebsitePage with content
 * - Links WebsitePage to WebsiteStructure
 * - Updates iaStatus to 'complete'
 * - Returns IA metadata for cross-page consistency
 */

import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * TKT-091: Component type normalization map.
 * Maps invalid/creative section names to valid component types.
 * The AI sometimes outputs section names (like "services") instead of component types (like "feature-grid").
 * This runtime normalization ensures consistent rendering.
 */
const COMPONENT_TYPE_NORMALIZATION_MAP: Record<string, string> = {
  // Services/capabilities sections → feature-grid
  'services': 'feature-grid',
  'services-overview': 'feature-grid',
  'our-services': 'feature-grid',
  'what-we-do': 'feature-grid',
  'capabilities': 'feature-grid',
  'expertise': 'feature-grid',
  'service-list': 'feature-grid',
  // Process/workflow sections → feature-grid
  'process': 'feature-grid',
  'our-process': 'feature-grid',
  'process-steps': 'feature-grid',
  'how-it-works': 'feature-grid',
  'workflow': 'feature-grid',
  'steps': 'feature-grid',
  // Portfolio/work sections → feature-grid
  'featured-work': 'feature-grid',
  'selected-projects': 'feature-grid',
  'portfolio': 'feature-grid',
  'projects': 'feature-grid',
  'case-studies': 'feature-grid',
  'work': 'feature-grid',
  'our-work': 'feature-grid',
  // Products sections → feature-grid
  'featured-products': 'feature-grid',
  'products': 'feature-grid',
  'product-grid': 'feature-grid',
  'bestsellers': 'feature-grid',
  'shop': 'feature-grid',
  // Team sections → feature-grid
  'team': 'feature-grid',
  'team-section': 'feature-grid',
  'our-team': 'feature-grid',
  'team-members': 'feature-grid',
  // Features sections → feature-grid
  'features': 'feature-grid',
  'features-list': 'feature-grid',
  'key-features': 'feature-grid',
  'product-features': 'feature-grid',
  'value-propositions': 'feature-grid',
  'value-props': 'feature-grid',
  'key-benefits': 'feature-grid',
  // Skills sections → feature-grid
  'skills': 'feature-grid',
  'skills-list': 'feature-grid',
  'what-i-do': 'feature-grid',
  'my-skills': 'feature-grid',
  // Experience/timeline sections → feature-grid
  'experience': 'feature-grid',
  'experience-timeline': 'feature-grid',
  'timeline': 'feature-grid',
  'work-history': 'feature-grid',
  'career': 'feature-grid',
  // Testimonials variants → testimonials
  'testimonial': 'testimonials',
  'testimonials-grid': 'testimonials',
  'social-proof': 'testimonials',
  'reviews': 'testimonials',
  'client-testimonials': 'testimonials',
  'client-testimonial': 'testimonials',
  // CTA variants → cta-simple
  'cta': 'cta-simple',
  'cta-banner': 'cta-simple',
  'call-to-action': 'cta-simple',
  'final-cta': 'cta-simple',
  'contact-form': 'cta-simple',
  'contact': 'cta-simple',
  'get-in-touch': 'cta-simple',
  'newsletter-cta': 'cta-simple',
  'newsletter': 'cta-simple',
  'signup': 'cta-simple',
  'sign-up': 'cta-simple',
  // Stats variants → stats-grid
  'stats': 'stats-grid',
  'stats-section': 'stats-grid',
  'stats-highlights': 'stats-grid',
  'key-stats': 'stats-grid',
  'metrics': 'stats-grid',
  'numbers': 'stats-grid',
  'by-the-numbers': 'stats-grid',
  // Menu/location sections → feature-grid
  'menu-highlights': 'feature-grid',
  'visit-us': 'feature-grid',
  'visit-info': 'feature-grid',
  'location-info': 'feature-grid',
  'business-hours': 'feature-grid',
  'contact-details': 'feature-grid',
  // Classes/pricing sections → feature-grid
  'classes-list': 'feature-grid',
  'classes': 'feature-grid',
  'courses': 'feature-grid',
  'programs': 'feature-grid',
  'pricing-options': 'feature-grid',
  'pricing': 'feature-grid',
  'pricing-plans': 'feature-grid',
  'membership': 'feature-grid',
  // FAQ sections → feature-list
  'faq': 'feature-list',
  'faq-section': 'feature-list',
  'faqs': 'feature-list',
  'questions': 'feature-list',
  // Hero variants → hero-simple
  'hero': 'hero-simple',
  'hero-introduction': 'hero-simple',
  'hero-intro': 'hero-simple',
  // About/text sections → text-block
  'about': 'text-block',
  'about-story': 'text-block',
  'problem-statement': 'text-block',
  'category-overview': 'text-block',
  'contact-info': 'text-block',
  'credentials': 'text-block',
  'team-values': 'text-block',
  // Logo/partner sections → feature-grid
  'logos': 'feature-grid',
  'logo-bar': 'feature-grid',
  'client-logos': 'feature-grid',
  'trusted-by': 'feature-grid',
  'trusted-logos': 'feature-grid',
  'partners': 'feature-grid',
  'partner-logos': 'feature-grid',
  // Gallery sections → image-gallery (keep as-is, these are valid component types)
  // 'gallery': 'image-gallery', - already valid
  // 'image-gallery': stays as-is - already valid
  // 'photos': 'image-gallery', - already valid
  // Practice areas (law firms) → feature-grid
  'practice-areas': 'feature-grid',
  'areas-of-practice': 'feature-grid',
  'specialties': 'feature-grid',
  // Why choose us → feature-grid
  'why-choose-us': 'feature-grid',
  'why-us': 'feature-grid',
  'benefits': 'feature-grid',
  'advantages': 'feature-grid',
  // Real estate → feature-grid
  'listings': 'feature-grid',
  'featured-listings': 'feature-grid',
  'properties': 'feature-grid',
  'current-listings': 'feature-grid',
  // Restaurant → cta-simple for reservations
  'reservations': 'cta-simple',
  'reservation': 'cta-simple',
  'book-a-table': 'cta-simple',
  'booking': 'cta-simple',
  'location': 'feature-grid',
  'find-us': 'feature-grid',
};

/**
 * Normalizes a component type to a valid renderer type.
 * Returns the original type if no mapping exists (it may already be valid).
 */
function normalizeComponentType(type: string): string {
  const normalized = COMPONENT_TYPE_NORMALIZATION_MAP[type.toLowerCase()];
  if (normalized) {
    console.info(`[populatePageContent] Normalized component type: "${type}" → "${normalized}"`);
    return normalized;
  }
  return type;
}

/**
 * Default icon mappings by content keyword.
 * Used to add icons to feature-grid items that are missing them.
 */
const CONTENT_TO_ICON_MAP: Record<string, string> = {
  // Location/contact
  'location': 'MapPin',
  'address': 'MapPin',
  'find us': 'MapPin',
  'visit': 'MapPin',
  'directions': 'MapPin',
  // Time/schedule
  'hours': 'Clock',
  'schedule': 'Clock',
  'time': 'Clock',
  'open': 'Clock',
  'availability': 'Calendar',
  // Phone/contact
  'phone': 'Phone',
  'call': 'Phone',
  'mobile': 'Smartphone',
  'contact': 'MessageCircle',
  // Email
  'email': 'Mail',
  'mail': 'Mail',
  // Wifi/amenities
  'wifi': 'Wifi',
  'internet': 'Wifi',
  'amenities': 'Sparkles',
  // Food/drink
  'coffee': 'Coffee',
  'drink': 'Coffee',
  'menu': 'UtensilsCrossed',
  'food': 'UtensilsCrossed',
  'restaurant': 'UtensilsCrossed',
  // Services
  'service': 'Wrench',
  'repair': 'Wrench',
  'maintenance': 'Settings',
  'plumbing': 'Droplets',
  'water': 'Droplets',
  'heating': 'Flame',
  'emergency': 'Zap',
  'fast': 'Zap',
  'quick': 'Zap',
  // Quality/trust
  'quality': 'Award',
  'award': 'Award',
  'certified': 'Award',
  'trusted': 'Shield',
  'secure': 'Shield',
  'guarantee': 'Shield',
  'safe': 'Lock',
  // Professional
  'experience': 'Briefcase',
  'work': 'Briefcase',
  'professional': 'Briefcase',
  'expert': 'Star',
  // Team
  'team': 'Users',
  'people': 'Users',
  'staff': 'Users',
  'support': 'Headphones',
  // Technology
  'code': 'Code',
  'development': 'Code',
  'software': 'Code',
  'design': 'Palette',
  'creative': 'Palette',
  'video': 'Video',
  'photo': 'Camera',
  // Business
  'growth': 'TrendingUp',
  'analytics': 'BarChart3',
  'data': 'PieChart',
  'insight': 'Lightbulb',
  'idea': 'Lightbulb',
  'solution': 'Puzzle',
  'strategy': 'Target',
  'goal': 'Target',
  // E-commerce
  'shipping': 'Truck',
  'delivery': 'Truck',
  'package': 'Package',
  'product': 'Package',
  'payment': 'CreditCard',
  'price': 'DollarSign',
  'cost': 'DollarSign',
  'value': 'DollarSign',
  // Eco/sustainability
  'eco': 'Leaf',
  'sustainable': 'Leaf',
  'green': 'Leaf',
  'organic': 'Leaf',
  // Health/wellness
  'health': 'Heart',
  'wellness': 'Heart',
  'yoga': 'Heart',
  'fitness': 'Heart',
  // Legal
  'legal': 'Scale',
  'law': 'Scale',
  'justice': 'Scale',
  'court': 'Gavel',
  // Real estate
  'home': 'Home',
  'house': 'Home',
  'property': 'Building2',
  'building': 'Building2',
  'office': 'Building2',
  // Communication
  'chat': 'MessageCircle',
  'message': 'MessageCircle',
  'conversation': 'MessageCircle',
  'send': 'Send',
  'submit': 'Send',
  // Downloads/uploads
  'download': 'Download',
  'upload': 'Upload',
  'file': 'FileText',
  'document': 'FileText',
  // General positive
  'free': 'Gift',
  'bonus': 'Gift',
  'offer': 'Gift',
  'studio': 'Sparkles',
  'special': 'Sparkles',
  'check': 'CheckCircle',
  'done': 'CheckCircle',
  'complete': 'CheckCircle',
  // Launch/new
  'launch': 'Rocket',
  'new': 'Rocket',
  'start': 'Rocket',
};

/**
 * Background colors for visual rhythm.
 * Sections alternate between these to create depth.
 */
const BACKGROUND_RHYTHM = ['default', 'muted', 'default', 'muted', 'primary'] as const;

/**
 * Infers an appropriate icon for a feature item based on its title and description.
 */
function inferIconForFeature(title?: string, description?: string): string | undefined {
  const searchText = `${title || ''} ${description || ''}`.toLowerCase();

  for (const [keyword, icon] of Object.entries(CONTENT_TO_ICON_MAP)) {
    if (searchText.includes(keyword)) {
      return icon;
    }
  }

  return undefined;
}

/**
 * Enhances components for visual quality (v0.dev parity).
 * - Ensures homepage heroes have height: "full"
 * - Adds alternating background colors for visual rhythm
 * - Adds icons to feature-grid items that are missing them
 *
 * This runs AFTER sanitization to improve AI-generated content.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enhanceVisualQuality(content: Record<string, any>, slug: string): Record<string, any> {
  if (!content || typeof content !== 'object' || !Array.isArray(content.components)) {
    return content;
  }

  const isHomepage = slug === 'home' || slug === 'index' || slug === '';
  let contentSectionIndex = 0; // Track content sections for background rhythm (excludes navbar/footer)

  content.components = content.components.map((comp: Record<string, unknown>) => {
    if (!comp || typeof comp !== 'object' || typeof comp.type !== 'string') {
      return comp;
    }

    const componentType = comp.type as string;
    const componentContent = (comp.content as Record<string, unknown>) || {};

    // 1. Hero height enhancement - ensure homepage heroes are full viewport
    if (componentType.includes('hero')) {
      if (isHomepage && !componentContent.height) {
        console.info('[populatePageContent] Enhancing hero height to "full" for homepage');
        return {
          ...comp,
          content: {
            ...componentContent,
            height: 'full'
          }
        };
      }
    }

    // 2. Background rhythm enhancement - add alternating backgrounds to content sections
    // Skip navbar, footer, and heroes (they have their own styling)
    if (!['navbar', 'footer'].includes(componentType) && !componentType.includes('hero')) {
      const currentBgIndex = contentSectionIndex % BACKGROUND_RHYTHM.length;
      contentSectionIndex++;

      // Only add background if not already set
      if (!componentContent.background) {
        const bgColor = BACKGROUND_RHYTHM[currentBgIndex];
        // Skip 'default' as it's the implicit default
        if (bgColor !== 'default') {
          console.info(`[populatePageContent] Adding background "${bgColor}" to ${componentType}`);
          return {
            ...comp,
            content: {
              ...componentContent,
              background: { color: bgColor }
            }
          };
        }
      }
    }

    // 3. Icon enhancement for feature-grid items
    if (componentType === 'feature-grid') {
      const items = componentContent.items || componentContent.features;
      if (Array.isArray(items)) {
        let iconsAdded = 0;
        const enhancedItems = items.map((item: Record<string, unknown>) => {
          if (!item || typeof item !== 'object') return item;

          // Skip if icon already exists
          if (item.icon) return item;

          // Infer icon from title/description
          const inferredIcon = inferIconForFeature(
            item.title as string | undefined,
            item.description as string | undefined
          );

          if (inferredIcon) {
            iconsAdded++;
            return { ...item, icon: inferredIcon };
          }

          return item;
        });

        if (iconsAdded > 0) {
          console.info(`[populatePageContent] Added ${iconsAdded} inferred icons to feature-grid`);
          return {
            ...comp,
            content: {
              ...componentContent,
              items: enhancedItems,
              features: undefined // Remove duplicate if present
            }
          };
        }
      }
    }

    return comp;
  });

  return content;
}

/**
 * Detects if an object looks like a component (has type and optionally region/content).
 * Used to identify malformed AI responses where component properties are at root level.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function looksLikeComponent(obj: Record<string, any>): boolean {
  return typeof obj.type === 'string' && (
    typeof obj.region === 'string' ||
    typeof obj.content === 'object' ||
    // Common component type patterns
    ['navbar', 'footer', 'hero', 'feature', 'cta', 'text', 'card'].some(t =>
      (obj.type as string).toLowerCase().includes(t)
    )
  );
}

/**
 * Known component type keys that might appear at root level in malformed responses.
 * The AI sometimes returns component data as root-level properties like:
 * { "footer": {...}, "hero-with-image": {...}, "card-grid": {...}, "components": [...] }
 * instead of the correct:
 * { "components": [{ "type": "footer", ... }, { "type": "hero-with-image", ... }] }
 */
const KNOWN_COMPONENT_KEYS = [
  // Navigation
  'navbar', 'nav', 'header', 'navigation',
  // Heroes
  'hero', 'hero-simple', 'hero-with-image', 'hero-banner', 'hero-split',
  // Footers
  'footer', 'footer-simple', 'footer-columns',
  // Content sections
  'feature-grid', 'feature-list', 'features', 'feature-section',
  'card-grid', 'cards', 'card-section',
  'text-block', 'text-section', 'content-section',
  'about-section', 'about', 'about-us',
  'team-grid', 'team', 'team-section',
  'testimonials', 'testimonial-section', 'testimonials-grid',
  'stats-grid', 'stats', 'statistics',
  // CTAs
  'cta', 'cta-simple', 'cta-banner', 'cta-section', 'call-to-action',
  // Other common types
  'accordion', 'faq', 'faq-section',
  'contact-form', 'contact', 'contact-section',
  'pricing-table', 'pricing', 'pricing-section',
  'gallery', 'image-gallery', 'gallery-section',
  'blog-list', 'blog-grid', 'blog-section',
  'timeline', 'timeline-section',
];

/**
 * Checks if a key looks like a component type key (kebab-case pattern commonly used for components).
 */
function looksLikeComponentKey(key: string): boolean {
  const lowerKey = key.toLowerCase();

  // Direct match with known component keys
  if (KNOWN_COMPONENT_KEYS.includes(lowerKey)) {
    return true;
  }

  // Check for common component patterns
  return ['hero', 'footer', 'cta', 'feature', 'card', 'team', 'testimonial', 'stats', 'section'].some(
    pattern => lowerKey.includes(pattern)
  );
}

/**
 * Checks if a value looks like component content (has nested content or common component properties).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function looksLikeComponentContent(value: any): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  // Has nested content property (common pattern)
  if (value.content && typeof value.content === 'object') {
    return true;
  }

  // Has region property (footer, header)
  if (value.region && typeof value.region === 'string') {
    return true;
  }

  // Has common component content properties
  const componentProps = ['heading', 'subheading', 'items', 'cards', 'columns', 'members', 'events', 'ctaButtons', 'image', 'body'];
  return componentProps.some(prop => prop in value);
}

/**
 * Fixes malformed AI responses where component data appears as root-level properties.
 *
 * This handles TWO patterns of malformed output:
 *
 * Pattern 1: Single component with type/region/content at root:
 * {
 *   "type": "footer",
 *   "region": "footer",
 *   "content": { columns: [...] },
 *   "components": [ { "type": "navbar", ... } ]
 * }
 *
 * Pattern 2: Multiple components as named root properties:
 * {
 *   "footer": { "region": "footer", "content": {...} },
 *   "hero-with-image": { "heading": "...", "image": {...} },
 *   "card-grid": { "heading": "...", "cards": [...] },
 *   "components": [ { "type": "navbar", ... } ]
 * }
 *
 * Both patterns are restructured into the correct format:
 * { "components": [{ "type": "navbar", ...}, { "type": "hero-with-image", ... }, ...] }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixMalformedRootComponent(content: Record<string, any>): Record<string, any> {
  // Get the components array if it exists (may be empty or contain partial content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingComponents: any[] = Array.isArray(content.components) ? [...content.components] : [];

  // Collect components found at root level (either as properties or as type/region/content)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootLevelComponents: any[] = [];

  // Pattern 1: Check if root object itself looks like a component (has type property)
  if (looksLikeComponent(content)) {
    const rootComponent: Record<string, unknown> = {
      type: content.type,
      region: content.region,
      content: content.content
    };

    // Copy styling/layout properties that belong to this component
    const componentProps = ['filters', 'background', 'overlay', 'height', 'align', 'variant'];
    for (const prop of componentProps) {
      if (content[prop] !== undefined) {
        rootComponent[prop] = content[prop];
      }
    }

    rootLevelComponents.push(rootComponent);
  }

  // Pattern 2: Check for named component properties at root level
  // e.g., { "hero-with-image": {...}, "card-grid": {...}, "footer": {...} }
  const reservedKeys = ['components', 'type', 'region', 'content', 'filters', 'background', 'overlay', 'height', 'align', 'variant'];

  for (const [key, value] of Object.entries(content)) {
    // Skip reserved keys and already-processed keys
    if (reservedKeys.includes(key)) continue;

    // Check if this key looks like a component type and has component-like content
    if (looksLikeComponentKey(key) && looksLikeComponentContent(value)) {
      // Build a proper component from this root-level property
      const component: Record<string, unknown> = {
        type: key, // The property key IS the component type
      };

      // The value contains the component's content
      // If it has a "content" nested property, use it; otherwise, the value itself is the content
      if (value.content && typeof value.content === 'object') {
        // Structured format: { content: {...}, region: "...", ... }
        component.content = value.content;
        if (value.region) component.region = value.region;
        if (value.background) component.background = value.background;
      } else {
        // Flat format: the value object IS the content
        // Extract known metadata/layout properties first
        const { region, background, overlay, ...restContent } = value;
        component.content = restContent;
        if (region) component.region = region;
        if (background) component.background = background;
        if (overlay) component.overlay = overlay;
      }

      rootLevelComponents.push(component);
    }
  }

  // If no root-level components found, return unchanged
  if (rootLevelComponents.length === 0) {
    return content;
  }

  console.warn('[populatePageContent] Detected malformed AI response: component data at root level. Restructuring...');
  console.info('[populatePageContent] Found root-level components:', rootLevelComponents.map(c => c.type));

  // Sort and merge components:
  // 1. Headers/navbars go first
  // 2. Content components (hero, features, etc.) go in the middle
  // 3. Footers go last

  const headers: typeof rootLevelComponents = [];
  const mainContent: typeof rootLevelComponents = [];
  const footers: typeof rootLevelComponents = [];

  for (const comp of [...existingComponents, ...rootLevelComponents]) {
    const compType = (comp.type as string || '').toLowerCase();
    const compRegion = (comp.region as string || '').toLowerCase();

    if (compRegion === 'header' || compType.includes('navbar') || compType.includes('nav')) {
      headers.push(comp);
    } else if (compRegion === 'footer' || compType.includes('footer')) {
      footers.push(comp);
    } else {
      mainContent.push(comp);
    }
  }

  // Order main content: heroes first, then other content, then CTAs
  const orderedMainContent = mainContent.sort((a, b) => {
    const aType = (a.type as string || '').toLowerCase();
    const bType = (b.type as string || '').toLowerCase();

    // Heroes come first
    if (aType.includes('hero') && !bType.includes('hero')) return -1;
    if (!aType.includes('hero') && bType.includes('hero')) return 1;

    // CTAs come last (before footer)
    if (aType.includes('cta') && !bType.includes('cta')) return 1;
    if (!aType.includes('cta') && bType.includes('cta')) return -1;

    return 0;
  });

  const mergedComponents = [...headers, ...orderedMainContent, ...footers];

  console.info('[populatePageContent] Restructured malformed response:', {
    originalComponentCount: existingComponents.length,
    rootLevelComponentCount: rootLevelComponents.length,
    newComponentCount: mergedComponents.length,
    componentTypes: mergedComponents.map(c => c.type)
  });

  // Return clean structure with only components array
  return { components: mergedComponents };
}

/**
 * Fixes malformed components array where strings are interleaved with objects.
 *
 * Handles multiple patterns:
 *
 * Pattern A: Key-value interleaving
 *   ["type", "hero-banner", "content", {...}, "type", ...]
 *   → [{ type: "hero-banner", content: {...} }, ...]
 *
 * Pattern B: Direct type-content pairs
 *   ["hero-banner", {...}, "footer", {...}]
 *   → [{ type: "hero-banner", content: {...} }, { type: "footer", content: {...} }]
 *
 * This happens when the AI incorrectly serializes the component structure,
 * putting property keys and values as separate array elements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixInterleavedComponentArray(components: any[]): any[] {
  // Check if this looks like an interleaved pattern:
  // Has strings that are either property keys (type/content/region) OR component type names
  const stringItems = components.filter(item => typeof item === 'string');

  // Pattern A detection: "type", "content", "region" as keys
  const hasKeyValuePattern = stringItems.some(item =>
    item === 'type' || item === 'content' || item === 'region'
  );

  // Pattern B detection: Component type names as direct values followed by objects
  const hasDirectTypePattern = components.some((item, i) =>
    typeof item === 'string' &&
    looksLikeComponentKey(item) &&
    i + 1 < components.length &&
    typeof components[i + 1] === 'object' &&
    components[i + 1] !== null &&
    !Array.isArray(components[i + 1])
  );

  if (!hasKeyValuePattern && !hasDirectTypePattern) {
    return components;
  }

  console.warn('[populatePageContent] Detected interleaved pattern in components array. Reconstructing...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reconstructed: any[] = [];

  // First, try Pattern B (simpler and more common): direct type-content pairs
  // ["hero-banner", {...}, "footer", {...}]
  if (hasDirectTypePattern && !hasKeyValuePattern) {
    for (let i = 0; i < components.length; i++) {
      const item = components[i];

      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Already a properly formed component
        if (item.type && typeof item.type === 'string') {
          reconstructed.push(item);
        }
        // Skip orphan objects that follow a type string (handled below)
        continue;
      }

      if (typeof item === 'string' && looksLikeComponentKey(item)) {
        const nextItem = components[i + 1];
        if (nextItem && typeof nextItem === 'object' && !Array.isArray(nextItem)) {
          // Pattern: "hero-banner", { ...content }
          // The content could be wrapped in a "content" key or flat
          const componentContent = nextItem.content || nextItem;
          reconstructed.push({
            type: item,
            content: componentContent,
            ...(nextItem.region && { region: nextItem.region }),
            ...(nextItem.background && { background: nextItem.background })
          });
          i++; // Skip the content object we just consumed
        }
      }
    }

    if (reconstructed.length > 0) {
      console.info('[populatePageContent] Reconstructed from direct type-content pattern:', {
        originalLength: components.length,
        reconstructedCount: reconstructed.length,
        types: reconstructed.map(c => c.type).filter(Boolean)
      });
      return reconstructed;
    }
  }

  // Pattern A: Key-value interleaving ["type", "hero-banner", "content", {...}]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentComponent: Record<string, any> | null = null;
  let expectingValue = false;
  let currentKey = '';

  for (let i = 0; i < components.length; i++) {
    const item = components[i];

    if (typeof item === 'string') {
      // Check if this is a property key like "type", "content", "region"
      const isPropertyKey = item === 'type' || item === 'content' || item === 'region' || item === 'id';

      if (isPropertyKey && !expectingValue) {
        // It's a key - start or continue building a component
        if (item === 'type') {
          // Starting a new component - save current if valid
          if (currentComponent && currentComponent.type) {
            reconstructed.push(currentComponent);
          }
          currentComponent = {};
        }
        currentKey = item;
        expectingValue = true;
      } else if (expectingValue && currentComponent) {
        // It's a value for the current key
        currentComponent[currentKey] = item;
        expectingValue = false;
        currentKey = '';
      } else if (!expectingValue && looksLikeComponentKey(item)) {
        // String looks like a component type name followed by an object
        const nextItem = components[i + 1];
        if (nextItem && typeof nextItem === 'object' && !Array.isArray(nextItem)) {
          // Pattern: "hero-banner", { ...content }
          if (currentComponent && currentComponent.type) {
            reconstructed.push(currentComponent);
          }
          const componentContent = nextItem.content || nextItem;
          currentComponent = {
            type: item,
            content: componentContent,
            ...(nextItem.region && { region: nextItem.region })
          };
          i++; // Skip the content object
          expectingValue = false;
          currentKey = '';
        }
      }
    } else if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      if (expectingValue && currentComponent) {
        // It's a value for the current key (likely "content")
        currentComponent[currentKey] = item;
        expectingValue = false;
        currentKey = '';
      } else if (item.type && typeof item.type === 'string') {
        // It's already a properly formed component object
        if (currentComponent && currentComponent.type) {
          reconstructed.push(currentComponent);
        }
        reconstructed.push(item);
        currentComponent = null;
      } else if (currentComponent && !currentComponent.content) {
        // Orphan object - might be content for current component
        currentComponent.content = item;
      }
    }
  }

  // Don't forget the last component
  if (currentComponent && currentComponent.type) {
    reconstructed.push(currentComponent);
  }

  if (reconstructed.length > 0) {
    console.info('[populatePageContent] Reconstructed from key-value interleaved pattern:', {
      originalLength: components.length,
      reconstructedCount: reconstructed.length,
      types: reconstructed.map(c => c.type).filter(Boolean)
    });
    return reconstructed;
  }

  // Reconstruction failed, return original
  console.warn('[populatePageContent] Interleaved pattern reconstruction failed, returning original');
  return components;
}

/**
 * Validates and sanitizes components array.
 * - Fixes malformed AI responses (component properties at root level)
 * - Fixes interleaved string patterns in components array
 * - Filters out invalid components (non-objects, missing type)
 * - Normalizes invalid component types to valid renderer types (TKT-091)
 * - Ensures all valid components have unique IDs
 *
 * AI-generated content can sometimes have malformed components due to JSON parsing issues.
 * This prevents corrupted data from being saved to the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeAndEnsureComponentIds(content: Record<string, any>, slug?: string): Record<string, any> {
  if (!content || typeof content !== 'object') {
    return content;
  }

  // FIRST: Fix malformed AI responses where component properties are at root level
  content = fixMalformedRootComponent(content);

  // Check for components array (standard page content structure)
  if (Array.isArray(content.components)) {
    // SECOND: Fix interleaved string patterns in components array
    // (e.g., ["type", "hero-banner", "content", {...}] → [{ type: "hero-banner", content: {...} }])
    content.components = fixInterleavedComponentArray(content.components);

    const timestamp = Date.now();
    let validIndex = 0;

    // Filter out invalid components and ensure IDs on valid ones
    content.components = content.components
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((comp: any) => {
        // Must be an object with a string type property
        const isValid = comp && typeof comp === 'object' && typeof comp.type === 'string';
        if (!isValid) {
          console.warn('[populatePageContent] Filtering out invalid component:',
            typeof comp === 'string' ? comp.substring(0, 50) : typeof comp
          );
        }
        return isValid;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((comp: any) => {
        // TKT-091: Normalize component type to valid renderer type
        const normalizedType = normalizeComponentType(comp.type);

        // Generate ID if missing (use normalized type for ID)
        if (!comp.id) {
          return {
            ...comp,
            type: normalizedType,
            id: `${normalizedType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${timestamp}-${validIndex++}`
          };
        }
        validIndex++;
        // Still normalize type even if ID exists
        return {
          ...comp,
          type: normalizedType
        };
      });
  }

  return content;
}

/**
 * Populate page content tool
 *
 * Creates a WebsitePage and links it to an existing WebsiteStructure.
 * The WebsiteStructure must exist and not already have a page linked.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const populatePageContent = (tool as any)({
  description: `Populate content for an existing site structure entry.

Use this tool during greenfield content generation after site structure is established.
The tool creates a WebsitePage and links it to the WebsiteStructure.

PREREQUISITES:
- WebsiteStructure must already exist (created by createSiteStructure tool)
- Structure must not already have a page (websitePageId must be null)

The tool will:
1. Find the WebsiteStructure by websiteId + slug
2. Create a WebsitePage with the provided content
3. Link the page to the structure
4. Update iaStatus to 'complete'
5. Return the page info + IA metadata for context

Example input:
{
  "websiteId": "abc123",
  "slug": "about",
  "contentTypeId": "page-type-id",
  "content": { "components": [...] }
}`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    slug: z.string().describe('URL slug of the page to populate (matches WebsiteStructure.slug)'),
    contentTypeId: z.string().describe('The content type ID for the page'),
    content: z.record(z.any()).describe('The page content (typically { components: [...] })')
  }),

  execute: async (params: {
    websiteId: string;
    slug: string;
    contentTypeId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>;
  }) => {
    const startTime = Date.now();
    const { websiteId, slug, contentTypeId, content } = params;

    try {
      // Find the WebsiteStructure by websiteId + slug
      const structure = await prisma.websiteStructure.findFirst({
        where: {
          websiteId,
          slug
        },
        select: {
          id: true,
          slug: true,
          fullPath: true,
          websitePageId: true,
          iaMetadata: true,
          iaStatus: true,
          website: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!structure) {
        return {
          success: false,
          error: `WebsiteStructure not found for websiteId="${websiteId}" and slug="${slug}"`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Check if already populated - return success for idempotency (allows workflow retries)
      if (structure.websitePageId !== null) {
        console.info('[populatePageContent] Page already exists, returning existing', {
          websiteId,
          slug,
          pageId: structure.websitePageId
        });

        // Fetch existing page info
        const existingPage = await prisma.websitePage.findUnique({
          where: { id: structure.websitePageId },
          select: {
            id: true,
            title: true,
            type: true,
            websiteId: true,
            contentTypeId: true,
            status: true,
            createdAt: true
          }
        });

        return {
          success: true,
          page: existingPage ? {
            id: existingPage.id,
            title: existingPage.title,
            type: existingPage.type,
            websiteId: existingPage.websiteId,
            contentTypeId: existingPage.contentTypeId,
            status: existingPage.status,
            createdAt: existingPage.createdAt
          } : { id: structure.websitePageId },
          structure: {
            id: structure.id,
            slug: structure.slug,
            fullPath: structure.fullPath,
            iaStatus: structure.iaStatus
          },
          iaMetadata: structure.iaMetadata || null,
          alreadyExisted: true,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Validate content type exists
      const contentType = await prisma.contentType.findUnique({
        where: { id: contentTypeId },
        select: { id: true, name: true }
      });

      if (!contentType) {
        return {
          success: false,
          error: `ContentType not found: ${contentTypeId}`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Sanitize and ensure component IDs, then enhance visual quality
      const sanitizedContent = sanitizeAndEnsureComponentIds(content, slug);
      const processedContent = enhanceVisualQuality(sanitizedContent, slug);

      // Extract title from IA metadata or use slug
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const iaMetadata = structure.iaMetadata as Record<string, any> | null;
      const title = iaMetadata?.title || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

      // Create WebsitePage and update WebsiteStructure in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the WebsitePage
        const page = await tx.websitePage.create({
          data: {
            websiteId,
            contentTypeId,
            type: 'page',
            title,
            content: processedContent,
            status: 'draft'
          }
        });

        // Update WebsiteStructure to link the page and mark as complete
        const updatedStructure = await tx.websiteStructure.update({
          where: { id: structure.id },
          data: {
            websitePageId: page.id,
            iaStatus: 'complete'
          }
        });

        return { page, structure: updatedStructure };
      });

      return {
        success: true,
        page: {
          id: result.page.id,
          title: result.page.title,
          type: result.page.type,
          websiteId: result.page.websiteId,
          contentTypeId: result.page.contentTypeId,
          status: result.page.status,
          createdAt: result.page.createdAt
        },
        structure: {
          id: result.structure.id,
          slug: result.structure.slug,
          fullPath: result.structure.fullPath,
          iaStatus: result.structure.iaStatus
        },
        // Return IA metadata for cross-page consistency context
        iaMetadata: iaMetadata || null,
        executionTime: `${Date.now() - startTime}ms`
      };

    } catch (error) {
      console.error('[populatePageContent] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to populate page content',
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
