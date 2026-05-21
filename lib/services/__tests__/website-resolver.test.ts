import { WebsiteResolver } from '@/lib/services/website-resolver'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

const website = prisma.website as unknown as {
  findFirst: jest.Mock
  findUnique: jest.Mock
}

describe('WebsiteResolver', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('does not fall back to an arbitrary active website for domain resolution', async () => {
    process.env.WEBSITE_RESOLUTION_STRATEGY = 'domain'
    delete process.env.WEBSITE_DOMAIN_MAP

    const resolver = new WebsiteResolver()
    const result = await resolver.resolve({ host: 'example.com' })

    expect(result).toBeNull()
    expect(website.findFirst).not.toHaveBeenCalled()
  })

  it('resolves domains only through explicit map entries', async () => {
    process.env.WEBSITE_RESOLUTION_STRATEGY = 'domain'
    process.env.WEBSITE_DOMAIN_MAP = JSON.stringify({ 'example.com': 'site-1' })
    website.findFirst.mockResolvedValue({ id: 'site-1' })

    const resolver = new WebsiteResolver()
    const result = await resolver.resolve({ host: 'example.com:443' })

    expect(result).toBe('site-1')
    expect(website.findFirst).toHaveBeenCalledWith({
      where: { id: 'site-1', isActive: true },
      select: { id: true },
    })
  })
})

