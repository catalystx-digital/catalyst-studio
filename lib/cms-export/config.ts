/**
 * Provider configuration utilities
 * Handles environment-based provider selection and configuration
 */

import { PROVIDER_IDS, type ProviderId } from './registry-map';

let cachedDisabledProviders: Set<ProviderId> | null = null;

function normaliseProviderId(providerId: string | undefined | null): ProviderId | null {
  if (!providerId) {
    return null;
  }

  const match = PROVIDER_IDS.find(id => id === providerId.toLowerCase().trim());
  return match ?? null;
}

function parseDisabledProviders(): Set<ProviderId> {
  if (cachedDisabledProviders) {
    return cachedDisabledProviders;
  }

  const raw = process.env.CMS_DISABLED_PROVIDERS ?? '';
  const values = raw
    .split(',')
    .map(value => normaliseProviderId(value))
    .filter((value): value is ProviderId => value !== null);

  cachedDisabledProviders = new Set(values);
  return cachedDisabledProviders;
}

export function getDisabledProviderSlugs(): ProviderId[] {
  return Array.from(parseDisabledProviders());
}

export function isProviderEnabled(providerId: string): boolean {
  const normalised = normaliseProviderId(providerId);
  if (!normalised) {
    return false;
  }

  return !parseDisabledProviders().has(normalised);
}

export function getEnabledProviderSlugs(): ProviderId[] {
  return PROVIDER_IDS.filter(id => isProviderEnabled(id));
}

/**
 * Test helper to reset cached provider configuration state
 */
export function __resetProviderConfigCache(): void {
  cachedDisabledProviders = null;
}

function ensureEnabledProvider(providerId: ProviderId | null): ProviderId {
  const enabled = getEnabledProviderSlugs();

  if (providerId && isProviderEnabled(providerId)) {
    return providerId;
  }

  const fallback = enabled.includes('mock') ? 'mock' : enabled[0];

  if (fallback) {
    if (providerId && providerId !== fallback) {
      console.warn(`Provider '${providerId}' is disabled via CMS_DISABLED_PROVIDERS. Falling back to '${fallback}'.`);
    }
    return fallback;
  }

  throw new Error('No CMS providers are enabled. Update CMS_DISABLED_PROVIDERS to enable at least one provider.');
}

/**
 * Base configuration shared by all providers
 */
