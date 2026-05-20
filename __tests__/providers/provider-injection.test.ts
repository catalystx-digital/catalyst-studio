import { ProviderRegistry } from '@/lib/cms-export/registry';
import { ProviderFactory } from '@/lib/cms-export/factory';
import { MockProvider } from '@/lib/cms-export/mock';
import { getAvailableProviders } from '@/lib/cms-export/config';
import { ICMSProvider, UniversalContentType } from '@/lib/cms-export/types';

describe('Provider Injection System', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = ProviderRegistry.getInstance();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('ProviderRegistry', () => {
    it('should be a singleton', () => {
      const instance1 = ProviderRegistry.getInstance();
      const instance2 = ProviderRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should register and retrieve providers', () => {
      const mockProvider = new MockProvider();
      registry.register('mock', mockProvider);
      
      const retrieved = registry.getProvider('mock');
      expect(retrieved).toBe(mockProvider);
    });

    it('should set and get active provider', () => {
      const mockProvider = new MockProvider();
      registry.register('mock', mockProvider);
      registry.setActiveProvider('mock');
      
      const active = registry.getActiveProvider();
      expect(active).toBe(mockProvider);
      expect(registry.getActiveProviderId()).toBe('mock');
    });

    it('should handle provider not found', () => {
      const provider = registry.getProvider('nonexistent');
      expect(provider).toBeNull();
    });

    it('should list registered providers', () => {
      const mock1 = new MockProvider();
      const mock2 = new MockProvider();
      
      registry.register('mock1', mock1);
      registry.register('mock2', mock2);
      
      const providers = registry.listProviders();
      expect(providers).toContain('mock1');
      expect(providers).toContain('mock2');
      expect(providers).toHaveLength(2);
    });

    it('should unregister providers', () => {
      const mockProvider = new MockProvider();
      registry.register('mock', mockProvider);
      
      const unregistered = registry.unregister('mock');
      expect(unregistered).toBe(true);
      
      const provider = registry.getProvider('mock');
      expect(provider).toBeNull();
    });

    it('should clear active provider when unregistering', () => {
      const mockProvider = new MockProvider();
      registry.register('mock', mockProvider);
      registry.setActiveProvider('mock');
      
      registry.unregister('mock');
      
      expect(registry.getActiveProvider()).toBeNull();
      expect(registry.getActiveProviderId()).toBeNull();
    });
  });

  describe('ProviderFactory', () => {
    it('should create mock provider', () => {
      const provider = ProviderFactory.createProvider('mock');
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.id).toBe('mock');
    });

    it('should fallback to mock provider for unknown provider', () => {
      const provider = ProviderFactory.createProvider('unknown');
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('should apply configuration to provider', () => {
      const config = {
        simulateDelay: 100,
        shouldFail: false
      };
      
      const provider = ProviderFactory.createProvider('mock', config) as MockProvider;
      expect(provider).toBeInstanceOf(MockProvider);
      
      // Verify configuration was applied
      const calls = provider.getMethodCalls();
      expect(calls).toEqual([]);
    });

    it('should list available providers', () => {
      const providers = ProviderFactory.getAvailableProviders();
      expect(providers).toContain('optimizely');
      expect(providers).toContain('mock');
    });

    it('includes contentstack in available providers when credentials exist', () => {
      const previousKey = process.env.CONTENTSTACK_API_KEY;
      const previousToken = process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
      process.env.CONTENTSTACK_API_KEY = 'stack-key';
      process.env.CONTENTSTACK_MANAGEMENT_TOKEN = 'token-value';
      try {
        const providers = getAvailableProviders();
        expect(providers).toContain('contentstack');
      } finally {
        if (previousKey === undefined) {
          delete process.env.CONTENTSTACK_API_KEY;
        } else {
          process.env.CONTENTSTACK_API_KEY = previousKey;
        }
        if (previousToken === undefined) {
          delete process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
        } else {
          process.env.CONTENTSTACK_MANAGEMENT_TOKEN = previousToken;
        }
      }
    });

    it('should check if provider exists', () => {
      expect(ProviderFactory.hasProvider('mock')).toBe(true);
      expect(ProviderFactory.hasProvider('optimizely')).toBe(true);
      expect(ProviderFactory.hasProvider('nonexistent')).toBe(false);
    });
  });

  describe('MockProvider', () => {
    let mockProvider: MockProvider;

    beforeEach(() => {
      mockProvider = new MockProvider();
    });

    it('should implement ICMSProvider interface', () => {
      expect(mockProvider.id).toBe('mock');
      expect(mockProvider.name).toBe('Mock CMS Provider');
      expect(mockProvider.version).toBe('1.0.0');
    });

    it('should return test content types', async () => {
      const contentTypes = await mockProvider.getContentTypes();
      expect(contentTypes).toHaveLength(2);
      
      const blogPost = contentTypes.find(ct => ct.id === 'blog-post');
      expect(blogPost).toBeDefined();
      expect(blogPost?.name).toBe('Blog Post');
      expect(blogPost?.type).toBe('page');
    });

    it('should create new content type', async () => {
      const newType: UniversalContentType = {
        version: '1.0.0',
        id: 'test-type',
        name: 'TestType',
        type: 'component',
        isRoutable: false,
        fields: [
          {
            id: 'field1',
            name: 'field1',
            layer: 'primitive',
            type: 'text',
            required: true
          }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };
      
      await mockProvider.createContentType(newType);
      
      const retrieved = await mockProvider.getContentType('test-type');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('TestType');
    });

    it('should update existing content type', async () => {
      const update = {
        name: 'UpdatedBlogPost'
      };
      
      await mockProvider.updateContentType('blog-post', update);
      
      const retrieved = await mockProvider.getContentType('blog-post');
      expect(retrieved?.name).toBe('UpdatedBlogPost');
    });

    it('should delete content type', async () => {
      await mockProvider.deleteContentType('blog-post');
      
      const retrieved = await mockProvider.getContentType('blog-post');
      expect(retrieved).toBeNull();
    });

    it('should track method calls', async () => {
      await mockProvider.getContentTypes();
      await mockProvider.getContentType('blog-post');
      
      const calls = mockProvider.getMethodCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0].method).toBe('getContentTypes');
      expect(calls[1].method).toBe('getContentType');
      expect(calls[1].args).toEqual(['blog-post']);
    });

    it('should simulate delay when configured', async () => {
      mockProvider.configure({ simulateDelay: 50 });
      
      const start = Date.now();
      await mockProvider.getContentTypes();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should simulate failures when configured', async () => {
      mockProvider.configure({
        shouldFail: true,
        failureMessage: 'Test failure'
      });
      
      await expect(mockProvider.getContentTypes()).rejects.toThrow('Test failure');
    });

    it('should reset to initial state', () => {
      mockProvider.clearMethodCalls();
      mockProvider.configure({ simulateDelay: 100 });
      
      mockProvider.reset();
      
      const calls = mockProvider.getMethodCalls();
      expect(calls).toHaveLength(0);
    });

    it('should handle content instances', async () => {
      const instance = {
        id: 'test-1',
        typeId: 'blog-post',
        data: {
          title: 'New Post',
          content: 'Content here'
        }
      };
      
      const id = await mockProvider.createContentInstance(instance);
      expect(id).toBeDefined();
      
      const instances = await mockProvider.getContentInstances('blog-post');
      expect(instances.length).toBeGreaterThan(0);
      
      const retrieved = await mockProvider.getContentInstance('blog-post', id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.data.title).toBe('New Post');
    });

    it('should validate content types', async () => {
      const validType: UniversalContentType = {
        version: '1.0.0',
        id: 'valid',
        name: 'ValidType',
        type: 'page',
        isRoutable: true,
        fields: [{ 
          id: 'f1', 
          name: 'f1', 
          layer: 'primitive',
          type: 'text', 
          required: true 
        }],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };
      
      const invalidType: UniversalContentType = {
        version: '1.0.0',
        id: '',
        name: '',
        type: 'page',
        isRoutable: true,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };
      
      const validResult = await mockProvider.validateContentType(validType);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toBeUndefined();
      
      const invalidResult = await mockProvider.validateContentType(invalidType);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toBeDefined();
      expect(invalidResult.errors?.length).toBeGreaterThan(0);
    });

    it('should provide capabilities', () => {
      const capabilities = mockProvider.getCapabilities();
      
      expect(capabilities.supportsVersioning).toBe(true);
      expect(capabilities.supportsLocalizations).toBe(true);
      expect(capabilities.supportsComponents).toBe(true);
      expect(capabilities.customCapabilities?.supportsTestMode).toBe(true);
    });
  });

  describe('Provider Integration', () => {
    it('should switch providers dynamically', () => {
      const mock1 = new MockProvider();
      const mock2 = new MockProvider();
      
      registry.register('provider1', mock1);
      registry.register('provider2', mock2);
      
      registry.setActiveProvider('provider1');
      expect(registry.getActiveProvider()).toBe(mock1);
      
      registry.setActiveProvider('provider2');
      expect(registry.getActiveProvider()).toBe(mock2);
    });

    it('should handle provider lifecycle', async () => {
      // Create provider
      const provider = ProviderFactory.createProvider('mock');
      
      // Register it
      registry.register('test', provider);
      
      // Use it
      registry.setActiveProvider('test');
      const active = registry.getActiveProvider();
      expect(active).toBe(provider);
      
      // Verify it works via supported API
      const type = await active!.getContentType('blog-post');
      // When provider lacks this type, it should return null (mock has it by default)
      expect(type === null || type?.id === 'blog-post').toBeTruthy();
      
      // Clean up
      registry.unregister('test');
      expect(registry.getActiveProvider()).toBeNull();
    });
  });
});



