"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/auth/hooks';
import type { AccountUsageSummary, AccountQuotaItem } from '@/lib/api/hooks/use-account-usage';
import type { QuotaKind } from '@/lib/usage/limits';

type Summary = AccountUsageSummary;

const QUOTA_LABELS: Record<QuotaKind, string> = {
  import_page: 'Imports',
  chat_tokens: 'Chat Tokens',
  website_create: 'Website Creations',
  page_create: 'Page Creations',
  chat_sessions: 'Chat Sessions',
  credits: 'Credits',
};

const RESET_OPTIONS: Array<{ kind: QuotaKind; label: string }> = [
  { kind: 'import_page', label: 'Reset Imports Today' },
  { kind: 'chat_tokens', label: 'Reset Chat Tokens Today' },
  { kind: 'chat_sessions', label: 'Reset Chat Sessions Today' },
  { kind: 'website_create', label: 'Reset Website Creations Today' },
  { kind: 'page_create', label: 'Reset Page Creations Today' },
];

function formatQuotaValue(item: AccountQuotaItem): string {
  const used = item.used;
  const limit = item.limit ?? '∞';
  return `${used} / ${limit}`;
}

export default function AccountUsagePage() {
  const user = useUser();
  const accountId = useMemo(() => user?.id ?? null, [user]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/usage');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load usage');
      setSummary(json.data as Summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    void refresh();
  }, [accountId, refresh]);

  async function onReset(kind: 'all' | QuotaKind) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', kind, period: 'day' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to reset');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
        <h1>Account Usage</h1>
        <p>Please sign in to view usage details.</p>
      </div>
    );
  }

  const metadata = user?.user_metadata as Record<string, any> | null | undefined;
  const accountName =
    metadata?.full_name ||
    metadata?.name ||
    user.email ||
    metadata?.preferred_username ||
    accountId;

  const quotaEntries = summary ? Object.entries(summary.quotas) as Array<[QuotaKind, AccountQuotaItem]> : [];

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h1>Account Usage</h1>
      <p>
        Signed in as <strong>{accountName}</strong>
        <br />
        Account ID: <code>{accountId}</code>
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button onClick={refresh} disabled={loading}>Reload</button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {loading && <div>Loading…</div>}
      {summary && (
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
          <h2>Quotas</h2>
          <p style={{ marginTop: 0, color: '#555' }}>Enforcement mode: <strong>{summary.enforcement.mode}</strong></p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Quota</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Usage</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Remaining</th>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Period</th>
              </tr>
            </thead>
            <tbody>
              {quotaEntries.map(([kind, item]) => (
                <tr key={kind}>
                  <td style={{ padding: '4px 8px' }}>{QUOTA_LABELS[kind] || kind}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatQuotaValue(item)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.available ?? '∞'}</td>
                  <td style={{ padding: '4px 8px' }}>{item.period ?? 'lifetime'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>Integrations</h3>
          <p style={{ margin: 0 }}>
            Enabled: {summary.integrations.enabled} / {summary.integrations.total}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <button onClick={() => onReset('all')} disabled={loading}>Reset All Today</button>
            {RESET_OPTIONS.map(({ kind, label }) => (
              <button key={kind} onClick={() => onReset(kind)} disabled={loading}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
