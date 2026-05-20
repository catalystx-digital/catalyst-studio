// ProviderRegistry Unit Tests

import { ProviderRegistry, providerRegistry } from '../registry';
import { ICMSProvider, ProviderNotFoundError } from '../types';
import { MockProvider } from '../mock/mock-provider';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let mockProvider: ICMSProvider;

  beforeEach(() => {
    // Get fresh instance and clear it
    registry = ProviderRegistry.getInstance();
    registry.clear();
    mockProvider = new MockProvider();
  });

  describe('Singleton Behavior', () => {
    it('should return the same instance', () => {
      const instance1 = ProviderRegistry.getInstance();
      const instance2 = ProviderRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = ProviderRegistry.getInstance();
      instance1.register('test', mockProvider);
      
      const instance2 = ProviderRegistry.getInstance();
      expect(instance2.hasProvider('test')).toBe(true);
    });

    it('exported providerRegistry should be the singleton instance', () => {
      expect(providerRegistry).toBe(ProviderRegistry.getInstance());
    });
  });

  describe('Provider Registration', () => {
    it('should register a provider successfully', () => {
      registry.register('mock', mockProvider);
      expect(registry.hasProvider('mock')).toBe(true);
      expect(registry.getProviderCount()).toBe(1);
    });

    it('should throw error when platformId is missing', () => {
      expect(() => registry.register('', mockProvider)).toThrow('Platform ID is required');
    });

    it('should throw error when provider is missing', () => {
      expect(() => registry.register('mock', null as any)).toThrow('Provider instance is required');
    });

    it('should set first registered provider as active', () => {
      registry.register('mock', mockProvider);
      expect(registry.getActiveProviderId()).toBe('mock');
    });

    it('should not change active provider when registering additional providers', () => {
      const provider1 = new MockProvider();
      const provider2 = new MockProvider();
      
      registry.register('provider1', provider1);
      registry.register('provider2', provider2);
      
      expect(registry.getActiveProviderId()).toBe('provider1');
    });

    it('should allow overwriting existing provider', () => {
      const provider1 = new MockProvider();
      const provider2 = new MockProvider();
      
      registry.register('mock', provider1);
      registry.register('mock', provider2);
      
      expect(registry.getProvider('mock')).toBe(provider2);
      expect(registry.getProviderCount()).toBe(1);
    });
  });

  describe('Provider Retrieval', () => {
    beforeEach(() => {
      registry.register('mock', mockProvider);
    });

    it('should retrieve registered provider', () => {
      const retrieved = registry.getProvider('mock');
      expect(retrieved).toBe(mockProvider);
    });

    it('should return null for non-existent provider', () => {
      const retrieved = registry.getProvider('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should list all registered provider IDs', () => {
      const provider2 = new MockProvider();
      registry.register('provider2', provider2);
      
      const providers = registry.listProviders();
      expect(providers).toContain('mock');
      expect(providers).toContain('provider2');
      expect(providers.length).toBe(2);
    });
  });

  describe('Active Provider Management', () => {
    beforeEach(() => {
      registry.register('provider1', new MockProvider());
      registry.register('provider2', new MockProvider());
    });

    it('should set active provider successfully', () => {
      registry.setActiveProvider('provider2');
      expect(registry.getActiveProviderId()).toBe('provider2');
    });

    it('should throw error when setting non-existent provider as active', () => {
      expect(() => registry.setActiveProvider('non-existent'))
        .toThrow(ProviderNotFoundError);
    });

    it('should retrieve active provider instance', () => {
      registry.setActiveProvider('provider1');
      const active = registry.getActiveProvider();
      expect(active).toBeDefined();
      expect(active).toBe(registry.getProvider('provider1'));
    });

    it('should return null when no active provider is set', () => {
      registry.clear();
      const active = registry.getActiveProvider();
      expect(active).toBeNull();
    });

    it('should clear active provider when it is unregistered', () => {
      registry.setActiveProvider('provider1');
      registry.unregister('provider1');
      expect(registry.getActiveProviderId()).toBeNull();
    });
  });

  describe('Provider Unregistration', () => {
    beforeEach(() => {
      registry.register('mock', mockProvider);
    });

    it('should unregister provider successfully', () => {
      const result = registry.unregister('mock');
      expect(result).toBe(true);
      expect(registry.hasProvider('mock')).toBe(false);
    });

    it('should return false when unregistering non-existent provider', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should clear active provider if unregistered provider was active', () => {
      registry.setActiveProvider('mock');
      registry.unregister('mock');
      expect(registry.getActiveProviderId()).toBeNull();
    });
  });

  describe('Registry Management', () => {
    it('should clear all providers', () => {
      registry.register('provider1', new MockProvider());
      registry.register('provider2', new MockProvider());
      
      registry.clear();
      
      expect(registry.getProviderCount()).toBe(0);
      expect(registry.listProviders()).toEqual([]);
      expect(registry.getActiveProviderId()).toBeNull();
    });

    it('should check if provider exists', () => {
      registry.register('mock', mockProvider);
      
      expect(registry.hasProvider('mock')).toBe(true);
      expect(registry.hasProvider('non-existent')).toBe(false);
    });

    it('should return correct provider count', () => {
      expect(registry.getProviderCount()).toBe(0);
      
      registry.register('provider1', new MockProvider());
      expect(registry.getProviderCount()).toBe(1);
      
      registry.register('provider2', new MockProvider());
      expect(registry.getProviderCount()).toBe(2);
      
      registry.unregister('provider1');
      expect(registry.getProviderCount()).toBe(1);
    });
  });
});