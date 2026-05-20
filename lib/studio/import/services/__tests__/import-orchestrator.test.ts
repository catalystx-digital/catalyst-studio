import { ImportOrchestrator, ImportOrchestratorConfig } from '../import-orchestrator'
import { ComponentTypeExtractor } from '../component-type-extractor'
import { PageBuilderService } from '../page-builder-service'
import { StructureService } from '../structure-service'
import { ISharedComponentDetector } from '../interfaces/shared-component-detector.interface'
import { DetectionResult } from '../interfaces/component-type-extractor.interface'
import { ImportOptions, ImportProgress } from '../interfaces/import-orchestrator.interface'

const ensureTemplatePageTypesMock = jest.fn<Promise<Map<string, string>>, any[]>(async () => {
  return new Map<string, string>([['core/generic-default', 'content-type-id']])
})

jest.mock('../template-page-type-seeder', () => ({
  ensureTemplatePageTypes: (...args: any[]) => ensureTemplatePageTypesMock(...args)
}))


type JestMock = jest.Mock<any, any>

expect.extend({
  toHaveBeenCalledBefore(received: JestMock, nextMock: JestMock) {
    const receivedOrder = received.mock.invocationCallOrder[0]
    const nextOrder = nextMock.mock.invocationCallOrder[0]

    if (receivedOrder === undefined) {
      return {
        pass: false,
        message: () => 'Expected the first mock to have been called at least once.'
      }
    }

    if (nextOrder === undefined) {
      return {
        pass: false,
        message: () => 'Expected the second mock to have been called at least once.'
      }
    }

    const pass = receivedOrder < nextOrder

    return {
      pass,
      message: () =>
        pass
          ? 'Expected the first mock not to be called before the second mock.'
          : 'Expected the first mock to be called before the second mock.'
    }
  }
})

// Mock Prisma
const mockPrisma = {
  $transaction: jest.fn(),
  websiteComponentType: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  websitePage: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn()
  },
  websiteStructure: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  },
  websiteSharedComponent: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
} as any

// Mock services
const mockComponentTypeExtractor = {
  extractPatterns: jest.fn(),
  reduceToTypes: jest.fn()
} as any

const mockPageBuilderService = {
  configureContentTypes: jest.fn(),
  createPagesInBatch: jest.fn()
} as any

const mockStructureService = {
  createStructures: jest.fn(),
  clearDiagnostics: jest.fn(),
  getDiagnostics: jest.fn().mockReturnValue([])
} as any

const mockSharedComponentDetector = {
  detectShared: jest.fn(),
  updatePageReferences: jest.fn()
} as any

