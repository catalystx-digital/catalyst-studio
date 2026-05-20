"use strict";
import { POST as createConceptRoute } from '../[websiteId]/design-system/concepts/route'
import { POST as shuffleConceptRoute } from '../[websiteId]/design-system/concepts/[conceptId]/shuffle/route'
import { createTestRequest, createTestParams } from '../../websites/__tests__/test-helpers'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/studio/design-system/design-concept.service', () => {
  const createConcept = jest.fn()
  const shuffleConceptPalette = jest.fn()
  return {
    DesignConceptService: jest.fn().mockImplementation(() => ({
      createConcept,
      shuffleConceptPalette,
      listConcepts: jest.fn(),
      getConcept: jest.fn(),
      deleteConcept: jest.fn(),
      setDefaultConcept: jest.fn(),
      updateConceptDetails: jest.fn()
    })),
    __mocks: {
      createConcept,
      shuffleConceptPalette
    }
  }
})

jest.mock('@/lib/studio/config/feature-flags', () => ({
  isStudioDesignConceptsEnabled: jest.fn().mockReturnValue(true)
}))

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: { website: { findUnique: jest.Mock } }
}

const { __mocks } = jest.requireMock(
  '@/lib/studio/design-system/design-concept.service'
) as {
  __mocks: {
    createConcept: jest.Mock
    shuffleConceptPalette: jest.Mock
  }
}

describe('/api/website/[websiteId]/design-system/concepts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.website.findUnique.mockResolvedValue({ id: 'site-1' })
  })

  it('creates a concept and returns payload', async () => {
    __mocks.createConcept.mockResolvedValue({
      concept: { id: 'concept-1', name: 'Concept 1' },
      designSystem: { palette: {}, typography: {} },
      seed: 'seed-123'
    })

    const request = createTestRequest(
      { name: 'Concept 1' },
      'http://localhost:3000/api/website/site-1/design-system/concepts',
      'POST'
    )
    const response = await createConceptRoute(request, {
      params: createTestParams({ websiteId: 'site-1' })
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.concept.id).toBe('concept-1')
    expect(__mocks.createConcept).toHaveBeenCalled()
  })

  it('shuffles the palette for a concept', async () => {
    __mocks.shuffleConceptPalette.mockResolvedValue({
      concept: { id: 'concept-1', name: 'Concept 1' },
      designSystem: { palette: {}, typography: {} },
      seed: 'seed-456'
    })

    const request = createTestRequest(
      {},
      'http://localhost:3000/api/website/site-1/design-system/concepts/concept-1/shuffle',
      'POST'
    )
    const response = await shuffleConceptRoute(request, {
      params: createTestParams({ websiteId: 'site-1', conceptId: 'concept-1' })
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.seed).toBe('seed-456')
    expect(__mocks.shuffleConceptPalette).toHaveBeenCalledWith({
      websiteId: 'site-1',
      conceptId: 'concept-1',
      requestedBy: undefined
    })
  })
})
