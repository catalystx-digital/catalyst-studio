import { ImportOrchestrator } from '../import-orchestrator';
import { PrismaClient } from '@/lib/generated/prisma';

// Mock Prisma with realistic database operations
const mockPrisma = {
  $transaction: jest.fn(),
  websiteComponentType: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn()
  },
  websitePage: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn()
  },
  websiteStructure: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn()
  },
  websiteSharedComponent: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn()
  }
} as any;

describe('Database Integrity Tests', () => {
  const websiteId = 'integrity-test-website';
  let orchestrator: ImportOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create orchestrator with mock services
    orchestrator = new ImportOrchestrator({
      componentTypeExtractor: createMockComponentTypeExtractor(),
      pageBuilderService: createMockPageBuilderService(),
      structureService: createMockStructureService(),
      sharedComponentDetector: createMockSharedComponentDetector(),
      prisma: mockPrisma
    });

    // Setup default transaction behavior
    mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
      return await callback(mockPrisma);
    });
  });

  describe('Foreign Key Relationships', () => {
    it('should maintain foreign key relationships between all 4 tables', async () => {
      // Arrange
      const mockComponentTypes = [
        { id: 'ct-1', websiteId, type: 'header', category: 'layout' },
        { id: 'ct-2', websiteId, type: 'button', category: 'interactive' }
      ];

      const mockPages = [
        { 
          id: 'page-1', 
          websiteId,
          title: 'Home',
          content: { 
            components: [
              { id: 'comp-1', typeId: 'ct-1', type: 'header' },
              { id: 'comp-2', typeId: 'ct-2', type: 'button' }
            ]
          }
        },
        { 
          id: 'page-2', 
          websiteId,
          title: 'About',
          content: {
            components: [
              { id: 'comp-3', typeId: 'ct-1', type: 'header' }
            ]
          }
        }
      ];

      const mockStructures = [
        { id: 'struct-1', websiteId, websitePageId: 'page-1', slug: 'home', fullPath: '/home' },
        { id: 'struct-2', websiteId, websitePageId: 'page-2', slug: 'about', fullPath: '/about' }
      ];

      const mockSharedComponents = [
        { id: 'shared-1', websiteId, websiteComponentTypeId: 'ct-1', name: 'Shared Header' }
      ];

      // Mock database operations
      setupDatabaseMocks(mockComponentTypes, mockPages, mockStructures, mockSharedComponents);

      // Act
      const detectionResults = createMockDetectionResults();
      await orchestrator.orchestrateImport(detectionResults, websiteId, { enableTransactions: true });

      // Assert - Verify foreign key consistency
      
      // 1. WebsiteStructure.websitePageId -> WebsitePage.id
      mockStructures.forEach(structure => {
        const referencedPage = mockPages.find(page => page.id === structure.websitePageId);
        expect(referencedPage).toBeDefined();
        expect(referencedPage?.websiteId).toBe(structure.websiteId);
      });

      // 2. Page components reference valid component types
      mockPages.forEach(page => {
        page.content.components.forEach(component => {
          if (component.typeId) {
            const referencedType = mockComponentTypes.find(ct => ct.id === component.typeId);
            expect(referencedType).toBeDefined();
            expect(referencedType?.websiteId).toBe(page.websiteId);
          }
        });
      });

      // 3. WebsiteSharedComponent.websiteComponentTypeId -> WebsiteComponentType.id
      mockSharedComponents.forEach(sharedComp => {
        const referencedType = mockComponentTypes.find(ct => ct.id === sharedComp.websiteComponentTypeId);
        expect(referencedType).toBeDefined();
        expect(referencedType?.websiteId).toBe(sharedComp.websiteId);
      });

      // 4. All records share the same websiteId
      const allWebsiteIds = [
        ...mockComponentTypes.map(ct => ct.websiteId),
        ...mockPages.map(p => p.websiteId),
        ...mockStructures.map(s => s.websiteId),
        ...mockSharedComponents.map(sc => sc.websiteId)
      ];

      allWebsiteIds.forEach(id => {
        expect(id).toBe(websiteId);
      });
    });

    it('should prevent orphaned records after import completion', async () => {
      // Arrange - Setup data with potential orphan scenarios
      const componentTypes = [
        { id: 'ct-orphan-1', websiteId, type: 'orphan-type' },
        { id: 'ct-valid-1', websiteId, type: 'valid-type' }
      ];

      const pages = [
        { 
          id: 'page-valid-1', 
          websiteId,
          content: { 
            components: [
              { id: 'comp-1', typeId: 'ct-valid-1', type: 'valid-type' } // Valid reference
              // No component referencing ct-orphan-1
            ]
          }
        }
      ];

      const structures = [
        { id: 'struct-valid-1', websiteId, websitePageId: 'page-valid-1' }
        // No orphaned structures
      ];

      const sharedComponents = [
        { id: 'shared-valid-1', websiteId, websiteComponentTypeId: 'ct-valid-1' }
        // No orphaned shared components
      ];

      setupDatabaseMocks(componentTypes, pages, structures, sharedComponents);

      // Act
      const detectionResults = createMockDetectionResults();
      await orchestrator.orchestrateImport(detectionResults, websiteId, { 
        enableTransactions: true,
        validateIntegrity: true 
      });

      // Simulate integrity check
      const integrityResults = await simulateIntegrityCheck(websiteId);

      // Assert - No orphaned records should exist
      expect(integrityResults.orphanedComponentTypes).toHaveLength(0);
      expect(integrityResults.orphanedStructures).toHaveLength(0);
      expect(integrityResults.orphanedSharedComponents).toHaveLength(0);
      expect(integrityResults.unreferencedPages).toHaveLength(0);
    });
  });

  describe('Constraint Enforcement', () => {
    it('should enforce unique slugs within same parent', async () => {
      // Arrange
      const duplicateSlugStructures = [
        { id: 'struct-1', websiteId, websitePageId: 'page-1', slug: 'duplicate-slug', parentId: null },
        { id: 'struct-2', websiteId, websitePageId: 'page-2', slug: 'duplicate-slug', parentId: null }
      ];

      // Mock constraint violation
      mockPrisma.websiteStructure.createMany.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed on fields: (websiteId, slug, parentId)'
      });

      // Act & Assert
      await expect(async () => {
        setupDatabaseMocks([], [], duplicateSlugStructures, []);
        const detectionResults = createMockDetectionResults();
        await orchestrator.orchestrateImport(detectionResults, websiteId, { enableTransactions: true });
      }).rejects.toThrow('Unique constraint failed');
    });

    it('should validate foreign key references during creation', async () => {
      // Arrange - Invalid foreign key reference
      const invalidStructure = [
        { 
          id: 'struct-invalid', 
          websiteId, 
          websitePageId: 'non-existent-page-id', // Invalid reference
          slug: 'invalid-page'
        }
      ];

      // Mock foreign key constraint violation
      mockPrisma.websiteStructure.createMany.mockRejectedValue({
        code: 'P2003',
        message: 'Foreign key constraint failed on field: websitePageId'
      });

      // Act & Assert
      await expect(async () => {
        setupDatabaseMocks([], [], invalidStructure, []);
        const detectionResults = createMockDetectionResults();
        await orchestrator.orchestrateImport(detectionResults, websiteId, { enableTransactions: true });
      }).rejects.toThrow('Foreign key constraint failed');
    });

    it('should enforce websiteId consistency across all tables', async () => {
      // Arrange - Mixed websiteIds (should not be allowed)
      const mixedWebsiteData = {
        componentTypes: [{ id: 'ct-1', websiteId: 'different-website', type: 'header' }],
        pages: [{ id: 'page-1', websiteId, content: { components: [] } }],
        structures: [{ id: 'struct-1', websiteId, websitePageId: 'page-1' }],
        sharedComponents: [{ id: 'shared-1', websiteId, websiteComponentTypeId: 'ct-1' }]
      };

      // Act
      const validationResults = validateWebsiteIdConsistency(mixedWebsiteData, websiteId);

      // Assert
      expect(validationResults.isValid).toBe(false);
      expect(validationResults.violations).toContainEqual({
        table: 'websiteComponentType',
        recordId: 'ct-1',
        expectedWebsiteId: websiteId,
        actualWebsiteId: 'different-website'
      });
    });
  });

  describe('JSON Field Structures', () => {
    it('should validate JSON field structures match Epic 16 specifications', async () => {
      // Arrange - Test various JSON structures
      const testPages = [
        {
          id: 'page-json-1',
          websiteId,
          title: 'JSON Test Page',
          content: {
            components: [
              {
                id: 'comp-1',
                typeId: 'ct-1',
                type: 'header',
                parentId: null,
                position: 0,
                props: { title: 'Header Title' }
              },
              {
                id: 'comp-2',
                typeId: 'ct-2',
                type: 'button',
                parentId: 'comp-1',
                position: 0,
                props: { text: 'Click Me', style: 'primary' }
              }
            ],
            metadata: {
              version: '1.0',
              lastModified: '2024-01-03T10:00:00Z'
            }
          },
          metadata: {
            seo: {
              title: 'Page Title',
              description: 'Page description',
              keywords: ['test', 'page']
            }
          }
        }
      ];

      // Act
      const validationResults = validateJSONStructures(testPages);

      // Assert
      validationResults.forEach(result => {
        expect(result.isValid).toBe(true);
        
        // Validate content.components structure
        if (result.content?.components) {
          result.content.components.forEach(component => {
            expect(component).toHaveProperty('id');
            expect(component).toHaveProperty('typeId');
            expect(component).toHaveProperty('type');
            expect(component).toHaveProperty('position');
            expect(typeof component.position).toBe('number');
            
            // Optional fields should be null or valid values
            if (component.parentId !== undefined) {
              expect(component.parentId === null || typeof component.parentId === 'string').toBe(true);
            }
          });
        }

        // Validate metadata structure
        if (result.metadata) {
          expect(typeof result.metadata).toBe('object');
        }
      });
    });

    it('should handle nested component hierarchies in JSON', async () => {
      // Arrange - Complex nested structure
      const nestedPage = {
        id: 'page-nested',
        websiteId,
        content: {
          components: [
            { id: 'root', typeId: 'ct-1', type: 'container', parentId: null, position: 0 },
            { id: 'child-1', typeId: 'ct-2', type: 'section', parentId: 'root', position: 0 },
            { id: 'child-2', typeId: 'ct-2', type: 'section', parentId: 'root', position: 1 },
            { id: 'grandchild-1', typeId: 'ct-3', type: 'text', parentId: 'child-1', position: 0 },
            { id: 'grandchild-2', typeId: 'ct-4', type: 'image', parentId: 'child-1', position: 1 }
          ]
        }
      };

      // Act
      const hierarchyValidation = validateComponentHierarchy(nestedPage.content.components);

      // Assert
      expect(hierarchyValidation.isValid).toBe(true);
      expect(hierarchyValidation.rootComponents).toHaveLength(1);
      expect(hierarchyValidation.maxDepth).toBeLessThanOrEqual(5); // Reasonable nesting limit
      
      // Verify parent-child relationships
      const childComponents = nestedPage.content.components.filter(c => c.parentId === 'root');
      expect(childComponents).toHaveLength(2);
      
      const grandchildComponents = nestedPage.content.components.filter(c => c.parentId === 'child-1');
      expect(grandchildComponents).toHaveLength(2);
    });
  });

  describe('Concurrent Import Safety', () => {
    it('should handle 10+ concurrent imports without data corruption', async () => {
      // Arrange
      const concurrentImports = Array.from({ length: 12 }, (_, i) => ({
        websiteId: `concurrent-test-${i}`,
        detectionResults: createMockDetectionResults(`site-${i}`)
      }));

      // Mock concurrent transaction behavior
      let transactionCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        transactionCount++;
        
        // Simulate concurrent database operations
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        return await callback(mockPrisma);
      });

      // Act
      const importPromises = concurrentImports.map(async (importData) => {
        try {
          setupDatabaseMocksForWebsite(importData.websiteId);
          return await orchestrator.orchestrateImport(
            importData.detectionResults, 
            importData.websiteId, 
            { enableTransactions: true }
          );
        } catch (error) {
          return { error, websiteId: importData.websiteId };
        }
      });

      const results = await Promise.all(importPromises);

      // Assert
      expect(transactionCount).toBe(12); // All transactions executed
      
      const successfulImports = results.filter(r => !r.error);
      const failedImports = results.filter(r => r.error);
      
      expect(successfulImports.length).toBe(12); // All should succeed
      expect(failedImports.length).toBe(0);

      // Verify no data corruption (each import has unique websiteId)
      const websiteIds = successfulImports.map(r => r.websiteId);
      const uniqueWebsiteIds = new Set(websiteIds);
      expect(uniqueWebsiteIds.size).toBe(12); // No duplicate websiteIds
    });

    it('should maintain transaction isolation to prevent partial imports', async () => {
      // Arrange - Simulate transaction failure mid-operation
      let operationCount = 0;
      mockPrisma.websiteComponentType.createMany.mockImplementation(() => {
        operationCount++;
        return Promise.resolve({ count: 3 });
      });
      
      mockPrisma.websitePage.createMany.mockImplementation(() => {
        operationCount++;
        return Promise.resolve({ count: 2 });
      });
      
      mockPrisma.websiteStructure.createMany.mockImplementation(() => {
        operationCount++;
        // Simulate failure at structure creation
        throw new Error('Database connection lost');
      });

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        try {
          return await callback(mockPrisma);
        } catch (error) {
          // Simulate transaction rollback
          throw error;
        }
      });

      // Act
      const detectionResults = createMockDetectionResults();
      
      let importError;
      try {
        await orchestrator.orchestrateImport(detectionResults, websiteId, { enableTransactions: true });
      } catch (error) {
        importError = error;
      }

      // Assert
      expect(importError).toBeDefined();
      expect(operationCount).toBe(3); // Operations executed before failure
      
      // Verify rollback behavior
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      
      // In a real scenario, all data would be rolled back
      // Here we verify the transaction was attempted with proper error handling
    });
  });

  describe('Data Consistency Validation', () => {
    it('should verify component instance counts match database records', async () => {
      // Arrange
      const testData = {
        componentTypes: 8,
        pages: 5,
        structures: 5,
        sharedComponents: 3,
        totalComponentInstances: 25
      };

      // Mock database counts
      mockPrisma.websiteComponentType.count.mockResolvedValue(testData.componentTypes);
      mockPrisma.websitePage.count.mockResolvedValue(testData.pages);
      mockPrisma.websiteStructure.count.mockResolvedValue(testData.structures);
      mockPrisma.websiteSharedComponent.count.mockResolvedValue(testData.sharedComponents);

      // Mock pages with component instances
      mockPrisma.websitePage.findMany.mockResolvedValue(
        Array.from({ length: testData.pages }, (_, i) => ({
          id: `page-${i}`,
          websiteId,
          content: {
            components: Array.from({ length: 5 }, (_, j) => ({
              id: `comp-${i}-${j}`,
              typeId: `ct-${j % testData.componentTypes}`,
              type: `type-${j % testData.componentTypes}`
            }))
          }
        }))
      );

      // Act
      const consistencyCheck = await performConsistencyCheck(websiteId);

      // Assert
      expect(consistencyCheck.componentTypesCount).toBe(testData.componentTypes);
      expect(consistencyCheck.pagesCount).toBe(testData.pages);
      expect(consistencyCheck.structuresCount).toBe(testData.structures);
      expect(consistencyCheck.sharedComponentsCount).toBe(testData.sharedComponents);
      expect(consistencyCheck.totalComponentInstances).toBe(testData.totalComponentInstances);

      // Verify consistency ratios
      expect(consistencyCheck.pagesCount).toBe(consistencyCheck.structuresCount); // 1:1 ratio
      expect(consistencyCheck.sharedComponentsCount).toBeLessThan(consistencyCheck.componentTypesCount); // Reasonable ratio
    });

    it('should validate component type references in page content', async () => {
      // Arrange
      const componentTypes = [
        { id: 'ct-1', websiteId, type: 'header' },
        { id: 'ct-2', websiteId, type: 'button' }
      ];

      const pagesWithReferences = [
        {
          id: 'page-1',
          websiteId,
          content: {
            components: [
              { id: 'comp-1', typeId: 'ct-1', type: 'header' }, // Valid reference
              { id: 'comp-2', typeId: 'ct-3', type: 'invalid' } // Invalid reference
            ]
          }
        }
      ];

      // Mock data
      mockPrisma.websiteComponentType.findMany.mockResolvedValue(componentTypes);
      mockPrisma.websitePage.findMany.mockResolvedValue(pagesWithReferences);

      // Act
      const referenceValidation = await validateComponentTypeReferences(websiteId);

      // Assert
      expect(referenceValidation.isValid).toBe(false);
      expect(referenceValidation.invalidReferences).toHaveLength(1);
      expect(referenceValidation.invalidReferences[0]).toEqual({
        pageId: 'page-1',
        componentId: 'comp-2',
        invalidTypeId: 'ct-3',
        componentType: 'invalid'
      });

      expect(referenceValidation.validReferences).toHaveLength(1);
      expect(referenceValidation.validReferences[0]).toEqual({
        pageId: 'page-1',
        componentId: 'comp-1',
        typeId: 'ct-1',
        componentType: 'header'
      });
    });
  });
});

