/**
 * Preview System Type Definitions
 * Story 1.4: Create Preview System with Device Switching
 */

// Device type enum for different viewport categories
export enum DeviceType {
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  MOBILE = 'mobile'
}

// Frame styling for device representation
export interface FrameStyle {
  borderRadius?: string
  borderWidth?: string
  borderColor?: string
  backgroundColor?: string
  boxShadow?: string
  padding?: string
  hasNotch?: boolean
  hasHomeButton?: boolean
  hasBrowserChrome?: boolean
}

// Device configuration with viewport dimensions
export interface Device {
  type: DeviceType
  name: string
  width: number
  height: number
  scale: number
  frame: FrameStyle
  userAgent?: string
}

// Common device presets
export const DEVICE_PRESETS: Record<string, Device> = {
  // Desktop devices
  'desktop-full-hd': {
    type: DeviceType.DESKTOP,
    name: 'Desktop Full HD',
    width: 1920,
    height: 1080,
    scale: 0.5,
    frame: {
      borderRadius: '8px',
      borderWidth: '1px',
      borderColor: '#e5e7eb',
      backgroundColor: '#ffffff',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      hasBrowserChrome: true
    }
  },
  'desktop-macbook': {
    type: DeviceType.DESKTOP,
    name: 'MacBook',
    width: 1440,
    height: 900,
    scale: 0.6,
    frame: {
      borderRadius: '8px',
      borderWidth: '1px',
      borderColor: '#e5e7eb',
      backgroundColor: '#ffffff',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      hasBrowserChrome: true
    }
  },
  // Tablet devices
  'tablet-ipad-air': {
    type: DeviceType.TABLET,
    name: 'iPad Air',
    width: 820,
    height: 1180,
    scale: 0.7,
    frame: {
      borderRadius: '24px',
      borderWidth: '8px',
      borderColor: '#1f2937',
      backgroundColor: '#000000',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      padding: '12px',
      hasHomeButton: false
    }
  },
  'tablet-ipad-mini': {
    type: DeviceType.TABLET,
    name: 'iPad Mini',
    width: 768,
    height: 1024,
    scale: 0.7,
    frame: {
      borderRadius: '24px',
      borderWidth: '8px',
      borderColor: '#1f2937',
      backgroundColor: '#000000',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      padding: '12px',
      hasHomeButton: true
    }
  },
  // Mobile devices
  'mobile-iphone-14-pro': {
    type: DeviceType.MOBILE,
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    scale: 1,
    frame: {
      borderRadius: '47px',
      borderWidth: '10px',
      borderColor: '#1f2937',
      backgroundColor: '#000000',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      padding: '10px',
      hasNotch: true,
      hasHomeButton: false
    }
  },
  'mobile-iphone-12': {
    type: DeviceType.MOBILE,
    name: 'iPhone 12/13',
    width: 390,
    height: 844,
    scale: 1,
    frame: {
      borderRadius: '47px',
      borderWidth: '10px',
      borderColor: '#1f2937',
      backgroundColor: '#000000',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      padding: '10px',
      hasNotch: true,
      hasHomeButton: false
    }
  },
  'mobile-iphone-se': {
    type: DeviceType.MOBILE,
    name: 'iPhone SE',
    width: 375,
    height: 667,
    scale: 1,
    frame: {
      borderRadius: '36px',
      borderWidth: '10px',
      borderColor: '#1f2937',
      backgroundColor: '#000000',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      padding: '10px',
      hasNotch: false,
      hasHomeButton: true
    }
  }
}

// Page information for multi-page navigation
export interface Page {
  id: string
  title: string
  path: string
  content: string
  styles?: string
}

// Preview settings for user preferences
export interface PreviewSettings {
  showDeviceFrame: boolean
  showToolbar: boolean
  autoRefresh: boolean
  refreshInterval: number // milliseconds
  defaultDevice: string
  zoom: number
  showGrid: boolean
  showRulers: boolean
  highlightInteractive: boolean
}

// Complete preview state
export interface PreviewState {
  activeDevice: Device
  content: string
  styles?: string
  pages: Page[]
  currentPage: number
  zoom: number
  settings: PreviewSettings
  isLoading: boolean
  error: string | null
  lastUpdate: number
  cachedContent?: Record<string, string>
}

// PostMessage protocol types
// Parent → iframe messages
export interface PreviewMessage {
  type: 'UPDATE_CONTENT' | 'UPDATE_COMPONENT' | 'CHANGE_DEVICE' | 'NAVIGATE' | 'REFRESH'
  payload: {
    content?: string
    device?: DeviceType
    page?: number
    styles?: string
    // UPDATE_COMPONENT specific fields
    html?: string
    css?: string
    darkCss?: string
  }
  timestamp: number
}

// iframe → Parent responses
export interface PreviewResponse {
  type: 'READY' | 'ERROR' | 'NAVIGATION' | 'LOADED'
  payload: {
    status?: string
    error?: string
    currentPage?: number
  }
  timestamp: number
}

// Default preview settings
export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  showDeviceFrame: true,
  showToolbar: true,
  autoRefresh: true,
  refreshInterval: 2000, // 2 seconds as per requirement
  defaultDevice: 'desktop-macbook',
  zoom: 1,
  showGrid: false,
  showRulers: false,
  highlightInteractive: false
}

// Initial preview state
export const INITIAL_PREVIEW_STATE: PreviewState = {
  activeDevice: DEVICE_PRESETS['desktop-macbook'],
  content: '',
  pages: [],
  currentPage: 0,
  zoom: 1,
  settings: DEFAULT_PREVIEW_SETTINGS,
  isLoading: false,
  error: null,
  lastUpdate: Date.now()
}