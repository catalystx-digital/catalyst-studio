import { resolve } from 'node:path'
import type { ComponentMappingSummary } from '../core/component-mapper'
import type {
  GeneratorDiagnostic,
  RouteDefinition,
  SiteSnapshot,
  SlugRegistryEntry
} from '../core/types'
import { createEmptyMediaDiagnosticsReport } from '../core/types'
import type { StructureIndex } from '../core/structure'
import { ProjectBuilder } from '../generator/project-builder'
import { populateProjectFiles } from '../generator/scaffold'

describe('populateProjectFiles', () => {
  const repoRoot = resolve(__dirname, '..', '..', '..')

  function buildSnapshot(): SiteSnapshot {
    return {
      site: { id: 'site', name: 'Test Site' },
      pages: [
        {
          id: 'page-home',
          title: 'Home',
          fullPath: '/',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [],
          metadata: {},
          sharedComponentIds: []
        }
      ],
      sharedComponents: [],
      structure: [],
      capturedAt: new Date().toISOString()
    }
  }

  it('copies studio design system modules used by UCS runtime builders', () => {
    const builder = new ProjectBuilder('/tmp/head-scaffold-test')
    const snapshot = buildSnapshot()

    const componentSummary: ComponentMappingSummary = {
      pages: [
        {
          pageId: 'page-home',
          fullPath: '/',
          templateKey: null,
          template: undefined,
          components: []
        }
      ],
      diagnostics: [],
      componentImports: new Map()
    }

    const routes: RouteDefinition[] = [
      {
        pageId: 'page-home',
        fullPath: '/',
        canonicalFullPath: '/',
        routePath: '',
        canonicalRoutePath: '',
        segments: [],
        canonicalSegments: [],
        title: 'Home',
        templateKey: null
      }
    ]

    const slugRegistry: SlugRegistryEntry[] = [
      {
        pageId: 'page-home',
        slug: [],
        canonicalSlug: [],
        canonicalFullPath: '/',
        originalSlug: [],
        originalFullPath: '/',
        fullPath: '/',
        templateKey: null,
        title: 'Home',
        aliasOf: null,
        structureId: null,
        parentId: null
      }
    ]

    const structureIndex: StructureIndex = {
      nodes: [],
      childrenByParent: {},
      pageToStructure: {
        'page-home': null
      },
      nodeById: {}
    }

    const diagnostics: GeneratorDiagnostic[] = []
    const diagnosticSummary = { infoCount: 0, warnCount: 0, errorCount: 0 }

    populateProjectFiles(builder, {
      snapshot,
      provider: 'ucs',
      projectName: 'test-site',
      diagnostics,
      diagnosticSummary,
      componentSummary,
      routes,
      slugRegistry,
      structureIndex,
      websiteId: snapshot.site.id,
      templateOverrideKey: null,
      repoRoot,
      mediaDiagnostics: createEmptyMediaDiagnosticsReport()
    })

    const filePaths = builder.listFiles().map(file => file.path)
    expect(filePaths).toContain('lib/studio/design-system/design-concept.repository.ts')
  })
})
