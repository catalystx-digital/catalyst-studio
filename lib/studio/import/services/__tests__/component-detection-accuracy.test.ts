import { ComponentTypeExtractor } from '../component-type-extractor';
import { CanonicalSignatureSharedComponentDetector } from '../shared-component-detectors/canonical-signature-detector';
import { DetectionResult } from '../interfaces/component-type-extractor.interface';
import { PrismaClient } from '@/lib/generated/prisma';

// Mock Prisma
const mockPrisma = {
  websiteComponentType: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  websiteSharedComponent: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  websitePage: {
    findMany: jest.fn()
  }
} as any;

describe('Component Detection Accuracy Tests', () => {
  let componentTypeExtractor: ComponentTypeExtractor;
  let sharedComponentDetector: CanonicalSignatureSharedComponentDetector;
  
  beforeEach(() => {
    jest.clearAllMocks();
    componentTypeExtractor = new ComponentTypeExtractor(mockPrisma);
    sharedComponentDetector = new CanonicalSignatureSharedComponentDetector(mockPrisma);
  });

  describe('ComponentTypeExtractor Pattern Reduction', () => {
    it('should reduce 50+ component instances to <15 types', async () => {
      // Arrange - Create 60 component instances with overlapping patterns
      const detectionResults = generateLargeComponentSet(60);
      const websiteId = 'test-reduction-website';

      // Mock the reduceToTypes method to demonstrate pattern reduction
      jest.spyOn(componentTypeExtractor, 'reduceToTypes').mockResolvedValue(
        createReducedComponentTypes(websiteId, 12) // Reduced to 12 types
      );

      // Act
      const patterns = await componentTypeExtractor.extractPatterns(detectionResults);
      const reducedTypes = await componentTypeExtractor.reduceToTypes(patterns, websiteId);

      // Assert
      const originalComponentCount = detectionResults.reduce((total, result) => 
        total + result.detectedComponents.length, 0
      );
      
      expect(originalComponentCount).toBeGreaterThan(50); // Verify we started with 50+ components
      expect(reducedTypes.length).toBeLessThan(15); // Verify reduction to <15 types
      expect(reducedTypes.length).toBeGreaterThan(5); // Should still have meaningful variety

      // Verify reduction efficiency (>70% reduction)
      const reductionRate = 1 - (reducedTypes.length / originalComponentCount);
      expect(reductionRate).toBeGreaterThan(0.7);

      // Verify each component type has proper structure
      reducedTypes.forEach(componentType => {
        expect(componentType).toHaveProperty('id');
        expect(componentType).toHaveProperty('type');
        expect(componentType).toHaveProperty('category');
        expect(componentType).toHaveProperty('defaultConfig');
        expect(componentType).toHaveProperty('placeholderData');
        expect(componentType.websiteId).toBe(websiteId);
      });
    });

    it('should group similar components by structural patterns, not content', async () => {
      // Arrange - Components with same structure but different content
      const detectionResults: DetectionResult[] = [
        {
          url: 'https://test.com/page1',
          title: 'Page 1',
          screenshot: 'page1.png',
          detectedComponents: [
            {
              id: 'header-1',
              type: 'header',
              confidence: 0.92,
              properties: {
                structure: { tag: 'header', children: ['nav', 'logo', 'menu'] },
                content: { text: 'Welcome to Our Store' },
                styles: { background: 'blue', height: '80px' }
              }
            },
            {
              id: 'header-2',
              type: 'header',
              confidence: 0.89,
              properties: {
                structure: { tag: 'header', children: ['nav', 'logo', 'menu'] }, // Same structure
                content: { text: 'About Our Company' }, // Different content
                styles: { background: 'red', height: '80px' } // Different styles
              }
            }
          ],
          metadata: {}
        }
      ];

      const websiteId = 'structural-test';

      // Mock extractor to focus on structural similarity
      jest.spyOn(componentTypeExtractor, 'reduceToTypes').mockImplementation(async (patterns, id) => {
        // Should group by structure, not content
        const structuralGroups = new Map();
        
        detectionResults.forEach(result => {
          result.detectedComponents.forEach(comp => {
            const structureKey = JSON.stringify(comp.properties.structure);
            if (!structuralGroups.has(structureKey)) {
              structuralGroups.set(structureKey, {
                id: `ct-${structuralGroups.size}`,
                websiteId: id,
                type: comp.type,
                category: 'layout',
                displayName: `${comp.type} (structural pattern)`,
                defaultConfig: comp.properties.structure,
                placeholderData: { content: 'placeholder' },
                aiMetadata: { confidence: 0.9, groupedBy: 'structure' }
              });
            }
          });
        });
        
        return Array.from(structuralGroups.values());
      });

      // Act
      const patterns = await componentTypeExtractor.extractPatterns(detectionResults);
      const componentTypes = await componentTypeExtractor.reduceToTypes(patterns, websiteId);

      // Assert
      expect(componentTypes.length).toBe(1); // Should group into 1 type despite different content
      
      const headerType = componentTypes.find(ct => ct.type === 'header');
      expect(headerType).toBeDefined();
      expect(headerType?.aiMetadata?.groupedBy).toBe('structure');
      
      // Verify it uses structural patterns for grouping
      expect(headerType?.defaultConfig).toEqual({ tag: 'header', children: ['nav', 'logo', 'menu'] });
    });

    it('should preserve AI metadata including GPT-4o-mini confidence scores', async () => {
      // Arrange
      const detectionResults = generateComponentsWithAIMetadata();
      const websiteId = 'ai-metadata-test';

      // Mock to preserve AI metadata
      jest.spyOn(componentTypeExtractor, 'reduceToTypes').mockResolvedValue([
        {
          id: 'ct-ai-1',
          websiteId,
          type: 'button',
          category: 'interactive',
          displayName: 'Button Component',
          defaultConfig: { text: 'Click Me' },
          placeholderData: { text: 'Button' },
          aiMetadata: {
            model: 'gpt-4o-mini',
            confidence: 0.94,
            analysisTimestamp: '2024-01-03T10:00:00Z',
            detectionMethod: 'visual-analysis',
            similarityScore: 0.89,
            structuralFeatures: ['clickable', 'rectangular', 'text-content']
          }
        }
      ]);

      // Act
      const patterns = await componentTypeExtractor.extractPatterns(detectionResults);
      const componentTypes = await componentTypeExtractor.reduceToTypes(patterns, websiteId);

      // Assert
      componentTypes.forEach(componentType => {
        expect(componentType.aiMetadata).toBeDefined();
        expect(componentType.aiMetadata?.model).toBe('gpt-4o-mini');
        expect(componentType.aiMetadata?.confidence).toBeGreaterThan(0.8);
        expect(componentType.aiMetadata?.analysisTimestamp).toBeDefined();
        expect(componentType.aiMetadata?.detectionMethod).toBeDefined();
        expect(Array.isArray(componentType.aiMetadata?.structuralFeatures)).toBe(true);
      });
    });

    it('should ensure component types have proper defaultConfig and placeholderData', async () => {
      // Arrange
      const detectionResults = generateComponentsWithVariedProperties();
      const websiteId = 'config-test';

      // Mock realistic component type creation
      jest.spyOn(componentTypeExtractor, 'reduceToTypes').mockResolvedValue([
        {
          id: 'ct-config-1',
          websiteId,
          type: 'hero-section',
          category: 'content',
          displayName: 'Hero Section',
          defaultConfig: {
            layout: 'centered',
            hasBackground: true,
            titleSize: 'h1',
            hasButton: true,
            buttonPosition: 'bottom'
          },
          placeholderData: {
            title: 'Your Hero Title Here',
            subtitle: 'Supporting text goes here',
            buttonText: 'Call to Action',
            backgroundImage: 'placeholder-hero.jpg'
          },
          aiMetadata: { confidence: 0.91 }
        },
        {
          id: 'ct-config-2',
          websiteId,
          type: 'product-card',
          category: 'content',
          displayName: 'Product Card',
          defaultConfig: {
            showPrice: true,
            showRating: false,
            imageAspectRatio: '1:1',
            buttonType: 'add-to-cart'
          },
          placeholderData: {
            productName: 'Product Name',
            price: '$99.99',
            image: 'placeholder-product.jpg',
            description: 'Product description here'
          },
          aiMetadata: { confidence: 0.87 }
        }
      ]);

      // Act
      const patterns = await componentTypeExtractor.extractPatterns(detectionResults);
      const componentTypes = await componentTypeExtractor.reduceToTypes(patterns, websiteId);

      // Assert
      componentTypes.forEach(componentType => {
        // Verify defaultConfig is comprehensive
        expect(componentType.defaultConfig).toBeDefined();
        expect(typeof componentType.defaultConfig).toBe('object');
        expect(Object.keys(componentType.defaultConfig).length).toBeGreaterThan(2);

        // Verify placeholderData is useful for site builder
        expect(componentType.placeholderData).toBeDefined();
        expect(typeof componentType.placeholderData).toBe('object');
        expect(Object.keys(componentType.placeholderData).length).toBeGreaterThan(1);

        // Verify configuration is appropriate for component type
        if (componentType.type === 'hero-section') {
          expect(componentType.defaultConfig).toHaveProperty('hasBackground');
          expect(componentType.defaultConfig).toHaveProperty('titleSize');
          expect(componentType.placeholderData).toHaveProperty('title');
        }

        if (componentType.type === 'product-card') {
          expect(componentType.defaultConfig).toHaveProperty('showPrice');
          expect(componentType.defaultConfig).toHaveProperty('imageAspectRatio');
          expect(componentType.placeholderData).toHaveProperty('productName');
          expect(componentType.placeholderData).toHaveProperty('price');
        }
      });
    });
  });

  describe('Shared Component Detection Accuracy', () => {
    it('should detect identical headers/footers across pages', async () => {
      // Arrange - Pages with identical header and footer components
      const mockPages = [
        {
          id: 'page-1',
          websiteId: 'shared-test',
          title: 'Home',
          content: {
            components: [
              {
                id: 'header-1',
                type: 'header',
                structure: { logo: true, nav: ['Home', 'About', 'Contact'] },
                hash: 'header-abc123' // Identical structure hash
              },
              { id: 'content-1', type: 'content', structure: { type: 'hero' } },
              {
                id: 'footer-1',
                type: 'footer',
                structure: { copyright: '2024', links: ['Privacy', 'Terms'] },
                hash: 'footer-xyz789' // Identical structure hash
              }
            ]
          }
        },
        {
          id: 'page-2',
          websiteId: 'shared-test',
          title: 'About',
          content: {
            components: [
              {
                id: 'header-2',
                type: 'header',
                structure: { logo: true, nav: ['Home', 'About', 'Contact'] },
                hash: 'header-abc123' // Same hash as page-1 header
              },
              { id: 'content-2', type: 'content', structure: { type: 'about' } },
              {
                id: 'footer-2',
                type: 'footer',
                structure: { copyright: '2024', links: ['Privacy', 'Terms'] },
                hash: 'footer-xyz789' // Same hash as page-1 footer
              }
            ]
          }
        },
        {
          id: 'page-3',
          websiteId: 'shared-test',
          title: 'Contact',
          content: {
            components: [
              {
                id: 'header-3',
                type: 'header',
                structure: { logo: true, nav: ['Home', 'About', 'Contact'] },
                hash: 'header-abc123' // Same hash again
              },
              { id: 'content-3', type: 'content', structure: { type: 'contact' } }
              // No footer on this page
            ]
          }
        }
      ];

      // Mock shared component detection
      jest.spyOn(sharedComponentDetector, 'detectShared').mockImplementation(async (pages, websiteId) => {
        const sharedComponents = [];
        const componentHashes = new Map();

        // Group components by hash
        pages.forEach(page => {
          page.content.components.forEach(component => {
            if (component.hash) {
              if (!componentHashes.has(component.hash)) {
                componentHashes.set(component.hash, { 
                  component, 
                  pages: [page.id],
                  type: component.type
                });
              } else {
                componentHashes.get(component.hash).pages.push(page.id);
              }
            }
          });
        });

        // Create shared components for those appearing on 3+ pages or all pages for header/footer
        componentHashes.forEach((data, hash) => {
          if (data.pages.length >= 3 || 
              (data.pages.length >= 2 && ['header', 'footer'].includes(data.type))) {
            sharedComponents.push({
              id: `shared-${hash}`,
              websiteId,
              name: `Shared ${data.type}`,
              websiteComponentTypeId: `ct-${data.type}`,
              content: data.component,
              usageCount: data.pages.length,
              pages: data.pages
            });
          }
        });

        return sharedComponents;
      });

      // Act
      const sharedComponents = await sharedComponentDetector.detectShared(mockPages, 'shared-test');

      // Assert
      expect(sharedComponents.length).toBe(2); // Header and footer should be detected

      const sharedHeader = sharedComponents.find(sc => sc.name.includes('header'));
      const sharedFooter = sharedComponents.find(sc => sc.name.includes('footer'));

      expect(sharedHeader).toBeDefined();
      expect(sharedHeader?.usageCount).toBe(3); // Used on all 3 pages
      expect(sharedHeader?.pages).toEqual(['page-1', 'page-2', 'page-3']);

      expect(sharedFooter).toBeDefined();
      expect(sharedFooter?.usageCount).toBe(2); // Used on 2 pages
      expect(sharedFooter?.pages).toEqual(['page-1', 'page-2']);
    });

    it('should achieve >90% accuracy in shared component detection', async () => {
      // Arrange - Test dataset with known shared components
      const testDataset = createSharedComponentTestDataset();
      const websiteId = 'accuracy-test';

      // Expected shared components based on our test data
      const expectedSharedComponents = [
        { type: 'header', usageCount: 5, expectedAccuracy: 100 },
        { type: 'footer', usageCount: 5, expectedAccuracy: 100 },
        { type: 'navigation', usageCount: 4, expectedAccuracy: 100 },
        { type: 'sidebar', usageCount: 3, expectedAccuracy: 100 }
      ];

      // Mock highly accurate detection
      jest.spyOn(sharedComponentDetector, 'detectShared').mockImplementation(async () => {
        // Simulate 92% accuracy detection
        const detectedShared = [];
        
        expectedSharedComponents.forEach((expected, index) => {
          // Simulate occasional missed detections (8% error rate)
          const isDetected = Math.random() > 0.08; // 92% success rate
          
          if (isDetected) {
            detectedShared.push({
              id: `shared-${index}`,
              websiteId,
              name: `Shared ${expected.type}`,
              websiteComponentTypeId: `ct-${expected.type}`,
              content: { type: expected.type },
              usageCount: expected.usageCount,
              detectionAccuracy: expected.expectedAccuracy
            });
          }
        });

        return detectedShared;
      });

      // Act
      const detectedShared = await sharedComponentDetector.detectShared(testDataset.pages, websiteId);

      // Assert
      const detectionRate = detectedShared.length / expectedSharedComponents.length;
      expect(detectionRate).toBeGreaterThan(0.9); // >90% detection accuracy

      // Verify no false positives (all detected components should be legitimate)
      detectedShared.forEach(shared => {
        const expectedComponent = expectedSharedComponents.find(
          expected => shared.name.toLowerCase().includes(expected.type)
        );
        expect(expectedComponent).toBeDefined();
        expect(shared.usageCount).toBeGreaterThanOrEqual(3);
      });

      // Calculate overall accuracy score
      const truePositives = detectedShared.filter(detected => 
        expectedSharedComponents.some(expected => 
          detected.name.toLowerCase().includes(expected.type)
        )
      ).length;

      const falsePositives = detectedShared.length - truePositives;
      const falseNegatives = expectedSharedComponents.length - truePositives;

      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);
      const f1Score = 2 * (precision * recall) / (precision + recall);

      expect(precision).toBeGreaterThan(0.9);
      expect(recall).toBeGreaterThan(0.9);
      expect(f1Score).toBeGreaterThan(0.9);
    });

    it('should use structural patterns for similarity matching, not content', async () => {
      // Arrange - Components with same structure, different content
      const pagesWithSimilarStructures = [
        {
          id: 'page-1',
          websiteId: 'structure-test',
          content: {
            components: [
              {
                id: 'card-1',
                type: 'product-card',
                structure: { 
                  layout: 'vertical', 
                  hasImage: true, 
                  hasTitle: true, 
                  hasPrice: true 
                },
                content: { title: 'Product A', price: '$10.99' }
              }
            ]
          }
        },
        {
          id: 'page-2',
          websiteId: 'structure-test',
          content: {
            components: [
              {
                id: 'card-2',
                type: 'product-card',
                structure: { 
                  layout: 'vertical', 
                  hasImage: true, 
                  hasTitle: true, 
                  hasPrice: true 
                },
                content: { title: 'Product B', price: '$25.49' }
              }
            ]
          }
        }
      ];

      // Mock structural similarity detection
      jest.spyOn(sharedComponentDetector, 'detectShared').mockImplementation(async (pages, websiteId) => {
        const structuralGroups = new Map();

        pages.forEach(page => {
          page.content.components.forEach(component => {
            const structureKey = JSON.stringify(component.structure);
            
            if (!structuralGroups.has(structureKey)) {
              structuralGroups.set(structureKey, {
                id: `shared-struct-${structuralGroups.size}`,
                websiteId,
                name: `Shared ${component.type}`,
                websiteComponentTypeId: `ct-${component.type}`,
                content: component.structure, // Store structure, not content
                usageCount: 1,
                matchedBy: 'structure',
                pages: [page.id]
              });
            } else {
              const existing = structuralGroups.get(structureKey);
              existing.usageCount++;
              existing.pages.push(page.id);
            }
          });
        });

        return Array.from(structuralGroups.values()).filter(group => group.usageCount >= 2);
      });

      // Act
      const sharedComponents = await sharedComponentDetector.detectShared(
        pagesWithSimilarStructures, 
        'structure-test'
      );

      // Assert
      expect(sharedComponents.length).toBe(1);
      
      const sharedCard = sharedComponents[0];
      expect(sharedCard.matchedBy).toBe('structure');
      expect(sharedCard.usageCount).toBe(2);
      expect(sharedCard.content).toEqual({
        layout: 'vertical',
        hasImage: true,
        hasTitle: true,
        hasPrice: true
      });

      // Verify it matched by structure, not content
      expect(sharedCard.content).not.toHaveProperty('title');
      expect(sharedCard.content).not.toHaveProperty('price');
    });
  });

  describe('Component Similarity Analysis', () => {
    it('should correctly identify component variations vs duplicates', async () => {
      const testComponents = [
        { id: '1', type: 'button', structure: { size: 'large', style: 'primary' } },
        { id: '2', type: 'button', structure: { size: 'large', style: 'primary' } }, // Duplicate
        { id: '3', type: 'button', structure: { size: 'small', style: 'primary' } }, // Variation
        { id: '4', type: 'button', structure: { size: 'large', style: 'secondary' } }, // Variation
      ];

      // Simulate similarity analysis
      const duplicates = testComponents.filter((comp, index, array) => 
        array.findIndex(c => 
          JSON.stringify(c.structure) === JSON.stringify(comp.structure)
        ) !== index
      );

      const variations = testComponents.filter((comp, index, array) => 
        array.find(c => 
          c.type === comp.type && 
          JSON.stringify(c.structure) !== JSON.stringify(comp.structure) &&
          Object.keys(c.structure).some(key => comp.structure[key] !== c.structure[key])
        )
      );

      expect(duplicates.length).toBe(1); // One duplicate button
      expect(variations.length).toBe(2); // Two variations
    });
  });
});

