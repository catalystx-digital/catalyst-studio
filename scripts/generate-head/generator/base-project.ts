import { buildPackageJson } from './package-json'
import { ProjectBuilder } from './project-builder'
import { DESIGN_SYSTEM_THEME_FALLBACKS, type GeneratedCSSVariables } from '@/lib/studio/design-system/generate-css-variables'

export interface BaseProjectScaffoldOptions {
  projectName: string
  siteName: string
  siteDescription?: string
  studioLibAliasPath: string
  remoteImagePatterns?: RemoteImagePattern[]
  designSystemCss?: GeneratedCSSVariables | null
  runtimeProvider: 'static' | 'ucs' | 'graphql'
  includeGraphqlRuntime?: boolean
}

function stringifyJson(object: Record<string, unknown>): string {
  return `${JSON.stringify(object, null, 2)}\n`
}

function buildTailwindConfig(): string {
  return `import type { Config } from 'tailwindcss'
import fs from 'node:fs'
import catalystPlugin from './tailwind-plugin'

const loadDesignSystem = (): any => {
  try {
    const raw = fs.readFileSync('./generated/design-system.json', 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const designSystem = loadDesignSystem()

const spacingScale = (() => {
  const values = designSystem?.tokens?.spacing?.values
  if (!Array.isArray(values)) {
    return null
  }

  const unit = designSystem?.tokens?.spacing?.unit ?? 'px'
  const entries = values.reduce<Record<string, string>>((acc, entry) => {
    if (typeof entry?.value !== 'number') {
      return acc
    }

    let baseName: string
    if (typeof entry.name === 'string' && entry.name.trim().length > 0) {
      baseName = entry.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    } else {
      baseName = 'step-' + entry.step
    }

    acc['ds-' + baseName] = String(entry.value) + unit
    return acc
  }, {})

  return Object.keys(entries).length > 0 ? entries : null
})()

const radiusScale = (() => {
  const values = designSystem?.tokens?.radii?.values
  if (!Array.isArray(values)) {
    return null
  }

  const unit = designSystem?.tokens?.radii?.unit ?? 'px'
  const entries = values.reduce<Record<string, string>>((acc, entry) => {
    if (typeof entry?.value !== 'number') {
      return acc
    }

    let baseName: string
    if (typeof entry.name === 'string' && entry.name.trim().length > 0) {
      baseName = entry.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    } else {
      baseName = 'step-' + entry.step
    }

    acc['ds-' + baseName] = String(entry.value) + unit
    return acc
  }, {})

  return Object.keys(entries).length > 0 ? entries : null
})()

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './generated/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui standard color configuration
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      ...(spacingScale ? { spacing: spacingScale } : {}),
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) * 0.75)',
        sm: 'calc(var(--radius) * 0.5)',
        xs: 'calc(var(--radius) * 0.25)',
        ...(radiusScale ?? {})
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    },
  },
  plugins: [require('tailwindcss-animate'), catalystPlugin],
  safelist: [
    { pattern: /^ds-(?:spacing|gap|space-[xy]|p[trblxy]?|m[trblxy]?)-(?:xxs|xs|sm|md|lg|xl|2xl|3xl)$/ },
    { pattern: /^ds-heading-[1-6]$/ },
    { pattern: /^ds-body-(?:xs|sm|md|lg|xl)$/ }
  ],
}

export default config
`
}