describe('ImportOrchestrator', () => {
  let orchestrator: ImportOrchestrator
  let mockConfig: ImportOrchestratorConfig

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks()
    ensureTemplatePageTypesMock.mockResolvedValue(
      new Map<string, string>([['core/generic-default', 'content-type-id']])
    )

    // Default Prisma behavior for missing methods
    mockPrisma.$transaction.mockImplementation(async (callback: Function) => callback())

    mockPrisma.websiteComponentType.createMany.mockResolvedValue({ count: 0 })
    mockPrisma.websiteComponentType.findMany.mockImplementation(async (args: any = {}) => {
      const reduceMock = mockComponentTypeExtractor.reduceToTypes as jest.Mock
      if (reduceMock.mock.results.length) {
        for (let i = reduceMock.mock.results.length - 1; i >= 0; i -= 1) {
          const outcome = reduceMock.mock.results[i]
          if ('value' in outcome && outcome.value) {
            try {
              const resolved = await outcome.value
              if (Array.isArray(resolved)) {
                const targetWebsiteId = args?.where?.websiteId
                return typeof targetWebsiteId === 'string'
                  ? resolved.filter((item: any) => item.websiteId === targetWebsiteId)
                  : resolved
              }
            } catch {
              // ignore and fall through to default
            }
          }
        }
      }
      return []
    })
    mockPrisma.websiteComponentType.findFirst.mockResolvedValue(null)
    mockPrisma.websiteComponentType.create.mockImplementation(async ({ data } = {} as any) => ({
      id: data?.id ?? 'mock-component-type',
      ...data,
    }))
    mockPrisma.websiteComponentType.update.mockImplementation(async ({ where, data }: any = {}) => ({
      id: where?.id ?? data?.id ?? 'mock-component-type',
      ...data,
    }))
    mockPrisma.websiteComponentType.deleteMany.mockResolvedValue({ count: 0 })

    mockPrisma.websitePage.createMany.mockResolvedValue({ count: 0 })
    mockPrisma.websitePage.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.websitePage.findMany.mockResolvedValue([])
    mockPrisma.websitePage.updateMany.mockResolvedValue({ count: 0 })

    mockPrisma.websiteStructure.createMany.mockResolvedValue({ count: 0 })
    mockPrisma.websiteStructure.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.websiteStructure.findMany.mockResolvedValue([])

    mockPrisma.websiteSharedComponent.createMany.mockResolvedValue({ count: 0 })
    mockPrisma.websiteSharedComponent.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.websiteSharedComponent.findMany.mockResolvedValue([])
    mockPrisma.websiteSharedComponent.findFirst.mockResolvedValue(null)
    mockPrisma.websiteSharedComponent.create.mockImplementation(async ({ data } = {} as any) => ({
      id: data?.id ?? 'mock-shared-component',
      ...data,
    }))
    mockPrisma.websiteSharedComponent.update.mockImplementation(async ({ where, data }: any = {}) => ({
      id: where?.id ?? data?.id ?? 'mock-shared-component',
      ...data,
    }))

    // Reset service mocks to neutral defaults
    mockPageBuilderService.configureContentTypes.mockImplementation(() => undefined)
    mockComponentTypeExtractor.extractPatterns.mockResolvedValue([])
    mockComponentTypeExtractor.reduceToTypes.mockResolvedValue([])
    mockPageBuilderService.createPagesInBatch.mockResolvedValue([])
    mockStructureService.clearDiagnostics.mockClear()
    mockStructureService.getDiagnostics.mockReturnValue([])
    mockStructureService.createStructures.mockResolvedValue([])
    mockSharedComponentDetector.detectShared.mockResolvedValue([])
    mockSharedComponentDetector.updatePageReferences.mockImplementation(async (page) => page)

    mockConfig = {
      componentTypeExtractor: mockComponentTypeExtractor,
      pageBuilderService: mockPageBuilderService,
      structureService: mockStructureService,
      sharedComponentDetector: mockSharedComponentDetector,
      prisma: mockPrisma
    }

    orchestrator = new ImportOrchestrator(mockConfig)
  })

  describe('orchestrateImport', () => {
    const mockDetectionResults: DetectionResult[] = [
      {
        url: 'https://example.com',
        title: 'Test Page',
        screenshot: 'screenshot.png',
        detectedComponents: [
          {
            id: 'comp-1',
            type: 'button',
            confidence: 0.9,
            properties: { text: 'Click me' }
          }
        ],
        metadata: {}
      }
    ]

    const websiteId = 'website-123'

    it('should orchestrate complete import sequence successfully', async () => {
      // Arrange
      const mockComponentTypes = [
        { id: 'type-1', websiteId, type: 'button', category: 'UI', props: {} }
      ]
      const mockPages = [
        { id: 'page-1', websiteId, url: 'https://example.com', title: 'Test Page', content: {} }
      ]
      const mockStructures = [
        { id: 'struct-1', websiteId, slug: 'test-page', fullPath: '/test-page', websitePageId: 'page-1' }
      ]
      const mockSharedComponents = [
        { id: 'shared-1', websiteId, name: 'Header', componentTypeId: 'type-1' }
      ]

      mockComponentTypeExtractor.extractPatterns.mockResolvedValue(['pattern1'])
      mockComponentTypeExtractor.reduceToTypes.mockResolvedValue(mockComponentTypes)
      mockPageBuilderService.createPagesInBatch.mockResolvedValue(mockPages)
      mockStructureService.createStructures.mockResolvedValue(mockStructures)
      mockSharedComponentDetector.detectShared.mockResolvedValue(mockSharedComponents)
      mockPrisma.websiteComponentType.createMany.mockResolvedValue({ count: mockComponentTypes.length })
      mockPrisma.websiteComponentType.findMany.mockResolvedValue(mockComponentTypes)
      mockPrisma.websitePage.findMany.mockResolvedValue(mockPages)
      mockPrisma.websiteSharedComponent.findMany.mockResolvedValue(mockSharedComponents)

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        return await callback()
      })

      let progressCallbacks: ImportProgress[] = []
      const options: ImportOptions = {
        enableTransactions: true,
        validateIntegrity: true,
        progressCallback: (progress) => progressCallbacks.push(progress)
      }

      // Act
      const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

      // Assert
      expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledWith(mockDetectionResults)
      expect(mockComponentTypeExtractor.reduceToTypes).toHaveBeenCalledWith(['pattern1'], websiteId)
      expect(mockPageBuilderService.createPagesInBatch).toHaveBeenCalled()
      expect(mockStructureService.createStructures).toHaveBeenCalledWith(mockPages, websiteId)
      expect(mockSharedComponentDetector.detectShared).toHaveBeenCalledWith(mockPages)

      expect(result.websiteId).toBe(websiteId)
      expect(result.pages).toEqual(mockPages)
      expect(result.structures).toEqual(mockStructures)
      expect(result.componentTypes).toEqual(expect.arrayContaining(mockComponentTypes))
      expect(result.componentTypes.length).toBeGreaterThanOrEqual(mockComponentTypes.length)
      expect(result.sharedComponents.some(component => component.name === 'Header')).toBe(true)
      expect(result.sharedComponents.length).toBeGreaterThanOrEqual(mockSharedComponents.length)
      expect(result.statistics.totalPages).toBe(1)
      expect(result.statistics.uniqueComponentTypes).toBeGreaterThanOrEqual(mockComponentTypes.length)
      expect(result.statistics.sharedComponentsDetected).toBe(1)
      expect(result.statistics.processingTimeMs).toBeGreaterThan(0)

      // Check progress was reported
      expect(progressCallbacks.length).toBeGreaterThan(0)
      expect(progressCallbacks[0].stage).toBe('extracting')
      expect(progressCallbacks[0].progress).toBe(0)
    })

    it('should surface structure canonical collision diagnostics', async () => {
      const mockComponentTypes = [
        { id: 'type-1', websiteId, type: 'button', category: 'UI', props: {} }
      ]
      const mockPages = [
        { id: 'page-1', websiteId, url: 'https://example.com/about', title: 'About', content: {} }
      ]
      const mockStructures = [
        { id: 'struct-1', websiteId, slug: 'about', fullPath: '/about', websitePageId: 'page-1' }
      ]
      const structureDiagnostics = [
        {
          code: 'STRUCTURE_CANONICAL_COLLISION',
          level: 'warn',
          message: 'Collision detected',
          context: {
            canonicalPath: '/about',
            pageId: 'page-1',
            existingPageId: 'page-home'
          }
        }
      ]

      mockComponentTypeExtractor.extractPatterns.mockResolvedValue(['pattern1'])
      mockComponentTypeExtractor.reduceToTypes.mockResolvedValue(mockComponentTypes)
      mockPageBuilderService.createPagesInBatch.mockResolvedValue(mockPages)
      mockStructureService.createStructures.mockResolvedValue(mockStructures)
      mockStructureService.getDiagnostics
        .mockImplementationOnce(() => structureDiagnostics)
        .mockReturnValue([])
      mockSharedComponentDetector.detectShared.mockResolvedValue([])
      mockPrisma.websiteComponentType.createMany.mockResolvedValue({ count: mockComponentTypes.length })
      mockPrisma.websiteComponentType.findMany.mockResolvedValue(mockComponentTypes)
      mockPrisma.websitePage.findMany.mockResolvedValue(mockPages)
      mockPrisma.websiteSharedComponent.findMany.mockResolvedValue([])

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        return await callback()
      })

      const progressReports: ImportProgress[] = []
      const options: ImportOptions = {
        enableTransactions: true,
        validateIntegrity: false,
        progressCallback: progress => progressReports.push(progress)
      }

      const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'STRUCTURE_CANONICAL_COLLISION',
            level: 'warn',
            source: 'structure',
            context: expect.objectContaining({
              canonicalPath: '/about',
              pageId: 'page-1',
              existingPageId: 'page-home'
            })
          })
        ])
      )

      expect(progressReports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: 'structuring',
            progress: 55,
            message: 'Detected canonical routing collisions'
          })
        ])
      )

      expect(mockStructureService.clearDiagnostics).toHaveBeenCalledTimes(2)
    })

    it('should handle transaction rollback on failure', async () => {
      // Arrange
      const error = new Error('Service failure')
      mockComponentTypeExtractor.extractPatterns.mockRejectedValue(error)
      
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        try {
          return await callback()
        } catch (e) {
          throw e
        }
      })

      const options: ImportOptions = {
        enableTransactions: true
      }

      // Act & Assert
      await expect(
        orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)
      ).rejects.toThrow('Service failure')
    })

    it('seeds canonical detection types before component mapping', async () => {
      const detectionResults: DetectionResult[] = [
        {
          id: 'hero-1',
          type: 'hero-simple',
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
          confidence: 0.92,
          metadata: {},
          children: []
        } as DetectionResult,
        {
          id: 'grid-1',
          type: 'feature-grid',
          bounds: { x: 0, y: 720, width: 1280, height: 600 },
          confidence: 0.84,
          metadata: {},
          children: []
        } as DetectionResult
      ]

      mockComponentTypeExtractor.extractPatterns.mockResolvedValue([])
      mockComponentTypeExtractor.reduceToTypes.mockResolvedValue([])
      mockPageBuilderService.createPagesInBatch.mockResolvedValue([])
      mockStructureService.createStructures.mockResolvedValue([])
      mockSharedComponentDetector.detectShared.mockResolvedValue([])

      await orchestrator.orchestrateImport(detectionResults, 'seed-website', {
        enableTransactions: false
      })

      expect(mockPrisma.websiteComponentType.createMany).toHaveBeenCalled()
      const seededCalls = mockPrisma.websiteComponentType.createMany.mock.calls
      const seededTypes = seededCalls
        .flatMap(call => (Array.isArray(call[0]?.data) ? call[0].data : []))
        .map((entry: any) => entry.type)
      expect(seededTypes).toEqual(expect.arrayContaining(['hero-simple', 'feature-grid']))
      expect(mockPrisma.websiteComponentType.createMany).toHaveBeenCalledBefore(
        mockPageBuilderService.createPagesInBatch as unknown as jest.Mock
      )
    })

    it('should retry on recoverable errors', async () => {
      // Arrange
      const networkError = new Error('NetworkError: Connection timeout')
      mockComponentTypeExtractor.extractPatterns
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue(['pattern1'])
      
      mockComponentTypeExtractor.reduceToTypes.mockResolvedValue([])
      mockPageBuilderService.createPagesInBatch.mockResolvedValue([])
      mockStructureService.createStructures.mockResolvedValue([])
      mockSharedComponentDetector.detectShared.mockResolvedValue([])

      const options: ImportOptions = {
        enableTransactions: false,
        maxRetries: 1
      }

      // Act
      const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

      // Assert
      expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledTimes(2)
      expect(result.websiteId).toBe(websiteId)
    })

    it('should not retry on non-recoverable errors', async () => {
      // Arrange
      const validationError = new Error('ValidationError: Invalid schema')
      mockComponentTypeExtractor.extractPatterns.mockRejectedValue(validationError)

      const options: ImportOptions = {
        enableTransactions: false,
        maxRetries: 3
      }

      // Act & Assert
      await expect(
        orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)
      ).rejects.toThrow('ValidationError: Invalid schema')
      
      expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledTimes(1)
    })
  })

  describe('executeInTransaction', () => {
    it('should execute operations within transaction and return success', async () => {
      // Arrange
      const expectedData = { success: true }
      mockPrisma.$transaction.mockResolvedValue(expectedData)

      // Act
      const result = await orchestrator.executeInTransaction(async () => expectedData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(expectedData)
      expect(result.error).toBeUndefined()
      expect(result.rollbackPerformed).toBeUndefined()
    })

    it('should handle transaction failure with rollback', async () => {
      // Arrange
      const error = new Error('Transaction failed')
      mockPrisma.$transaction.mockRejectedValue(error)

      // Act
      const result = await orchestrator.executeInTransaction(async () => {
        throw error
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBe(error)
      expect(result.rollbackPerformed).toBe(true)
    })
  })

  describe('validateImportIntegrity', () => {
    it('should validate successful import result', () => {
      // Arrange
      const validResult = {
        websiteId: 'website-123',
        pages: [
          {
            id: 'page-1',
            content: {
              components: [
                { id: 'comp-1', typeId: 'type-1', type: 'button' }
              ]
            }
          }
        ],
        structures: [
          { id: 'struct-1', websitePageId: 'page-1' }
        ],
        componentTypes: [
          { id: 'type-1', type: 'button' }
        ],
        sharedComponents: [
          { id: 'shared-1', componentTypeId: 'type-1' }
        ],
        statistics: {
          totalPages: 1,
          totalComponents: 1,
          uniqueComponentTypes: 1,
          sharedComponentsDetected: 1,
          processingTimeMs: 100
        }
      }

      // Act
      const result = orchestrator.validateImportIntegrity(validResult)

      // Assert
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.statistics.pagesValidated).toBe(1)
      expect(result.statistics.componentsValidated).toBe(1)
      expect(result.statistics.structuresValidated).toBe(1)
    })

    it('should detect invalid foreign key references', () => {
      // Arrange
      const invalidResult = {
        websiteId: 'website-123',
        pages: [
          {
            id: 'page-1',
            content: {
              components: [
                { id: 'comp-1', typeId: 'invalid-type-id', type: 'button' }
              ]
            }
          }
        ],
        structures: [
          { id: 'struct-1', websitePageId: 'invalid-page-id' }
        ],
        componentTypes: [
          { id: 'type-1', type: 'button' }
        ],
        sharedComponents: [
          { id: 'shared-1', componentTypeId: 'invalid-type-id' }
        ],
        statistics: {
          totalPages: 1,
          totalComponents: 1,
          uniqueComponentTypes: 1,
          sharedComponentsDetected: 1,
          processingTimeMs: 100
        }
      }

      // Act
      const result = orchestrator.validateImportIntegrity(invalidResult)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Page page-1 references invalid component type invalid-type-id')
      expect(result.errors).toContain('Structure struct-1 references invalid page invalid-page-id')
      expect(result.errors).toContain('Shared component shared-1 references invalid type invalid-type-id')
    })
  })

  describe('handleImportError', () => {
    it('should return true for recoverable errors within retry limit', async () => {
      // Arrange
      const networkError = new Error('NetworkError: Connection timeout')

      // Act
      const shouldRetry = await orchestrator.handleImportError(networkError, 0, 3)

      // Assert
      expect(shouldRetry).toBe(true)
    })

    it('should return false for non-recoverable errors', async () => {
      // Arrange
      const validationError = new Error('ValidationError: Invalid data')

      // Act
      const shouldRetry = await orchestrator.handleImportError(validationError, 0, 3)

      // Assert
      expect(shouldRetry).toBe(false)
    })

    it('should return false when retry limit exceeded', async () => {
      // Arrange
      const networkError = new Error('NetworkError: Connection timeout')

      // Act
      const shouldRetry = await orchestrator.handleImportError(networkError, 3, 3)

      // Assert
      expect(shouldRetry).toBe(false)
    })
  })

  describe('rollbackImport', () => {
    it('should delete import data in reverse order', async () => {
      // Arrange
      const websiteId = 'website-123'
      const importResult = {
        sharedComponents: [{ id: 'shared-1' }],
        structures: [{ id: 'struct-1' }],
        pages: [{ id: 'page-1' }],
        componentTypes: [{ id: 'type-1' }]
      }

      // Act
      await orchestrator.rollbackImport(websiteId, importResult)

      // Assert
      expect(mockPrisma.websiteSharedComponent.deleteMany).toHaveBeenCalledWith({
        where: { websiteId }
      })
      expect(mockPrisma.websiteStructure.deleteMany).toHaveBeenCalledWith({
        where: { websiteId }
      })
      expect(mockPrisma.websitePage.deleteMany).toHaveBeenCalledWith({
        where: { websiteId }
      })
      expect(mockPrisma.websiteComponentType.deleteMany).toHaveBeenCalledWith({
        where: { websiteId }
      })
    })
  })

  describe('generateImportSummary', () => {
    it('should generate human-readable import summary', () => {
      // Arrange
      const result = {
        websiteId: 'website-123',
        pages: [],
        structures: [],
        componentTypes: [],
        sharedComponents: [],
        statistics: {
          totalPages: 5,
          totalComponents: 25,
          uniqueComponentTypes: 8,
          sharedComponentsDetected: 3,
          processingTimeMs: 1500
        }
      }

      // Act
      const summary = orchestrator.generateImportSummary(result)

      // Assert
      expect(summary).toContain('Import Summary for Website website-123')
      expect(summary).toContain('Pages Created: 5')
      expect(summary).toContain('Total Components: 25')
      expect(summary).toContain('Unique Component Types: 8')
      expect(summary).toContain('Shared Components Detected: 3')
      expect(summary).toContain('Processing Time: 1500ms')
      expect(summary).toContain('Import Status: Completed Successfully')
    })
  })

  describe('reportProgress', () => {
    it('should call progress callback when provided', () => {
      // Arrange
      const progressCallback = jest.fn()
      const orchestratorWithCallback = new ImportOrchestrator({
        ...mockConfig
      })

      const progress: ImportProgress = {
        stage: 'extracting',
        progress: 50,
        message: 'Extracting components'
      }

      // Simulate setting progress callback (this would normally be done in orchestrateImport)
      ;(orchestratorWithCallback as any).progressCallback = progressCallback

      // Act
      orchestratorWithCallback.reportProgress(progress)

      // Assert
      expect(progressCallback).toHaveBeenCalledWith(progress)
    })

    it('should not fail when no progress callback is provided', () => {
      // Arrange
      const progress: ImportProgress = {
        stage: 'building',
        progress: 30,
        message: 'Building pages'
      }

      // Act & Assert - should not throw
      expect(() => orchestrator.reportProgress(progress)).not.toThrow()
    })
  })

  describe('verifyDatabaseConsistency', () => {
    it('should return true when database consistency checks pass', async () => {
      // Arrange
      const websiteId = 'website-123'
      mockPrisma.websitePage.findMany.mockResolvedValue([
        { id: 'page-1', websiteComponentType: { id: 'type-1' } }
      ])
      mockPrisma.websiteStructure.findMany.mockResolvedValue([
        { id: 'struct-1', websitePage: { id: 'page-1' } }
      ])

      // Act
      const result = await orchestrator.verifyDatabaseConsistency(websiteId)

      // Assert
      expect(result).toBe(true)
      expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith({
        where: { websiteId }
      })
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledWith({
        where: { websiteId },
        include: { websitePage: true }
      })
    })

    it('should return false when database consistency checks fail', async () => {
      // Arrange
      const websiteId = 'website-123'
      mockPrisma.websitePage.findMany.mockRejectedValue(new Error('Database error'))

      // Act
      const result = await orchestrator.verifyDatabaseConsistency(websiteId)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('Enhanced Service Orchestration Tests', () => {
    const websiteId = 'test-website-integration'
    const mockDetectionResults: DetectionResult[] = [
      {
        url: 'https://test.example.com/page1',
        title: 'Page 1',
        screenshot: 'page1.png',
        detectedComponents: [
          { id: 'comp-1', type: 'header', confidence: 0.95, properties: { title: 'Main Header' } },
          { id: 'comp-2', type: 'button', confidence: 0.87, properties: { text: 'Click Me' } }
        ],
        metadata: { pageSize: 15000 }
      },
      {
        url: 'https://test.example.com/page2',
        title: 'Page 2',
        screenshot: 'page2.png',
        detectedComponents: [
          { id: 'comp-3', type: 'header', confidence: 0.92, properties: { title: 'Secondary Header' } },
          { id: 'comp-4', type: 'footer', confidence: 0.89, properties: { copyright: '2024' } }
        ],
        metadata: { pageSize: 12000 }
      }
    ]

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks()

      // Setup successful service orchestration flow
      mockComponentTypeExtractor.extractPatterns.mockResolvedValue(['header', 'button', 'footer'])
      mockComponentTypeExtractor.reduceToTypes.mockResolvedValue([
        { id: 'ct-1', websiteId, type: 'header', category: 'layout', defaultConfig: {} },
        { id: 'ct-2', websiteId, type: 'button', category: 'interactive', defaultConfig: {} },
        { id: 'ct-3', websiteId, type: 'footer', category: 'layout', defaultConfig: {} }
      ])

      mockPageBuilderService.createPagesInBatch.mockResolvedValue([
        { id: 'page-1', websiteId, title: 'Page 1', content: { components: [] } },
        { id: 'page-2', websiteId, title: 'Page 2', content: { components: [] } }
      ])

      mockStructureService.createStructures.mockResolvedValue([
        { id: 'struct-1', websiteId, websitePageId: 'page-1', fullPath: '/page-1' },
        { id: 'struct-2', websiteId, websitePageId: 'page-2', fullPath: '/page-2' }
      ])

      mockSharedComponentDetector.detectShared.mockResolvedValue([
        { id: 'shared-1', websiteId, name: 'Shared Header', componentTypeId: 'ct-1' }
      ])

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        return await callback()
      })
    })

    describe('Service Coordination Sequence', () => {
      it('should coordinate all services in correct sequence', async () => {
        // Arrange
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        }

        // Act
        const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert - Verify services called in correct order
        expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledBefore(
          mockComponentTypeExtractor.reduceToTypes as jest.Mock
        )
        expect(mockComponentTypeExtractor.reduceToTypes).toHaveBeenCalledBefore(
          mockPageBuilderService.createPagesInBatch as jest.Mock
        )
        expect(mockPageBuilderService.createPagesInBatch).toHaveBeenCalledBefore(
          mockStructureService.createStructures as jest.Mock
        )
        expect(mockStructureService.createStructures).toHaveBeenCalledBefore(
          mockSharedComponentDetector.detectShared as jest.Mock
        )

        // Verify all services received correct data
        expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledWith(mockDetectionResults)
        expect(mockComponentTypeExtractor.reduceToTypes).toHaveBeenCalledWith(['header', 'button', 'footer'], websiteId)
        expect(mockPageBuilderService.createPagesInBatch).toHaveBeenCalled()
        const callArg = (mockPageBuilderService.createPagesInBatch as jest.Mock).mock.calls[0][0]
        expect(Array.isArray(callArg)).toBe(true)
        expect(callArg.length).toBeGreaterThan(0)

        expect(result.statistics.totalPages).toBe(2)
        expect(result.statistics.uniqueComponentTypes).toBeGreaterThanOrEqual(3)
      })
    })

    describe('Transaction Handling', () => {
      it('should execute all operations within successful transaction', async () => {
        // Arrange
        const transactionSpy = jest.fn().mockImplementation(async (callback: Function) => {
          return await callback()
        })
        mockPrisma.$transaction = transactionSpy

        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        }

        // Act
        await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        expect(transactionSpy).toHaveBeenCalledTimes(1)
        expect(transactionSpy).toHaveBeenCalledWith(expect.any(Function), {
          maxWait: 5000,
          timeout: 30000,
          isolationLevel: 'Serializable'
        })

        // Verify representative database operations were called (executed within transaction scope)
        expect(mockPrisma.websiteComponentType.createMany).toHaveBeenCalled()
        expect(mockPageBuilderService.createPagesInBatch).toHaveBeenCalled()
        expect(mockStructureService.createStructures).toHaveBeenCalled()
        expect(mockPrisma.websiteSharedComponent.create).toHaveBeenCalled()
      })

      it('should perform rollback when transaction fails', async () => {
        // Arrange
        const error = new Error('Transaction failed')
        mockComponentTypeExtractor.extractPatterns.mockRejectedValue(error)
        
        const rollbackSpy = jest.spyOn(orchestrator, 'rollbackImport').mockImplementation()

        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        }

        // Act & Assert
        await expect(
          orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)
        ).rejects.toThrow('Transaction failed')

        expect(rollbackSpy).toHaveBeenCalledWith(
          websiteId,
          expect.any(Object)
        )
      })
    })

    describe('Rollback on Failure Points', () => {
      const failureScenarios = [
        {
          name: 'component extraction failure',
          setup: () => mockComponentTypeExtractor.extractPatterns.mockRejectedValue(new Error('Extraction failed'))
        },
        {
          name: 'page building failure',
          setup: () => mockPageBuilderService.createPagesInBatch.mockRejectedValue(new Error('Page build failed'))
        },
        {
          name: 'structure creation failure',
          setup: () => mockStructureService.createStructures.mockRejectedValue(new Error('Structure failed'))
        },
        {
          name: 'shared component detection failure',
          setup: () => mockSharedComponentDetector.detectShared.mockRejectedValue(new Error('Shared detection failed'))
        }
      ]

      failureScenarios.forEach(scenario => {
        it(`should rollback on ${scenario.name}`, async () => {
          // Arrange
          scenario.setup()
          
          const rollbackSpy = jest.spyOn(orchestrator, 'rollbackImport').mockImplementation()
          
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true
          }

          // Act
          try {
            await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)
          } catch (error) {
            // Expected to fail
          }

          // Assert
          expect(rollbackSpy).toHaveBeenCalledWith(websiteId, expect.any(Object))
        })
      })
    })

    describe('Progress Reporting', () => {
      it('should report progress at correct intervals (10%, 30%, 50%, 70%, 90%, 100%)', async () => {
        // Arrange
        const progressUpdates: any[] = []
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true,
          progressCallback: (progress) => progressUpdates.push(progress)
        }

        // Act
        await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        expect(progressUpdates.length).toBeGreaterThanOrEqual(6) // At least 6 progress updates

        // Check for key progress milestones
        const progressValues = progressUpdates.map(p => p.progress)
        const expectedMilestones = [0, 10, 30, 50, 70, 90, 100]
        
        expectedMilestones.forEach(milestone => {
          const hasCloseProgress = progressValues.some(p => Math.abs(p - milestone) <= 5)
          expect(hasCloseProgress).toBe(true)
        })

        // Verify progress stages are reported
        const stages = progressUpdates.map(p => p.stage)
        expect(stages).toContain('extracting')
        expect(stages).toContain('building')
        expect(stages).toContain('structuring')
        expect(stages).toContain('detecting')
        expect(stages).toContain('finalizing')
      })

      it('should include meaningful messages in progress updates', async () => {
        // Arrange
        const progressUpdates: any[] = []
        const options: ImportOptions = {
          enableTransactions: true,
          progressCallback: (progress) => progressUpdates.push(progress)
        }

        // Act
        await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        progressUpdates.forEach(progress => {
          expect(progress).toHaveProperty('message')
          expect(typeof progress.message).toBe('string')
          expect(progress.message.length).toBeGreaterThan(0)
        })

        // Check for specific meaningful messages
        const messages = progressUpdates.map(p => p.message)
        expect(messages.some(m => m.includes('Extracting') || m.includes('extracting'))).toBe(true)
        expect(messages.some(m => m.includes('Building') || m.includes('building'))).toBe(true)
        expect(messages.some(m => m.includes('completed') || m.includes('Completed'))).toBe(true)
      })
    })

    describe('Error Recovery Strategies', () => {
      it('should retry recoverable errors (network timeouts)', async () => {
        // Arrange
        const networkError = new Error('NetworkError: Connection timeout')
        mockComponentTypeExtractor.extractPatterns
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError) // Fail twice
          .mockResolvedValue(['header', 'button']) // Then succeed

        const options: ImportOptions = {
          enableTransactions: true,
          maxRetries: 3
        }

        // Act
        const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledTimes(3)
        expect(result.websiteId).toBe(websiteId)
      })

      it('should retry rate limit errors with exponential backoff', async () => {
        // Arrange
        const rateLimitError = new Error('RateLimitError: Too many requests')
        mockComponentTypeExtractor.extractPatterns
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValue(['header', 'button'])

        const options: ImportOptions = {
          enableTransactions: true,
          maxRetries: 2
        }

        // Act
        const result = await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledTimes(2)
        expect(result.websiteId).toBe(websiteId)
      })

      it('should not retry non-recoverable validation errors', async () => {
        // Arrange
        const validationError = new Error('ValidationError: Invalid data schema')
        mockComponentTypeExtractor.extractPatterns.mockRejectedValue(validationError)

        const options: ImportOptions = {
          enableTransactions: true,
          maxRetries: 3
        }

        // Act & Assert
        await expect(
          orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)
        ).rejects.toThrow('ValidationError: Invalid data schema')

        expect(mockComponentTypeExtractor.extractPatterns).toHaveBeenCalledTimes(1)
      })
    })

    describe('WebSocket Updates Backward Compatibility', () => {
      it('should maintain backward compatible progress format', async () => {
        // Arrange
        const progressUpdates: any[] = []
        const options: ImportOptions = {
          enableTransactions: true,
          progressCallback: (progress) => progressUpdates.push(progress)
        }

        // Act
        await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        progressUpdates.forEach(progress => {
          // Check backward compatible fields
          expect(progress).toHaveProperty('stage')
          expect(progress).toHaveProperty('progress')
          expect(progress).toHaveProperty('message')

          // Ensure progress is numeric and in valid range
          expect(typeof progress.progress).toBe('number')
          expect(progress.progress).toBeGreaterThanOrEqual(0)
          expect(progress.progress).toBeLessThanOrEqual(100)

          // Ensure stage is a string
          expect(typeof progress.stage).toBe('string')
          expect(progress.stage.length).toBeGreaterThan(0)
        })
      })

      it('should emit progress updates in expected format for WebSocket consumption', async () => {
        // Arrange
        const progressUpdates: any[] = []
        const options: ImportOptions = {
          enableTransactions: true,
          progressCallback: (progress) => {
            // Simulate WebSocket serialization/deserialization
            const serialized = JSON.stringify(progress)
            const deserialized = JSON.parse(serialized)
            progressUpdates.push(deserialized)
          }
        }

        // Act
        await orchestrator.orchestrateImport(mockDetectionResults, websiteId, options)

        // Assert
        expect(progressUpdates.length).toBeGreaterThan(0)
        
        progressUpdates.forEach(progress => {
          // Ensure all fields survive JSON serialization
          expect(progress.stage).toBeDefined()
          expect(progress.progress).toBeDefined()
          expect(progress.message).toBeDefined()
          
          // No undefined values that could break WebSocket clients
          expect(progress.stage).not.toBe(undefined)
          expect(progress.progress).not.toBe(undefined)
          expect(progress.message).not.toBe(undefined)
        })
      })
    })
  })
})
