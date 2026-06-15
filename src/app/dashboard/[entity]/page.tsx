import { Suspense } from 'react';
import { getDashboardConfig } from '@/lib/services/dashboard.service';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { notFound } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return {
    title: `${entity.charAt(0).toUpperCase() + entity.slice(1)} Dashboard`,
    description: `Analytics for ${entity}`,
    robots: { index: false, follow: false },
  };
}

interface Props {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ workspaceId?: string; industry?: string }>;
}

export default async function EntityDashboardPage({ params, searchParams }: Props) {
  const { entity } = await params;
  const search = await searchParams;
  
  const workspaceId = search.workspaceId || 'demo-workspace-id';
  const industry = search.industry || 'saas';

  // Basic validation for allowed entities (can be expanded)
  const allowedEntities = ['deals', 'contacts', 'companies', 'campaigns'];
  if (!allowedEntities.includes(entity.toLowerCase())) {
    notFound();
  }

  // Fetch the configuration for this specific entity
  const config = await getDashboardConfig(workspaceId, industry, entity);

  return (
    <div className="flex h-screen flex-col w-full bg-background overflow-hidden">
      <header className="flex-none p-6 border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-2xl font-bold tracking-tight capitalize">{entity} Analytics</h1>
      </header>
      <main className="flex-1 overflow-auto bg-muted/10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardGrid workspaceId={workspaceId} entityType={entity} config={config} />
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