export interface BaseProviderConfig {
  cacheEnabled?: boolean;
  cacheTTL?: number;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Mock provider specific configuration
 */
export interface MockProviderConfig extends BaseProviderConfig {
  simulateDelay?: number;
  shouldFail?: boolean;
  failureMessage?: string;
}

/**
 * Optimizely provider specific configuration
 */
export interface OptimizelyProviderConfig extends BaseProviderConfig {
  clientId?: string;
  clientSecret?: string;
  projectId?: string;
}

/**
 * Contentful provider specific configuration (for future use)
 */
export interface ContentfulProviderConfig extends BaseProviderConfig {
  spaceId?: string;
  accessToken?: string;
  environment?: string;
}

/**
 * Contentstack provider specific configuration
 */
export interface ContentstackProviderConfig extends BaseProviderConfig {
  stackApiKey?: string;
  managementToken?: string;
  environment?: string;
  locale?: string;
  branch?: string;
  baseUrl?: string;
}

/**
 * Kontent.ai provider specific configuration
 */
export interface KontentProviderConfig extends BaseProviderConfig {
  environmentId?: string;
  managementApiKey?: string;
  languageCodename?: string;
  baseUrl?: string;
  rateLimitMs?: number;
  maxRetries?: number;
}

/**
 * Strapi provider specific configuration
 */
export interface StrapiProviderConfig extends BaseProviderConfig {
  baseUrl?: string;
  apiToken?: string;    // Content API token
  adminToken?: string;  // Optional Admin JWT (for CTB access)
  adminEmail?: string;  // Optional Admin login email
  adminPassword?: string; // Optional Admin login password
}

/**
 * Umbraco Compose provider specific configuration
 */
export interface UmbracoComposeProviderConfig extends BaseProviderConfig {
  projectAlias?: string;
  region?: string;
  environment?: string;
  clientId?: string;
  clientSecret?: string;
  personalAccessToken?: string;
  collection?: string;
  rateLimitMs?: number;
}

/**
 * Union type for provider-specific configurations
 */
export type ProviderSpecificConfig =
  | MockProviderConfig
  | OptimizelyProviderConfig
  | ContentfulProviderConfig
  | ContentstackProviderConfig
  | KontentProviderConfig
  | StrapiProviderConfig
  | UmbracoComposeProviderConfig;

export interface ProviderConfig<T extends ProviderSpecificConfig = ProviderSpecificConfig> {
  providerId: string;
  config?: T;
}

/**
 * Get provider configuration from environment
 * @returns Provider configuration with auto-detection
 */
export function getProviderConfig(): ProviderConfig {
  const envProvider = process.env.CMS_PROVIDER;

  // If explicitly set, use that provider when enabled
  if (envProvider && envProvider !== 'auto') {
    const providerId = ensureEnabledProvider(normaliseProviderId(envProvider));
    return {
      providerId,
      config: getProviderSpecificConfig(providerId),
    };
  }

  // Auto-detect based on available credentials in priority order
  const autoCandidates: ProviderId[] = ['optimizely', 'kontent', 'contentstack', 'strapi', 'umbraco-compose'];

  for (const candidate of autoCandidates) {
    if (!isProviderEnabled(candidate)) {
      continue;
    }

    if (candidate === 'optimizely' && process.env.OPTIMIZELY_CLIENT_ID && process.env.OPTIMIZELY_CLIENT_SECRET) {
      return {
        providerId: candidate,
        config: getProviderSpecificConfig(candidate),
      };
    }

    if (candidate === 'contentstack' && process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_MANAGEMENT_TOKEN) {
      return {
        providerId: candidate,
        config: getProviderSpecificConfig(candidate),
      };
    }

    if (candidate === 'kontent' && process.env.KONTENT_ENVIRONMENT_ID && process.env.KONTENT_MANAGEMENT_API_KEY) {
      return {
        providerId: candidate,
        config: getProviderSpecificConfig(candidate),
      };
    }

    if (candidate === 'strapi' && (process.env.STRAPI_BASE_URL || process.env.STRAPI_API_TOKEN || process.env.STRAPI_ADMIN_TOKEN)) {
      return {
        providerId: candidate,
        config: getProviderSpecificConfig(candidate),
      };
    }

    if (candidate === 'umbraco-compose' && process.env.UMBRACO_PROJECT_ALIAS && process.env.UMBRACO_REGION) {
      return {
        providerId: candidate,
        config: getProviderSpecificConfig(candidate),
      };
    }
  }

  // Default to the first enabled provider (mock is guaranteed unless disabled)
  const fallback = ensureEnabledProvider('mock');
  return {
    providerId: fallback,
    config: getProviderSpecificConfig(fallback),
  };
}

/**
 * Get provider-specific configuration
 * @param providerId Provider identifier
 * @returns Provider-specific configuration object
 */
export function getProviderSpecificConfig(providerId: string): ProviderSpecificConfig {
  switch (providerId) {
    case 'optimizely': {
      const config: OptimizelyProviderConfig = {
        clientId: process.env.OPTIMIZELY_CLIENT_ID,
        clientSecret: process.env.OPTIMIZELY_CLIENT_SECRET,
        projectId: process.env.OPTIMIZELY_PROJECT_ID,
        cacheEnabled: process.env.PROVIDER_CACHE_ENABLED === 'true',
        cacheTTL: parseInt(process.env.PROVIDER_CACHE_TTL || '300', 10)
      };
      return config;
    }
    case 'strapi': {
      const config: StrapiProviderConfig = {
        baseUrl: process.env.STRAPI_BASE_URL,
        apiToken: process.env.STRAPI_API_TOKEN,
        adminToken: process.env.STRAPI_ADMIN_TOKEN,
        adminEmail: process.env.STRAPI_ADMIN_EMAIL,
        adminPassword: process.env.STRAPI_ADMIN_PASSWORD,
      };
      return config;
    }
    case 'contentstack': {
      const config: ContentstackProviderConfig = {
        stackApiKey: process.env.CONTENTSTACK_API_KEY,
        managementToken: process.env.CONTENTSTACK_MANAGEMENT_TOKEN,
        environment: process.env.CONTENTSTACK_ENVIRONMENT,
        locale: process.env.CONTENTSTACK_LOCALE,
        branch: process.env.CONTENTSTACK_BRANCH,
        baseUrl: process.env.CONTENTSTACK_BASE_URL,
      };
      return config;
    }
      
    case 'mock': {
      const config: MockProviderConfig = {
        simulateDelay: parseInt(process.env.MOCK_PROVIDER_DELAY || '0', 10),
        shouldFail: process.env.MOCK_PROVIDER_FAIL === 'true',
        failureMessage: process.env.MOCK_PROVIDER_FAIL_MESSAGE
      };
      return config;
    }

    case 'umbraco-compose': {
      const config: UmbracoComposeProviderConfig = {
        projectAlias: process.env.UMBRACO_PROJECT_ALIAS,
        region: process.env.UMBRACO_REGION,
        environment: process.env.UMBRACO_ENVIRONMENT,
        clientId: process.env.UMBRACO_CLIENT_ID,
        clientSecret: process.env.UMBRACO_CLIENT_SECRET,
        personalAccessToken: process.env.UMBRACO_PAT,
        collection: process.env.UMBRACO_COLLECTION,
      };
      return config;
    }

    default:
      return {} as ProviderSpecificConfig;
  }
}

/**
 * Check if a provider is available
 * @param providerId Provider identifier
 * @returns True if provider can be configured
 */
export function isProviderAvailable(providerId: string): boolean {
  switch (providerId) {
    case 'optimizely':
      return isProviderEnabled('optimizely') && !!(process.env.OPTIMIZELY_CLIENT_ID && process.env.OPTIMIZELY_CLIENT_SECRET);
    case 'contentstack':
      return isProviderEnabled('contentstack') && !!(process.env.CONTENTSTACK_API_KEY && process.env.CONTENTSTACK_MANAGEMENT_TOKEN);
    case 'kontent':
      return isProviderEnabled('kontent') && !!(process.env.KONTENT_ENVIRONMENT_ID && process.env.KONTENT_MANAGEMENT_API_KEY);
    case 'strapi':
      return isProviderEnabled('strapi');
    case 'umbraco-compose':
      return isProviderEnabled('umbraco-compose') && !!(process.env.UMBRACO_PROJECT_ALIAS && process.env.UMBRACO_REGION);
    case 'mock':
      return isProviderEnabled('mock');
    default:
      return false;
  }
}

/**
 * Get list of available providers
 * @returns Array of available provider IDs
 */
export function getAvailableProviders(): string[] {
  const providers: string[] = [];

  for (const provider of PROVIDER_IDS) {
    if (isProviderAvailable(provider)) {
      providers.push(provider);
    }
  }

  return providers;
}

/**
 * Get provider display name
 * @param providerId Provider identifier
 * @returns Human-readable provider name
 */
export function getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    optimizely: 'Optimizely CMS',
    contentstack: 'Contentstack',
    kontent: 'Kontent.ai',
    strapi: 'Strapi',
    'umbraco-compose': 'Umbraco Compose',
    mock: 'Mock Provider (Development)',
    contentful: 'Contentful'
  };

  return names[providerId] || providerId;
}
