import {
  __resetProviderConfigCache,
  getDisabledProviderSlugs,
  getProviderConfig,
  isProviderAvailable,
} from '../config';

describe('provider config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, originalEnv);
    __resetProviderConfigCache();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses CMS_DISABLED_PROVIDERS into slug list', () => {
    process.env.CMS_DISABLED_PROVIDERS = 'strapi, contentful';
    __resetProviderConfigCache();

    expect(getDisabledProviderSlugs()).toEqual(['strapi', 'contentful']);
  });

  it('falls back to mock when explicit provider is disabled', () => {
    process.env.CMS_DISABLED_PROVIDERS = 'strapi';
    process.env.CMS_PROVIDER = 'strapi';
    __resetProviderConfigCache();

    const config = getProviderConfig();
    expect(config.providerId).toBe('mock');
  });

  it('treats disabled providers as unavailable', () => {
    process.env.CMS_DISABLED_PROVIDERS = 'strapi';
    __resetProviderConfigCache();

    expect(isProviderAvailable('strapi')).toBe(false);
  });
});
