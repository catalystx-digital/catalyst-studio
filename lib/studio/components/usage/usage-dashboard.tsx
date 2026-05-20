'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UsageProgressBar } from './usage-progress-bar';
import { ComingSoonModal } from './coming-soon-modal';
import type { UsageResponse, MonthlyUsage } from '@/app/api/usage/route';

interface UsageDashboardProps {
  className?: string;
}

/**
 * Usage Dashboard - displays usage metrics, history, and upgrade option
 */
export function UsageDashboard({ className }: UsageDashboardProps) {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    async function fetchUsage() {
      try {
        setLoading(true);
        const response = await fetch('/api/usage');
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Failed to fetch usage data');
        }

        setData(result.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  // Calculate days until reset
  const getDaysUntilReset = () => {
    if (!data?.resetDate) return 0;
    const resetDate = new Date(data.resetDate);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Format reset date for display
  const formatResetDate = () => {
    if (!data?.resetDate) return '';
    const resetDate = new Date(data.resetDate);
    return resetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading usage data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const daysUntilReset = getDaysUntilReset();

  return (
    <div className={className}>
      {/* Current Usage Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Overview</CardTitle>
              <CardDescription>
                Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''} ({formatResetDate()})
              </CardDescription>
            </div>
            {data.isAdmin && (
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                Admin
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageProgressBar
            label="Websites"
            current={data.websites.current}
            limit={data.websites.limit}
            warningLevel={data.websites.warningLevel}
            graceAvailable={data.websites.graceAvailable}
          />
          <UsageProgressBar
            label="Pages"
            current={data.pages.current}
            limit={data.pages.limit}
            warningLevel={data.pages.warningLevel}
            graceAvailable={data.pages.graceAvailable}
          />
          <UsageProgressBar
            label="AI Tokens"
            current={data.tokens.current}
            limit={data.tokens.limit}
            warningLevel={data.tokens.warningLevel}
            graceAvailable={data.tokens.graceAvailable}
          />

          {/* Upgrade CTA - show if any metric is at warning or above */}
          {(data.websites.warningLevel !== 'none' ||
            data.pages.warningLevel !== 'none' ||
            data.tokens.warningLevel !== 'none') && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="mb-2 text-sm text-orange-800">
                Approaching your usage limits? Upgrade to Pro for unlimited access.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setUpgradeModalOpen(true)}
              >
                Upgrade to Pro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage History Card */}
      {data.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage History</CardTitle>
            <CardDescription>Past 3 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium">Month</th>
                    <th className="pb-2 text-right font-medium">Websites</th>
                    <th className="pb-2 text-right font-medium">Pages</th>
                    <th className="pb-2 text-right font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((month: MonthlyUsage) => (
                    <tr key={month.month} className="border-b last:border-0">
                      <td className="py-2">{formatMonthLabel(month.month)}</td>
                      <td className="py-2 text-right">{month.websites}</td>
                      <td className="py-2 text-right">{month.pages}</td>
                      <td className="py-2 text-right">{month.tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coming Soon Modal */}
      <ComingSoonModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </div>
  );
}

/**
 * Format month key (e.g., '2025-12') to human readable (e.g., 'December 2025')
 */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
