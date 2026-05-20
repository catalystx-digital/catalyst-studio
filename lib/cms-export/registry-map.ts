import { ContentfulProvider } from './contentful';
import { ContentstackProvider } from './contentstack';
import { MockProvider } from './mock';
import { OptimizelyProvider } from './optimizely';
import { KontentProvider } from './kontent';
import { StrapiProvider } from './strapi';
import { UmbracoComposeProvider } from './umbraco-compose';
import type { ICMSProvider } from './types';

export const providerFactories = {
  optimizely: () => new OptimizelyProvider() as ICMSProvider,
  contentful: () => new ContentfulProvider() as ICMSProvider,
  contentstack: () => new ContentstackProvider() as ICMSProvider,
  kontent: () => new KontentProvider() as ICMSProvider,
  strapi: () => new StrapiProvider() as ICMSProvider,
  'umbraco-compose': () => new UmbracoComposeProvider() as ICMSProvider,
  mock: () => new MockProvider() as ICMSProvider,
} as const satisfies Record<string, () => ICMSProvider>;

export type ProviderId = keyof typeof providerFactories;

export const PROVIDER_IDS = Object.keys(providerFactories) as ProviderId[];

export function createProviderMap(): Map<string, () => ICMSProvider> {
  return new Map(Object.entries(providerFactories));
}
