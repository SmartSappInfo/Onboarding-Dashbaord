'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import the grid so it isn't included in the initial SSR bundle, 
// avoiding hydration mismatches and bundle bloat.
const DashboardGridInner = dynamic(() => import('./dashboard-grid-inner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      {/* Basic skeleton representing a loading grid */}
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="col-span-1 md:col-span-2 lg:col-span-4 h-64 rounded-xl" />
    </div>
  )
});

export { DashboardGridInner as DashboardGrid };
