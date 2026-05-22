import { ComponentType, ComponentConstructor, AIComponentMetadata } from '../_core/types';

export interface RegistryEntry {
  component: ComponentConstructor;
  metadata?: AIComponentMetadata;
  preloaded: boolean;
  dependencies?: ComponentType[];
}

export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private registry: Map<ComponentType, RegistryEntry> = new Map();
  
  private constructor() {}
  
  public static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }
  
  public register(
    type: ComponentType,
    component: ComponentConstructor,
    metadata?: AIComponentMetadata
  ): void {
    if (this.registry.has(type)) {
      const message = `CMS component type "${type}" is already registered. Duplicate registrations are ignored.`;
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(message);
      }
      return;
    }

    this.registry.set(type, {
      component,
      metadata,
      preloaded: false,
      dependencies: []
    });
  }
  
  public getComponent(type: ComponentType): ComponentConstructor | undefined {
    return this.registry.get(type)?.component;
  }
  
  public has(type: ComponentType): boolean {
    return this.registry.has(type);
  }
  
  public getAllTypes(): ComponentType[] {
    return Array.from(this.registry.keys());
  }
  
  public async preload(type: ComponentType): Promise<void> {
    const entry = this.registry.get(type);
    if (entry && !entry.preloaded) {
      // Mark as preloaded
      entry.preloaded = true;
      
      // Preload dependencies if any
      if (entry.dependencies) {
        await Promise.all(
          entry.dependencies.map(dep => this.preload(dep))
        );
      }
    }
  }
  
  public clear(): void {
    this.registry.clear();
  }
}
