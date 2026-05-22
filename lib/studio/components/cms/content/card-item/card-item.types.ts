import type { ComponentTheme, ComponentType, ComponentCategory } from '../../_core/types'
import type { SmartLink } from '../../_core/value-objects'

/**
 * Image structure that can come from import pipeline
 * Supports both simple string URLs and complex media objects
 */
export interface CardItemImage {
  [key: string]: unknown
  src: string | { src?: string; url?: string; mediaId?: string; mediaType?: 'image' | 'video' | 'file'; originalUrl?: string; renditions?: Array<{ src: string; width?: number; height?: number }> }
  alt?: string
  originalUrl?: string
  renditions?: Array<{ src: string; width?: number; height?: number }>
}

/**
 * Content structure for CardItem component
 */
export interface CardItemContent {
  [key: string]: unknown
  title: string
  description?: string
  image?: string | CardItemImage
  imageAlt?: string
  link?: string
  href?: SmartLink | string
  linkText?: string
  badge?: string
  icon?: string
  metadata?: {
    author?: string
    date?: string
    category?: string
    tags?: string[]
  }
  actions?: Array<{
    label: string
    url?: string
    href?: SmartLink | string
    variant?: 'primary' | 'secondary' | 'outline'
  }>
}

/**
 * Props for the CardItem component
 * Note: We don't extend CMSComponentProps due to content type conflicts,
 * but we match its structure for compatibility with the factory
 */
export interface CardItemProps {
  id: string
  type?: ComponentType
  category?: ComponentCategory
  content: CardItemContent
  className?: string
  style?: React.CSSProperties
  theme?: ComponentTheme
  variant?: 'default' | 'compact' | 'horizontal'
}
