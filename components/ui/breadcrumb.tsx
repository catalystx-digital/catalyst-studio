"use client"

import * as React from "react"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    className={cn(
      "flex items-center space-x-1 text-sm text-muted-foreground",
      className,
    )}
    {...props}
  />
))
Breadcrumb.displayName = "Breadcrumb"

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.OlHTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn("flex items-center gap-1.5 [&>li]:inline-flex [&>li]:items-center", className)}
    {...props}
  />
))
BreadcrumbList.displayName = "BreadcrumbList"

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}
    {...props}
  />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

interface BreadcrumbLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean
}

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  BreadcrumbLinkProps
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      ref={ref}
      className={cn(
        'transition-colors hover:text-foreground rounded-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  )
})
BreadcrumbLink.displayName = "BreadcrumbLink"

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

const BreadcrumbSeparator = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ children, className, ...props }, ref) => (
  <span
    ref={ref}
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5 text-muted-foreground", className)}
    {...props}
  >
    {children ?? <ChevronRight className="h-3.5 w-3.5" />}
  </span>
))
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

const BreadcrumbEllipsis = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="presentation"
    aria-hidden="true"
    className={cn("flex size-11 items-center justify-center", className)}
    {...props}
  >
    <span className="sr-only">More</span>
    <MoreHorizontal className="h-4 w-4" />
  </span>
))
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
