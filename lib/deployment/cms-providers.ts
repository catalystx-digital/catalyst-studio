import { CMSProvider, CMSProviderId, ConnectionStatus } from './deployment-types';

export const CMS_PROVIDERS: Record<CMSProviderId, Omit<CMSProvider, 'connectionStatus' | 'config'>> = {
  optimizely: {
    id: 'optimizely',
    name: 'Optimizely',
    description: 'Enterprise-grade experimentation and content management platform',
    logo: '/images/cms/optimizely-logo.svg',
  },
  contentful: {
    id: 'contentful',
    name: 'Contentful',
    description: 'API-first content platform for digital experiences',
    logo: '/images/cms/contentful-logo.svg',
  },
  contentstack: {
    id: 'contentstack',
    name: 'Contentstack',
    description: 'Headless CMS with modular content modeling and stack environments',
    logo: '/images/cms/contentstack-logo.svg',
  },
  strapi: {
    id: 'strapi',
    name: 'Strapi',
    description: 'Open-source headless CMS for building powerful APIs',
    logo: '/images/cms/strapi-logo.svg',
  },
  mock: {
    id: 'mock',
    name: 'Mock Provider',
    description: 'Internal testing provider without external integration',
    logo: '/images/cms/mock-logo.svg',
  },
};

export const getProviderConfigFields = (providerId: CMSProviderId): Array<{
  name: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder?: string;
}> => {
  switch (providerId) {
    case 'optimizely':
      return [
        { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Enter your Optimizely Client ID' },
        { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Enter your Optimizely Client Secret' },
        { name: 'projectId', label: 'Project ID', type: 'text', required: false, placeholder: 'Optional: e.g., 12345678' },
      ];
    case 'contentful':
      return [
        { name: 'apiKey', label: 'Content Management API Token', type: 'password', required: true, placeholder: 'Enter your Contentful API token' },
        { name: 'workspace', label: 'Space ID', type: 'text', required: true, placeholder: 'e.g., abc123xyz' },
        { name: 'environment', label: 'Environment', type: 'text', required: true, placeholder: 'e.g., master' },
      ];
    case 'contentstack':
      return [
        { name: 'stackApiKey', label: 'Stack API Key', type: 'text', required: true, placeholder: 'e.g., blt123example' },
        { name: 'managementToken', label: 'Management Token', type: 'password', required: true, placeholder: 'Paste your Contentstack management token' },
        { name: 'environment', label: 'Environment', type: 'text', required: true, placeholder: 'Default: development' },
        { name: 'locale', label: 'Locale', type: 'text', required: true, placeholder: 'Default: en-us' },
        { name: 'branch', label: 'Branch (optional)', type: 'text', required: false, placeholder: 'Default: main' },
        { name: 'baseUrl', label: 'Base URL (optional)', type: 'url', required: false, placeholder: 'https://api.contentstack.io/v3' },
      ];
    case 'strapi':
      return [
        { name: 'baseUrl', label: 'Base URL', type: 'url', required: true, placeholder: 'http://localhost:1337' },
        { name: 'apiToken', label: 'Content API Token', type: 'password', required: true, placeholder: 'Paste your Strapi Content API token' },
        { name: 'adminEmail', label: 'Admin Email (optional)', type: 'text', required: false, placeholder: 'admin@example.com' },
        { name: 'adminPassword', label: 'Admin Password (optional)', type: 'password', required: false, placeholder: 'Admin password for CTB access' },
      ];
    default:
      return [];
  }
};

export const validateProviderConfig = (providerId: CMSProviderId, config: Record<string, string>): { valid: boolean; errors: string[] } => {
  const fields = getProviderConfigFields(providerId);
  const errors: string[] = [];

  fields.forEach(field => {
    if (field.required && !config[field.name]) {
      errors.push(`${field.label} is required`);
    }
    if (field.type === 'url' && config[field.name]) {
      try {
        new URL(config[field.name]);
      } catch {
        errors.push(`${field.label} must be a valid URL`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};


