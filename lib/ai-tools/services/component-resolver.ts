/**
 * Component Resolver Service
 *
 * Provides fuzzy matching to resolve human-readable component descriptions
 * to specific component instance IDs within a page.
 */

export interface ComponentInstance {
  id: string;
  type: string;
  props?: Record<string, unknown>;
}

export interface ComponentSearchCriteria {
  type?: string;
  typePattern?: string;
  position?: 'first' | 'last' | number;
  instanceId?: string;
  containsText?: string;
  propMatch?: Record<string, unknown>;
}

export interface ComponentMatch {
  instanceId: string;
  type: string;
  index: number;
  props: Record<string, unknown>;
  confidence: number;
  matchReason: string;
}

export interface ComponentResolutionResult {
  matches: ComponentMatch[];
  exactMatch: boolean;
}

/**
 * Resolve component search criteria to matching components within page content
 */
export function resolveComponent(
  pageContent: Record<string, unknown> | null,
  search: ComponentSearchCriteria
): ComponentResolutionResult {
  if (!pageContent) {
    return { matches: [], exactMatch: false };
  }

  // Extract components array from page content
  const components = extractComponents(pageContent);

  if (components.length === 0) {
    return { matches: [], exactMatch: false };
  }

  // Direct instance ID lookup (highest confidence)
  if (search.instanceId) {
    const index = components.findIndex(c => c.id === search.instanceId);
    if (index >= 0) {
      const comp = components[index];
      return {
        matches: [{
          instanceId: comp.id,
          type: comp.type,
          index,
          props: comp.props || {},
          confidence: 1.0,
          matchReason: 'Direct instance ID match'
        }],
        exactMatch: true
      };
    }
    return { matches: [], exactMatch: false };
  }

  // Position-based lookup
  if (search.position !== undefined) {
    const filteredComponents = search.type || search.typePattern
      ? components.filter(c => matchesType(c.type, search))
      : components;

    if (filteredComponents.length === 0) {
      return { matches: [], exactMatch: false };
    }

    let targetComponent: ComponentInstance | null = null;
    let targetIndex: number = -1;

    if (search.position === 'first') {
      targetComponent = filteredComponents[0];
      targetIndex = components.indexOf(targetComponent);
    } else if (search.position === 'last') {
      targetComponent = filteredComponents[filteredComponents.length - 1];
      targetIndex = components.indexOf(targetComponent);
    } else if (typeof search.position === 'number') {
      if (search.position >= 0 && search.position < filteredComponents.length) {
        targetComponent = filteredComponents[search.position];
        targetIndex = components.indexOf(targetComponent);
      }
    }

    if (targetComponent && targetIndex >= 0) {
      return {
        matches: [{
          instanceId: targetComponent.id,
          type: targetComponent.type,
          index: targetIndex,
          props: targetComponent.props || {},
          confidence: 0.95,
          matchReason: `Position match: ${search.position}`
        }],
        exactMatch: true
      };
    }

    return { matches: [], exactMatch: false };
  }

  // Fuzzy matching for all components
  const matches = components
    .map((component, index) => {
      const { confidence, reason } = calculateComponentConfidence(component, search);
      return {
        instanceId: component.id,
        type: component.type,
        index,
        props: component.props || {},
        confidence,
        matchReason: reason
      };
    })
    .filter(m => m.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence);

  // Check if we have an exact match
  const exactMatch = matches.length === 1 && matches[0].confidence >= 0.9;

  return { matches, exactMatch };
}

/**
 * Extract components array from various page content structures
 */
function extractComponents(content: Record<string, unknown>): ComponentInstance[] {
  // Try direct components array
  if (Array.isArray(content.components)) {
    return content.components as ComponentInstance[];
  }

  // Try content.components (nested structure)
  if (content.content && typeof content.content === 'object') {
    const innerContent = content.content as Record<string, unknown>;
    if (Array.isArray(innerContent.components)) {
      return innerContent.components as ComponentInstance[];
    }
  }

  // Try blocks array (alternative structure)
  if (Array.isArray(content.blocks)) {
    return content.blocks as ComponentInstance[];
  }

  return [];
}

