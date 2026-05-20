import { initializePageTemplates } from '@/lib/studio/pages/_factory/initialize'
import { pageTemplateFactory } from '@/lib/studio/pages/_factory/page-factory'
import type { PageTemplateRegistration } from '@/lib/studio/pages/_core/types'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated'

let isInitialized = false
const registeredComponentTypes = new Set<ComponentType>(COMPONENT_REGISTRY.map(e => e.name))

export async function ensureRegistriesLoaded(): Promise<void> {
  if (isInitialized) {
    return
  }

  await initializePageTemplates()
  isInitialized = true
}

export function getTemplate(templateKey: string | null | undefined): PageTemplateRegistration | undefined {
  if (!templateKey) {
    return undefined
  }
  return pageTemplateFactory.getTemplate(templateKey)
}

export function isComponentRegistered(type: ComponentType): boolean {
  return registeredComponentTypes.has(type)
}

export function getAllRegisteredComponentTypes(): ComponentType[] {
  return Array.from(registeredComponentTypes)
}
