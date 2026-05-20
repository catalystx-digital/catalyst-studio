import { IntegrationProvider } from '@/lib/generated/prisma';
import { z } from 'zod';

import {
  INTEGRATION_PROVIDER_METADATA,
  IntegrationFieldDefinition,
  IntegrationProviderMetadata,
  IntegrationProviderSlug,
  SECRET_MASK,
} from './provider-config';

export interface ProviderDefinition {
  readonly createSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  readonly updateSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  readonly secretKeys: readonly string[];
}

const slugToEnumMap: Record<IntegrationProviderSlug, IntegrationProvider> = {
  optimizely: IntegrationProvider.OPTIMIZELY,
  contentful: IntegrationProvider.CONTENTFUL,
  contentstack: IntegrationProvider.CONTENTSTACK,
  strapi: IntegrationProvider.STRAPI,
  kontent: IntegrationProvider.KONTENT,
  'umbraco-compose': IntegrationProvider.UMBRACO_COMPOSE,
  mock: IntegrationProvider.MOCK,
};

const providerDefinitions: Record<IntegrationProvider, ProviderDefinition> = Object.entries(
  INTEGRATION_PROVIDER_METADATA,
).reduce<Record<IntegrationProvider, ProviderDefinition>>((acc, [slug, metadata]) => {
  const provider = slugToEnum(slug as IntegrationProviderSlug);
  const createSchema = buildProviderSchema(metadata);
  const updateSchema = createSchema.partial();
  const secretKeys = metadata.fields.filter(field => field.secret).map(field => field.name);

  acc[provider] = {
    createSchema,
    updateSchema,
    secretKeys,
  };

  return acc;
}, {} as Record<IntegrationProvider, ProviderDefinition>);

export function getProviderDefinition(provider: IntegrationProvider): ProviderDefinition {
  const definition = providerDefinitions[provider];

  if (!definition) {
    throw new Error(`Unsupported integration provider: ${provider}`);
  }

  return definition;
}

export function listSupportedProviders(): IntegrationProvider[] {
  return Object.keys(providerDefinitions) as IntegrationProvider[];
}

export function slugToEnum(slug: IntegrationProviderSlug): IntegrationProvider {
  const value = slugToEnumMap[slug];

  if (!value) {
    throw new Error(`Unsupported provider slug: ${slug}`);
  }

  return value;
}

export function enumToSlug(provider: IntegrationProvider): IntegrationProviderSlug {
  const entry = Object.entries(slugToEnumMap).find(([, value]) => value === provider);

  if (!entry) {
    throw new Error(`Unsupported integration provider: ${provider}`);
  }

  return entry[0] as IntegrationProviderSlug;
}

function buildProviderSchema(metadata: IntegrationProviderMetadata) {
  const shape = metadata.fields.reduce<Record<string, z.ZodTypeAny>>((acc, field) => {
    acc[field.name] = buildFieldSchema(field);
    return acc;
  }, {});

  return z.object(shape);
}

function buildFieldSchema(field: IntegrationFieldDefinition): z.ZodTypeAny {
  if (field.inputType === 'checkbox') {
    const base = z.boolean({ required_error: `${field.label} is required` });
    return field.required ? base : base.optional();
  }

  if (field.inputType === 'number') {
    let base = z
      .number({
        required_error: `${field.label} is required`,
        invalid_type_error: `${field.label} must be a number`,
      });

    if (field.integer) {
      base = base.int(`${field.label} must be an integer`);
    }

    if (typeof field.min === 'number') {
      base = base.min(field.min, `${field.label} must be at least ${field.min}`);
    }

    if (typeof field.max === 'number') {
      base = base.max(field.max, `${field.label} must be at most ${field.max}`);
    }

    return field.required ? base : base.optional();
  }

  let base: z.ZodTypeAny = z.string({ required_error: `${field.label} is required` });

  if (field.inputType === 'url') {
    base = (base as z.ZodString).url(`${field.label} must be a valid URL`);
  } else if (field.inputType === 'email') {
    base = (base as z.ZodString).email(`${field.label} must be a valid email address`);
  }

  const minLength = field.minLength ?? (field.required ? 1 : undefined);

  if (typeof minLength === 'number' && minLength > 0) {
    base = (base as z.ZodString).min(minLength, `${field.label} is required`);
  }

  if (typeof field.maxLength === 'number') {
    base = (base as z.ZodString).max(field.maxLength, `${field.label} must be at most ${field.maxLength} characters`);
  }

  if (!field.required) {
    base = base.optional();
  }

  return base;
}
