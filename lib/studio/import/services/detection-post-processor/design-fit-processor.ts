import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import type {
  DesignFitDiagnostic,
  DesignFitMutation,
  ImportDesignProfile,
  PresentationSkeletonSelection,
} from '@/lib/studio/import/types/design-profile.types'

type ComponentMetadataWithDesignFit = NonNullable<DetectedComponent['metadata']> & {
  designFit?: {
    skeletonKey?: string
    skeletonConfidence?: number
    designProfileConfidence?: number
    mutations?: DesignFitMutation[]
  }
}

export interface DesignFitResult {
  components: DetectedComponent[]
  mutations: DesignFitMutation[]
  diagnostics: DesignFitDiagnostic[]
}

export interface DesignFitOptions {
  designProfile?: ImportDesignProfile | null
  skeleton?: PresentationSkeletonSelection | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function setIfMissing(
  component: DetectedComponent,
  mutations: DesignFitMutation[],
  field: string,
  value: unknown,
  evidence: string,
): void {
  if (!isRecord(component.content) || component.content[field] !== undefined) {
    return
  }
  component.content[field] = value
  mutations.push({
    component: String(component.type),
    field,
    value,
    evidence,
    confidence: 'medium',
  })
}

function setButtonVariant(
  component: DetectedComponent,
  mutations: DesignFitMutation[],
  field: 'primaryButton' | 'secondaryButton',
  variant: 'primary' | 'outline',
): void {
  const button = component.content?.[field]
  if (!isRecord(button) || button.variant !== undefined) {
    return
  }
  button.variant = variant
  mutations.push({
    component: String(component.type),
    field: `${field}.variant`,
    value: variant,
    evidence: 'presentation-skeleton.button-role',
    confidence: 'medium',
  })
}

function hasUsableImage(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }
  const src = value.src
  if (typeof src === 'string' && src.trim().length > 0) {
    return true
  }
  if (isRecord(src) && typeof src.url === 'string' && src.url.trim().length > 0) {
    return true
  }
  return typeof value.originalUrl === 'string' && value.originalUrl.trim().length > 0
}

function normalizeCtaButtons(
  component: DetectedComponent,
  mutations: DesignFitMutation[],
): void {
  const buttons = component.content?.ctaButtons
  if (!Array.isArray(buttons)) return
  buttons.forEach((button, index) => {
    if (!isRecord(button) || button.variant !== undefined) return
    const variant = index === 0 ? 'primary' : 'outline'
    button.variant = variant
    mutations.push({
      component: String(component.type),
      field: `ctaButtons[${index}].variant`,
      value: variant,
      evidence: 'presentation-skeleton.button-order',
      confidence: 'medium',
    })
  })
}

function applyGlobalBrandMetadata(
  component: DetectedComponent,
  profile: ImportDesignProfile | null | undefined,
  skeleton: PresentationSkeletonSelection | null | undefined,
  mutations: DesignFitMutation[] = [],
): void {
  component.metadata = {
    ...(component.metadata ?? {}),
    designFit: {
      skeletonKey: skeleton?.key,
      skeletonConfidence: skeleton?.confidence,
      designProfileConfidence: profile?.confidence,
      mutations,
    },
  } as ComponentMetadataWithDesignFit
}

function fitCardGrid(
  component: DetectedComponent,
  mutations: DesignFitMutation[],
): void {
  if (!Array.isArray(component.content?.cards)) return
  const cards = component.content.cards.filter(isRecord)
  const cardCount = cards.length
  const imageCount = cards.filter(card => hasUsableImage(card.image) || hasUsableImage(card.thumbnail)).length
  const imageRatio = cardCount > 0 ? imageCount / cardCount : 0
  const textOnly = imageCount === 0
  const twoCardEditorial = cardCount === 2 && imageCount === 2
  const imageHeavy = imageRatio >= 0.5
  const columns = cardCount >= 4 ? 4 : cardCount === 2 ? 2 : 3
  setIfMissing(component, mutations, 'columns', columns, 'card-grid.source-shape.columns')
  setIfMissing(component, mutations, 'gap', 'medium', 'card-grid.source-shape.spacing')

  if (textOnly) {
    setIfMissing(component, mutations, 'cardStyle', 'compact', 'card-grid.source-shape.text-only')
    return
  }

  if (twoCardEditorial) {
    setIfMissing(component, mutations, 'cardStyle', 'horizontal', 'card-grid.source-shape.two-card-editorial')
    setIfMissing(component, mutations, 'imagePosition', 'left', 'card-grid.source-shape.two-card-editorial')
    setIfMissing(component, mutations, 'imageAspectRatio', '4:3', 'card-grid.source-shape.two-card-editorial')
    return
  }

  if (imageHeavy) {
    setIfMissing(component, mutations, 'cardStyle', 'vertical', 'card-grid.source-shape.image-heavy')
    setIfMissing(component, mutations, 'imagePosition', 'top', 'card-grid.source-shape.image-heavy')
    setIfMissing(component, mutations, 'imageAspectRatio', '16:9', 'card-grid.source-shape.image-heavy')
  }
}