/**
 * Check if component type matches search criteria
 */
function matchesType(componentType: string, search: ComponentSearchCriteria): boolean {
  const normalizedType = componentType.toLowerCase();

  // Exact type match
  if (search.type) {
    const searchType = search.type.toLowerCase();
    if (normalizedType === searchType) return true;
    // Allow partial match (e.g., "hero" matches "hero-simple")
    if (normalizedType.startsWith(searchType)) return true;
  }

  // Pattern match (e.g., "hero*" matches "hero-simple", "hero-centered")
  if (search.typePattern) {
    const pattern = search.typePattern.toLowerCase().replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(normalizedType)) return true;
  }

  return false;
}

/**
 * Calculate confidence score for component match
 */
function calculateComponentConfidence(
  component: ComponentInstance,
  search: ComponentSearchCriteria
): { confidence: number; reason: string } {
  let score = 0;
  let criteriaCount = 0;
  const reasons: string[] = [];

  // Type matching
  if (search.type || search.typePattern) {
    criteriaCount++;
    const normalizedType = component.type.toLowerCase();

    if (search.type) {
      const searchType = search.type.toLowerCase();
      if (normalizedType === searchType) {
        score += 1.0;
        reasons.push(`Exact type match: ${component.type}`);
      } else if (normalizedType.startsWith(searchType)) {
        score += 0.8;
        reasons.push(`Type starts with: ${search.type}`);
      } else if (normalizedType.includes(searchType)) {
        score += 0.5;
        reasons.push(`Type contains: ${search.type}`);
      }
    }

    if (search.typePattern) {
      const pattern = search.typePattern.toLowerCase().replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(normalizedType)) {
        score += 0.9;
        reasons.push(`Pattern match: ${search.typePattern}`);
      }
    }
  }

  // Text content matching
  if (search.containsText && component.props) {
    criteriaCount++;
    const searchText = search.containsText.toLowerCase();
    const propsJson = JSON.stringify(component.props).toLowerCase();

    if (propsJson.includes(searchText)) {
      score += 0.85;
      reasons.push(`Contains text: "${search.containsText}"`);
    }
  }

  // Property value matching
  if (search.propMatch && component.props) {
    criteriaCount++;
    let propMatches = 0;
    const propKeys = Object.keys(search.propMatch);

    for (const key of propKeys) {
      const expectedValue = search.propMatch[key];
      const actualValue = component.props[key];

      if (actualValue !== undefined) {
        if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
          if (actualValue.toLowerCase().includes(expectedValue.toLowerCase())) {
            propMatches++;
          }
        } else if (actualValue === expectedValue) {
          propMatches++;
        }
      }
    }

    if (propMatches > 0) {
      const matchRatio = propMatches / propKeys.length;
      score += matchRatio * 0.9;
      reasons.push(`Property match: ${propMatches}/${propKeys.length} props`);
    }
  }

  // If no specific criteria, give baseline score based on common component types
  if (criteriaCount === 0) {
    // Hero components are often what users want to edit
    if (component.type.toLowerCase().includes('hero')) {
      return { confidence: 0.4, reason: 'Default: Hero component (common target)' };
    }
    // CTA components are also frequently edited
    if (component.type.toLowerCase().includes('cta')) {
      return { confidence: 0.35, reason: 'Default: CTA component (common target)' };
    }
    return { confidence: 0.1, reason: 'No matching criteria' };
  }

  const finalScore = criteriaCount > 0 ? score / criteriaCount : 0;
  return {
    confidence: finalScore,
    reason: reasons.join('; ') || 'No specific match'
  };
}

/**
 * Format a component match for display to user
 */
export function formatComponentDescription(match: ComponentMatch): string {
  const position = match.index === 0 ? 'first' : match.index === 1 ? 'second' : `position ${match.index}`;

  // Try to extract a meaningful identifier from props
  const heading = match.props.heading || match.props.title || match.props.text;
  const headingPreview = heading
    ? ` with heading: "${String(heading).slice(0, 30)}${String(heading).length > 30 ? '...' : ''}"`
    : '';

  return `${match.type} (${position})${headingPreview}`;
}
