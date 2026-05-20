#!/usr/bin/env tsx

/**
 * Comprehensive component registry generator.
 *
 * Scans the CMS component directories, detects concrete implementations,
 * and emits `lib/studio/components/component-registry.generated.ts`.
 *
 * The output powers runtime rendering (PageRendererHelper) and the export
 * pipeline by mapping each `ComponentType` to its implementation path and
 * canonical category.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ComponentType,
  ComponentCategory
} from '../lib/studio/components/cms/_core/types';
import { cmsComponentFactory } from '../lib/studio/components/cms/_factory/factory';
import { initializeCMSComponents } from '../lib/studio/components/cms/_factory/initialize';

type ComponentTypeValue = (typeof ComponentType)[keyof typeof ComponentType];
type ComponentCategoryValue =
  (typeof ComponentCategory)[keyof typeof ComponentCategory];

interface DetectedComponent {
  type: ComponentTypeValue;
  path: string;
  category: ComponentCategoryValue;
  hasAdapter: boolean;
  description?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cmsRoot = path.resolve(
  projectRoot,
  'lib',
  'studio',
  'components',
  'cms'
);
const outputPath = path.resolve(
  projectRoot,
  'lib',
  'studio',
  'components',
  'component-registry.generated.ts'
);

const componentTypeEntries = Object.entries(ComponentType) as Array<
  [keyof typeof ComponentType, ComponentTypeValue]
>;
const componentTypeByIdentifier = new Map(componentTypeEntries);
const componentTypeValues = new Set<ComponentTypeValue>(
  componentTypeEntries.map(([, value]) => value)
);
const componentTypeIdentifierByValue = new Map(
  componentTypeEntries.map(([identifier, value]) => [value, identifier])
);

const componentCategoryEntries = Object.entries(ComponentCategory) as Array<
  [keyof typeof ComponentCategory, ComponentCategoryValue]
>;
const componentCategoryIdentifierByValue = new Map(
  componentCategoryEntries.map(([identifier, value]) => [value, identifier])
);

const directoryCategoryMap: Record<string, ComponentCategoryValue> = {
  navigation: ComponentCategory.Navigation,
  heroes: ComponentCategory.Heroes,
  content: ComponentCategory.Content,
  features: ComponentCategory.Features,
  cta: ComponentCategory.CTA,
  'social-proof': ComponentCategory.SocialProof,
  contact: ComponentCategory.Contact,
  about: ComponentCategory.About,
  blog: ComponentCategory.Blog,
  pricing: ComponentCategory.Pricing,
  data: ComponentCategory.Data
};

const categoryOverrides: Partial<
  Record<ComponentTypeValue, ComponentCategoryValue>
> = {
  [ComponentType.Timeline]: ComponentCategory.About,
  [ComponentType.Mission]: ComponentCategory.About,
  [ComponentType.PricingTable]: ComponentCategory.Pricing,
  [ComponentType.PricingCard]: ComponentCategory.Pricing,
  [ComponentType.PricingComparison]: ComponentCategory.Pricing,
  [ComponentType.CTAWithForm]: ComponentCategory.CTA,
  [ComponentType.CTAButtonGroup]: ComponentCategory.CTA,
  [ComponentType.LogoCloud]: ComponentCategory.SocialProof,
  [ComponentType.Reviews]: ComponentCategory.SocialProof,
  [ComponentType.Testimonials]: ComponentCategory.SocialProof
};

const preferredPathByType: Partial<Record<ComponentTypeValue, string[]>> = {
  [ComponentType.PricingTable]: ['pricing/pricing-table'],
  [ComponentType.Testimonials]: ['social-proof/testimonial-grid'],
  // SideMenu maps to sidebar-nav implementation
  [ComponentType.SideMenu]: ['navigation/sidebar-nav']
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readDirectory(
  dirPath: string
): Promise<fs.Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    console.warn(`Skipping unreadable directory: ${dirPath}`, error);
    return [];
  }
}

function normalizeRelative(filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function collectTypeIdentifierMatches(
  source: string
): ComponentTypeValue[] {
  const matches = new Set<ComponentTypeValue>();

  const withInstrumentation = /withPerformanceTracking\(\s*[\s\S]*?ComponentType\.(\w+)\s*\)/m;
  let match = withInstrumentation.exec(source);
  if (match) {
    const identifier = match[1];
    const resolved = componentTypeByIdentifier.get(
      identifier as keyof typeof ComponentType
    );
    if (resolved) {
      matches.add(resolved);
    }
  }

  const generalUsage = /ComponentType\.(\w+)/g;
  while ((match = generalUsage.exec(source)) !== null) {
    const identifier = match[1];
    const resolved = componentTypeByIdentifier.get(
      identifier as keyof typeof ComponentType
    );
    if (resolved) {
      matches.add(resolved);
    }
  }

  return Array.from(matches);
}

async function detectComponentType(
  componentDir: string
): Promise<ComponentTypeValue | null> {
  const candidateFiles = [
    'index.tsx',
    'index.ts',
    'index.client.tsx',
    'index.server.tsx'
  ];

  for (const candidate of candidateFiles) {
    const candidatePath = path.join(componentDir, candidate);
    if (!(await pathExists(candidatePath))) {
      continue;
    }

    const contents = await fs.readFile(candidatePath, 'utf8');
    const detectedMatches = collectTypeIdentifierMatches(contents);
    if (detectedMatches.length > 0) {
      const folderName = path.basename(componentDir);
      const candidateFromFolder = folderName.replace(/_/g, '-');
      const preferred =
        detectedMatches.find(
          (value) =>
            value === candidateFromFolder ||
            value.replace(/-/g, '').toLowerCase() ===
              candidateFromFolder.replace(/-/g, '').toLowerCase(),
        ) ?? null;
      return preferred ?? detectedMatches[0];
    }
  }

  const folderName = path.basename(componentDir);
  const candidate = folderName.replace(/_/g, '-');
  if (componentTypeValues.has(candidate as ComponentTypeValue)) {
    return candidate as ComponentTypeValue;
  }

  const collapsed = candidate.replace(/-/g, '').toLowerCase();
  for (const value of componentTypeValues) {
    if (
      value.replace(/-/g, '').replace(/_/g, '').toLowerCase() === collapsed
    ) {
      return value;
    }
  }

  return null;
}

async function hasEntryModule(dirPath: string): Promise<boolean> {
  const candidateFiles = [
    'index.tsx',
    'index.ts',
    'index.client.tsx',
    'index.server.tsx'
  ];

  for (const candidate of candidateFiles) {
    if (await pathExists(path.join(dirPath, candidate))) {
      return true;
    }
  }

  return false;
}

function resolveCategory(
  type: ComponentTypeValue,
  componentPath: string
): ComponentCategoryValue | null {
  if (categoryOverrides[type]) {
    return categoryOverrides[type]!;
  }

  const segments = componentPath.split('/');
  const cmsIndex = segments.indexOf('cms');
  if (cmsIndex >= 0 && cmsIndex + 1 < segments.length) {
    const categoryDir = segments[cmsIndex + 1];
    const category = directoryCategoryMap[categoryDir];
    if (category) {
      return category;
    }
  }

  return null;
}

function shouldReplaceExistingComponent(
  type: ComponentTypeValue,
  existing: DetectedComponent,
  candidate: DetectedComponent
): boolean {
  const preferredFragments = preferredPathByType[type];
  if (preferredFragments && preferredFragments.length > 0) {
    const existingPreferred = preferredFragments.some(fragment =>
      existing.path.includes(fragment)
    );
    const candidatePreferred = preferredFragments.some(fragment =>
      candidate.path.includes(fragment)
    );

    if (existingPreferred !== candidatePreferred) {
      return candidatePreferred;
    }
  }

  return false;
}

async function discoverComponents(): Promise<{
  components: DetectedComponent[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const componentMap = new Map<ComponentTypeValue, DetectedComponent>();

  const categoryDirs = await readDirectory(cmsRoot);
  for (const categoryDir of categoryDirs) {
    if (!categoryDir.isDirectory()) continue;
    if (categoryDir.name.startsWith('_')) continue;

    const categoryPath = path.join(cmsRoot, categoryDir.name);
    const componentDirs = await readDirectory(categoryPath);

    for (const componentDir of componentDirs) {
      if (!componentDir.isDirectory()) continue;
      if (componentDir.name.startsWith('_')) continue;
      if (componentDir.name === 'utils') continue;

      const dirPath = path.join(categoryPath, componentDir.name);
      const hasEntry = await hasEntryModule(dirPath);
      if (!hasEntry) {
        continue;
      }

      const detectedType = await detectComponentType(dirPath);
      if (!detectedType) {
        warnings.push(
          `Could not detect ComponentType for ${normalizeRelative(dirPath)}`
        );
        continue;
      }

      const normalizedPath = normalizeRelative(dirPath);
      const category = resolveCategory(detectedType, normalizedPath);
      if (!category) {
        warnings.push(
          `Unable to resolve category for type "${detectedType}" (${normalizedPath})`
        );
        continue;
      }

      const candidate: DetectedComponent = {
        type: detectedType,
        path: normalizedPath,
        category,
        hasAdapter: true
      };

      const existing = componentMap.get(detectedType);
      if (existing) {
        const preferredFragments = preferredPathByType[detectedType] ?? [];
        const replace = shouldReplaceExistingComponent(
          detectedType,
          existing,
          candidate
        );

        if (replace) {
          componentMap.set(detectedType, candidate);
        } else if (preferredFragments.length === 0) {
          warnings.push(
            `Duplicate definition for type "${detectedType}" detected at ${normalizedPath}`
          );
        }
        continue;
      }

      componentMap.set(detectedType, candidate);
    }
  }

  // Add components from preferredPathByType that weren't discovered naturally
  // This handles alias types (e.g., SideMenu -> sidebar-nav)
  for (const [typeValue, preferredPaths] of Object.entries(preferredPathByType)) {
    if (componentMap.has(typeValue as ComponentTypeValue)) {
      continue; // Already discovered
    }

    for (const fragmentPath of preferredPaths as string[]) {
      const fullPath = path.join(cmsRoot, fragmentPath);
      const hasEntry = await hasEntryModule(fullPath);
      if (!hasEntry) {
        continue;
      }

      const normalizedPath = normalizeRelative(fullPath);
      const category = resolveCategory(typeValue as ComponentTypeValue, normalizedPath);
      if (!category) {
        warnings.push(
          `Unable to resolve category for aliased type "${typeValue}" (${normalizedPath})`
        );
        continue;
      }

      componentMap.set(typeValue as ComponentTypeValue, {
        type: typeValue as ComponentTypeValue,
        path: normalizedPath,
        category,
        hasAdapter: true
      });
      break; // Use first valid path
    }
  }

  const uniqueComponents = Array.from(componentMap.values());
  const enriched = await enrichWithRegistryMetadata(uniqueComponents);
  warnings.push(...enriched.warnings);

  return { components: enriched.components, warnings };
}

function buildFileContents(components: DetectedComponent[]): string {
  const header = `// Generated component registry - DO NOT EDIT MANUALLY
// Run 'npm run build:components' to regenerate

import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types';

export interface ComponentRegistryEntry {
  name: ComponentType;
  path: string;
  category: ComponentCategory;
  hasAdapter: boolean;
  description?: string;
}

export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
`;

  const body = components
    .map(component => {
      const typeIdentifier =
        componentTypeIdentifierByValue.get(component.type) ??
        (() => {
          throw new Error(`Missing ComponentType identifier for ${component.type}`);
        })();

      const categoryIdentifier =
        componentCategoryIdentifierByValue.get(component.category) ??
        (() => {
          throw new Error(`Missing ComponentCategory identifier for ${component.category}`);
        })();

      const descriptionLine = component.description
        ? `,\n    description: ${JSON.stringify(component.description)}`
        : '';

      return `  {
    name: ComponentType.${typeIdentifier},
    path: '${component.path}',
    category: ComponentCategory.${categoryIdentifier},
    hasAdapter: ${component.hasAdapter}${descriptionLine}
  }`;
    })
    .join(',\n');

  const footer = `
];

export function getComponentByName(name: ComponentType): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find(entry => entry.name === name);
}

export function getComponentsByCategory(category: ComponentCategory): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter(entry => entry.category === category);
}

export function hasComponent(name: ComponentType): boolean {
  return COMPONENT_REGISTRY.some(entry => entry.name === name);
}
`;

  return `${header}${body}\n${footer}`;
}

function sortComponents(components: DetectedComponent[]): DetectedComponent[] {
  return components.slice().sort((a, b) => {
    if (a.category === b.category) {
      return a.type.localeCompare(b.type);
    }
    return a.category.localeCompare(b.category);
  });
}

async function enrichWithRegistryMetadata(
  components: DetectedComponent[]
): Promise<{ components: DetectedComponent[]; warnings: string[] }> {
  const warnings: string[] = [];
  await initializeCMSComponents();
  const registry = cmsComponentFactory.getRegistry();

  const filtered: DetectedComponent[] = [];

  components.forEach(component => {
    const registryEntry = registry.get(component.type as ComponentType);
    if (!registryEntry) {
      warnings.push(
        `Component type "${component.type}" is not registered in CMS factory.`
      );
      return;
    }

    const isSubOnly = Boolean((registryEntry as { subOnly?: boolean }).subOnly);
    if (isSubOnly) {
      return;
    }

    filtered.push({
      ...component,
      hasAdapter: !isSubOnly,
      description: registryEntry.description
    });
  });

  return { components: filtered, warnings };
}

async function main(): Promise<void> {
  const { components, warnings } = await discoverComponents();
  const sorted = sortComponents(components);
  const contents = buildFileContents(sorted);

  await fs.writeFile(outputPath, contents, 'utf8');

  console.log(`✓ Generated component registry with ${sorted.length} entries.`);
  if (warnings.length > 0) {
    console.warn('Warnings encountered while generating registry:');
    warnings.forEach(warning => console.warn(`  • ${warning}`));
  }
}

main()
  .then(() => {
    const exitCode =
      typeof process.exitCode === 'number' ? process.exitCode : 0;
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('✗ Failed to generate component registry:', error);
    process.exit(1);
  });
