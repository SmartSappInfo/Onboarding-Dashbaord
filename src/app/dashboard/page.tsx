import { Suspense } from 'react';
import { getDashboardConfig } from '@/lib/services/dashboard.service';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Intelligence Hub',
  description: 'Workspace analytics and overview.',
};

interface Props {
  searchParams: Promise<{ workspaceId?: string; industry?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  // Await async searchParams as required by Next.js 15+
  const params = await searchParams;
  
  // Replace these with actual auth context in the future
  const workspaceId = params.workspaceId || 'demo-workspace-id';
  const industry = params.industry || 'saas';

  // Fetch the configuration (merging global template + workspace overrides)
  const config = await getDashboardConfig(workspaceId, industry);

  return (
    <div className="flex h-screen flex-col w-full bg-background overflow-hidden">
      <header className="flex-none p-6 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intelligence Hub</h1>
            <p className="text-sm text-muted-foreground">Your workspace overview and analytics.</p>
          </div>
          {/* Settings or Filters could go here */}
        </div>
      </header>
      <main className="flex-1 overflow-auto bg-muted/10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardGrid workspaceId={workspaceId} config={config} />
        </Suspense>
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full h-full p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
       <Skeleton className="h-32 rounded-xl" />
       <Skeleton className="h-32 rounded-xl" />
       <Skeleton className="h-32 rounded-xl" />
       <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
