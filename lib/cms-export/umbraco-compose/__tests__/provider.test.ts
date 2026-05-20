/**
 * Umbraco Compose Provider Tests
 *
 * Tests for Task 1: Provider Scaffolding & Registration
 *
 * Note: Registry and config tests are isolated to avoid cascading imports
 * from other providers that may have unresolved dependencies.
 */

import { UmbracoComposeProvider } from '../provider';
import { UMBRACO_COMPOSE_PROVIDER_ID, UMBRACO_COMPOSE_DISPLAY_NAME } from '../constants';

// Mock the client and auth manager
jest.mock('../client', () => ({
  UmbracoComposeClient: jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    configureFromEnv: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(false),
    ensureConfigured: jest.fn(),
    testConnection: jest.fn().mockResolvedValue(true),
    setDebug: jest.fn(),
    ensureCollection: jest.fn().mockResolvedValue(undefined),
    ensureTypeSchema: jest.fn().mockResolvedValue(true),
    ingestContent: jest.fn().mockResolvedValue({ success: true }),
    getCollection: jest.fn().mockReturnValue('pages'),
    getEnvironment: jest.fn().mockReturnValue('production'),
  })),
}));

jest.mock('../auth', () => ({
  UmbracoAuthManager: jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    configureFromEnv: jest.fn(),
    hasManagementCredentials: jest.fn().mockReturnValue(true),
    hasIngestionCredentials: jest.fn().mockReturnValue(true),
    hasAnyCredentials: jest.fn().mockReturnValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    getManagementToken: jest.fn().mockResolvedValue('mock-token'),
    getIngestionToken: jest.fn().mockReturnValue('mock-pat'),
  })),
}));

describe('UmbracoComposeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider instantiation', () => {
    it('should have correct provider ID', () => {
      const provider = new UmbracoComposeProvider();
      expect(provider.id).toBe(UMBRACO_COMPOSE_PROVIDER_ID);
      expect(provider.id).toBe('umbraco-compose');
    });

    it('should implement ICMSProvider interface', () => {
      const provider = new UmbracoComposeProvider();

      // Check required interface members
      expect(provider.id).toBeDefined();
      expect(typeof provider.syncUnifiedBundle).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
    });

    it('should be instantiable with config', () => {
      const provider = new UmbracoComposeProvider({
        projectAlias: 'test-project',
        region: 'germanywestcentral',
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        personalAccessToken: 'test-pat',
      });

      expect(provider).toBeInstanceOf(UmbracoComposeProvider);
    });

    it('should be instantiable without config', () => {
      const provider = new UmbracoComposeProvider();
      expect(provider).toBeInstanceOf(UmbracoComposeProvider);
    });

    it('should have configure method', () => {
      const provider = new UmbracoComposeProvider();
      expect(typeof provider.configure).toBe('function');
    });
  });

  describe('Provider constants', () => {
    it('should have correct provider ID constant', () => {
      expect(UMBRACO_COMPOSE_PROVIDER_ID).toBe('umbraco-compose');
    });

    it('should have correct display name constant', () => {
      expect(UMBRACO_COMPOSE_DISPLAY_NAME).toBe('Umbraco Compose');
    });
  });

  describe('testConnection', () => {
    it('should return boolean from testConnection', async () => {
      const provider = new UmbracoComposeProvider();
      const result = await provider.testConnection();
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Provider Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment variable names', () => {
    it('should use correct env var names from constants', async () => {
      const { ENV_VARS } = await import('../constants');

      expect(ENV_VARS.PROJECT_ALIAS).toBe('UMBRACO_PROJECT_ALIAS');
      expect(ENV_VARS.REGION).toBe('UMBRACO_REGION');
      expect(ENV_VARS.CLIENT_ID).toBe('UMBRACO_CLIENT_ID');
      expect(ENV_VARS.CLIENT_SECRET).toBe('UMBRACO_CLIENT_SECRET');
      expect(ENV_VARS.PAT).toBe('UMBRACO_PAT');
    });
  });

  describe('Provider configuration from env', () => {
    it('should be configurable via environment variables', () => {
      process.env.UMBRACO_PROJECT_ALIAS = 'test-project';
      process.env.UMBRACO_REGION = 'germanywestcentral';

      const provider = new UmbracoComposeProvider();
      // Provider should be instantiable with env vars set
      expect(provider).toBeInstanceOf(UmbracoComposeProvider);
    });
  });
});

describe('Provider exports', () => {
  it('should export UmbracoComposeProvider from index', async () => {
    const { UmbracoComposeProvider: Provider } = await import('../index');
    expect(Provider).toBeDefined();
    const instance = new Provider();
    expect(instance.id).toBe('umbraco-compose');
  });

  it('should export UmbracoComposeClient from index', async () => {
    const { UmbracoComposeClient: Client } = await import('../index');
    expect(Client).toBeDefined();
  });

  it('should export UmbracoAuthManager from index', async () => {
    const { UmbracoAuthManager: AuthManager } = await import('../index');
    expect(AuthManager).toBeDefined();
  });

  it('should export constants from index', async () => {
    const {
      UMBRACO_COMPOSE_PROVIDER_ID,
      UMBRACO_COMPOSE_DISPLAY_NAME,
      ENV_VARS,
    } = await import('../index');

    expect(UMBRACO_COMPOSE_PROVIDER_ID).toBe('umbraco-compose');
    expect(UMBRACO_COMPOSE_DISPLAY_NAME).toBe('Umbraco Compose');
    expect(ENV_VARS).toBeDefined();
    expect(ENV_VARS.PROJECT_ALIAS).toBe('UMBRACO_PROJECT_ALIAS');
  });

  it('should export error classes from index', async () => {
    const {
      UmbracoComposeError,
      UmbracoAuthError,
      UmbracoValidationError,
      UmbracoRateLimitError,
      UmbracoIngestionError,
      UmbracoConnectionError,
    } = await import('../index');

    expect(UmbracoComposeError).toBeDefined();
    expect(UmbracoAuthError).toBeDefined();
    expect(UmbracoValidationError).toBeDefined();
    expect(UmbracoRateLimitError).toBeDefined();
    expect(UmbracoIngestionError).toBeDefined();
    expect(UmbracoConnectionError).toBeDefined();
  });

  it('should export utility functions from index', async () => {
    const {
      generateContentId,
      generatePageId,
      mapContentTypeToSchema,
      transformPageToEntry,
    } = await import('../index');

    expect(generateContentId).toBeDefined();
    expect(generatePageId).toBeDefined();
    expect(mapContentTypeToSchema).toBeDefined();
    expect(transformPageToEntry).toBeDefined();
  });
});

// Note: Registry integration tests (providerFactories, PROVIDER_IDS, ProviderFactory)
// are not included here to avoid cascading import issues from other providers.
// These would be tested at a higher integration level where all providers are configured.
