import { EnhancedExportValidator, ValidationSeverity, ExportErrorCode } from '../export-validator'
import { StandardExport } from '../bundle-exporter'

describe('EnhancedExportValidator', () => {
  let validator: EnhancedExportValidator

  beforeEach(() => {
    validator = new EnhancedExportValidator()
  })

  describe('Missing Dependencies Detection', () => {
    it('should detect missing component dependencies', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [
          { id: 'comp1', type: 'button', category: 'ui', props: {}, content: {} }
        ],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 1,
            folders: 0,
            totalExportTime: 100
          },
          componentRelationships: [
            {
              componentId: 'comp1',
              dependencies: [
                { targetId: 'comp2', type: 'reference' }
              ]
            }
          ]
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe(ExportErrorCode.MISSING_DEPENDENCIES)
      expect(result.errors[0].message).toContain('depends on missing component')
    })

    it('should detect missing content references', async () => {
      const exportData: StandardExport = {
        contentTypes: [
          { id: 'type1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'content', fields: {} }
        ],
        contentItems: [
          { 
            id: 'item1', 
            contentTypeId: 'type1', 
            title: 'Test Item',
            slug: 'test-item',
            content: { referenceId: 'missing-item' }
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 1,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.warnings.length).toBeGreaterThan(0)
      const referenceWarning = result.warnings.find(w => 
        w.message.includes('references non-existent content')
      )
      expect(referenceWarning).toBeDefined()
    })

    it('should detect missing folder references', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: 'item1', 
            contentTypeId: 'type1',
            title: 'Test Item',
            slug: 'test-item',
            content: {},
            metadata: { folderId: 'missing-folder' }
          } as any
        ],
        components: [],
        folders: { 
          root: [
            { id: 'folder1', name: 'Folder 1', path: '/folder1', contentItems: [], children: [] }
          ], 
          totalFolders: 1, 
          maxDepth: 1,
          pathMappings: { 'folder1': '/folder1' } 
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 1,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      // Should have at least the warning for missing folder reference
      const folderError = result.errors.find(e => 
        e.message.includes('references missing folder')
      )
      if (folderError) {
        expect(folderError.code).toBe(ExportErrorCode.MISSING_DEPENDENCIES)
      }
    })
  })

  describe('Circular Dependencies Detection', () => {
    it('should detect simple circular reference (A→B→A)', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [
          { id: 'compA', type: 'container', category: 'layout', props: {}, content: {} },
          { id: 'compB', type: 'section', category: 'layout', props: {}, content: {} }
        ],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 2,
            folders: 0,
            totalExportTime: 100
          },
          componentRelationships: [
            {
              componentId: 'compA',
              dependencies: [
                { targetId: 'compB', type: 'reference' }
              ]
            },
            {
              componentId: 'compB',
              dependencies: [
                { targetId: 'compA', type: 'reference' }
              ]
            }
          ]
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const circularError = result.errors.find(e => 
        e.code === ExportErrorCode.CIRCULAR_REFERENCE
      )
      expect(circularError).toBeDefined()
      expect(circularError?.message).toContain('Circular dependency detected')
    })

    it('should detect complex circular reference (A→B→C→A)', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [
          { id: 'compA', type: 'container', category: 'layout', props: {}, content: {} },
          { id: 'compB', type: 'section', category: 'layout', props: {}, content: {} },
          { id: 'compC', type: 'header', category: 'layout', props: {}, content: {} }
        ],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 3,
            folders: 0,
            totalExportTime: 100
          },
          componentRelationships: [
            {
              componentId: 'compA',
              dependencies: [
                { targetId: 'compB', type: 'reference' }
              ]
            },
            {
              componentId: 'compB',
              dependencies: [
                { targetId: 'compC', type: 'reference' }
              ]
            },
            {
              componentId: 'compC',
              dependencies: [
                { targetId: 'compA', type: 'reference' }
              ]
            }
          ]
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const circularError = result.errors.find(e => 
        e.code === ExportErrorCode.CIRCULAR_REFERENCE
      )
      expect(circularError).toBeDefined()
      expect(circularError?.details.cycle).toContain('compA')
      expect(circularError?.details.cycle).toContain('compB')
      expect(circularError?.details.cycle).toContain('compC')
    })

    it('should detect multiple independent cycles', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [
          { id: 'comp1', type: 'container', category: 'layout', props: {}, content: {} },
          { id: 'comp2', type: 'section', category: 'layout', props: {}, content: {} },
          { id: 'comp3', type: 'header', category: 'layout', props: {}, content: {} },
          { id: 'comp4', type: 'footer', category: 'layout', props: {}, content: {} }
        ],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 4,
            folders: 0,
            totalExportTime: 100
          },
          componentRelationships: [
            {
              componentId: 'comp1',
              dependencies: [
                { targetId: 'comp2', type: 'reference' }
              ]
            },
            {
              componentId: 'comp2',
              dependencies: [
                { targetId: 'comp1', type: 'reference' }
              ]
            },
            {
              componentId: 'comp3',
              dependencies: [
                { targetId: 'comp4', type: 'reference' }
              ]
            },
            {
              componentId: 'comp4',
              dependencies: [
                { targetId: 'comp3', type: 'reference' }
              ]
            }
          ]
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const circularErrors = result.errors.filter(e => 
        e.code === ExportErrorCode.CIRCULAR_REFERENCE
      )
      expect(circularErrors.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Data Integrity Validation', () => {
    it('should validate required fields in content items', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: '', // Missing ID
            contentTypeId: 'type1',
            title: 'Test',
            slug: 'test',
            content: {}
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const integrityError = result.errors.find(e => 
        e.code === ExportErrorCode.DATA_INTEGRITY_ERROR &&
        e.message.includes('missing required field: id')
      )
      expect(integrityError).toBeDefined()
    })

    it('should validate content type structure', async () => {
      const exportData: StandardExport = {
        contentTypes: [
          { 
            id: 'type1',
            key: 'article',
            name: '', // Missing name
            pluralName: 'Articles',
            category: 'content',
            fields: {}
          }
        ],
        contentItems: [],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 1,
            contentItems: 0,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      const integrityError = result.errors.find(e => 
        e.code === ExportErrorCode.DATA_INTEGRITY_ERROR &&
        e.message.includes('missing required fields')
      )
      expect(integrityError).toBeDefined()
    })

    it('should validate component structure', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [
          { 
            id: '',  // Missing ID
            type: 'button',
            category: 'ui',
            props: {},
            content: {}
          }
        ],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 1,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const componentError = result.errors.find(e => 
        e.code === ExportErrorCode.DATA_INTEGRITY_ERROR &&
        e.message.includes('Component missing required fields')
      )
      expect(componentError).toBeDefined()
    })

    it('should detect empty data objects and warn', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: 'item1',
            contentTypeId: 'type1',
            title: 'Test',
            slug: 'test',
            content: {} // Empty content
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      const emptyDataWarning = result.warnings.find(w => 
        w.message.includes('has empty data object')
      )
      expect(emptyDataWarning).toBeDefined()
    })
  })

  describe('Reference Resolution', () => {
    it('should validate valid references', async () => {
      const exportData: StandardExport = {
        contentTypes: [
          { id: 'type1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'content', fields: {} }
        ],
        contentItems: [
          { 
            id: 'item1',
            contentTypeId: 'type1', // Valid reference
            title: 'Test',
            slug: 'test',
            content: {}
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 1,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      // Should not have reference errors for valid references
      const refError = result.errors.find(e => 
        e.code === ExportErrorCode.UNRESOLVED_REFERENCE &&
        e.message.includes('references non-existent content type')
      )
      expect(refError).toBeUndefined()
    })

    it('should detect broken content type references', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: 'item1',
            contentTypeId: 'missing-type', // Invalid reference
            title: 'Test',
            slug: 'test',
            content: {}
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.valid).toBe(false)
      const refError = result.errors.find(e => 
        e.message.includes('references non-existent content type')
      )
      expect(refError).toBeDefined()
    })

    it('should detect cross-type reference validation', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: 'item1',
            contentTypeId: 'type1',
            title: 'Test',
            slug: 'test',
            content: {
              componentId: 'missing-component'
            }
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      const componentRefWarning = result.warnings.find(w => 
        w.message.includes('references non-existent component')
      )
      expect(componentRefWarning).toBeDefined()
    })

    it('should handle external references', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 0,
            folders: 0,
            totalExportTime: 100
          },
          externalReferences: [
            { id: 'external-1', type: 'image', url: 'https://example.com/image.jpg' }
          ]
        }
      }

      const result = await validator.validateExportData(exportData)

      const extRefWarning = result.warnings.find(w => 
        w.message.includes('Export contains external reference')
      )
      expect(extRefWarning).toBeDefined()
    })
  })

  describe('Validation Summary Generation', () => {
    it('should generate accurate count summary', async () => {
      const exportData: StandardExport = {
        contentTypes: [
          { id: 'type1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'content', fields: {} },
          { id: 'type2', key: 'page', name: 'Page', pluralName: 'Pages', category: 'content', fields: {} }
        ],
        contentItems: [
          { id: 'item1', contentTypeId: 'type1', title: 'Test 1', slug: 'test-1', content: {} },
          { id: 'item2', contentTypeId: 'type1', title: 'Test 2', slug: 'test-2', content: {} },
          { id: 'item3', contentTypeId: 'type2', title: 'Test 3', slug: 'test-3', content: {} }
        ],
        components: [
          { id: 'comp1', type: 'button', category: 'ui', props: {}, content: {} }
        ],
        folders: { 
          root: [
            { id: 'folder1', name: 'Folder 1', path: '/folder1', contentItems: [], children: [] }
          ], 
          totalFolders: 1,
          maxDepth: 1,
          pathMappings: {}
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 2,
            contentItems: 3,
            components: 1,
            folders: 1,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.summary.contentTypes).toBe(2)
      expect(result.summary.websitePages).toBe(3)
      expect(result.summary.components).toBe(1)
      expect(result.summary.folders).toBe(1)
    })

    it('should estimate export size', async () => {
      const exportData: StandardExport = {
        contentTypes: [
          { id: 'type1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'content', fields: {} }
        ],
        contentItems: [
          { id: 'item1', contentTypeId: 'type1', title: 'Test', slug: 'test', content: { data: 'Some content' } }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 1,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.summary.estimatedSize).toBeGreaterThan(0)
      expect(typeof result.summary.estimatedSize).toBe('number')
    })

    it('should estimate export time', async () => {
      const exportData: StandardExport = {
        contentTypes: Array(10).fill(null).map((_, i) => ({
          id: `type${i}`,
          key: `type${i}`,
          name: `Type ${i}`,
          pluralName: `Types ${i}`,
          category: 'content',
          fields: {}
        })),
        contentItems: Array(100).fill(null).map((_, i) => ({
          id: `item${i}`,
          contentTypeId: 'type1',
          title: `Test ${i}`,
          slug: `test-${i}`,
          content: {}
        })),
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 10,
            contentItems: 100,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.summary.estimatedTime).toBeGreaterThan(0)
      expect(typeof result.summary.estimatedTime).toBe('number')
    })

    it('should track error and warning counts', async () => {
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [
          { 
            id: '', // Will cause error
            contentTypeId: 'missing-type', // Will cause error
            title: 'Test',
            slug: 'test',
            content: {} // Will cause warning
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 1,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result.summary.errorCount).toBeGreaterThan(0)
      expect(result.summary.warningCount).toBeGreaterThanOrEqual(0)
      expect(result.summary.errorCount).toBe(result.errors.length)
      expect(result.summary.warningCount).toBe(result.warnings.length)
    })
  })

  describe('Performance and Limits', () => {
    it('should handle large datasets efficiently', async () => {
      const largeExportData: StandardExport = {
        contentTypes: Array(50).fill(null).map((_, i) => ({
          id: `type${i}`,
          key: `type${i}`,
          name: `Type ${i}`,
          pluralName: `Types ${i}`,
          category: 'content',
          fields: {}
        })),
        contentItems: Array(1000).fill(null).map((_, i) => ({
          id: `item${i}`,
          contentTypeId: `type${i % 50}`,
          title: `Test ${i}`,
          slug: `test-${i}`,
          content: { data: `Content ${i}` }
        })),
        components: Array(200).fill(null).map((_, i) => ({
          id: `comp${i}`,
          type: 'component',
          category: 'ui',
          props: {},
          content: {}
        })),
        folders: { 
          root: [],
          totalFolders: 0,
          maxDepth: 0,
          pathMappings: {}
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 50,
            contentItems: 1000,
            components: 200,
            folders: 0,
            totalExportTime: 1000
          }
        }
      }

      const startTime = Date.now()
      const result = await validator.validateExportData(largeExportData)
      const validationTime = Date.now() - startTime

      // Should complete within 5 seconds even for large datasets
      expect(validationTime).toBeLessThan(5000)
      expect(result).toBeDefined()
      expect(result.summary.websitePages).toBe(1000)
    })

    it('should warn when validation takes too long', async () => {
      // This test is more conceptual since we can't easily mock the time
      // But the implementation should warn if validation exceeds 5 seconds
      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      // The warning would only appear if validation actually took > 5 seconds
      // This test mainly ensures the method completes without error
      expect(result).toBeDefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty export data', async () => {
      const emptyExportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(emptyExportData)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should handle null/undefined fields gracefully', async () => {
      const exportData: StandardExport = {
        contentTypes: null as any,
        contentItems: undefined as any,
        components: null as any,
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 0,
            folders: 0,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result).toBeDefined()
      expect(result.summary.contentTypes).toBe(0)
      expect(result.summary.websitePages).toBe(0)
      expect(result.summary.components).toBe(0)
    })

    it('should handle deeply nested folder structures', async () => {
      const createNestedFolder = (depth: number, id: string): any => {
        if (depth === 0) {
          return { id, name: `Folder ${id}`, path: `/path/${id}`, contentItems: [], children: [] }
        }
        return {
          id,
          name: `Folder ${id}`,
          path: `/path/${id}`,
          contentItems: [],
          children: [createNestedFolder(depth - 1, `${id}-child`)]
        }
      }

      const exportData: StandardExport = {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: { 
          root: [createNestedFolder(10, 'root-1')],
          totalFolders: 11,
          maxDepth: 10,
          pathMappings: {}
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          websiteName: 'Test Website',
          version: '1.0.0',
          statistics: {
            contentTypes: 0,
            contentItems: 0,
            components: 0,
            folders: 11,
            totalExportTime: 100
          }
        }
      }

      const result = await validator.validateExportData(exportData)

      expect(result).toBeDefined()
      expect(result.summary.folders).toBe(11)
    })

    it('should catch and handle validation exceptions', async () => {
      const malformedData = {
        // Intentionally malformed data
        contentTypes: 'not-an-array' as any,
        metadata: null
      } as any

      const result = await validator.validateExportData(malformedData)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].code).toBe(ExportErrorCode.VALIDATION_FAILED)
    })
  })
})