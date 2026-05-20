// Utilities (KEEP - genuine value)
export {
  buildCmsClassName,
  themeClass,
  resolveTheme,
} from './classnames';
export { withTheme, focusRing } from './theme-utils';
export { dsSpacing, typographyScale } from './design-tokens';
export { cmsHeading, cmsBody, type CmsHeadingLevel, type CmsBodySize } from './typography';

// Wrappers with genuine value (KEEP)
export * from './alert';       // devOnly prop + shouldShowDevEmptyState utility
export * from './badge';       // Extended variants (accent, neutral, positive, negative)
export * from './button-group'; // Group layout utility
export * from './section';     // Layout wrapper with container control
export * from './table';       // Responsive + alignment props - real value
export * from './form';        // Theme context for complex forms

// Tone classes for inline use (replaces CmsCard tone prop)
// Usage: <Card className={cn(CARD_TONES.muted, className)}>
export const CARD_TONES = {
  default: '', // Use shadcn Card default styling
  muted: 'bg-muted/50 border-border/50',
  accent: 'bg-primary text-primary-foreground border-transparent',
  minimal: 'bg-transparent border-transparent shadow-none',
} as const;

export type CmsCardTone = keyof typeof CARD_TONES;

// DELETED in Phase 13: button, card, avatar, input, textarea, checkbox, switch, breadcrumb, command, aspect-ratio
// Use shadcn directly:
//   import { Button } from '@/components/ui/button'
//   import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card'
//   import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
//   import { Input } from '@/components/ui/input'
//   import { Textarea } from '@/components/ui/textarea'
//   import { Checkbox } from '@/components/ui/checkbox'
//   import { Switch } from '@/components/ui/switch'
//   import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
//   import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
//   import { AspectRatio } from '@/components/ui/aspect-ratio'
