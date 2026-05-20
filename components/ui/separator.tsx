import * as React from "react"

import { cn } from "@/lib/utils"

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = false, ...props },
    ref
  ) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
      data-orientation={orientation}
      className={cn(
        "bg-border",
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = "Separator"

export { Separator }