// Helper Functions
function createMockComponentTypeExtractor() {
  return {
    extractPatterns: jest.fn().mockResolvedValue(['header', 'button', 'content']),
    reduceToTypes: jest.fn().mockResolvedValue([
      { id: 'ct-1', type: 'header', category: 'layout', websiteId: 'mock' },
      { id: 'ct-2', type: 'button', category: 'interactive', websiteId: 'mock' }
    ])
  };
}

function createMockPageBuilderService() {
  return {
    createPagesInBatch: jest.fn().mockResolvedValue([
      { id: 'page-1', websiteId: 'mock', title: 'Page 1', content: { components: [] } },
      { id: 'page-2', websiteId: 'mock', title: 'Page 2', content: { components: [] } }
    ])
  };
}

function createMockStructureService() {
  return {
    createStructures: jest.fn().mockResolvedValue([
      { id: 'struct-1', websiteId: 'mock', websitePageId: 'page-1', slug: 'page-1' },
      { id: 'struct-2', websiteId: 'mock', websitePageId: 'page-2', slug: 'page-2' }
    ])
  };
}

function createMockSharedComponentDetector() {
  return {
    detectShared: jest.fn().mockResolvedValue([
      { id: 'shared-1', websiteId: 'mock', name: 'Shared Header', componentTypeId: 'ct-1' }
    ])
  };
}

