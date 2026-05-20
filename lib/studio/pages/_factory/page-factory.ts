import { PageTemplateRegistration, PageTemplatePropsMeta } from '../_core/types'
import type { TemplateManifest } from '../_core/manifest'

export class PageTemplateFactory {
  private static instance: PageTemplateFactory
  private registry = new Map<string, PageTemplateRegistration>()
  private manifestRegistry = new Map<string, TemplateManifest>()
  private initialized = false

  private constructor() {}

  public static getInstance(): PageTemplateFactory {
    if (!PageTemplateFactory.instance) {
      PageTemplateFactory.instance = new PageTemplateFactory()
    }
    return PageTemplateFactory.instance
  }

  public registerTemplate(registration: PageTemplateRegistration): void {
    const key = registration.templateKey
    if (!key || typeof key !== 'string') {
      throw new Error('[PageTemplateFactory] templateKey is required')
    }
    if (this.registry.has(key)) {
      throw new Error(`[PageTemplateFactory] Template with key "${key}" is already registered`)
    }

    // Schema-first: propsMeta is derived from schema or legacy propsMeta
    const normalizedProps: PageTemplatePropsMeta | undefined = registration.propsMeta
      ? Object.fromEntries(
          Object.entries(registration.propsMeta).map(([propKey, meta]) => [
            propKey,
            {
              ...meta,
              allowedComponentTypes: meta.allowedComponentTypes
                ? [...meta.allowedComponentTypes]
                : undefined,
              allowedValues: meta.allowedValues ? [...meta.allowedValues] : undefined
            }
          ])
        )
      : undefined

    const normalizedContentSchema = registration.contentSchema
      ? Object.fromEntries(
          Object.entries(registration.contentSchema).map(([fieldKey, meta]) => [
            fieldKey,
            {
              ...meta,
              allowedComponentTypes: meta.allowedComponentTypes
                ? [...meta.allowedComponentTypes]
                : undefined
            }
          ])
        )
      : undefined

    const normalized: PageTemplateRegistration = {
      ...registration,
      requiredRegions: registration.requiredRegions.map(region => ({
        ...region,
        allowedComponents: [...region.allowedComponents]
      })),
      optionalRegions: registration.optionalRegions
        ? registration.optionalRegions.map(region => ({
            ...region,
            allowedComponents: [...region.allowedComponents]
          }))
        : undefined,
      childContainment: registration.childContainment
        ? [...registration.childContainment]
        : undefined,
      propsMeta: normalizedProps,
      contentSchema: normalizedContentSchema,
      aiMetadata: {
        ...registration.aiMetadata,
        keywords: [...registration.aiMetadata.keywords],
        layoutGuidelines: [...registration.aiMetadata.layoutGuidelines],
        contentGuidelines: registration.aiMetadata.contentGuidelines
          ? [...registration.aiMetadata.contentGuidelines]
          : undefined,
        recommendedComponents: registration.aiMetadata.recommendedComponents
          ? [...registration.aiMetadata.recommendedComponents]
          : undefined,
        discouragedComponents: registration.aiMetadata.discouragedComponents
          ? [...registration.aiMetadata.discouragedComponents]
          : undefined,
        exampleUseCases: registration.aiMetadata.exampleUseCases
          ? [...registration.aiMetadata.exampleUseCases]
          : undefined,
        routeHints: registration.aiMetadata.routeHints
          ? [...registration.aiMetadata.routeHints]
          : undefined
      }
    }

    this.registry.set(key, Object.freeze(normalized))
  }

  public registerManifest(manifest: TemplateManifest): void {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('[PageTemplateFactory] manifest is required')
    }

    const { registration } = manifest
    if (!this.registry.has(registration.templateKey)) {
      this.registerTemplate(registration)
    }

    const stored = this.registry.get(registration.templateKey)
    if (!stored) {
      throw new Error(`[PageTemplateFactory] Failed to resolve template "${registration.templateKey}"`)
    }

    const normalizedManifest = this.normalizeManifest(manifest, stored)
    this.manifestRegistry.set(stored.templateKey, normalizedManifest)
  }

  private normalizeManifest(manifest: TemplateManifest, registration: PageTemplateRegistration): TemplateManifest {
    const canonical = manifest.canonical
      ? manifest.canonical.map(rule => ({
          ...rule,
          allowedCanonicals: rule.allowedCanonicals ? [...rule.allowedCanonicals] : undefined,
          hints: rule.hints ? [...rule.hints] : undefined,
          metadata: rule.metadata ? { ...rule.metadata } : undefined
        }))
      : undefined

    const detectionGuidance = manifest.detectionGuidance
      ? [...manifest.detectionGuidance]
      : undefined

    const regionPolicies = manifest.regionPolicies
      ? manifest.regionPolicies.map(policy => ({
          ...policy,
          allowedRegions: policy.allowedRegions ? [...policy.allowedRegions] : undefined,
          metadata: policy.metadata ? { ...policy.metadata } : undefined
        }))
      : undefined

    return Object.freeze({
      registration,
      canonical,
      detectionGuidance,
      regionPolicies
    })
  }

  public unregisterTemplate(templateKey: string): boolean {
    const removed = this.registry.delete(templateKey)
    this.manifestRegistry.delete(templateKey)
    return removed
  }

  public getTemplate(templateKey: string): PageTemplateRegistration | undefined {
    return this.registry.get(templateKey)
  }

  public getManifest(templateKey: string): TemplateManifest | undefined {
    const manifest = this.manifestRegistry.get(templateKey)
    if (manifest) {
      return manifest
    }
    const registration = this.registry.get(templateKey)
    if (!registration) {
      return undefined
    }
    return { registration }
  }

  public listTemplates(): PageTemplateRegistration[] {
    return Array.from(this.registry.values())
  }

  public listManifests(): TemplateManifest[] {
    if (this.manifestRegistry.size === 0) {
      return Array.from(this.registry.values()).map(registration => ({ registration }))
    }
    return Array.from(this.manifestRegistry.values())
  }

  public getRegistry(): Map<string, PageTemplateRegistration> {
    return new Map(this.registry)
  }

  public clearRegistry(): void {
    this.registry.clear()
    this.manifestRegistry.clear()
    this.initialized = false
  }

  public markInitialized(): void {
    this.initialized = true
  }

  public markUninitialized(): void {
    this.initialized = false
  }

  public isInitialized(): boolean {
    return this.initialized
  }
}

export const pageTemplateFactory = PageTemplateFactory.getInstance()