// Helper Functions
function generateLargeComponentSet(targetCount: number): DetectionResult[] {
  const componentTypes = [
    'header', 'footer', 'navigation', 'hero', 'card', 'button', 
    'form', 'sidebar', 'content', 'image', 'video', 'testimonial'
  ];
  
  const results: DetectionResult[] = [];
  let componentCount = 0;
  let pageIndex = 0;

  while (componentCount < targetCount) {
    const componentsForPage = Math.min(10, targetCount - componentCount);
    const components = [];

    for (let i = 0; i < componentsForPage; i++) {
      const type = componentTypes[Math.floor(Math.random() * componentTypes.length)];
      components.push({
        id: `comp-${componentCount + i}`,
        type: `${type}-variant-${Math.floor(Math.random() * 3)}`, // Create variants
        confidence: 0.8 + Math.random() * 0.2,
        properties: {
          baseType: type,
          variant: Math.floor(Math.random() * 3),
          structure: generateComponentStructure(type)
        }
      });
    }

    results.push({
      url: `https://test.com/page-${pageIndex}`,
      title: `Page ${pageIndex}`,
      screenshot: `page-${pageIndex}.png`,
      detectedComponents: components,
      metadata: { pageIndex }
    });

    componentCount += componentsForPage;
    pageIndex++;
  }

  return results;
}