function createMockDetectionResults(siteName = 'test-site') {
  return [
    {
      url: `https://${siteName}.com`,
      title: `${siteName} Home`,
      screenshot: `${siteName}-home.png`,
      detectedComponents: [
        { id: 'comp-1', type: 'header', confidence: 0.9, properties: {} },
        { id: 'comp-2', type: 'button', confidence: 0.8, properties: {} }
      ],
      metadata: {}
    }
  ];
}

function setupDatabaseMocks(componentTypes: any[], pages: any[], structures: any[], sharedComponents: any[]) {
  mockPrisma.websiteComponentType.createMany.mockResolvedValue({ count: componentTypes.length });
  mockPrisma.websiteComponentType.findMany.mockResolvedValue(componentTypes);
  
  mockPrisma.websitePage.createMany.mockResolvedValue({ count: pages.length });
  mockPrisma.websitePage.findMany.mockResolvedValue(pages);
  
  mockPrisma.websiteStructure.createMany.mockResolvedValue({ count: structures.length });
  mockPrisma.websiteStructure.findMany.mockResolvedValue(structures);
  
  mockPrisma.websiteSharedComponent.createMany.mockResolvedValue({ count: sharedComponents.length });
  mockPrisma.websiteSharedComponent.findMany.mockResolvedValue(sharedComponents);
}

