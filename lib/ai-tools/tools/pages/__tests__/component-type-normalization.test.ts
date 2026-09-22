/**
 * @jest-environment node
 */

/**
 * Guards COMPONENT_TYPE_NORMALIZATION_MAP against pointing at component types
 * that do not exist.
 *
 * The map runs at write time (populatePageContent) and the type it emits is
 * stored verbatim on the page. The renderer looks that string up directly in
 * the CMS component factory - no alias resolution happens on this path - so an
 * unregistered value makes the whole page render throw
 * ("Component type is not registered: <type>").
 */

jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import { COMPONENT_TYPE_NORMALIZATION_MAP } from '../populate-page-content';
import { ComponentType } from '@/lib/studio/components/cms/_core/types';
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated';

describe('COMPONENT_TYPE_NORMALIZATION_MAP', () => {
  const registeredTypes = new Set<string>(Object.values(ComponentType) as string[]);
  const builtTypes = new Set<string>(COMPONENT_REGISTRY.map(entry => String(entry.name)));

  it('has entries', () => {
    expect(Object.keys(COMPONENT_TYPE_NORMALIZATION_MAP).length).toBeGreaterThan(0);
  });

  it('maps every key to a component type that exists in the ComponentType enum', () => {
    const invalid = Object.entries(COMPONENT_TYPE_NORMALIZATION_MAP)
      .filter(([, value]) => !registeredTypes.has(value))
      .map(([key, value]) => `${key} -> ${value}`);

    expect(invalid).toEqual([]);
  });

  it('maps every key to a component type that is present in the component registry', () => {
    const missing = Object.entries(COMPONENT_TYPE_NORMALIZATION_MAP)
      .filter(([, value]) => !builtTypes.has(value))
      .map(([key, value]) => `${key} -> ${value}`);

    expect(missing).toEqual([]);
  });

  it('normalizes stats section names to the statistics component', () => {
    for (const key of [
      'stats',
      'stats-section',
      'stats-highlights',
      'key-stats',
      'metrics',
      'numbers',
      'by-the-numbers',
    ]) {
      expect(COMPONENT_TYPE_NORMALIZATION_MAP[key]).toBe(ComponentType.Statistics);
    }
  });
});
