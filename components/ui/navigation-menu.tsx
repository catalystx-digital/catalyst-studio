"use client"

import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type PanelAlignment = "start" | "center" | "end"

type TriggerMeta = {
  offset: number
  align: PanelAlignment
  width: string | number | null
}

type Measurement = {
  rect: DOMRect
  meta: TriggerMeta
}

interface PositioningContextValue {
  registerViewportWrapper(node: HTMLDivElement | null): void
  registerViewport(node: HTMLElement | null): void
  updatePosition(trigger: HTMLElement, meta: TriggerMeta): void
}

const PositioningContext = React.createContext<PositioningContextValue | null>(
  null
)

function usePositioningContext(component: string) {
  const context = React.useContext(PositioningContext)
  if (!context) {
    throw new Error(
      `${component} must be used within a NavigationMenu provider.`
    )
  }
  return context
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (!ref) return
      if (typeof ref === "function") {
        ref(value)
      } else {
        ;(ref as React.MutableRefObject<T | null>).current = value
      }
    })
  }
}

function parseAlign(value: unknown): PanelAlignment {
  if (value === "start" || value === "end" || value === "center") {
    return value
  }
  return "center"
}

function parseOffset(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseFloat(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return 0
}

function parseWidth(value: unknown): string | number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length) {
    return value
  }
  return null
}

