import { z } from "zod";
import {
  ComponentType,
  ComponentCategory,
  ComponentRegistryMap,
  ComponentRegistryEntry,
  ComponentConstructor,
  AIComponentMetadata,
} from "../_core/types";
// ============================================================================
// Component Factory Class
// ============================================================================
export class CMSComponentFactory {
  private static instance: CMSComponentFactory;
  private registry: ComponentRegistryMap = {};
  private componentCache = new Map<ComponentType, ComponentConstructor>();
  private loadingPromises = new Map<
    ComponentType,
    Promise<ComponentConstructor>
  >();
  private initializationPromise: Promise<void> | null = null;
  // Singleton pattern
  private constructor() {}
  public static getInstance(): CMSComponentFactory {
    if (!CMSComponentFactory.instance) {
      CMSComponentFactory.instance = new CMSComponentFactory();
    }
    return CMSComponentFactory.instance;
  }
  // ============================================================================
  // Registration Methods
  // ============================================================================
  /**
   * Register a component in the factory
   */
  public registerComponent(
    type: ComponentType,
    component: ComponentConstructor,
    metadata: AIComponentMetadata,
    options: {
      description?: string;
      schema: z.ZodObject<z.ZodRawShape>;
      subOnly?: boolean;
    },
  ): void {
    this.registry[type] = {
      component,
      metadata,
      preload: false,
      description: options.description,
      schema: options.schema,
      ...(options.subOnly ? { subOnly: true } : {}),
    };
    this.componentCache.set(type, component);
  }
  /**
   * Register a component with extended metadata (used by register.ts files)
   */
  public register(options: {
    type: ComponentType;
    category: ComponentCategory;
    component: ComponentConstructor;
    metadata: {
      name: string;
      description: string;
      version: string;
      author: string;
      tags: string[];
      aiMetadata: AIComponentMetadata;
    };
    schema: z.ZodObject<z.ZodRawShape>;
    subOnly?: boolean;
  }): void {
    this.registry[options.type] = {
      component: options.component,
      metadata: options.metadata.aiMetadata,
      preload: false,
      description: options.metadata.description,
      schema: options.schema,
      ...(options.subOnly ? { subOnly: true } : {}),
    };
    this.componentCache.set(options.type, options.component);
  }
  /**
   * Register multiple components at once
   */
  public registerComponents(
    entries: Array<{
      type: ComponentType;
      component: ComponentConstructor;
      metadata: AIComponentMetadata;
      description?: string;
      schema: z.ZodObject<z.ZodRawShape>;
      subOnly?: boolean;
    }>,
  ): void {
    entries.forEach(
      ({ type, component, metadata, description, schema, subOnly }) => {
        this.registerComponent(type, component, metadata, {
          description,
          schema,
          ...(subOnly ? { subOnly } : {}),
        });
      },
    );
  }
  /**
   * Unregister a component
   */
  public unregisterComponent(type: ComponentType): boolean {
    if (this.registry[type]) {
      delete this.registry[type];
      this.componentCache.delete(type);
      this.loadingPromises.delete(type);
      return true;
    }
    return false;
  }
  // ============================================================================
  // Component Loading Methods
  // ============================================================================
  /**
   * Get a component by type (synchronous if cached)
   */
  public getComponent(type: ComponentType): ComponentConstructor | undefined {
    return this.componentCache.get(type);
  }
  /**
   * Load a component dynamically with code splitting
   */
  public async loadComponent(
    type: ComponentType,
  ): Promise<ComponentConstructor> {
    // Check cache first
    const cached = this.componentCache.get(type);
    if (cached) {
      return cached;
    }
    // Check if already loading
    const loading = this.loadingPromises.get(type);
    if (loading) {
      return loading;
    }
    // Start loading
    const loadPromise = this.loadComponentAsync(type);
    this.loadingPromises.set(type, loadPromise);
    try {
      const component = await loadPromise;
      this.componentCache.set(type, component);
      this.loadingPromises.delete(type);
      return component;
    } catch (error) {
      this.loadingPromises.delete(type);
      throw error;
    }
  }
  private async ensureRegistryInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    this.initializationPromise = import("./initialize")
      .then(async (module) => {
        if (typeof module.initializeCMSComponents === "function") {
          await module.initializeCMSComponents();
        }
      })
      .catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    await this.initializationPromise;
  }
  private async ensureComponentRegistration(
    type: ComponentType,
  ): Promise<void> {
    if (this.registry[type] || this.componentCache.has(type)) {
      return;
    }
    await this.ensureRegistryInitialized();
    if (
      !this.registry[type] &&
      !this.componentCache.has(type) &&
      process.env.NODE_ENV === "development"
    ) {
      const [category] = this.getComponentCategoryAndName(type);
      console.warn(
        `[CMSComponentFactory] Component "${type}" (category: ${category}) is not registered.`,
      );
    }
  }
  /**
   * Internal async component loader with dynamic imports
   */
  private async loadComponentAsync(
    type: ComponentType,
  ): Promise<ComponentConstructor> {
    try {
      await this.ensureComponentRegistration(type);
      const cached = this.componentCache.get(type);
      if (cached) {
        return cached;
      }
      const registration = this.registry[type];
      if (registration?.component) {
        this.componentCache.set(type, registration.component);
        return registration.component;
      }
      throw new Error(`Component type is not registered: ${type}`);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error(`Failed to load component ${type}:`, error);
      }
      throw new Error(`Failed to load component ${type}: ${error}`);
    }
  }
  /**
   * Preload components for better performance
   */
  public async preloadComponents(types: ComponentType[]): Promise<void> {
    await Promise.all(types.map((type) => this.loadComponent(type)));
  }
  /**
   * Preload components by category
   */
  public async preloadCategory(category: ComponentCategory): Promise<void> {
    const types = this.getComponentTypesByCategory(category);
    await this.preloadComponents(types);
  }
  // ============================================================================
  // Registry Query Methods
  // ============================================================================
  /**
   * Check if a component is registered
   */
  public hasComponent(type: ComponentType): boolean {
    return !!this.registry[type] || this.componentCache.has(type);
  }
  /**
   * Get component metadata
   */
  public getComponentMetadata(
    type: ComponentType,
  ): AIComponentMetadata | undefined {
    return this.registry[type]?.metadata;
  }
  /**
   * Get all registered component types
   */
  public getRegisteredTypes(): ComponentType[] {
    return Object.keys(this.registry) as ComponentType[];
  }
  /**
   * Get component catalog with all registered components and their metadata
   */
  public getComponentCatalog(): Map<ComponentType, ComponentRegistryEntry> {
    return new Map(
      Object.entries(this.registry) as Array<
        [ComponentType, ComponentRegistryEntry]
      >,
    );
  }
  /**
   * Get detection patterns aggregated from all components
   */
  public getDetectionPatterns(): {
    byType: Map<
      ComponentType,
      { keywords: string[]; patterns: string[]; confidence: number }
    >;
    aggregated: {
      keywords: Set<string>;
      patterns: Set<string>;
      selectors: Set<string>;
    };
  } {
    const byType = new Map<
      ComponentType,
      { keywords: string[]; patterns: string[]; confidence: number }
    >();
    const aggregated = {
      keywords: new Set<string>(),
      patterns: new Set<string>(),
      selectors: new Set<string>(),
    };
    for (const [type, entry] of Object.entries(this.registry) as Array<
      [ComponentType, ComponentRegistryEntry]
    >) {
      if (entry.metadata) {
        const metadata = entry.metadata;
        const typePatterns = {
          keywords: metadata.keywords || [],
          patterns: metadata.patterns || [],
          confidence: metadata.confidence || 0.7,
        };
        byType.set(type, typePatterns);
        // Aggregate patterns
        typePatterns.keywords.forEach((k) => aggregated.keywords.add(k));
        typePatterns.patterns.forEach((p) => aggregated.patterns.add(p));
        // Extract DOM selectors from patterns if available
        // Note: domPatterns would be in extended metadata if available
        if ((metadata as any).domPatterns) {
          (metadata as any).domPatterns.forEach((s: string) =>
            aggregated.selectors.add(s),
          );
        }
      }
    }
    return { byType, aggregated };
  }
  /**
   * Get the registry map (for internal use by detection API)
   */
  public getRegistry(): Map<ComponentType, ComponentRegistryEntry> {
    return new Map(
      Object.entries(this.registry) as Array<
        [ComponentType, ComponentRegistryEntry]
      >,
    );
  }
  /**
   * Get components by category
   */
  public getComponentsByCategory(
    category: ComponentCategory,
  ): ComponentRegistryEntry[] {
    return Object.entries(this.registry)
      .filter(
        ([type]) =>
          this.getComponentCategory(type as ComponentType) === category,
      )
      .map(([_, entry]) => entry) as ComponentRegistryEntry[];
  }
  // ============================================================================
  // Cache Management
  // ============================================================================
  /**
   * Clear component cache
   */
  public clearCache(): void {
    this.componentCache.clear();
    this.loadingPromises.clear();
  }
  /**
   * Clear specific component from cache
   */
  public clearComponentCache(type: ComponentType): boolean {
    const deleted = this.componentCache.delete(type);
    this.loadingPromises.delete(type);
    return deleted;
  }
  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    cachedCount: number;
    loadingCount: number;
    registeredCount: number;
  } {
    return {
      cachedCount: this.componentCache.size,
      loadingCount: this.loadingPromises.size,
      registeredCount: Object.keys(this.registry).length,
    };
  }
  // ============================================================================
  // Helper Methods
  // ============================================================================
  /**
   * Get component category from type
   */
  private getComponentCategory(type: ComponentType): ComponentCategory {
    const categoryMap: { [key: string]: ComponentCategory } = {
      navbar: ComponentCategory.Navigation,
      sidemenu: ComponentCategory.Navigation,
      breadcrumb: ComponentCategory.Navigation,
      megamenu: ComponentCategory.Navigation,
      "hero-simple": ComponentCategory.Heroes,
      "hero-with-image": ComponentCategory.Heroes,
      "hero-video": ComponentCategory.Heroes,
      "hero-carousel": ComponentCategory.Heroes,
      "hero-banner": ComponentCategory.Heroes,
      "hero-split": ComponentCategory.Heroes,
      "hero-minimal": ComponentCategory.Heroes,
      "text-block": ComponentCategory.Content,
      "image-gallery": ComponentCategory.Content,
      "video-embed": ComponentCategory.Content,
      accordion: ComponentCategory.Content,
      "feature-grid": ComponentCategory.Features,
      "feature-list": ComponentCategory.Features,
      "feature-showcase": ComponentCategory.Features,
      "feature-comparison": ComponentCategory.Features,
      "cta-simple": ComponentCategory.CTA,
      "cta-with-form": ComponentCategory.CTA,
      "cta-banner": ComponentCategory.CTA,
      testimonials: ComponentCategory.SocialProof,
      "logo-cloud": ComponentCategory.SocialProof,
      reviews: ComponentCategory.SocialProof,
      "case-study": ComponentCategory.SocialProof,
      "contact-form": ComponentCategory.Contact,
      "contact-info": ComponentCategory.Contact,
      "location-map": ComponentCategory.Contact,
      "team-grid": ComponentCategory.About,
      timeline: ComponentCategory.Data,
      "timeline-event": ComponentCategory.Data,
      mission: ComponentCategory.About,
      "blog-post": ComponentCategory.Blog,
      "blog-list": ComponentCategory.Blog,
      "blog-card": ComponentCategory.Blog,
      "pricing-table": ComponentCategory.Pricing,
      "pricing-card": ComponentCategory.Pricing,
      "pricing-comparison": ComponentCategory.Pricing,
      "data-table": ComponentCategory.Data,
      chart: ComponentCategory.Data,
      statistics: ComponentCategory.Data,
    };
    return categoryMap[type] || ComponentCategory.Content;
  }
  /**
   * Get component category and name from type
   */
  private getComponentCategoryAndName(
    type: ComponentType,
  ): [ComponentCategory, string] {
    const category = this.getComponentCategory(type);
    return [category, type];
  }
  /**
   * Get all component types for a category
   */
  private getComponentTypesByCategory(
    category: ComponentCategory,
  ): ComponentType[] {
    return Object.values(ComponentType).filter(
      (type) => this.getComponentCategory(type) === category,
    );
  }
}
// ============================================================================
// Export singleton instance
// ============================================================================
export const cmsComponentFactory = CMSComponentFactory.getInstance();
// NOTE: Component registration moved to separate initialization file
// to avoid circular dependencies that were causing build timeouts
