#!/usr/bin/env tsx

/**
 * Comprehensive Component Registry Generator
 *
 * This script generates a complete component registry that includes:
 * - All CMS components from the factory
 * - Global components
 * - Proper type definitions
 * - Lazy loading paths
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { cmsComponentFactory } from '../lib/studio/components/cms/_factory/factory';
import { ComponentType } from '../lib/studio/components/cms/_core/types';

interface RegistryEntry {
  name: string;
  path: string;
  category: string;
  hasAdapter: boolean;
  description?: string;
}

const COMPONENT_CATEGORIES = {
  navigation: ['navbar', 'sidemenu', 'breadcrumb', 'megamenu'],
  heroes: ['hero-simple', 'hero-with-image', 'hero-video', 'hero-carousel', 'hero-banner', 'hero-split', 'hero-minimal'],
  content: ['text-block', 'image-gallery', 'video-embed', 'accordion', 'two-column'],
  features: ['feature-grid', 'feature-list', 'feature-showcase', 'feature-comparison'],
  cta: ['cta-simple', 'cta-with-form', 'cta-banner'],
  'social-proof': ['testimonials', 'logo-cloud', 'reviews', 'case-study'],
  contact: ['contact-form', 'contact-info', 'location-map'],
  about: ['team-grid', 'timeline', 'mission'],
  blog: ['blog-post', 'blog-list', 'blog-card'],
  pricing: ['pricing-table', 'pricing-card', 'pricing-comparison'],
  data: ['data-table', 'chart', 'statistics']
};

function generateRegistry(): RegistryEntry[] {
  const registry: RegistryEntry[] = [];

  // Add CMS components (real components)
  const cmsComponentCategories = [
    { category: 'heroes', basePath: 'lib/studio/components/cms/heroes' },
    { category: 'features', basePath: 'lib/studio/components/cms/features' },
    { category: 'navigation', basePath: 'lib/studio/components/cms/navigation' },
    { category: 'cta', basePath: 'lib/studio/components/cms/cta' },
    { category: 'content', basePath: 'lib/studio/components/cms/content' },
    { category: 'about', basePath: 'lib/studio/components/cms/about' },
    { category: 'blog', basePath: 'lib/studio/components/cms/blog' },
    { category: 'contact', basePath: 'lib/studio/components/cms/contact' },
    { category: 'pricing', basePath: 'lib/studio/components/cms/pricing' },
    { category: 'social-proof', basePath: 'lib/studio/components/cms/social-proof' },
    { category: 'data', basePath: 'lib/studio/components/cms/data' }
  ];

  // Process real CMS components from directories
  cmsComponentCategories.forEach(({ category, basePath }) => {
    try {
      const componentDirs = fs.readdirSync(basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      componentDirs.forEach(componentName => {
        const componentPath = path.join(basePath, componentName);
        const indexPath = path.join(componentPath, 'index.tsx');

        // Check if component exists
        if (fs.existsSync(indexPath)) {
          registry.push({
            name: componentName,
            path: componentPath,
            category,
            hasAdapter: true,
            description: `${category} component: ${componentName}`
          });
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not process category ${category}:`, error);
    }
  });

  // Add CMS components based on ComponentType enum
  Object.values(ComponentType).forEach(type => {
    // Skip sub-components that shouldn't be top-level
    const subComponents = [
      'nav-menu-item', 'columnItem', 'socialLinkItem', 'breadcrumb',
      'accordion-item', 'tab-item', 'card-item', 'promo-item', 'quote-block',
      'feature-item', 'showcase-section', 'testimonial-item', 'team-member',
      'timeline-event', 'article-header', 'author-bio', 'related-posts'
    ];

    if (subComponents.includes(type)) {
      return; // Skip sub-components
    }

    // Determine category
    let category = 'content';
    for (const [catName, types] of Object.entries(COMPONENT_CATEGORIES)) {
      if (types.includes(type)) {
        category = catName;
        break;
      }
    }

    // Generate path based on category and type
    const categoryPath = category.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    let componentPath = `lib/studio/components/cms/${categoryPath}`;

    // Special handling for specific components
    if (type.includes('hero')) {
      componentPath = `lib/studio/components/cms/heroes`;
    } else if (type.includes('feature')) {
      componentPath = `lib/studio/components/cms/features`;
    } else if (type.includes('cta')) {
      componentPath = `lib/studio/components/cms/cta`;
    } else if (type.includes('testimonial') || type === 'logo-cloud' || type === 'reviews' || type === 'case-study') {
      componentPath = 'lib/studio/components/cms/social-proof';
    } else if (type.includes('contact')) {
      componentPath = 'lib/studio/components/cms/contact';
    } else if (type.includes('pricing')) {
      componentPath = 'lib/studio/components/cms/pricing';
    } else if (type.includes('blog')) {
      componentPath = 'lib/studio/components/cms/blog';
    } else if (type.includes('data') || type === 'chart' || type === 'statistics') {
      componentPath = 'lib/studio/components/cms/data';
    } else if (type.includes('team') || type === 'timeline' || type === 'mission') {
      componentPath = 'lib/studio/components/cms/about';
    } else if (type.includes('nav') || type === 'footer' || type === 'mobile-menu' || type === 'megamenu') {
      componentPath = 'lib/studio/components/cms/navigation';
    }

    registry.push({
      name: type,
      path: componentPath,
      category,
      hasAdapter: true,
      description: `${type.replace(/-/g, ' ')} component`
    });
  });

  return registry;
}

function generateRegistryFile(registry: RegistryEntry[]): string {
  const componentNames = registry.map(r => `'${r.name}'`).join(' | ');

  return `// Generated comprehensive component registry - DO NOT EDIT MANUALLY
// Run 'npm run generate:registry' to regenerate

export interface ComponentRegistryEntry {
  name: string;
  path: string;
  category: string;
  hasAdapter: boolean;
  description?: string;
}

export const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
${registry.map(entry => `  {
    "name": "${entry.name}",
    "path": "${entry.path}",
    "category": "${entry.category}",
    "hasAdapter": ${entry.hasAdapter},
    "description": "${entry.description || ''}"
  }`).join(',\n')}
];

// Export component names for type safety
export type ComponentName = ${componentNames};

// Helper function to get component by name
export function getComponentByName(name: string): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find(c => c.name === name);
}

// Helper function to get components by category
export function getComponentsByCategory(category: string): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter(c => c.category === category);
}

// Helper function to check if component exists
export function hasComponent(name: string): boolean {
  return COMPONENT_REGISTRY.some(c => c.name === name);
}

// Export category mappings
export const COMPONENT_CATEGORIES = {
${Object.entries(COMPONENT_CATEGORIES).map(([cat, types]) => `  ${cat}: [${types.map(t => `'${t}'`).join(', ')}]`).join(',\n')}
} as const;

export type ComponentCategory = keyof typeof COMPONENT_CATEGORIES;
`;
}

function generateLazyLoader(registry: RegistryEntry[]): string {
  return `// Generated lazy loader for components - DO NOT EDIT MANUALLY
// Run 'npm run generate:registry' to regenerate

import { ComponentType } from '../_core/types';
import { ComponentConstructor } from '../factory';

interface LazyComponentModule {
  default: ComponentConstructor;
  [key: string]: ComponentConstructor;
}

/**
 * Dynamic component loader with proper TypeScript types
 * Maps component types to their respective modules
 */
