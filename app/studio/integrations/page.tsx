'use client';

/**
 * Integrations Page
 *
 * Dedicated page for managing CMS integrations.
 * Accessed via sidebar "Integrations" link.
 */

import { IntegrationManager } from '@/lib/studio/components/integrations/integration-manager';

export default function IntegrationsPage() {
  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your website to external CMS platforms and services.
        </p>
      </div>

      <div className="p-6">
        <IntegrationManager />
      </div>
    </div>
  );
}
