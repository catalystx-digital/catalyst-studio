'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ICMSProvider } from '../types';
import { ProviderFactory } from '../factory';
import { ProviderRegistry } from '../registry';

interface ProviderContextValue {
  provider: ICMSProvider | null;
  providerId: string | null;
  isLoading: boolean;
  error: Error | null;
  switchProvider: (providerId: string) => Promise<void>;
  refreshProvider: () => Promise<void>;
}

const ProviderContext = createContext<ProviderContextValue | undefined>(undefined);

export interface ProviderContextProviderProps {
  children: React.ReactNode;
  providerId?: string;
  config?: Record<string, any>;
}

/**
 * Provider context provider component
 * Manages CMS provider instance and makes it available to child components
 */
export function ProviderContextProvider({ 
  children, 
  providerId = 'auto',
  config 
}: ProviderContextProviderProps) {
  const [provider, setProvider] = useState<ICMSProvider | null>(null);
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const initializeProvider = async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Create provider instance
      const newProvider = ProviderFactory.createProvider(id, config);
      
      // Register with global registry
      const registry = ProviderRegistry.getInstance();
      const providerId = (newProvider as any).id || id;
      registry.register(providerId, newProvider, { replace: true });
      registry.setActiveProvider(providerId);
      
      setProvider(newProvider);
      setCurrentProviderId(providerId);
    } catch (err) {
      console.error('Failed to initialize provider:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize provider'));
      
      // Fallback to mock provider on error
      try {
        const mockProvider = ProviderFactory.createProvider('mock');
        const mockProviderId = (mockProvider as any).id || 'mock';
        setProvider(mockProvider);
        setCurrentProviderId(mockProviderId);
      } catch (fallbackErr) {
        console.error('Failed to initialize mock provider:', fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchProvider = async (newProviderId: string) => {
    await initializeProvider(newProviderId);
  };

  const refreshProvider = async () => {
    if (currentProviderId) {
      await initializeProvider(currentProviderId);
    }
  };

  useEffect(() => {
    initializeProvider(providerId);
  }, [providerId]);

  const contextValue: ProviderContextValue = {
    provider,
    providerId: currentProviderId,
    isLoading,
    error,
    switchProvider,
    refreshProvider
  };

  return (
    <ProviderContext.Provider value={contextValue}>
      {children}
    </ProviderContext.Provider>
  );
}

/**
 * Hook to use the provider context
 * @returns Provider context value
 * @throws Error if used outside of ProviderContextProvider
 */
export function useProvider(): ProviderContextValue {
  const context = useContext(ProviderContext);
  
  if (context === undefined) {
    throw new Error('useProvider must be used within a ProviderContextProvider');
  }
  
  return context;
}

/**
 * Hook to get the current CMS provider instance
 * @returns Current provider instance or null if not initialized
 */
export function useCMSProvider(): ICMSProvider | null {
  const { provider } = useProvider();
  return provider;
}

/**
 * Hook to check if a specific provider is active
 * @param providerId Provider ID to check
 * @returns True if the specified provider is active
 */
export function useIsProvider(providerId: string): boolean {
  const { providerId: currentId } = useProvider();
  return currentId === providerId;
}