const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>((props, forwardedRef) => {
  const { className, children, ...rest } = props
  const rootRef = React.useRef<HTMLElement | null>(null)
  const viewportWrapperRef = React.useRef<HTMLDivElement | null>(null)
  const viewportRef = React.useRef<HTMLElement | null>(null)
  const lastMeasurementRef = React.useRef<Measurement | null>(null)

  const applyPosition = React.useCallback(
    (measurement: Measurement) => {
      const root = rootRef.current
      const wrapper = viewportWrapperRef.current
      const viewport = viewportRef.current
      if (!root || !wrapper || !viewport) {
        return
      }

      if (typeof window !== "undefined") {
        const isMobile = window.matchMedia("(max-width: 639px)").matches
        if (isMobile) {
          wrapper.style.setProperty("--cms-navigation-viewport-offset", "0px")
          viewport.style.removeProperty("width")
          return
        }
      }

      const { rect, meta } = measurement
      if (rect.width === 0 && rect.height === 0) {
        return
      }

      if (meta.width !== null) {
        viewport.style.width =
          typeof meta.width === "number" ? `${meta.width}px` : meta.width
      } else {
        viewport.style.removeProperty("width")
      }

      const viewportWidth =
        viewport.offsetWidth || viewport.getBoundingClientRect().width
      if (viewportWidth === 0) {
        wrapper.style.setProperty("--cms-navigation-viewport-offset", "0px")
        return
      }

      const rootRect = root.getBoundingClientRect()
      let left: number

      switch (meta.align) {
        case "start":
          left = rect.left
          break
        case "end":
          left = rect.right - viewportWidth
          break
        default:
          left = rect.left + rect.width / 2 - viewportWidth / 2
      }

      left += meta.offset

      const min = rootRect.left
      const max = rootRect.left + rootRect.width - viewportWidth
      const clamped = Math.max(min, Math.min(max, left))
      const relative = clamped - rootRect.left

      wrapper.style.setProperty(
        "--cms-navigation-viewport-offset",
        `${relative}px`
      )
    },
    []
  )

  const updatePosition = React.useCallback(
    (trigger: HTMLElement, meta: TriggerMeta) => {
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const measurement: Measurement = {
        rect,
        meta
      }
      lastMeasurementRef.current = measurement

      const run = () => applyPosition(measurement)
      if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
        window.requestAnimationFrame(run)
      } else {
        run()
      }
    },
    [applyPosition]
  )

  React.useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const viewport = viewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver(() => {
      if (lastMeasurementRef.current) {
        applyPosition(lastMeasurementRef.current)
      }
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [applyPosition])

  React.useEffect(() => {
    const handleResize = () => {
      if (lastMeasurementRef.current) {
        applyPosition(lastMeasurementRef.current)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [applyPosition])

  const contextValue = React.useMemo<PositioningContextValue>(
    () => ({
      registerViewportWrapper: (node) => {
        viewportWrapperRef.current = node
        if (node) {
          node.style.setProperty("--cms-navigation-viewport-offset", "0px")
          if (lastMeasurementRef.current) {
            applyPosition(lastMeasurementRef.current)
          }
        }
      },
      registerViewport: (node) => {
        viewportRef.current = node
        if (node) {
          node.style.removeProperty("width")
          if (lastMeasurementRef.current) {
            applyPosition(lastMeasurementRef.current)
          }
        }
      },
      updatePosition
    }),
    [updatePosition]
  )

  const combinedRef = React.useMemo(
    () => mergeRefs(forwardedRef, rootRef),
    [forwardedRef]
  )

  return (
    <PositioningContext.Provider value={contextValue}>
      <NavigationMenuPrimitive.Root
        ref={combinedRef}
        className={cn("relative", className)}
        {...rest}
      >
        {children}
      </NavigationMenuPrimitive.Root>
    </PositioningContext.Provider>
  )
})

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex list-none items-center gap-2 justify-start",
      className
    )}
    {...props}
  />
))
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = NavigationMenuPrimitive.Item

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>((props, ref) => {
  const { className, children, onPointerEnter, onFocus, ...rest } = props
  const positioning = usePositioningContext("NavigationMenuTrigger")
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const combinedRef = React.useMemo(
    () => mergeRefs(ref, triggerRef),
    [ref]
  )

  const updateFromTrigger = React.useCallback(() => {
    if (!triggerRef.current) return
    const { dataset } = triggerRef.current
    const meta: TriggerMeta = {
      offset: parseOffset(dataset.panelOffset),
      align: parseAlign(dataset.panelAlign),
      width: parseWidth(dataset.panelWidth)
    }
    positioning.updatePosition(triggerRef.current, meta)
  }, [positioning])

  React.useEffect(() => {
    const node = triggerRef.current
    if (!node || typeof MutationObserver === "undefined") {
      return
    }

    const observer = new MutationObserver(() => {
      if (node.getAttribute("data-state") === "open") {
        updateFromTrigger()
      }
    })
    observer.observe(node, { attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [updateFromTrigger])

  const handlePointerEnter = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerEnter?.(event)
      if (!event.defaultPrevented) {
        updateFromTrigger()
      }
    },
    [onPointerEnter, updateFromTrigger]
  )

  const handleFocus = React.useCallback(
    (event: React.FocusEvent<HTMLButtonElement>) => {
      onFocus?.(event)
      if (!event.defaultPrevented) {
        updateFromTrigger()
      }
    },
    [onFocus, updateFromTrigger]
  )

  return (
    <NavigationMenuPrimitive.Trigger
      ref={combinedRef}
      className={cn(
        "group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/30",
        className
      )}
      onPointerEnter={handlePointerEnter}
      onFocus={handleFocus}
      {...rest}
    >
      {children}
      <ChevronDown
        className="relative top-px ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  )
})
NavigationMenuTrigger.displayName =
  NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion=from-start]:animate-in data-[motion=from-start]:slide-in-from-left-52 data-[motion=from-end]:animate-in data-[motion=from-end]:slide-in-from-right-52 data-[motion=to-start]:animate-out data-[motion=to-start]:slide-out-to-left-52 data-[motion=to-end]:animate-out data-[motion=to-end]:slide-out-to-right-52 sm:absolute sm:w-auto",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName =
  NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Link>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Link>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Link
    ref={ref}
    className={cn(
      "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
NavigationMenuLink.displayName = NavigationMenuPrimitive.Link.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=visible]:fade-in data-[state=hidden]:fade-out",
      className
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>((props, ref) => {
  const { className, style, ...rest } = props
  const positioning = usePositioningContext("NavigationMenuViewport")
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const localViewportRef = React.useRef<HTMLDivElement | null>(null)
  const combinedRef = React.useMemo(
    () => mergeRefs(ref, localViewportRef),
    [ref]
  )

  const setWrapper = React.useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node
      positioning.registerViewportWrapper(node)
    },
    [positioning]
  )

  const setViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      localViewportRef.current = node
      positioning.registerViewport(node)
    },
    [positioning]
  )

  React.useEffect(() => {
    positioning.registerViewport(localViewportRef.current)
  }, [positioning])

  return (
    <div
      ref={setWrapper}
      className="cms-navigation-viewport-wrapper absolute left-0 top-full flex w-full justify-start transition-transform duration-200"
      style={{
        transform: "translate3d(var(--cms-navigation-viewport-offset,0px),0,0)"
      }}
    >
      <NavigationMenuPrimitive.Viewport
        ref={mergeRefs(combinedRef, setViewport)}
        className={cn(
          "relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full origin-[var(--radix-navigation-menu-content-transform-origin)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg transition-[width] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-90 sm:w-[var(--radix-navigation-menu-viewport-width)]",
          className
        )}
        style={{
          ...style
        }}
        {...rest}
      />
    </div>
  )
})
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
