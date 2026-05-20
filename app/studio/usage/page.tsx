import { UsageDashboard } from '@/lib/studio/components/usage/usage-dashboard';

export const metadata = {
  title: 'Usage & Limits | Catalyst Studio',
  description: 'View your usage statistics and account limits',
};

export default function UsagePage() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Usage & Limits</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor your monthly usage across websites, pages, and AI tokens.
        </p>
      </div>
      <UsageDashboard />
    </div>
  );
}