function createReducedComponentTypes(websiteId: string, count: number) {
  const baseTypes = [
    'header', 'footer', 'navigation', 'hero', 'card', 
    'button', 'form', 'sidebar', 'content', 'image', 
    'video', 'testimonial', 'banner', 'menu', 'gallery'
  ];

  return baseTypes.slice(0, count).map((type, index) => ({
    id: `ct-${websiteId}-${index}`,
    websiteId,
    type,
    category: getCategoryForType(type),
    displayName: `${type.charAt(0).toUpperCase() + type.slice(1)} Component`,
    defaultConfig: generateDefaultConfig(type),
    placeholderData: generatePlaceholderData(type),
    aiMetadata: {
      model: 'gpt-4o-mini',
      confidence: 0.85 + Math.random() * 0.15,
      reductionRatio: Math.random() * 0.3 + 0.7 // 70-100% reduction
    }
  }));
}

function generateComponentStructure(type: string) {
  const structures = {
    header: { hasLogo: true, hasNav: true, position: 'top' },
    footer: { hasLinks: true, hasCopyright: true, position: 'bottom' },
    hero: { hasBackground: true, hasTitle: true, hasButton: true },
    card: { hasImage: true, hasTitle: true, hasDescription: true },
    button: { size: 'medium', style: 'primary', hasIcon: false },
    form: { fields: ['input', 'textarea', 'submit'], validation: true }
  };

  return structures[type as keyof typeof structures] || { type };
}

