import React from 'react'
import { CardItemClient } from './card-item.client'
import type { CardItemProps } from './card-item.types'

/**
 * CardItem Server Component
 *
 * A standalone card component that renders a single card with title, description,
 * optional image, and actions. Used as a child component within two-column layouts
 * or other containers.
 */
export function CardItemServer(props: CardItemProps) {
  return <CardItemClient {...props} />
}
