import { CMSComponentProps } from '../../_core/types'
import { type CTAButton, type Image } from '@/lib/studio/components/cms/_core/value-objects'

// HeroWithImageCTA now uses CTAButton from registry
export type HeroWithImageCTA = CTAButton

// HeroWithImageImage extends Image from registry with additional fields
export interface HeroWithImageImage extends Image {
  renditions?: Array<{
    src?: string
    width?: number | null
    height?: number | null
  }>
  backgroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  objectFit?: 'cover' | 'contain'
  overlayColor?: string
}

export interface HeroWithImageContent {
  eyebrow?: string
  heading: string
  subheading?: string
  body?: string
  alignment?: 'left' | 'center'
  layout?: 'image-right' | 'image-left'
  theme?: 'light' | 'dark'
  image?: HeroWithImageImage
  ctaButtons?: HeroWithImageCTA[]
}

export interface HeroWithImageProps extends Omit<CMSComponentProps, 'content'> {
  content: HeroWithImageContent
}