function buildPostcssConfig(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

function buildTsconfig(studioLibAliasPath: string): string {
  const sanitizedExternalPath = studioLibAliasPath.endsWith('/')
    ? studioLibAliasPath.slice(0, -1)
    : studioLibAliasPath
  const externalLibEntry = `${sanitizedExternalPath}/*`
  const libEntries = ['./lib/*']

  if (!libEntries.includes(externalLibEntry)) {
    libEntries.push(externalLibEntry)
  }

  const config = {
    compilerOptions: {
      target: 'ES2022',
      lib: ['DOM', 'DOM.Iterable', 'ES2022'],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'ESNext',
      moduleResolution: 'Bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      baseUrl: '.',
      paths: {
        '@/lib/*': libEntries,
        '@/*': ['./*']
      },
      plugins: [
        {
          name: 'next'
        }
      ]
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules']
  }

  return stringifyJson(config)
}

interface RemoteImagePattern {
  protocol: 'http' | 'https'
  hostname: string
}

const MAX_REMOTE_PATTERNS = 50 // Next.js limit

function buildNextConfig(remotePatterns: RemoteImagePattern[] = []): string {
  // Next.js limits remotePatterns to 50 entries
  // Deduplicate by hostname and take the first 50
  const seenHostnames = new Set<string>()
  const uniquePatterns = remotePatterns.filter(pattern => {
    if (seenHostnames.has(pattern.hostname)) {
      return false
    }
    seenHostnames.add(pattern.hostname)
    return true
  })

  const limitedPatterns = uniquePatterns.slice(0, MAX_REMOTE_PATTERNS)
  if (uniquePatterns.length > MAX_REMOTE_PATTERNS) {
    console.warn(`[next.config] Truncated remotePatterns from ${uniquePatterns.length} to ${MAX_REMOTE_PATTERNS} (Next.js limit)`)
  }

  const remotePatternEntries = limitedPatterns.map(pattern => {
    return `      { protocol: '${pattern.protocol}', hostname: '${pattern.hostname}', pathname: '/**' }`
  })

  const remotePatternsSection =
    remotePatternEntries.length > 0
      ? `    remotePatterns: [
${remotePatternEntries.join(',\n')}
    ],
`
      : ''

  return `import type { NextConfig } from 'next'
import path from 'node:path'

const config: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    externalDir: true,
  },
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'isomorphic-dompurify': path.resolve(__dirname, 'lib/runtime/shims/isomorphic-dompurify.ts')
    }
    return config
  },
  images: {
    dangerouslyAllowSVG: true,
${remotePatternsSection}  },
}

export default config
`
}

function buildEslintConfig(): string {
  return `{
  "extends": ["next/core-web-vitals"]
}
`
}

function buildReadme(options: BaseProjectScaffoldOptions): string {
  const runtimeDefaultLabel =
    options.runtimeProvider === 'graphql'
      ? 'GraphQL (HEAD_RUNTIME_PROVIDER defaults to graphql)'
      : options.runtimeProvider === 'ucs'
        ? 'Prisma (HEAD_RUNTIME_PROVIDER defaults to ucs)'
        : 'Static snapshot (HEAD_RUNTIME_PROVIDER defaults to static)'

  const graphqlRuntimeNotice = options.includeGraphqlRuntime
    ? `- GraphQL runtime: set HEAD_RUNTIME_GRAPHQL_ENDPOINT and HEAD_RUNTIME_GRAPHQL_API_KEY (plus optional HEAD_RUNTIME_GRAPHQL_TIMEOUT_MS / HEAD_RUNTIME_GRAPHQL_MAX_RETRIES) when HEAD_RUNTIME_PROVIDER=graphql.`
    : null

  return `# ${options.siteName}

Generated by the Catalyst CLI Head generator.

## Getting Started

Install dependencies and launch the dev server:

\`pnpm install\`
\`pnpm dev\`

### Runtime providers & environment

- Default runtime: ${runtimeDefaultLabel}
- Switch providers via \`HEAD_RUNTIME_PROVIDER=graphql|static|ucs\`. Static uses the embedded snapshot with no network/DB.
- Prisma runtime: requires \`DATABASE_URL\` (and optional \`DIRECT_URL\`) when using \`HEAD_RUNTIME_PROVIDER=ucs\`.
${graphqlRuntimeNotice ? `${graphqlRuntimeNotice}\n` : ''}- \`.env\` and \`.env.local\` include the knobs for the active runtime; fill in the needed values before running locally.

## Available Scripts

- \`pnpm dev\` - start Next.js in development mode
- \`pnpm build\` - create an optimized production build
- \`pnpm start\` - run the production server
- \`pnpm lint\` - lint the project

## Design System

- Tokens are serialized to \`generated/design-system.json\` for inspection and future automation.
- The active CSS variables live in \`app/(theme)/design-system.css\`; tweak this file to adjust palette, typography, spacing, or radii.
- \`lib/design-system/apply.ts\` exposes helpers to regenerate CSS at runtime if you add editor overrides.
- If \`app/layout.tsx\` includes TODO comments for fonts, follow them to wire up any non-Google families.
`
}

function buildDesignSystemTheme(designSystemCss?: GeneratedCSSVariables | null): string {
  const sections = designSystemCss?.sections

  const rootContent =
    sections?.root ??
    designSystemCss?.combined ??
    DESIGN_SYSTEM_THEME_FALLBACKS.root

  const darkContent = sections?.dark ?? DESIGN_SYSTEM_THEME_FALLBACKS.dark
  const themeLightContent = sections?.themeLight ?? DESIGN_SYSTEM_THEME_FALLBACKS.themeLight
  const themeDarkContent = sections?.themeDark ?? DESIGN_SYSTEM_THEME_FALLBACKS.themeDark
  const themeInvertedContent =
    sections?.themeInverted ?? DESIGN_SYSTEM_THEME_FALLBACKS.themeInverted

  const blocks = [
    `:root {\n${rootContent}\n}`,
    `.dark {\n${darkContent}\n}`,
    `.theme-light {\n${themeLightContent}\n}`,
    `.theme-dark {\n${themeDarkContent}\n}`,
    `.theme-inverted {\n${themeInvertedContent}\n}`
  ]

  return `${blocks.join('\n\n')}\n`
}

function buildGlobalsCss(): string {
  return `@import './(theme)/design-system.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: var(--font-body, var(--font-sans, sans-serif));
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
}
`
}

function buildDesignSystemRuntimeHelper(): string {
  return `import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import { generateDesignSystemCSSVariables } from '@/lib/studio/design-system/generate-css-variables'

export const DESIGN_SYSTEM_STYLE_ID = 'catalyst-design-system'

export interface CompileDesignSystemOptions {
  aliasOverride?: Record<string, string> | null
}

export interface ApplyDesignSystemOptions extends CompileDesignSystemOptions {
  target?: Document | HTMLElement | null
  styleId?: string
}

export function compileDesignSystemCss(
  designSystem: DesignSystem,
  options: CompileDesignSystemOptions = {}
): string {
  const result = generateDesignSystemCSSVariables(designSystem, options.aliasOverride ?? null)
  return result.combined
}

export function applyDesignSystemCss(
  designSystem: DesignSystem,
  options: ApplyDesignSystemOptions = {}
): string {
  const cssText = compileDesignSystemCss(designSystem, options)

  if (typeof document === 'undefined') {
    return cssText
  }

  const styleId = options.styleId ?? DESIGN_SYSTEM_STYLE_ID
  const target = options.target
  const doc: Document | null =
    target instanceof Document
      ? target
      : target instanceof HTMLElement
        ? target.ownerDocument
        : document

  if (!doc) {
    return cssText
  }

  const existing = doc.getElementById(styleId) as HTMLStyleElement | null
  if (existing) {
    existing.textContent = cssText
    return cssText
  }

  const style = doc.createElement('style')
  style.id = styleId
  style.textContent = cssText
  ;(doc.head ?? doc.getElementsByTagName('head')[0] ?? doc.documentElement).appendChild(style)

  return cssText
}
`
}

function buildLibUtils(): string {
  return `import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
`
}

function buildDomPurifyShim(): string {
  return `function sanitize(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

const DOMPurify = {
  sanitize(value: unknown) {
    return sanitize(value)
  }
}

export default DOMPurify
export { sanitize }
`
}

function buildUiButton(): string {
  return `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "rounded-md px-4 py-2 text-xs",
        lg: "min-h-[52px] rounded-md px-8 py-3 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
`
}

function buildUiAccordion(): string {
  return `"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b border-border-default/40", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-left text-sm font-medium transition-all hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 shrink-0 transition-transform duration-200"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
`
}

function buildUiAlert(): string {
  return `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
`
}

function buildUiAspectRatio(): string {
  return `"use client"

import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

const AspectRatio = AspectRatioPrimitive.Root

export { AspectRatio }
`
}

function buildUiAvatar(): string {
  return `"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
`
}

function buildUiBadge(): string {
  return `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
`
}

function buildUiBreadcrumb(): string {
  return `"use client"

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
      className={cn('transition-colors hover:text-foreground', className)}
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
    role="link"
    aria-disabled="true"
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
`
}

function buildUiCard(): string {
  return `import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
`
}

function buildUiInput(): string {
  return `import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[44px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
`
}

function buildUiSelect(): string {
  return `"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex min-h-[44px] w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3.5 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUpIcon className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDownIcon className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
`
}

function buildUiTable(): string {
  return `import * as React from "react"
import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
`
}

function buildUiCheckbox(): string {
  return `"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
`
}

function buildUiCommand(): string {
  return `"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";

import { cn } from "@/lib/utils";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border-default bg-background text-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-64 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("py-6 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden py-2 text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border/60", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-border">
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors aria-selected:bg-muted aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
);
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
`
}

function buildUiForm(): string {
  return `"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}
FormField.displayName = "FormField"

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: \`\${id}-form-item\`,
    formDescriptionId: \`\${id}-form-item-description\`,
    formMessageId: \`\${id}-form-item-message\`,
    ...fieldState,
  }
}

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  const { formItemId, formMessageId, error } = useFormField()
  return (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-text-primary", error && "text-red-500", className)}
      htmlFor={formItemId}
      aria-describedby={error ? formMessageId : undefined}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { formItemId } = useFormField()
  return <Slot ref={ref} id={formItemId} {...props} />
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-text-muted", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { formMessageId, error } = useFormField()
  const body = error?.message ? String(error.message) : children
  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
}
`
}


function buildUiTooltip(): string {
  return `import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
`
}

function buildUiNavigationMenu(): string {
  return `"use client"

import * as React from "react"
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const NavigationMenu = NavigationMenuPrimitive.Root

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn(
      "group flex list-none items-center gap-1 justify-start",
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
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      "group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/30",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown
      className="relative top-px ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName =
  NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      "left-0 top-0 w-full sm:absolute sm:w-auto",
      className
    )}
    {...props}
  />
))
NavigationMenuContent.displayName =
  NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

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
>(({ className, ...props }, ref) => (
  <div className="absolute left-0 top-full flex w-full justify-start">
    <NavigationMenuPrimitive.Viewport
      ref={ref}
      className={cn(
        "relative mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full origin-top overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-95 sm:w-[var(--radix-navigation-menu-viewport-width)]",
        className
      )}
      {...props}
    />
  </div>
))
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
`
}

function buildUiSheet(): string {
  return `"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

type SheetPortalProps = SheetPrimitive.DialogPortalProps & {
  className?: string
  children?: React.ReactNode
}

const SheetPortal = ({ className, children, ...props }: SheetPortalProps) => (
  <SheetPrimitive.Portal {...props}>
    <div className={cn("fixed inset-0 z-50 flex", className)}>{children}</div>
  </SheetPrimitive.Portal>
)
SheetPortal.displayName = SheetPrimitive.Portal.displayName

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = {
  top: "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  bottom:
    "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
}

type SheetSide = keyof typeof sheetVariants

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: SheetSide
  hideClose?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>((props, ref) => {
  const {
    side = "right",
    className,
    children,
    hideClose = false,
    ...contentProps
  } = props

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 grid gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out",
          sheetVariants[side],
          className
        )}
        {...contentProps}
      >
        {children}
        {!hideClose && (
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid gap-2 text-center sm:text-left", className)}
    {...props}
  />
))
SheetHeader.displayName = "SheetHeader"

const SheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
))
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
`
}

function buildUiSwitch(): string {
  return `"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
`
}

function buildUiTabs(): string {
  return `"use client"

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
`
}

function buildUiTextarea(): string {
  return `"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
`
}

function buildNextEnv(): string {
  return `/// <reference types="next" />
/// <reference types="next/types/global" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
`
}

function buildUseIsMobileHook(): string {
  return `import { useEffect, useState } from 'react'

export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(\`(max-width: \${breakpoint}px)\`)

    const handleChange = (event: MediaQueryListEvent | MediaQueryList): void => {
      setIsMobile(event.matches)
    }

    handleChange(mediaQuery)

    const listener = (event: MediaQueryListEvent): void => handleChange(event)
    mediaQuery.addEventListener('change', listener)

    return () => {
      mediaQuery.removeEventListener('change', listener)
    }
  }, [breakpoint])

  return isMobile
}
`
}

function getPlaceholderIcon(): Buffer {
  // 32x32 Catalyst-blue placeholder generated from a simple gradient
  const base64Png =
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABTklEQVRYR+2XwQ2DMAxFX0kAJ2AFKoAJ2ACToAJ0gAnSAJ1gAl0gAl0gAlUil8ydhO5F5Wbmr2VZqb++ddcSwFzjGMPgBDm4A3ADjgPChwHZH0CM0HoAX035lXDIgkICbSB2AdHifoC5AcE5hNq+r6T5k6vM2C6b1nqvJBZzQiBf4vBTaIwIn3Z5k/EoIlrsK8JO2b1SogY+YxVhPo684ilGuOom9nBOku+518SMFW1uCmOQ4qmlO9xIBNsl0qXhohAuv9+TnCb6VPvWC2rV8YoS2h8BnHeYrXhrB3zYQbsoknZmn+rQzIHX2uGbdpbbd84d30k1EnEkFg1q38Cw5uI9yWit0ZkvQ8CzAGe+8xRp7Hj7Q0QWouHtjuC6qSYMkFaJL7tf3v/ZyaTOP4WCsNYQс1oAAAAASUVORK5CYII='
  return Buffer.from(base64Png, 'base64')
}

export function addBaseProjectFiles(builder: ProjectBuilder, options: BaseProjectScaffoldOptions): void {
  const pkg = buildPackageJson({ projectName: options.projectName })

  builder.addFile('package.json', stringifyJson(pkg))
  builder.addFile('README.md', buildReadme(options))
  builder.addFile('next.config.ts', buildNextConfig(options.remoteImagePatterns ?? []))
  builder.addFile('tsconfig.json', buildTsconfig(options.studioLibAliasPath))
  builder.addFile('postcss.config.cjs', buildPostcssConfig())
  builder.addFile('tailwind.config.ts', buildTailwindConfig())
  builder.addFile('.eslintrc.json', buildEslintConfig())
  builder.addFile('next-env.d.ts', buildNextEnv())
  builder.addFile('app/(theme)/design-system.css', buildDesignSystemTheme(options.designSystemCss ?? null))
  builder.addFile('app/globals.css', buildGlobalsCss())
  builder.addFile('lib/utils.ts', buildLibUtils())
  builder.addFile('lib/runtime/shims/isomorphic-dompurify.ts', buildDomPurifyShim())
  builder.addFile('lib/design-system/apply.ts', buildDesignSystemRuntimeHelper())
  builder.addFile('components/ui/accordion.tsx', buildUiAccordion())
  builder.addFile('components/ui/alert.tsx', buildUiAlert())
  builder.addFile('components/ui/aspect-ratio.tsx', buildUiAspectRatio())
  builder.addFile('components/ui/avatar.tsx', buildUiAvatar())
  builder.addFile('components/ui/badge.tsx', buildUiBadge())
  builder.addFile('components/ui/breadcrumb.tsx', buildUiBreadcrumb())
  builder.addFile('components/ui/button.tsx', buildUiButton())
  builder.addFile('components/ui/card.tsx', buildUiCard())
  builder.addFile('components/ui/checkbox.tsx', buildUiCheckbox())
  builder.addFile('components/ui/command.tsx', buildUiCommand())
  builder.addFile('components/ui/form.tsx', buildUiForm())
  builder.addFile('components/ui/input.tsx', buildUiInput())
  builder.addFile('components/ui/navigation-menu.tsx', buildUiNavigationMenu())
  builder.addFile('components/ui/select.tsx', buildUiSelect())
  builder.addFile('components/ui/sheet.tsx', buildUiSheet())
  builder.addFile('components/ui/switch.tsx', buildUiSwitch())
  builder.addFile('components/ui/tabs.tsx', buildUiTabs())
  builder.addFile('components/ui/table.tsx', buildUiTable())
  builder.addFile('components/ui/textarea.tsx', buildUiTextarea())
  builder.addFile('components/ui/tooltip.tsx', buildUiTooltip())
  builder.addFile('hooks/use-mobile.ts', buildUseIsMobileHook())
  const placeholderIcon = getPlaceholderIcon()
  builder.addFile('app/icon.png', placeholderIcon)
  builder.addFile('public/favicon.ico', placeholderIcon)

  // Ensure a components directory exists even if empty
  builder.addFile('components/.gitkeep', '')

  // Deploy script for Vercel deployment
  builder.addFile('scripts/deploy.mjs', buildDeployScript())
}

function buildDeployScript(): string {
  return `#!/usr/bin/env node
/**
 * Vercel Deployment Script
 *
 * Usage:
 *   pnpm deploy:vercel   # Deploy to production
 *   pnpm deploy:preview  # Deploy to preview environment
 *
 * This script handles:
 *   1. Initial Vercel project setup (if needed)
 *   2. Pushing environment variables from .env
 *   3. Deploying to Vercel
 */

import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const COLORS = {
  reset: '\\x1b[0m',
  green: '\\x1b[32m',
  yellow: '\\x1b[33m',
  red: '\\x1b[31m',
  cyan: '\\x1b[36m',
  dim: '\\x1b[2m'
}

function log(message, color = COLORS.reset) {
  console.log(\`\${color}\${message}\${COLORS.reset}\`)
}

function logStep(step, message) {
  log(\`\\n[\${step}] \${message}\`, COLORS.cyan)
}

function logSuccess(message) {
  log(\`✓ \${message}\`, COLORS.green)
}

function logError(message) {
  log(\`✗ \${message}\`, COLORS.red)
}

function logWarning(message) {
  log(\`⚠ \${message}\`, COLORS.yellow)
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
  } catch (error) {
    if (!options.ignoreError) {
      throw error
    }
    return null
  }
}

function checkVercelCli() {
  try {
    execSync('npx vercel --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Parse .env file into key-value pairs
 */
function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const vars = {}

  for (const line of content.split('\\n')) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      vars[key] = value
    }
  }

  return vars
}

/**
 * Push a single environment variable to Vercel (cross-platform)
 */
function pushEnvVar(key, value, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'vercel', 'env', 'add', key, environment], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => { stdout += data.toString() })
    child.stderr.on('data', (data) => { stderr += data.toString() })

    // Write the value to stdin and close it
    child.stdin.write(value)
    child.stdin.end()

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ key, success: true })
      } else {
        // Check if it's just a "already exists" warning
        if (stderr.includes('already exists') || stdout.includes('already exists')) {
          resolve({ key, success: true, skipped: true })
        } else {
          reject(new Error(\`Failed to add \${key}: \${stderr || stdout}\`))
        }
      }
    })

    child.on('error', (err) => {
      reject(new Error(\`Failed to spawn process for \${key}: \${err.message}\`))
    })
  })
}

/**
 * Sync all environment variables to Vercel (cross-platform)
 */
async function syncEnvVars(envFile, environment) {
  const vars = parseEnvFile(envFile)
  const keys = Object.keys(vars)

  if (keys.length === 0) {
    log('No environment variables found in file', COLORS.dim)
    return { success: 0, failed: 0 }
  }

  log(\`Found \${keys.length} environment variables to sync\`, COLORS.dim)

  let success = 0
  let failed = 0

  for (const key of keys) {
    try {
      const result = await pushEnvVar(key, vars[key], environment)
      if (result.skipped) {
        log(\`  → \${key}: already exists (skipped)\`, COLORS.dim)
      } else {
        log(\`  ✓ \${key}: added\`, COLORS.green)
      }
      success++
    } catch (error) {
      log(\`  ✗ \${key}: \${error.message}\`, COLORS.red)
      failed++
    }
  }

  return { success, failed }
}

function isVercelLinked() {
  return existsSync(resolve(process.cwd(), '.vercel/project.json'))
}

function getEnvFile() {
  const envPath = resolve(process.cwd(), '.env')
  const envLocalPath = resolve(process.cwd(), '.env.local')

  if (existsSync(envPath)) return envPath
  if (existsSync(envLocalPath)) return envLocalPath
  return null
}

async function deploy() {
  const args = process.argv.slice(2)
  const environment = args[0] || 'production'
  const isPreview = environment === 'preview'

  log('\\n🚀 Vercel Deployment Script', COLORS.cyan)
  log('=' .repeat(40), COLORS.dim)

  // Step 1: Check Vercel CLI
  logStep('1/4', 'Checking Vercel CLI...')
  if (!checkVercelCli()) {
    logError('Vercel CLI not found. Installing...')
    execCommand('npm install -g vercel')
  }
  logSuccess('Vercel CLI available')

  // Step 2: Link project if needed
  logStep('2/4', 'Checking Vercel project link...')
  const wasLinked = isVercelLinked()

  if (!wasLinked) {
    logWarning('Project not linked to Vercel. Creating new project...')
    // First deploy creates the project
    log('Running initial deployment to create project...', COLORS.dim)
    execCommand(\`npx vercel \${isPreview ? '' : '--prod'} --yes\`)
    logSuccess('Vercel project created')
  } else {
    logSuccess('Project already linked to Vercel')
  }

  // Step 3: Push environment variables
  logStep('3/4', 'Syncing environment variables...')
  const envFile = getEnvFile()

  if (envFile) {
    log(\`Found env file: \${envFile}\`, COLORS.dim)
    try {
      const targetEnv = isPreview ? 'preview' : 'production'
      const result = await syncEnvVars(envFile, targetEnv)
      if (result.failed > 0) {
        logWarning(\`Synced \${result.success} env vars, \${result.failed} failed\`)
      } else {
        logSuccess(\`Environment variables synced to \${targetEnv} (\${result.success} vars)\`)
      }
    } catch (error) {
      logWarning('Could not sync env vars automatically. You may need to add them manually.')
      log(\`Error: \${error.message}\`, COLORS.dim)
    }
  } else {
    logWarning('No .env file found. Skipping env var sync.')
  }

  // Step 4: Deploy
  logStep('4/4', \`Deploying to \${environment}...\`)
  const deployCmd = isPreview ? 'npx vercel --yes' : 'npx vercel --prod --yes'
  execCommand(deployCmd)

  log('\\n' + '=' .repeat(40), COLORS.dim)
  logSuccess(\`Deployment to \${environment} complete!\`)

  // Show project URL
  try {
    const projectJson = JSON.parse(readFileSync(resolve(process.cwd(), '.vercel/project.json'), 'utf8'))
    const projectName = projectJson.projectId ? \`Project ID: \${projectJson.projectId}\` : ''
    if (projectName) {
      log(\`\${projectName}\`, COLORS.dim)
    }
  } catch {
    // Ignore if can't read project.json
  }
}

deploy().catch(error => {
  logError(\`Deployment failed: \${error.message}\`)
  process.exit(1)
})
`
}