function fitLogoCloud(
  component: DetectedComponent,
  mutations: DesignFitMutation[],
): void {
  setIfMissing(component, mutations, 'size', 'medium', 'presentation-skeleton.logo-cloud')
  setIfMissing(component, mutations, 'grayscale', false, 'presentation-skeleton.logo-cloud')
  setIfMissing(component, mutations, 'animateScroll', false, 'presentation-skeleton.logo-cloud')
}

function fitHero(component: DetectedComponent, mutations: DesignFitMutation[]): void {
  if (component.type === ComponentType.HeroWithImage) {
    setIfMissing(component, mutations, 'alignment', 'left', 'presentation-skeleton.hero')
    setIfMissing(component, mutations, 'layout', 'image-right', 'presentation-skeleton.hero')
    normalizeCtaButtons(component, mutations)
  } else if (component.type === ComponentType.HeroSimple) {
    setIfMissing(component, mutations, 'alignment', 'center', 'presentation-skeleton.hero')
    setIfMissing(component, mutations, 'height', 'large', 'presentation-skeleton.hero')
    normalizeCtaButtons(component, mutations)
  } else if (component.type === ComponentType.HeroBanner) {
    setIfMissing(component, mutations, 'alignment', 'center', 'presentation-skeleton.hero')
    setIfMissing(component, mutations, 'height', 'large', 'presentation-skeleton.hero')
    normalizeCtaButtons(component, mutations)
  }
}

function hasUsableDesignProfile(profile: ImportDesignProfile | null | undefined): boolean {
  if (!profile || profile.confidence < 0.35) return false
  return !profile.diagnostics.some(diagnostic =>
    diagnostic.code === 'DESIGN_PROFILE_MISSING_PROBE' ||
    diagnostic.code === 'DESIGN_PROFILE_LOW_CONFIDENCE'
  )
}

function shouldApplyDesignFit(
  profile: ImportDesignProfile | null | undefined,
  skeleton: PresentationSkeletonSelection | null | undefined,
): boolean {
  return hasUsableDesignProfile(profile) && Boolean(skeleton && skeleton.key !== 'unknown' && skeleton.confidence >= 0.55)
}

export function applyDesignFit(
  components: DetectedComponent[],
  options: DesignFitOptions = {}
): DesignFitResult {
  const mutations: DesignFitMutation[] = []
  const diagnostics: DesignFitDiagnostic[] = []
  const skeleton = options.skeleton

  if (!shouldApplyDesignFit(options.designProfile, skeleton)) {
    diagnostics.push({
      code: 'DESIGN_PROFILE_LOW_CONFIDENCE',
      severity: 'warning',
      message: 'Design-fit skipped presentation mutations because design profile or skeleton evidence was insufficient.',
    })
    for (const component of components) {
      applyGlobalBrandMetadata(component, options.designProfile, skeleton)
    }
    return { components, mutations, diagnostics }
  }

  for (const component of components) {
    const componentMutations: DesignFitMutation[] = []

    switch (component.type) {
      case ComponentType.CardGrid:
        fitCardGrid(component, componentMutations)
        break
      case ComponentType.LogoCloud:
        fitLogoCloud(component, componentMutations)
        break
      case ComponentType.CTASimple:
        setButtonVariant(component, componentMutations, 'primaryButton', 'primary')
        setButtonVariant(component, componentMutations, 'secondaryButton', 'outline')
        setIfMissing(component, componentMutations, 'alignment', 'center', 'presentation-skeleton.cta')
        break
      case ComponentType.HeroWithImage:
      case ComponentType.HeroSimple:
      case ComponentType.HeroBanner:
        fitHero(component, componentMutations)
        break
    }

    mutations.push(...componentMutations)
    applyGlobalBrandMetadata(component, options.designProfile, skeleton, componentMutations)
  }

  return { components, mutations, diagnostics }
}
