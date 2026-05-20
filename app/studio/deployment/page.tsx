'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeploymentWizard } from '@/lib/studio/components/deployment/deployment-wizard';
import { DeploymentHistory } from '@/components/deployment/deployment-history';
import type { DeploymentJob } from '@/lib/deployment/deployment-types';
import { Rocket, History } from 'lucide-react';

export default function StudioDeploymentPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const [activeTab, setActiveTab] = useState('deploy');
  const [lastJob, setLastJob] = useState<DeploymentJob | null>(null);

  const websiteId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const queryId = search.get('websiteId');
      if (queryId) {
        return queryId;
      }
    }

    return typeof params?.id === 'string' ? params.id : '';
  }, [params?.id]);

  const cancelHref = useMemo(() => {
    if (!websiteId) {
      return '/studio/site-builder';
    }

    const search = new URLSearchParams({ websiteId });
    return `/studio/site-builder?${search.toString()}`;
  }, [websiteId]);

  const handleCancel = useCallback(() => {
    router.push(cancelHref);
  }, [cancelHref, router]);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Publish
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Deploy your website to your connected CMS platform.
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deploy">
                <Rocket className="mr-2 h-4 w-4" />
                Deploy
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deploy" className="mt-8">
              <DeploymentWizard
                websiteId={websiteId}
                onComplete={job => setLastJob(job)}
                onCancel={handleCancel}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-8">
              <DeploymentHistory onRedeploy={job => {
                setLastJob(job);
                setActiveTab('deploy');
              }} />
            </TabsContent>
          </Tabs>

          {lastJob && lastJob.status === 'completed' && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              Last deployment {lastJob.id} completed successfully.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

