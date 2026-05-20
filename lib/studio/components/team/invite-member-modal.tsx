'use client';

/**
 * Invite Member Modal
 *
 * Modal form to invite a new member to the account.
 * Includes role descriptions with capabilities.
 */

import { useState, useEffect } from 'react';
import { Shield, User, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ROLE_CAPABILITIES } from '@/lib/auth/permissions';
import { AccountRole } from '@/lib/auth/account';

// =============================================================================
// Types
// =============================================================================

export interface Website {
  id: string;
  name: string;
}

export interface InviteMemberData {
  email: string;
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteIds: string[];
}

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websites: Website[];
  isSubmitting?: boolean;
  onSubmit: (data: InviteMemberData) => void;
}

// =============================================================================
// Component
// =============================================================================

export function InviteMemberModal({
  open,
  onOpenChange,
  websites,
  isSubmitting = false,
  onSubmit,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [websiteAccess, setWebsiteAccess] = useState<'all' | 'specific'>('all');
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ email?: string; websites?: string }>({});

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('member');
      setWebsiteAccess('all');
      setSelectedWebsites([]);
      setErrors({});
    }
  }, [open]);

  // When role changes to admin, auto-set to all websites
  useEffect(() => {
    if (role === 'admin') {
      setWebsiteAccess('all');
    }
  }, [role]);

  const handleSubmit = () => {
    const newErrors: { email?: string; websites?: string } = {};

    // Validate email
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    // Validate website selection for members with specific access
    if (role === 'member' && websiteAccess === 'specific' && selectedWebsites.length === 0) {
      newErrors.websites = 'Select at least one website';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      email: email.toLowerCase().trim(),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your account. They'll receive an email with a link to accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
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

            {/* Role Capabilities Preview */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {role === 'admin' ? 'Admin' : 'Member'} can:
              </p>
              <ul className="space-y-1">
                {ROLE_CAPABILITIES[role === 'admin' ? AccountRole.admin : AccountRole.member]?.capabilities.map((cap, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                    <span className="text-muted-foreground">{cap}</span>
                  </li>
                ))}
              </ul>
              {role === 'member' && ROLE_CAPABILITIES[AccountRole.member]?.restrictions && (
                <>
                  <p className="text-xs font-medium text-muted-foreground pt-1">Cannot:</p>
                  <ul className="space-y-1">
                    {ROLE_CAPABILITIES[AccountRole.member].restrictions?.map((restriction, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        <span className="text-muted-foreground">{restriction}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
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
                  <RadioGroupItem value="all" id="access-all" />
                  <Label htmlFor="access-all" className="font-normal cursor-pointer">
                    All websites (current and future)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="access-specific" />
                  <Label htmlFor="access-specific" className="font-normal cursor-pointer">
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
                              id={`website-${website.id}`}
                              checked={selectedWebsites.includes(website.id)}
                              onCheckedChange={() => toggleWebsite(website.id)}
                            />
                            <Label
                              htmlFor={`website-${website.id}`}
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