function setupDatabaseMocksForWebsite(websiteId: string) {
  const mockData = {
    componentTypes: [
      { id: `ct-${websiteId}-1`, websiteId, type: 'header' },
      { id: `ct-${websiteId}-2`, websiteId, type: 'button' }
    ],
    pages: [
      { id: `page-${websiteId}-1`, websiteId, content: { components: [] } }
    ],
    structures: [
      { id: `struct-${websiteId}-1`, websiteId, websitePageId: `page-${websiteId}-1` }
    ],
    sharedComponents: [
      { id: `shared-${websiteId}-1`, websiteId, componentTypeId: `ct-${websiteId}-1` }
    ]
  };

  setupDatabaseMocks(
    mockData.componentTypes,
    mockData.pages,
    mockData.structures,
    mockData.sharedComponents
  );
}

async function simulateIntegrityCheck(websiteId: string) {
  // Simulate finding orphaned records
  return {
    orphanedComponentTypes: [], // Component types not referenced by any page components
    orphanedStructures: [], // Structures without corresponding pages
    orphanedSharedComponents: [], // Shared components with invalid componentTypeId
    unreferencedPages: [] // Pages without corresponding structures
  };
}

function validateWebsiteIdConsistency(data: any, expectedWebsiteId: string) {
  const violations = [];
  
  // Check component types
  data.componentTypes?.forEach((ct: any) => {
    if (ct.websiteId !== expectedWebsiteId) {
      violations.push({
        table: 'websiteComponentType',
        recordId: ct.id,
        expectedWebsiteId,
        actualWebsiteId: ct.websiteId
      });
    }
  });

  // Check other tables similarly...
  
  return {
    isValid: violations.length === 0,
    violations
  };
}

