import { OptimizelyProvider } from '../../provider'
import { ProviderRegistry } from '../../../registry'

describe('OptimizelyProvider Integration - Sync Workflow', () => {
  let provider: OptimizelyProvider
  let registry: ProviderRegistry

  beforeEach(() => {
    // Reset registry singleton
    ;(ProviderRegistry as any)['instance'] = undefined
    registry = ProviderRegistry.getInstance()
    provider = new OptimizelyProvider()
  })

  describe('Provider Registration', () => {
    it('registers and activates provider', () => {
      registry.register('optimizely', provider)
      registry.setActiveProvider('optimizely')
      expect(registry.getProvider('optimizely')).toBe(provider)
      expect(registry.getActiveProvider()).toBe(provider)
    })
  })

  describe('Compiled Type Support Ensure', () => {
    it('ensures compiled content types via support hooks', async () => {
      const support = provider.getCompiledTypeSupport()
      expect(support).toBeDefined()
      const mockClient = (provider as any).client

      // First type does not exist (create), second exists (update)
      mockClient.getContentType = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ key: 'hero', properties: {} } as any)
      mockClient.createContentType = jest.fn().mockResolvedValue({ key: 'article' } as any)
      mockClient.updateContentType = jest.fn().mockResolvedValue({ key: 'hero' } as any)

      const contentTypes = [
        { id: 't1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'page', fields: [] },
        { id: 't2', key: 'hero', name: 'Hero', pluralName: 'Heros', category: 'component', fields: [] },
      ] as any

      const compiled = support!.compile(contentTypes)
      await support!.configure?.(compiled as any)
      await support!.ensure?.(compiled as any)

      expect(mockClient.getContentType).toHaveBeenCalledTimes(2)
      expect(mockClient.createContentType).toHaveBeenCalledTimes(1)
      expect(mockClient.updateContentType).toHaveBeenCalledTimes(1)
    })
  })
})


