/**
 * Component Index
 * Story 1.1d - Base Component Structure
 * Central export for all Catalyst Studio components
 */

// Layout Components
export {
  LayoutContainer,
  ChatPanel,
  NavigationPanel,
  MainContentPanel,
} from './layout/layout-container';

// Branding Components
export {
  CatalystBranding,
  CatalystLogo,
  CatalystPattern,
} from './catalyst-branding';

// Glass Morphism & Animation Components
export {
  GlassCard,
  AnimatedPanel,
  FloatingShape,
  PageTransition,
} from './glass-morphism';

// Error Handling
export { ErrorBoundary, IsolatedErrorBoundary, useErrorHandler } from './error-boundary';

// UI Components (from shadcn/ui)
export { Button } from './ui/button';
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
export { Input } from './ui/input';
export { Label } from './ui/label';
export { ScrollArea } from './ui/scroll-area';
export { Switch } from './ui/switch';