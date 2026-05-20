// ProviderRegistry - Singleton for managing CMS providers

import { ICMSProvider, ProviderNotFoundError } from './types';

/**
 * Singleton registry for managing CMS providers
 * Handles provider registration, retrieval, and active provider management
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ICMSProvider>;
  private activeProviderId: string | null;

  private constructor() {
    this.providers = new Map();
    this.activeProviderId = null;
  }

  /**
   * Environment-aware logging
   */
  private log(message: string, level: 'log' | 'warn' | 'error' = 'log'): void {
    if (process.env.NODE_ENV !== 'production' || level === 'error') {
      console[level](`[ProviderRegistry] ${message}`);
    }
  }

  /**
   * Get the singleton instance of ProviderRegistry
   * @returns The singleton ProviderRegistry instance
   */
  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a provider with the registry
   * @param platformId Unique identifier for the platform (e.g., 'optimizely', 'contentful')
   * @param provider The provider instance implementing ICMSProvider
   */
  public register(platformId: string, provider: ICMSProvider, options: { replace?: boolean } = {}): void {
    if (!platformId) {
      throw new Error('Platform ID is required for provider registration');
    }
    if (!provider) {
      throw new Error('Provider instance is required for registration');
    }

    const replace = options.replace ?? true;
    if (!replace && this.providers.has(platformId)) {
      this.log(`Provider already registered for ${platformId}; skipping as replace=false`);
      return;
    }

    this.log(`Registering provider: ${platformId}`);
    this.providers.set(platformId, provider);

    // If this is the first provider, set it as active
    if (this.providers.size === 1) {
      this.activeProviderId = platformId;
      this.log(`Setting ${platformId} as active provider (first registered)`);
    }
  }

  /**
   * Get a provider by platform ID
   * @param platformId The platform identifier
   * @returns The provider instance or null if not found
   */
  public getProvider(platformId: string): ICMSProvider | null {
    const provider = this.providers.get(platformId) || null;
    if (!provider) {
      // Log at 'log' level since not-found is often expected (caller will create the provider)
      this.log(`Provider not found: ${platformId}`);
    }
    return provider;
  }

  /**
   * List all registered provider IDs
   * @returns Array of platform IDs
   */
  public listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Set the active provider
   * @param platformId The platform identifier to set as active
   * @throws ProviderNotFoundError if the provider is not registered
   */
  public setActiveProvider(platformId: string): void {
    if (!this.providers.has(platformId)) {
      throw new ProviderNotFoundError(platformId);
    }

    this.log(`Setting active provider: ${platformId}`);
    this.activeProviderId = platformId;
  }

  /**
   * Get the currently active provider
   * @returns The active provider instance or null if none is active
   */
  public getActiveProvider(): ICMSProvider | null {
    if (!this.activeProviderId) {
      this.log('No active provider set', 'warn');
      return null;
    }

    const provider = this.providers.get(this.activeProviderId) || null;
    if (!provider) {
      this.log(`Active provider '${this.activeProviderId}' not found in registry`, 'error');
      this.activeProviderId = null;
    }
    return provider;
  }

  /**
   * Get the ID of the currently active provider
   * @returns The active provider ID or null if none is active
   */
  public getActiveProviderId(): string | null {
    return this.activeProviderId;
  }

  /**
   * Unregister a provider
   * @param platformId The platform identifier to unregister
   * @returns True if the provider was unregistered, false if it wasn't registered
   */
  public unregister(platformId: string): boolean {
    const existed = this.providers.delete(platformId);
    
    if (existed) {
      this.log(`Unregistered provider: ${platformId}`);
      
      // If the unregistered provider was active, clear the active provider
      if (this.activeProviderId === platformId) {
        this.activeProviderId = null;
        this.log('Active provider cleared');
      }
    }
    
    return existed;
  }

  /**
   * Clear all providers from the registry
   */
  public clear(): void {
    this.log('Clearing all providers');
    this.providers.clear();
    this.activeProviderId = null;
  }

  /**
   * Check if a provider is registered
   * @param platformId The platform identifier to check
   * @returns True if the provider is registered
   */
  public hasProvider(platformId: string): boolean {
    return this.providers.has(platformId);
  }

  /**
   * Get the number of registered providers
   * @returns The count of registered providers
   */
  public getProviderCount(): number {
    return this.providers.size;
  }
}

// Export singleton instance
export const providerRegistry = ProviderRegistry.getInstance();
