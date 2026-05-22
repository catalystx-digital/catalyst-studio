/**
 * Adapter components that wrap CTA components to make them compatible
 * with the CMS component factory's type requirements.
 *
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react'
import type { CMSComponentProps } from '../_core/types'
import { readRuntimeContent } from '../_core/utils'
import CTABanner from './cta-banner'
import CTASimple from './cta-simple'
import CTANewsletter from './cta-newsletter'
import CTAButtonGroup from './cta-button-group'
import type { CTABannerProps, CTABannerContent } from './cta-banner/cta-banner.types'
import type { CTASimpleProps, CTASimpleContent } from './cta-simple/cta-simple.types'
import type { CTANewsletterProps, CTANewsletterContent } from './cta-newsletter/cta-newsletter.types'
import type { CTAButtonGroupProps, CTAButtonGroupContent } from './cta-button-group/cta-button-group.types'

/**
 * CTABanner Adapter Component
 */
export const CTABannerAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: CTABannerProps = {
    ...props,
    content: readRuntimeContent<CTABannerContent>(props.content) as CTABannerContent
  }
  return <CTABanner {...adaptedProps} />
}

/**
 * CTASimple Adapter Component
 */
export const CTASimpleAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: CTASimpleProps = {
    ...props,
    content: readRuntimeContent<CTASimpleContent>(props.content) as CTASimpleContent
  }
  return <CTASimple {...adaptedProps} />
}

/**
 * CTANewsletter Adapter Component
 */
export const CTANewsletterAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: CTANewsletterProps = {
    ...props,
    content: readRuntimeContent<CTANewsletterContent>(props.content) as CTANewsletterContent
  }
  return <CTANewsletter {...adaptedProps} />
}

/**
 * CTAButtonGroup Adapter Component
 */
export const CTAButtonGroupAdapter: React.FC<CMSComponentProps> = (props) => {
  const adaptedProps: CTAButtonGroupProps = {
    ...props,
    content: readRuntimeContent<CTAButtonGroupContent>(props.content) as CTAButtonGroupContent
  }
  return <CTAButtonGroup {...adaptedProps} />
}
