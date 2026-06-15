import * as React from 'react';
import { Suspense } from 'react';
import { CampaignAnalyticsClient } from './CampaignAnalyticsClient';

interface PageProps {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ track?: string }>;
}

export default async function CampaignAnalyticsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-zinc-950 py-20">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-semibold">Loading campaign analytics...</span>
        </div>
      </div>
    }>
      <CampaignAnalyticsClient 
        campaignId={resolvedParams.campaignId}
        workspaceId={resolvedSearchParams.track || ''}
      />
    </Suspense>
  );
}
