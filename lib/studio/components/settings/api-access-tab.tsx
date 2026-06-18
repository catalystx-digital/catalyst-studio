'use client';

import { useMemo, useState, type ReactNode, type SVGProps } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { KeyRound, RefreshCcw, Trash2, History, Copy, ShieldCheck, AlertTriangle, Loader2, Plus } from 'lucide-react';

import {
  AccountApiKeySummary,
  AccountApiKeyAuditEvent,
  CreateAccountApiKeyRequest,
} from '@/types/api';
import {
  useAccountApiKeys,
  useCreateAccountApiKey,
  useRotateAccountApiKey,
  useRevokeAccountApiKey,
  useUpdateAccountApiKey,
  useAccountApiKeyEvents,
} from '@/lib/api/hooks/use-account-api-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ApiAccessTabProps {
  websiteId: string | null;
  websiteName?: string;
}

type ScopeOption = 'account' | 'website';

export function ApiAccessTab({ websiteId, websiteName }: ApiAccessTabProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [scopeOption, setScopeOption] = useState<ScopeOption>('website');
  const [labelValue, setLabelValue] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [plaintextKey, setPlaintextKey] = useState<{ value: string; label: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<AccountApiKeySummary | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccountApiKeySummary | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [editTarget, setEditTarget] = useState<AccountApiKeySummary | null>(null);
  const [auditKey, setAuditKey] = useState<AccountApiKeySummary | null>(null);

  const targetWebsiteId = scopeOption === 'website' ? websiteId ?? undefined : undefined;
  const filterWebsiteId = websiteId ?? undefined;

  const { data: keys = [], isLoading, refetch } = useAccountApiKeys(filterWebsiteId);
  const createMutation = useCreateAccountApiKey(filterWebsiteId);
  const rotateMutation = useRotateAccountApiKey(filterWebsiteId);
  const revokeMutation = useRevokeAccountApiKey(filterWebsiteId);
  const updateMutation = useUpdateAccountApiKey(filterWebsiteId);
  const { data: auditEvents = [], isLoading: auditLoading } = useAccountApiKeyEvents(auditKey?.id ?? null);

  const rows = useMemo(() => {
    return keys.slice().sort((a, b) => {
      if (a.websiteId === b.websiteId) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (a.websiteId === null) {
        return -1;
      }
      if (b.websiteId === null) {
        return 1;
      }
      return (a.websiteId ?? '').localeCompare(b.websiteId ?? '');
    });
  }, [keys]);

  const creatingForWebsite = scopeOption === 'website' && websiteId;
  const canCreateWebsiteScoped = Boolean(websiteId);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied to clipboard' });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Clipboard error', error);
      }
      toast({ title: 'Unable to copy', variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    const payload: CreateAccountApiKeyRequest = {
      label: labelValue,
      websiteId: scopeOption === 'website' ? websiteId ?? undefined : undefined,
      scopes: scopeOption === 'website' ? ['WEBSITE_READ'] : ['ACCOUNT_READ'],
      expiresAt: expiresAt || undefined,
    };

    try {
      const result = await createMutation.mutateAsync(payload);
      setPlaintextKey({ value: result.plaintextKey, label: result.key.label });
      setIsCreateOpen(false);
      setLabelValue('');
      setExpiresAt('');
      await refetch();
    } catch (error) {
      toast({
        title: 'Failed to create key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRotate = async () => {
    if (!rotateTarget) return;
    try {
      const result = await rotateMutation.mutateAsync({ keyId: rotateTarget.id });
      setPlaintextKey({ value: result.plaintextKey, label: rotateTarget.label });
      setRotateTarget(null);
      await refetch();
    } catch (error) {
      toast({
        title: 'Rotation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeMutation.mutateAsync({ keyId: revokeTarget.id, reason: revokeReason });
      setRevokeTarget(null);
      setRevokeReason('');
      await refetch();
    } catch (error) {
      toast({
        title: 'Unable to revoke key',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({
        keyId: editTarget.id,
        label: editTarget.label,
        expiresAt: editTarget.expiresAt ? new Date(editTarget.expiresAt).toISOString() : null,
      });
      setEditTarget(null);
      await refetch();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const activeKeys = rows.filter(key => key.status === 'active').length;

  if (!websiteId) {
    return (
      <Card className="border-amber-400/60 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Select a website to manage API keys
          </CardTitle>
          <CardDescription className="text-amber-100/80">
            API Access is scoped to a specific website. Choose a site from the studio navigation first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Build the UCS GraphQL endpoint URL for the current host (client only)
  const graphqlEndpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/studio/ucs/graphql`
      : '/api/studio/ucs/graphql';

  // Demo values grounded in seeded "test-website" (per docs/setup.md + .env.example) and real UCS schema
  const demoWebsiteId = websiteId ?? 'test-website';
  const exampleQueryDisplay = `query GetHome($websiteId: ID!, $slug: String = "/") {
  website(id: $websiteId) { id name }
  page(websiteId: $websiteId, slug: $slug) {
    title fullPath templateKey
    components { id type componentType props content styles }
    sharedComponents { id name }
  }
  sharedComponents(websiteId: $websiteId) { id name componentType }
  designSystems(websiteId: $websiteId) { id version isCurrent }
}`;

  const handleTryNow = () => {
    // Compact single-line for reliable curl paste (GraphQL ignores whitespace)
    const q = 'query GetHome($websiteId: ID!, $slug: String = "/") { website(id: $websiteId) { id name } page(websiteId: $websiteId, slug: $slug) { title fullPath templateKey components { id type componentType props content styles } sharedComponents { id name } } sharedComponents(websiteId: $websiteId) { id name componentType } designSystems(websiteId: $websiteId) { id version isCurrent } }';
    const curl = `curl -X POST "${graphqlEndpoint}" -H "Content-Type: application/json" -H "x-ucs-api-key: <paste-your-api-key-here>" -d '{"query":${JSON.stringify(q)},"variables":{"websiteId":"${demoWebsiteId}"}}'`;
    handleCopy(curl);
  };

  return (
    <div className="space-y-6">
      {/* Headless / GraphQL visibility section for newcomers */}
      <Card className="border-catalyst-orange/40 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            Headless GraphQL API (UCS)
          </CardTitle>
          <CardDescription>
            Use this website&apos;s structured content headlessly from any frontend, static site generator, or custom app.
            The same resolved model that powers the visual builder, preview, and exports is available via GraphQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-medium text-foreground mb-1">Endpoint</div>
            <div className="font-mono text-xs bg-black/40 px-3 py-2 rounded border border-border-default/60 break-all">
              {graphqlEndpoint}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              POST GraphQL queries here. Requires an active website-scoped API key (WEBSITE_READ scope recommended).
            </p>
          </div>

          <div>
            <div className="font-medium text-foreground mb-1">Auth</div>
            <div className="font-mono text-xs bg-black/40 px-3 py-2 rounded border border-border-default/60">
              x-ucs-api-key: &lt;your-plaintext-api-key&gt;
            </div>
          </div>

          <div>
            <div className="font-medium text-foreground mb-1">Example: Fetch home page + components, shared components, design system (practical for seeded test-website)</div>
            <pre className="text-[10px] leading-tight bg-black/60 p-3 rounded border border-border-default/60 overflow-x-auto whitespace-pre-wrap">{exampleQueryDisplay}</pre>
            <p className="mt-1 text-muted-foreground text-xs">
              Send as JSON: {"{ \"query\": \"...\", \"variables\": { \"websiteId\": \"...\" } }"}.
              See README.md “Headless &amp; Delivery” section for more on using as a CMS.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTryNow}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Try it now (copy curl)
              </Button>
              <span className="text-[10px] text-muted-foreground">Generate a key in the table below first, then replace the placeholder. Uses active websiteId ({demoWebsiteId}).</span>
            </div>
            <p className="mt-1 text-[10px] text-catalyst-orange/80">Works instantly in the seeded demo – use the visual Site Builder + AI assistant to populate real structured content, then query it headlessly. The same resolved UCS model powers preview, builder edits, and exports.</p>
          </div>

          <div className="text-xs text-muted-foreground pt-1 border-t border-border-default/40">
            Keys created below work immediately with this API (and headless generation scripts in the repo).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border-default/40 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-white">
            <KeyRound className="h-5 w-5 text-catalyst-orange" />
            API Access for {websiteName ?? 'this website'}
          </CardTitle>
          <CardDescription>
            Issue scoped API keys for heads, exports, or partner runtimes. Rotate keys regularly and revoke unused credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active keys" value={activeKeys} icon={<ShieldCheck className="h-4 w-4" />} />
            <StatTile label="Account-level" value={rows.filter(key => !key.websiteId).length} icon={<KeyRound className="h-4 w-4" />} />
            <StatTile label="Website-scoped" value={rows.filter(key => key.websiteId).length} icon={<History className="h-4 w-4" />} />
            <StatTile label="Expiring soon" value={rows.filter(key => isExpiringSoon(key.expiresAt)).length} icon={<AlertTriangle className="h-4 w-4" />} accent />
          </div>

          {plaintextKey && (
            <div className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-4">
              <p className="text-sm font-medium text-emerald-200">
                Copy this key now. It will never be shown again.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-black/30 px-3 py-2 font-mono text-sm text-emerald-100">
                <span className="truncate">{plaintextKey.value}</span>
                <Button variant="outline" size="sm" onClick={() => handleCopy(plaintextKey.value)}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Keys inherit rate limits and WEBSITE_READ / ACCOUNT_READ scopes. See README “Headless &amp; Delivery” for UCS GraphQL usage.
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Generate API key
            </Button>
          </div>

          <div className="rounded-lg border border-border-default/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Loading keys...
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No API keys yet. Generate one to get started.
                    </TableCell>
                  </TableRow>
                )}

                {rows.map(key => (
                  <TableRow key={key.id} className={cn('border-border-default/40', key.status === 'revoked' && 'opacity-70')}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{key.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{key.keyPreview}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScopeBadge keySummary={key} websiteName={websiteName} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={key.status} />
                    </TableCell>
                    <TableCell>
                      {key.expiresAt ? (
                        <div className={cn('text-sm', isExpiringSoon(key.expiresAt) && 'text-amber-300')}>
                          {format(new Date(key.expiresAt), 'PP p')}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No requests</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" aria-label="View activity" onClick={() => setAuditKey(key)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditTarget({ ...key })}>
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Rotate"
                          disabled={key.status !== 'active'}
                          onClick={() => setRotateTarget(key)}
                        >
                          {rotateMutation.isPending && rotateTarget?.id === key.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Revoke"
                          onClick={() => setRevokeTarget(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API key</DialogTitle>
            <DialogDescription>
              Keys inherit the selected scope and are hashed immediately after creation. Store the plaintext securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">Label</label>
              <Input className="mt-2" placeholder="e.g. Partner storefront" value={labelValue} onChange={event => setLabelValue(event.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Scope</label>
              <Select value={scopeOption} onValueChange={value => setScopeOption(value as ScopeOption)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website" disabled={!canCreateWebsiteScoped}>
                    Website ({websiteName ?? 'current'})
                  </SelectItem>
                  <SelectItem value="account">Account (all websites)</SelectItem>
                </SelectContent>
              </Select>
              {!canCreateWebsiteScoped && (
                <p className="mt-2 text-sm text-muted-foreground">Link this website to an account to issue scoped keys.</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-white">Expires at (optional)</label>
              <Input
                type="datetime-local"
                className="mt-2"
                value={expiresAt}
                onChange={event => setExpiresAt(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit key metadata</DialogTitle>
            <DialogDescription>Update the label or expiration. Changes apply immediately.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Expiration updates take effect right away. Heads using this key will stop working after the configured time.
          </div>
          {editTarget && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white">Label</label>
                <Input
                  className="mt-2"
                  value={editTarget.label}
                  onChange={event => setEditTarget({ ...editTarget, label: event.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white">Expires at</label>
                <Input
                  type="datetime-local"
                  className="mt-2"
                  value={editTarget.expiresAt ? formatInputValue(editTarget.expiresAt) : ''}
                  onChange={event => {
                    const value = event.target.value;
                    setEditTarget({ ...editTarget, expiresAt: value ? new Date(value) : null });
                  }}
                />
                <p className="mt-2 text-sm text-muted-foreground">Leave blank for no expiration.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(rotateTarget)} onOpenChange={open => !open && setRotateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate “{rotateTarget?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              We will issue a new secret and keep the previous key active until you update clients. Copy the new value immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotate} disabled={rotateMutation.isPending}>
              {rotateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rotate key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={open => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{revokeTarget?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoked keys stop working immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label className="text-sm font-medium text-white">Reason (optional)</label>
            <Textarea className="mt-2" placeholder="Document why this key was revoked" value={revokeReason} onChange={event => setRevokeReason(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-500" onClick={handleRevoke} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(auditKey)} onOpenChange={open => !open && setAuditKey(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit log for “{auditKey?.label}”</DialogTitle>
            <DialogDescription>Events are retained for 90 days. Export JSON for compliance reviews.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" className="w-fit" onClick={() => exportAuditEvents(auditEvents)} disabled={auditEvents.length === 0}>
              <DownloadIcon className="mr-2 h-4 w-4" /> Export JSON
            </Button>
            <div className="max-h-96 overflow-y-auto rounded-md border border-border-default/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Loading events...</TableCell>
                    </TableRow>
                  )}
                  {!auditLoading && auditEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No audit entries in the last 90 days.</TableCell>
                    </TableRow>
                  )}
                  {auditEvents.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="capitalize">{event.action}</TableCell>
                      <TableCell>{event.actorId ?? 'system'}</TableCell>
                      <TableCell>{format(new Date(event.occurredAt), 'PP pp')}</TableCell>
                      <TableCell>
                        <pre className="max-h-24 overflow-auto rounded bg-black/30 p-2 text-xs text-muted-foreground">
                          {JSON.stringify(event.metadata ?? {}, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isExpiringSoon(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  return expires - Date.now() < 1000 * 60 * 60 * 24 * 7;
}

function formatInputValue(value: Date | string): string {
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function exportAuditEvents(events: AccountApiKeyAuditEvent[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ucs-api-key-audit-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ScopeBadge({ keySummary, websiteName }: { keySummary: AccountApiKeySummary; websiteName?: string }) {
  if (!keySummary.websiteId) {
    return <Badge variant="secondary">account</Badge>;
  }
  return <Badge variant="outline">{websiteName ?? 'website'}</Badge>;
}

function StatusBadge({ status }: { status: AccountApiKeySummary['status'] }) {
  if (status === 'active') {
    return <Badge className="bg-emerald-500/20 text-emerald-200">active</Badge>;
  }
  return <Badge variant="destructive">revoked</Badge>;
}

function StatTile({ label, value, icon, accent }: { label: string; value: number; icon: ReactNode; accent?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-4 py-3', accent ? 'border-amber-400/60 bg-amber-500/5' : 'border-border-default/40 bg-black/20')}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('h-4 w-4', props.className)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
