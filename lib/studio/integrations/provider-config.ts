import { getEnabledProviderSlugs, isProviderEnabled } from '@/lib/cms-export/config';

export type IntegrationProviderSlug = 'optimizely' | 'contentful' | 'contentstack' | 'strapi' | 'kontent' | 'umbraco-compose' | 'mock';

export type IntegrationFieldInputType =
  | 'text'
  | 'password'
  | 'textarea'
  | 'email'
  | 'url'
  | 'number'
  | 'checkbox';

export interface IntegrationFieldDefinition {
  readonly name: string;
  readonly label: string;
  readonly inputType: IntegrationFieldInputType;
  readonly required?: boolean;
  readonly description?: string;
  readonly placeholder?: string;
  readonly secret?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly integer?: boolean;
}

export interface IntegrationProviderMetadata {
  readonly slug: IntegrationProviderSlug;
  readonly label: string;
  readonly description: string;
  readonly documentationUrl?: string;
  readonly fields: readonly IntegrationFieldDefinition[];
}

export const SECRET_MASK = '********';

export const INTEGRATION_PROVIDER_METADATA: Record<IntegrationProviderSlug, IntegrationProviderMetadata> = {
  optimizely: {
    slug: 'optimizely',
    label: 'Optimizely CMS',
    description: 'Connect your Optimizely CMS project using the REST API credentials.',
    documentationUrl: 'https://docs.developers.optimizely.com/content-management-system',
    fields: [
      {
        name: 'clientId',
        label: 'Client ID',
        inputType: 'text',
        required: true,
        description: 'OAuth client identifier generated in Optimizely.',
        placeholder: 'optimizely-client-id',
        minLength: 1,
      },
      {
        name: 'clientSecret',
        label: 'Client Secret',
        inputType: 'password',
        required: true,
        description: 'OAuth client secret used for API access.',
        placeholder: '••••••••',
        secret: true,
        minLength: 1,
      },
      {
        name: 'projectId',
        label: 'Project ID',
        inputType: 'text',
        description: 'Optional project identifier if you manage multiple spaces.',
        placeholder: 'project-guid',
      },
    ],
  },
  contentful: {
    slug: 'contentful',
    label: 'Contentful',
    description: 'Authorize deployment access to your Contentful space.',
    documentationUrl: 'https://www.contentful.com/developers/docs/references/content-management-api/',
    fields: [
      {
        name: 'spaceId',
        label: 'Space ID',
        inputType: 'text',
        required: true,
        description: '12 character Contentful space identifier.',
        placeholder: 'abcd1234efgh',
        minLength: 1,
      },
      {
        name: 'accessToken',
        label: 'Management Token',
        inputType: 'password',
        required: true,
        description: 'Content Management API token with editor permissions.',
        placeholder: '••••••••',
        secret: true,
        minLength: 1,
      },
      {
        name: 'environment',
        label: 'Environment',
        inputType: 'text',
        description: 'Defaults to "master" if not provided.',
        placeholder: 'master',
      },
    ],
  },
  kontent: {
    slug: 'kontent',
    label: 'Kontent.ai',
    description: 'Connect to Kontent.ai using your Management API credentials.',
    documentationUrl: 'https://kontent.ai/learn/docs/apis/management-api-v2/',
    fields: [
      {
        name: 'environmentId',
        label: 'Environment ID',
        inputType: 'text',
        required: true,
        description: 'GUID of the Kontent.ai environment.',
        placeholder: '00000000-0000-0000-0000-000000000000',
        minLength: 1,
      },
      {
        name: 'managementApiKey',
        label: 'Management API Key',
        inputType: 'password',
        required: true,
        description: 'Bearer token used for the Management API v2.',
        placeholder: '••••••••',
        secret: true,
        minLength: 1,
      },
      {
        name: 'languageCodename',
        label: 'Language Codename',
        inputType: 'text',
        description: 'Defaults to "default" when left blank.',
        placeholder: 'default',
      },
      {
        name: 'baseUrl',
        label: 'Base URL',
        inputType: 'url',
        description: 'Optional override for the Management API base URL.',
        placeholder: 'https://manage.kontent.ai/v2',
      },
      {
        name: 'rateLimitMs',
        label: 'Rate Limit (ms)',
        inputType: 'number',
        description: 'Delay between API calls; defaults to 250ms.',
        min: 0,
        step: 25,
        integer: true,
      },
      {
        name: 'maxRetries',
        label: 'Max Retries',
        inputType: 'number',
        description: 'Number of retries on 429 responses; defaults to 5.',
        min: 0,
        step: 1,
        integer: true,
      },
    ],
  },
  contentstack: {
    slug: 'contentstack',
    label: 'Contentstack',
    description: 'Manage Contentstack stack exports using the Management API.',
    documentationUrl: 'https://www.contentstack.com/docs/developers/apis/content-management-api/',
    fields: [
      {
        name: 'stackApiKey',
        label: 'Stack API Key',
        inputType: 'password',
        required: true,
        description: 'Unique Stack API key used to identify the Contentstack stack.',
        placeholder: '********',
        secret: true,
        minLength: 1,
      },
      {
        name: 'managementToken',
        label: 'Management Token',
        inputType: 'password',
        required: true,
        description: 'Content Management API token with write access to entries, assets, and content types.',
        placeholder: '********',
        secret: true,
        minLength: 1,
      },
      {
        name: 'environment',
        label: 'Environment',
        inputType: 'text',
        required: true,
        description: 'Target environment for publishing (e.g. development, staging).',
        placeholder: 'development',
        minLength: 1,
      },
      {
        name: 'locale',
        label: 'Locale',
        inputType: 'text',
        required: true,
        description: 'Default locale code in lowercase with region (e.g. en-us).',
        placeholder: 'en-us',
        minLength: 2,
      },
      {
        name: 'branch',
        label: 'Branch',
        inputType: 'text',
        required: true,
        description: 'Branch identifier to scope content updates (use main when branches are disabled).',
        placeholder: 'main',
        minLength: 1,
      },
    ],
  },
  strapi: {
    slug: 'strapi',
    label: 'Strapi',
    description: 'Provide API credentials for your Strapi deployment.',
    documentationUrl: 'https://docs.strapi.io/dev-docs/api/rest',
    fields: [
      {
        name: 'baseUrl',
        label: 'Base URL',
        inputType: 'url',
        required: true,
        description: 'Root URL for your Strapi instance (include protocol).',
        placeholder: 'https://cms.example.com',
        minLength: 1,
      },
      {
        name: 'apiToken',
        label: 'API Token',
        inputType: 'password',
        required: true,
        description: 'Administrator API token with content read/write scope.',
        placeholder: '••••••••',
        secret: true,
        minLength: 1,
      },
      {
        name: 'adminToken',
        label: 'Admin Token',
        inputType: 'password',
        description: 'Optional admin token for management operations.',
        placeholder: '••••••••',
        secret: true,
      },
      {
        name: 'adminEmail',
        label: 'Admin Email',
        inputType: 'email',
        description: 'Used for audit notifications when available.',
        placeholder: 'admin@example.com',
      },
      {
        name: 'adminPassword',
        label: 'Admin Password',
        inputType: 'password',
        description: 'Required when admin email is provided and no token exists.',
        placeholder: '••••••••',
        secret: true,
      },
    ],
  },
  'umbraco-compose': {
    slug: 'umbraco-compose',
    label: 'Umbraco Compose',
    description: 'Connect to Umbraco Compose using Personal Access Token for content ingestion.',
    documentationUrl: 'https://docs.umbraco.com/umbraco-heartcore',
    fields: [
      {
        name: 'projectAlias',
        label: 'Project Alias',
        inputType: 'text',
        required: true,
        description: 'Your Umbraco project alias (found in the Umbraco Cloud portal).',
        placeholder: 'my-project',
      },
      {
        name: 'region',
        label: 'Region',
        inputType: 'text',
        required: true,
        description: 'Deployment region (e.g., "us-east", "eu-west").',
        placeholder: 'us-east',
      },
      {
        name: 'personalAccessToken',
        label: 'Personal Access Token',
        inputType: 'password',
        required: true,
        description: 'PAT from Umbraco Cloud portal (Settings → API Keys).',
        placeholder: '••••••••',
        secret: true,
      },
    ],
  },
  mock: {
    slug: 'mock',
    label: 'Mock Provider',
    description: 'Internal-only mock provider used for testing flows.',
    fields: [
      {
        name: 'simulateDelay',
        label: 'Simulated Delay (ms)',
        inputType: 'number',
        description: 'Adds artificial latency when running tests.',
        min: 0,
        step: 100,
        integer: true,
      },
      {
        name: 'shouldFail',
        label: 'Force Failure',
        inputType: 'checkbox',
        description: 'If enabled, connection tests return an error.',
      },
      {
        name: 'failureMessage',
        label: 'Failure Message',
        inputType: 'textarea',
        description: 'Optional error message returned when forcing failure.',
        placeholder: 'Authentication failed due to ...',
      },
    ],
  },
};

export const INTEGRATION_PROVIDER_SLUGS = Object.keys(INTEGRATION_PROVIDER_METADATA) as IntegrationProviderSlug[];

export function getProviderMetadata(slug: IntegrationProviderSlug): IntegrationProviderMetadata {
  const metadata = INTEGRATION_PROVIDER_METADATA[slug];

  if (!metadata) {
    throw new Error(`Unsupported provider slug: ${slug}`);
  }

  return metadata;
}

export function getProviderSecretKeys(slug: IntegrationProviderSlug): string[] {
  return getProviderMetadata(slug).fields.filter(field => field.secret).map(field => field.name);
}

export function getEnabledIntegrationProviderSlugs(): IntegrationProviderSlug[] {
  const enabled = new Set(getEnabledProviderSlugs());
  return INTEGRATION_PROVIDER_SLUGS.filter(slug => enabled.has(slug));
}

export function isIntegrationProviderEnabled(slug: IntegrationProviderSlug): boolean {
  return isProviderEnabled(slug);
}
