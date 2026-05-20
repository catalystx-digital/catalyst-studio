'use client'

/**
 * Device Selector Component
 * Story 1.4: Device switching UI with smooth transitions
 */

import React from 'react'
import { usePreviewContext } from '@/lib/context/preview-context'
import { DeviceType, DEVICE_PRESETS } from '@/lib/preview/types'
import { Monitor, Tablet, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DeviceSelectorProps {
  className?: string
}

function DeviceSelectorComponent({ className }: DeviceSelectorProps) {
  const { state, switchDevice } = usePreviewContext()
  const { activeDevice } = state

  // Group devices by type
  const deviceGroups = {
    [DeviceType.DESKTOP]: Object.entries(DEVICE_PRESETS).filter(
      ([, device]) => device.type === DeviceType.DESKTOP
    ),
    [DeviceType.TABLET]: Object.entries(DEVICE_PRESETS).filter(
      ([, device]) => device.type === DeviceType.TABLET
    ),
    [DeviceType.MOBILE]: Object.entries(DEVICE_PRESETS).filter(
      ([, device]) => device.type === DeviceType.MOBILE
    ),
  }

  // Get icon for device type
  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case DeviceType.DESKTOP:
        return Monitor
      case DeviceType.TABLET:
        return Tablet
      case DeviceType.MOBILE:
        return Smartphone
    }
  }

  // Quick device type buttons
  const deviceTypes = [
    { type: DeviceType.DESKTOP, label: 'Desktop', defaultDevice: 'desktop-macbook' },
    { type: DeviceType.TABLET, label: 'Tablet', defaultDevice: 'tablet-ipad-air' },
    { type: DeviceType.MOBILE, label: 'Mobile', defaultDevice: 'mobile-iphone-14-pro' },
  ]

  return (
    <div className={cn('device-selector flex flex-col gap-4', className)}>
      {/* Quick device type selector */}
      <div className="flex items-center gap-2 p-1 bg-surface-dark backdrop-blur-glass border border-gray-800 rounded-lg">
        {deviceTypes.map(({ type, label, defaultDevice }) => {
          const Icon = getDeviceIcon(type)
          const isActive = activeDevice.type === type
          
          return (
            <TooltipProvider key={type}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => switchDevice(defaultDevice)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 ease-catalyst',
                      'hover:bg-gray-800 hover:shadow-sm transform hover:scale-105 active:scale-95',
                      isActive && 'bg-gray-800 shadow-sm border border-catalyst-orange'
                    )}
                    style={{ willChange: 'transform' }}
                    aria-label={`Switch to ${label} view`}
                  >
                    <Icon 
                      className={cn(
                        'w-4 h-4 transition-colors',
                        isActive ? 'text-catalyst-orange' : 'text-gray-400'
                      )}
                    />
                    <span 
                      className={cn(
                        'text-sm font-medium transition-colors',
                        isActive ? 'text-catalyst-orange' : 'text-gray-300'
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {label.toLowerCase()} view</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>

      {/* Detailed device selector dropdown */}
      <div className="relative">
        <select
          value={Object.entries(DEVICE_PRESETS).find(([, d]) => 
            d.name === activeDevice.name
          )?.[0] || ''}
          onChange={(e) => switchDevice(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-surface-dark backdrop-blur-glass border border-gray-800 text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-catalyst-orange focus:border-catalyst-orange appearance-none cursor-pointer catalyst-select"
        >
          <optgroup label="Desktop">
            {deviceGroups[DeviceType.DESKTOP].map(([key, device]) => (
              <option key={key} value={key}>
                {device.name} ({device.width}×{device.height})
              </option>
            ))}
          </optgroup>
          <optgroup label="Tablet">
            {deviceGroups[DeviceType.TABLET].map(([key, device]) => (
              <option key={key} value={key}>
                {device.name} ({device.width}×{device.height})
              </option>
            ))}
          </optgroup>
          <optgroup label="Mobile">
            {deviceGroups[DeviceType.MOBILE].map(([key, device]) => (
              <option key={key} value={key}>
                {device.name} ({device.width}×{device.height})
              </option>
            ))}
          </optgroup>
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Current device info */}
      <div className="text-xs text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>Current Device:</span>
          <span className="font-medium text-gray-200">{activeDevice.name}</span>
        </div>
        <div className="flex justify-between">
          <span>Viewport:</span>
          <span className="font-medium text-gray-200">
            {activeDevice.width} × {activeDevice.height}px
          </span>
        </div>
        <div className="flex justify-between">
          <span>Scale:</span>
          <span className="font-medium text-gray-200">
            {(activeDevice.scale * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  )
}

// Export memoized component for performance
export const DeviceSelector = React.memo(DeviceSelectorComponent)