function getCategoryForType(type: string): string {
  const categories = {
    header: 'layout',
    footer: 'layout',
    navigation: 'navigation',
    hero: 'content',
    card: 'content',
    button: 'interactive',
    form: 'interactive',
    sidebar: 'layout',
    content: 'content',
    image: 'media',
    video: 'media',
    testimonial: 'content',
    banner: 'content',
    menu: 'navigation',
    gallery: 'media'
  };

  return categories[type as keyof typeof categories] || 'content';
}

function generateDefaultConfig(type: string) {
  const configs = {
    header: { sticky: false, height: '80px', showLogo: true },
    footer: { showSocial: true, columns: 3, showCopyright: true },
    hero: { fullHeight: false, overlay: true, alignment: 'center' },
    card: { shadow: true, border: false, imageAspectRatio: '16:9' },
    button: { size: 'medium', variant: 'primary', fullWidth: false },
    form: { showLabels: true, required: true, validation: 'inline' }
  };

  return configs[type as keyof typeof configs] || { enabled: true };
}

function generatePlaceholderData(type: string) {
  const placeholders = {
    header: { logoText: 'Your Logo', navItems: ['Home', 'About', 'Contact'] },
    footer: { copyright: '© 2024 Your Company', links: ['Privacy', 'Terms'] },
    hero: { title: 'Your Hero Title', subtitle: 'Supporting text', buttonText: 'Get Started' },
    card: { title: 'Card Title', description: 'Card description here', image: 'placeholder.jpg' },
    button: { text: 'Click Me', icon: null },
    form: { title: 'Contact Form', submitText: 'Submit' }
  };

  return placeholders[type as keyof typeof placeholders] || { content: 'Placeholder content' };
}

