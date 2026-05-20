'use client';

/**
 * Edit Member Modal
 *
 * Modal form to edit an existing member's role and access.
 * Includes warning dialog when demoting users from admin to member.
 */

import { useState, useEffect, useMemo } from 'react';
import { Shield, User, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ROLE_CAPABILITIES } from '@/lib/auth/permissions';
import { AccountRole } from '@/lib/auth/account';

// =============================================================================
// Types
// =============================================================================

export interface Website {
  id: string;
  name: string;
}

export interface MemberToEdit {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteIds: string[];
}

export interface UpdateMemberData {
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteIds: string[];
}

interface EditMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberToEdit | null;
  websites: Website[];
  isSubmitting?: boolean;
  onSubmit: (memberId: string, data: UpdateMemberData) => void;
}

// =============================================================================
// Component
// =============================================================================

export function EditMemberModal({
  open,
  onOpenChange,
  member,
  websites,
  isSubmitting = false,
  onSubmit,
}: EditMemberModalProps) {
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [websiteAccess, setWebsiteAccess] = useState<'all' | 'specific'>('all');
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ websites?: string }>({});

  // Initialize form when member changes
  useEffect(() => {
    if (member) {
      setRole(member.role);
      setWebsiteAccess(member.websiteAccess as 'all' | 'specific');
      setSelectedWebsites(member.websiteIds);
      setErrors({});
    }
  }, [member]);

  // When role changes to admin, auto-set to all websites
  useEffect(() => {
    if (role === 'admin') {
      setWebsiteAccess('all');
    }
  }, [role]);

  const handleSubmit = () => {
    if (!member) return;

    const newErrors: { websites?: string } = {};

    // Validate website selection for members with specific access
    if (role === 'member' && websiteAccess === 'specific' && selectedWebsites.length === 0) {
      newErrors.websites = 'Select at least one website';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(member.id, {
      role,
      websiteAccess,
      websiteIds: websiteAccess === 'specific' ? selectedWebsites : [],
    });
  };

  const toggleWebsite = (websiteId: string) => {
    setSelectedWebsites((prev) =>
      prev.includes(websiteId)
        ? prev.filter((id) => id !== websiteId)
        : [...prev, websiteId]
    );
    setErrors((prev) => ({ ...prev, websites: undefined }));
  };

  if (!member) return null;

  const hasChanges =
    role !== member.role ||
    websiteAccess !== member.websiteAccess ||
    JSON.stringify(selectedWebsites.sort()) !== JSON.stringify(member.websiteIds.sort());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
          <DialogDescription>
            Update role and website access for this team member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Member Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" alt={member.name ?? 'Team member'} />
              <AvatarFallback>
                {getInitials(member.name ?? member.email ?? '?')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{member.name ?? 'No name'}</div>
              <div className="text-sm text-muted-foreground">{member.email}</div>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-3">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as 'admin' | 'member')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Administrator</div>
                      <div className="text-xs text-muted-foreground">
                        Full access to content types, content, and team management
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Team Member</div>
                      <div className="text-xs text-muted-foreground">
                        Content editor with limited administrative access
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Role Change Warning - Demotion from Admin to Member */}
            {member.role === 'admin' && role === 'member' && (
              <RoleChangeWarning
                memberName={member.name ?? member.email ?? 'This user'}
                fromRole={AccountRole.admin}
                toRole={AccountRole.member}
              />
            )}

            {/* Role Change Info - Promotion from Member to Admin */}
            {member.role === 'member' && role === 'admin' && (
              <RoleChangeInfo
                memberName={member.name ?? member.email ?? 'This user'}
                fromRole={AccountRole.member}
                toRole={AccountRole.admin}
              />
            )}
          </div>

          {/* Website Access (only for members) */}
          {role === 'member' && (
            <div className="space-y-4">
              <Label>Website Access</Label>
              <RadioGroup
                value={websiteAccess}
                onValueChange={(value) => setWebsiteAccess(value as 'all' | 'specific')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="edit-access-all" />
                  <Label htmlFor="edit-access-all" className="font-normal cursor-pointer">
                    All websites (current and future)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="edit-access-specific" />
                  <Label htmlFor="edit-access-specific" className="font-normal cursor-pointer">
                    Specific websites only
                  </Label>
                </div>
              </RadioGroup>

              {/* Website Selection */}
              {websiteAccess === 'specific' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Select websites ({selectedWebsites.length} selected)
                  </Label>
                  <ScrollArea className="h-[150px] border rounded-md p-3">
                    {websites.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No websites available
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {websites.map((website) => (
                          <div key={website.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-website-${website.id}`}
                              checked={selectedWebsites.includes(website.id)}
                              onCheckedChange={() => toggleWebsite(website.id)}
                            />
                            <Label
                              htmlFor={`edit-website-${website.id}`}
                              className="font-normal cursor-pointer"
                            >
                              {website.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  {errors.websites && (
                    <p className="text-sm text-destructive">{errors.websites}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {role === 'admin' && (
            <p className="text-sm text-muted-foreground">
              Administrators automatically have access to all websites and can manage team members.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !hasChanges}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// Role Change Warning Component (Demotion)
// =============================================================================

interface RoleChangeWarningProps {
  memberName: string;
  fromRole: 'admin' | 'member';
  toRole: 'admin' | 'member';
}

function RoleChangeWarning({ memberName, fromRole, toRole }: RoleChangeWarningProps) {
  const fromCaps = ROLE_CAPABILITIES[fromRole];
  const toCaps = ROLE_CAPABILITIES[toRole];

  // Find capabilities that will be lost
  const lostCapabilities = fromCaps?.capabilities.filter(
    (cap) => !toCaps?.capabilities.includes(cap)
  ) ?? [];

  if (lostCapabilities.length === 0) return null;

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Permission Reduction Warning</p>
          <p className="text-sm text-muted-foreground mt-1">
            {memberName} will lose the following abilities:
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 ml-7">
        {lostCapabilities.map((cap, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <X className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Role Change Info Component (Promotion)
// =============================================================================

function RoleChangeInfo({ memberName, fromRole, toRole }: RoleChangeWarningProps) {
  const fromCaps = ROLE_CAPABILITIES[fromRole];
  const toCaps = ROLE_CAPABILITIES[toRole];

  // Find capabilities that will be gained
  const gainedCapabilities = toCaps?.capabilities.filter(
    (cap) => !fromCaps?.capabilities.includes(cap)
  ) ?? [];

  if (gainedCapabilities.length === 0) return null;

  return (
    <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Shield className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-300">Permission Upgrade</p>
          <p className="text-sm text-muted-foreground mt-1">
            {memberName} will gain the following abilities:
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 ml-7">
        {gainedCapabilities.map((cap, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
