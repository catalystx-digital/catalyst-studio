import { registerBlogCanonicalComponents } from './blog'
import { registerCommonCanonicalComponents } from './common'
import { registerHeroCanonicalComponents } from './heroes'
import { registerExperienceCanonicalComponents } from './experience'
import { registerNavigationCanonicalComponents } from './navigation'
import { registerContentCanonicalComponents } from './content'
import { registerCtaCanonicalComponents } from './cta'
import { registerContactCanonicalComponents } from './contact'
import { registerAboutCanonicalComponents } from './about'
import { registerDataCanonicalComponents } from './data'
import {
  canonicalizeComponentType,
  clearCanonicalComponentDefinitions,
  getCanonicalComponentDefinition,
  listCanonicalComponentDefinitions,
  registerCanonicalComponent
} from './registry'
import type { CanonicalComponentDefinition } from './registry'

let initialized = false

function ensureInitialized(): void {
  if (initialized) {
    return
  }
  registerNavigationCanonicalComponents()
  registerCommonCanonicalComponents()
  registerContentCanonicalComponents()
  registerHeroCanonicalComponents()
  registerExperienceCanonicalComponents()
  registerCtaCanonicalComponents()
  registerContactCanonicalComponents()
  registerAboutCanonicalComponents()
  registerDataCanonicalComponents()
  registerBlogCanonicalComponents()
  initialized = true
}

export function ensureCanonicalComponentsRegistered(): void {
  ensureInitialized()
}

export function getCanonicalComponent(
  canonicalType: string | undefined | null
): CanonicalComponentDefinition | undefined {
  ensureInitialized()
  return getCanonicalComponentDefinition(canonicalType)
}

export function listCanonicalComponents(): CanonicalComponentDefinition[] {
  ensureInitialized()
  return listCanonicalComponentDefinitions()
}

export function registerCanonicalComponentGuidance(definition: CanonicalComponentDefinition): void {
  registerCanonicalComponent(definition)
}

export function clearCanonicalComponentGuidance(): void {
  initialized = false
  clearCanonicalComponentDefinitions()
}

export { canonicalizeComponentType }
export type {
  CanonicalComponentDefinition
}