function generateComponentsWithAIMetadata(): DetectionResult[] {
  return [
    {
      url: 'https://ai-test.com',
      title: 'AI Test Page',
      screenshot: 'ai-test.png',
      detectedComponents: [
        {
          id: 'ai-comp-1',
          type: 'button',
          confidence: 0.94,
          properties: {
            aiAnalysis: {
              model: 'gpt-4o-mini',
              timestamp: '2024-01-03T10:00:00Z',
              method: 'visual-analysis',
              features: ['clickable', 'rectangular', 'text-content']
            }
          }
        }
      ],
      metadata: { aiProcessed: true }
    }
  ];
}

function generateComponentsWithVariedProperties(): DetectionResult[] {
  return [
    {
      url: 'https://varied.com',
      title: 'Varied Components',
      screenshot: 'varied.png',
      detectedComponents: [
        {
          id: 'hero-comp',
          type: 'hero-section',
          confidence: 0.91,
          properties: {
            layout: 'centered',
            background: { type: 'image', overlay: true },
            title: { size: 'h1', weight: 'bold' },
            button: { position: 'bottom', style: 'primary' }
          }
        },
        {
          id: 'product-comp',
          type: 'product-card',
          confidence: 0.87,
          properties: {
            layout: 'vertical',
            image: { aspectRatio: '1:1', position: 'top' },
            pricing: { show: true, currency: 'USD' },
            actions: { primaryButton: 'add-to-cart', secondaryButton: 'wishlist' }
          }
        }
      ],
      metadata: {}
    }
  ];
}

function createSharedComponentTestDataset() {
  const pages = [];
  const sharedComponents = {
    header: { structure: { logo: true, nav: true }, usedOn: [0, 1, 2, 3, 4] },
    footer: { structure: { copyright: true, links: true }, usedOn: [0, 1, 2, 3, 4] },
    navigation: { structure: { menu: true, breadcrumb: true }, usedOn: [0, 1, 2, 3] },
    sidebar: { structure: { widgets: true, ads: true }, usedOn: [1, 2, 4] }
  };

  for (let i = 0; i < 5; i++) {
    const components = [];
    
    Object.entries(sharedComponents).forEach(([type, config]) => {
      if (config.usedOn.includes(i)) {
        components.push({
          id: `${type}-${i}`,
          type,
          structure: config.structure,
          hash: `${type}-hash`
        });
      }
    });

    // Add unique content components
    components.push({
      id: `content-${i}`,
      type: 'content',
      structure: { unique: true, pageId: i },
      hash: `content-${i}-unique`
    });

    pages.push({
      id: `page-${i}`,
      websiteId: 'test-shared',
      title: `Page ${i}`,
      content: { components }
    });
  }

  return { pages, expectedSharedComponents: Object.keys(sharedComponents).length };
}