export const COMPONENT_LOADERS: Record<string, () => Promise<LazyComponentModule>> = {
${registry.map(entry => {
  const loaderName = entry.name.replace(/-/g, '');
  return `  [ComponentType.${loaderName.charAt(0).toUpperCase() + loaderName.slice(1)}]: (): Promise<LazyComponentModule> =>
    import('${entry.path}'),`;
}).join('\n')}
};

/**
 * Load a component dynamically
 */
export async function loadComponent(type: string): Promise<ComponentConstructor> {
  const loader = COMPONENT_LOADERS[type];

  if (!loader) {
    throw new Error(\`No loader found for component type: \${type}\`);
  }

  try {
    const module = await loader();
    // Try default export first, then specific named exports
    return module.default || Object.values(module).find(exp => typeof exp === 'function') as ComponentConstructor;
  } catch (error) {
    console.error(\`Failed to load component \${type}:\`, error);
    throw error;
  }
}

/**
 * Check if a component type has a lazy loader
 */
export function hasLoader(type: string): boolean {
  return type in COMPONENT_LOADERS;
}

/**
 * Get all available component types
 */
export function getAvailableComponentTypes(): string[] {
  return Object.keys(COMPONENT_LOADERS);
}
`;
}

function main() {
  try {
    console.log('🔧 Generating comprehensive component registry...');

    const registry = generateRegistry();
    console.log(`📝 Generated registry with ${registry.length} components`);

    // Write the main registry file
    const registryFile = generateRegistryFile(registry);
    writeFileSync(
      join(__dirname, '../lib/studio/components/component-registry.generated.ts'),
      registryFile
    );
    console.log('✅ Component registry generated');

    // Write the lazy loader file
    const loaderFile = generateLazyLoader(registry);
    writeFileSync(
      join(__dirname, '../lib/studio/components/component-lazy-loader.generated.ts'),
      loaderFile
    );
    console.log('✅ Component lazy loader generated');

    // Generate statistics
    const categoryStats = registry.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Registry Statistics:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} components`);
    });

    console.log('\n🎉 Component registry generation completed!');

  } catch (error) {
    console.error('❌ Failed to generate component registry:', error);
    process.exit(1);
  }
}

// Run the generator
if (require.main === module) {
  main();
}

export { generateRegistry, generateRegistryFile, generateLazyLoader };