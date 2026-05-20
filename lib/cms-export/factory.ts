import { ICMSProvider } from './types';
import { getProviderConfig, isProviderEnabled, ProviderSpecificConfig } from './config';
import { createProviderMap } from './registry-map';
import { MockProvider } from './mock';

/**
 * Provider factory for creating CMS provider instances
 * Supports environment-based configuration and lazy loading
 */
export class ProviderFactory {
  private static providers = createProviderMap();

  private static debug(...args: unknown[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  }

  /**
   * Register a custom provider factory
   * @param id Provider identifier
   * @param factory Function that creates a provider instance
   */
  static registerProvider(id: string, factory: () => ICMSProvider): void {
    this.providers.set(id, factory);
  }

  /**
   * Create a provider instance based on configuration
   * @param providerId Provider identifier or 'auto' for environment-based selection
   * @param config Optional provider configuration
   * @returns Provider instance
   */
  static createProvider(
    providerId: string = 'auto',
    config?: ProviderSpecificConfig
  ): ICMSProvider {
    this.debug(`ProviderFactory.createProvider called with providerId: ${providerId}, config:`, config);
    
    // Auto-detect provider from environment
    if (providerId === 'auto') {
      const providerConfig = getProviderConfig();
      providerId = providerConfig.providerId;
      config = config || providerConfig.config;
    }

    const factory = this.providers.get(providerId);
    if (!factory) {
      // Fallback to mock provider if not found
      console.warn(`Provider '${providerId}' not found in registry. Available providers:`, Array.from(this.providers.keys()));

      if (!isProviderEnabled('mock')) {
        throw new Error(`Provider '${providerId}' is disabled or unavailable, and the mock provider is also disabled.`);
      }

      const mockProvider = new MockProvider();
      if (config && this.isConfigurable(mockProvider)) {
        mockProvider.configure(config);
      }
      return mockProvider;
    }

    if (!isProviderEnabled(providerId)) {
      throw new Error(`Provider '${providerId}' is disabled. Update CMS_DISABLED_PROVIDERS to enable it.`);
    }

    try {
      this.debug(`Creating ${providerId} provider...`);
      const provider = factory();
      
      // Apply configuration if provided
      if (config && this.isConfigurable(provider)) {
        this.debug(`Configuring ${providerId} provider with:`, config);
        provider.configure(config);
      } else if (config) {
        console.warn(`⚠️ Provider ${providerId} does not have a configure method`);
      }

      this.debug(`${providerId} provider created successfully`);
      return provider;
    } catch (error) {
      console.error(`❌ Failed to create ${providerId} provider:`, error);
      throw error;
    }
  }

  /**
   * Type guard to check if provider is configurable
   * @param provider Provider instance
   * @returns True if provider has configure method
   */
  private static isConfigurable(provider: ICMSProvider): provider is ICMSProvider & { configure: (config: ProviderSpecificConfig) => void } {
    return 'configure' in provider && typeof (provider as ICMSProvider & { configure?: unknown }).configure === 'function';
  }

  /**
   * Get available provider IDs
   * @returns Array of registered provider IDs
   */
  static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   * @param providerId Provider identifier
   * @returns True if provider factory is registered
   */
  static hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