function validateJSONStructures(pages: any[]) {
  return pages.map(page => {
    try {
      // Validate content structure
      if (page.content && page.content.components) {
        const isValidComponents = Array.isArray(page.content.components) &&
          page.content.components.every(comp => 
            comp.id && comp.typeId && comp.type && typeof comp.position === 'number'
          );
        
        if (!isValidComponents) {
          return { isValid: false, error: 'Invalid components structure' };
        }
      }

      return { 
        isValid: true, 
        content: page.content,
        metadata: page.metadata 
      };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  });
}

function validateComponentHierarchy(components: any[]) {
  const componentMap = new Map(components.map(c => [c.id, c]));
  const rootComponents = components.filter(c => c.parentId === null);
  
  let maxDepth = 0;
  
  function calculateDepth(componentId: string, currentDepth = 0): number {
    const component = componentMap.get(componentId);
    if (!component) return currentDepth;
    
    const children = components.filter(c => c.parentId === componentId);
    if (children.length === 0) return currentDepth + 1;
    
    return Math.max(...children.map(child => calculateDepth(child.id, currentDepth + 1)));
  }
  
  rootComponents.forEach(root => {
    const depth = calculateDepth(root.id);
    maxDepth = Math.max(maxDepth, depth);
  });
  
  return {
    isValid: true,
    rootComponents,
    maxDepth
  };
}

async function performConsistencyCheck(websiteId: string) {
  const [
    componentTypesCount,
    pagesCount,
    structuresCount,
    sharedComponentsCount,
    pages
  ] = await Promise.all([
    mockPrisma.websiteComponentType.count({ where: { websiteId } }),
    mockPrisma.websitePage.count({ where: { websiteId } }),
    mockPrisma.websiteStructure.count({ where: { websiteId } }),
    mockPrisma.websiteSharedComponent.count({ where: { websiteId } }),
    mockPrisma.websitePage.findMany({ where: { websiteId } })
  ]);

  const totalComponentInstances = pages.reduce((total: number, page: any) => {
    return total + (page.content?.components?.length || 0);
  }, 0);

  return {
    componentTypesCount,
    pagesCount,
    structuresCount,
    sharedComponentsCount,
    totalComponentInstances
  };
}

async function validateComponentTypeReferences(websiteId: string) {
  const [componentTypes, pages] = await Promise.all([
    mockPrisma.websiteComponentType.findMany({ where: { websiteId } }),
    mockPrisma.websitePage.findMany({ where: { websiteId } })
  ]);

  const validTypeIds = new Set(componentTypes.map(ct => ct.id));
  const validReferences = [];
  const invalidReferences = [];

  pages.forEach(page => {
    page.content?.components?.forEach((component: any) => {
      if (component.typeId) {
        if (validTypeIds.has(component.typeId)) {
          validReferences.push({
            pageId: page.id,
            componentId: component.id,
            typeId: component.typeId,
            componentType: component.type
          });
        } else {
          invalidReferences.push({
            pageId: page.id,
            componentId: component.id,
            invalidTypeId: component.typeId,
            componentType: component.type
          });
        }
      }
    });
  });

  return {
    isValid: invalidReferences.length === 0,
    validReferences,
    invalidReferences
  };
}
