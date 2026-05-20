/**
 * @jest-environment node
 */

import { ProposalContextBuilder } from '../proposal-context-builder'

jest.mock('@/lib/studio/components/site-builder/transforms/to-react-flow', () => ({
  transformToReactFlow: jest.fn(() => ({
    nodes: [
      {
        id: 'node-1',
        data: {
          label: 'Home',
          fullPath: 'home',
          metadata: { status: 'published', contentTypeId: 'ct-1' }
        }
      },
      {
        id: 'node-2',
        data: {
          label: 'About',
          fullPath: 'home/about',
          metadata: { status: 'draft', contentTypeId: 'ct-1' }
        }
      }
    ],
    edges: []
  }))
}))

describe('ProposalContextBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('aggregates sitemap, content types, and design concepts with redaction', async () => {
    const prismaMock = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'website-1',
          name: 'Catalyst Demo',
          description: 'Modern commerce site'
        })
      }
    }

    const importJobRepositoryMock = {
      findById: jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 'completed',
        detectionResults: {
          summary: 'Contact us at hello@example.com for more info',
          pages: [{ title: 'Contact', url: 'mailto:hello@example.com' }]
        }
      }),
      findByWebsiteId: jest.fn().mockResolvedValue([])
    }

    const designConceptServiceMock = {
      listConcepts: jest.fn().mockResolvedValue([
        {
          id: 'concept-primary',
          name: 'Aurora',
          isDefault: true,
          metadata: { positioning: 'Studio commerce concept' },
          generatorSeed: 'seed-123'
        }
      ])
    }

    const designSystemRepositoryMock = {
      findLatestByConceptId: jest.fn().mockResolvedValue({
        tokens: {
          palette: {
            primary: [{ value: '#111111' }],
            secondary: [{ value: '#222222' }],
            accent: [{ value: '#333333' }],
            neutral: [{ value: '#444444' }],
            surface: [{ value: '#555555' }]
          },
          typography: {
            heading: [{ fontFamily: 'Sora' }],
            body: [{ fontFamily: 'Inter' }],
            ui: []
          },
          metadata: { generatorSeed: 'seed-123' }
        }
      })
    }

    const contentTypeFetcherMock = jest.fn().mockResolvedValue([
      {
        id: 'ct-1',
        name: 'Landing Page',
        category: 'page',
        fields: { fields: [{ required: false }] },
        settings: { description: 'Email: hello@example.com' }
      }
    ])

    const builder = new ProposalContextBuilder({
      prisma: prismaMock as never,
      siteStructureService: { getTree: jest.fn().mockResolvedValue({}) } as never,
      importJobRepository: importJobRepositoryMock as never,
      designConceptService: designConceptServiceMock as never,
      designSystemRepository: designSystemRepositoryMock as never,
      contentTypeFetcher: contentTypeFetcherMock as never
    })

    const result = await builder.build({
      websiteId: 'website-1',
      conceptId: 'concept-primary',
      includeAlternates: false
    })

    expect(result.context.website.name).toBe('Catalyst Demo')
    expect(result.context.sitemap.nodes).toHaveLength(2)
    expect(result.context.contentTypes[0].instanceCount).toBe(2)
    expect(result.context.importBrief?.summary).toContain('[redacted]')
    expect(result.context.designConcepts[0].palette.primary).toBe('#111111')
    expect(result.context.designConcepts[0].typography.heading).toBe('Sora')
  })
})
