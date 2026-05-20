import React, { useState, useEffect } from 'react'
import { 
  Menu, X, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  ChevronLeft, ChevronRight, Smartphone, Tablet, Monitor,
  Move, Hand, MousePointer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResponsiveWrapperProps {
  children: React.ReactNode
  onZoomChange?: (zoom: number) => void
  onViewportChange?: (viewport: string) => void
}

type DeviceMode = 'mobile' | 'tablet' | 'desktop' | 'responsive'
type InteractionMode = 'select' | 'pan' | 'zoom'

export function ResponsiveWrapper({ 
  children, 
  onZoomChange,
  onViewportChange 
}: ResponsiveWrapperProps) {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('responsive')
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('select')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [touchStartDistance, setTouchStartDistance] = useState(0)
  const [currentZoom, setCurrentZoom] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  // Device breakpoints
  const breakpoints = {
    mobile: 640,
    tablet: 1024,
    desktop: 1920
  }

  // Detect device type
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      setIsMobile(width < breakpoints.mobile)
      setIsTablet(width >= breakpoints.mobile && width < breakpoints.tablet)
      
      // Auto-adjust sidebar on mobile
      if (width < breakpoints.tablet) {
        setIsSidebarOpen(false)
      }
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [breakpoints.mobile, breakpoints.tablet])

  // Handle touch gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      setTouchStartDistance(distance)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistance > 0) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      
      const scale = distance / touchStartDistance
      const newZoom = Math.min(Math.max(currentZoom * scale, 0.1), 3)
      
      setCurrentZoom(newZoom)
      onZoomChange?.(newZoom)
    }
  }

  const handleTouchEnd = () => {
    setTouchStartDistance(0)
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Device mode styles
  const getDeviceStyles = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'max-w-[375px] mx-auto'
      case 'tablet':
        return 'max-w-[768px] mx-auto'
      case 'desktop':
        return 'max-w-[1440px] mx-auto'
      default:
        return ''
    }
  }

  // Mobile-optimized toolbar
  const MobileToolbar = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 p-2 z-50 md:hidden">
      <div className="flex items-center justify-around">
        <Button
          size="sm"
          variant={interactionMode === 'select' ? 'default' : 'ghost'}
          onClick={() => setInteractionMode('select')}
          className="flex-1"
        >
          <MousePointer className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={interactionMode === 'pan' ? 'default' : 'ghost'}
          onClick={() => setInteractionMode('pan')}
          className="flex-1"
        >
          <Hand className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={interactionMode === 'zoom' ? 'default' : 'ghost'}
          onClick={() => setInteractionMode('zoom')}
          className="flex-1"
        >
          <Move className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCurrentZoom(z => Math.min(z + 0.1, 3))}
          className="flex-1"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCurrentZoom(z => Math.max(z - 0.1, 0.1))}
          className="flex-1"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  // Tablet-optimized sidebar
  const TabletSidebar = () => (
    <div className={cn(
      "fixed left-0 top-0 bottom-0 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-gray-700 transform transition-transform z-40",
      isSidebarOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Tools</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Sidebar content */}
      </div>
    </div>
  )

  // Desktop viewport selector
  const ViewportSelector = () => (
    <div className="hidden md:flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
      <Button
        size="sm"
        variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
        onClick={() => {
          setDeviceMode('mobile')
          onViewportChange?.('mobile')
        }}
        className="px-2"
      >
        <Smartphone className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={deviceMode === 'tablet' ? 'default' : 'ghost'}
        onClick={() => {
          setDeviceMode('tablet')
          onViewportChange?.('tablet')
        }}
        className="px-2"
      >
        <Tablet className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
        onClick={() => {
          setDeviceMode('desktop')
          onViewportChange?.('desktop')
        }}
        className="px-2"
      >
        <Monitor className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant={deviceMode === 'responsive' ? 'default' : 'ghost'}
        onClick={() => {
          setDeviceMode('responsive')
          onViewportChange?.('responsive')
        }}
        className="px-2"
      >
        Auto
      </Button>
    </div>
  )

  return (
    <div className="relative w-full h-full">
      {/* Mobile menu button */}
      {(isMobile || isTablet) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Tablet sidebar */}
      {isTablet && <TabletSidebar />}


      {/* Main content area with responsive wrapper */}
      <div
        className={cn(
          "w-full h-full overflow-hidden",
          getDeviceStyles(),
          isMobile && "pb-16", // Space for mobile toolbar
          isTablet && isSidebarOpen && "ml-64" // Space for tablet sidebar
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: interactionMode === 'pan' ? 'grab' : 
                  interactionMode === 'zoom' ? 'zoom-in' : 
                  'default',
          touchAction: interactionMode === 'pan' ? 'none' : 'auto'
        }}
      >
        {/* Device frame for preview */}
        {deviceMode !== 'responsive' && !isMobile && !isTablet && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className={cn(
              "mx-auto border-2 border-gray-600 rounded-lg",
              deviceMode === 'mobile' && "w-[375px] h-[667px] rounded-[2rem]",
              deviceMode === 'tablet' && "w-[768px] h-[1024px] rounded-[1rem]",
              deviceMode === 'desktop' && "w-full h-full rounded-lg"
            )}>
              {/* Device frame decorations */}
              {deviceMode === 'mobile' && (
                <>
                  <div className="w-20 h-1 bg-gray-600 rounded-full mx-auto mt-2" />
                  <div className="w-10 h-10 border-2 border-gray-600 rounded-full mx-auto absolute bottom-2 left-1/2 -translate-x-1/2" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Render children with zoom */}
        <div 
          className="w-full h-full"
          style={{
            transform: `scale(${currentZoom})`,
            transformOrigin: 'center center'
          }}
        >
          {children}
        </div>
      </div>

      {/* Mobile toolbar */}
      {isMobile && <MobileToolbar />}

      {/* Touch gesture hints */}
      {isMobile && interactionMode === 'zoom' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-gray-900/90 text-white text-xs px-3 py-2 rounded-lg">
            Pinch to zoom
          </div>
        </div>
      )}
    </div>
  )
}
