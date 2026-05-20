import type { CMSComponentProps } from '../../_core/types'

export interface NavMenuItemContent {
  label: string
  href?: string
  external?: boolean
  icon?: string
  children?: CMSComponentProps[]
  panelOffset?: number
  panelWidth?: number | string
  panelAlign?: 'start' | 'center' | 'end'
}

export interface NavMenuItemProps extends CMSComponentProps {
  content: NavMenuItemContent
}
