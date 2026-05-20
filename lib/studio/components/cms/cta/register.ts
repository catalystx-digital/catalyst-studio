import { cmsComponentFactory } from '../_factory/factory'
import { ComponentType } from '../_core/types'
import { detectionToAIMetadata } from '../_core/component-definition'
import { CTABannerAdapter, CTASimpleAdapter, CTANewsletterAdapter, CTAButtonGroupAdapter } from './adapters'
import { CTABannerDef } from './cta-banner/cta-banner.def'
import { CTASimpleDef } from './cta-simple/cta-simple.def'
import { CTANewsletterDef } from './cta-newsletter/cta-newsletter.def'
import { CTAButtonGroupDef } from './cta-button-group/cta-button-group.def'

// Register CTA Simple component
cmsComponentFactory.registerComponent(
  ComponentType.CTASimple,
  CTASimpleAdapter,
  detectionToAIMetadata(CTASimpleDef.detection!, ComponentType.CTASimple),
  { description: CTASimpleDef.description, schema: CTASimpleDef.schema }
)

// Register CTA Banner component explicitly for contract coverage
cmsComponentFactory.registerComponent(
  ComponentType.CTABanner,
  CTABannerAdapter,
  detectionToAIMetadata(CTABannerDef.detection!, ComponentType.CTABanner),
  { description: CTABannerDef.description, schema: CTABannerDef.schema }
)

// Register CTA Newsletter component (maps to CTAWithForm)
cmsComponentFactory.registerComponent(
  ComponentType.CTAWithForm,
  CTANewsletterAdapter,
  detectionToAIMetadata(CTANewsletterDef.detection!, ComponentType.CTAWithForm),
  { description: CTANewsletterDef.description, schema: CTANewsletterDef.schema }
)

// Register CTA Button Group component
cmsComponentFactory.registerComponent(
  ComponentType.CTAButtonGroup,
  CTAButtonGroupAdapter,
  detectionToAIMetadata(CTAButtonGroupDef.detection!, ComponentType.CTAButtonGroup),
  { description: CTAButtonGroupDef.description, schema: CTAButtonGroupDef.schema }
)
