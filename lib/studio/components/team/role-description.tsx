'use client';

/**
 * Role Description Component
 *
 * Displays role information with capabilities and restrictions.
 * Used in invitation forms and member management interfaces.
 */

import { Shield, ShieldAlert, Check, X, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ROLE_CAPABILITIES,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
} from '@/lib/auth/permissions';
import { AccountRoleType, AccountRole } from '@/lib/auth/account';

// =============================================================================
// Types
// =============================================================================

export interface RoleDescriptionProps {
  role: AccountRoleType;
  variant?: 'inline' | 'tooltip' | 'card' | 'compact';
  className?: string;
  showRestrictions?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function RoleDescription({
  role,
  variant = 'inline',
  className,
  showRestrictions = true,
}: RoleDescriptionProps) {
  const displayName = ROLE_DISPLAY_NAMES[role] || role;
  const description = ROLE_DESCRIPTIONS[role] || '';
  const capabilities = ROLE_CAPABILITIES[role] || { capabilities: [], restrictions: [] };

  // Inline variant - simple text with icon
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <RoleIcon role={role} className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    );
  }

  // Compact variant - single line description
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant={role === AccountRole.owner ? 'default' : 'secondary'}>
          {displayName}
        </Badge>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    );
  }

  // Tooltip variant - hoverable info icon
  if (variant === 'tooltip') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn('inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground', className)}
            >
              <span className="text-sm">{displayName}</span>
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-[300px] p-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
              {capabilities.capabilities.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Can:</p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {capabilities.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {showRestrictions && capabilities.restrictions && capabilities.restrictions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium">Cannot:</p>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {capabilities.restrictions.map((restriction, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        {restriction}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Card variant - full details
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <RoleIcon role={role} className="h-5 w-5" />
          <CardTitle className="text-base">{displayName}</CardTitle>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {capabilities.capabilities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Capabilities</p>
            <ul className="space-y-1">
              {capabilities.capabilities.map((cap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
        )}
        {showRestrictions && capabilities.restrictions && capabilities.restrictions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Restrictions</p>
            <ul className="space-y-1">
              {capabilities.restrictions.map((restriction, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {restriction}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Role Icon Component
// =============================================================================

function RoleIcon({ role, className }: { role: AccountRoleType; className?: string }) {
  if (role === AccountRole.owner || role === AccountRole.admin) {
    return <Shield className={cn('text-primary', className)} />;
  }
  return <ShieldAlert className={cn('text-muted-foreground', className)} />;
}

// =============================================================================
// Role Options for Select Component
// =============================================================================

/**
 * Returns role options formatted for use in select/dropdown components
 */
export function getRoleOptions() {
  return [
    {
      value: AccountRole.admin,
      label: ROLE_DISPLAY_NAMES[AccountRole.admin],
      description: ROLE_DESCRIPTIONS[AccountRole.admin],
    },
    {
      value: AccountRole.member,
      label: ROLE_DISPLAY_NAMES[AccountRole.member],
      description: ROLE_DESCRIPTIONS[AccountRole.member],
    },
  ];
}

// =============================================================================
// Role Comparison Component
// =============================================================================

interface RoleComparisonProps {
  fromRole: AccountRoleType;
  toRole: AccountRoleType;
  className?: string;
}

/**
 * Shows what capabilities will be lost/gained when changing roles
 */
export function RoleComparison({ fromRole, toRole, className }: RoleComparisonProps) {
  const fromCaps = ROLE_CAPABILITIES[fromRole];
  const toCaps = ROLE_CAPABILITIES[toRole];

  if (!fromCaps || !toCaps) return null;

  // Find lost capabilities
  const lostCapabilities = fromCaps.capabilities.filter(
    (cap) => !toCaps.capabilities.includes(cap)
  );

  // Find gained capabilities
  const gainedCapabilities = toCaps.capabilities.filter(
    (cap) => !fromCaps.capabilities.includes(cap)
  );

  if (lostCapabilities.length === 0 && gainedCapabilities.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {lostCapabilities.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">
            Will lose the following abilities:
          </p>
          <ul className="mt-2 space-y-1">
            {lostCapabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                {cap}
              </li>
            ))}
          </ul>
        </div>
      )}
      {gainedCapabilities.length > 0 && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Will gain the following abilities:
          </p>
          <ul className="mt-2 space-y-1">
            {gainedCapabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                {cap}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
