
import { Suspense } from "react";
import { MetricsRow } from "@/components/dashboard/MetricsRow"
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings"
import { PipelineSnapshot } from "@/components/dashboard/PipelineSnapshot"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { getDashboardData } from "@/lib/dashboard"
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
            </div>
        </div>
    )
}

async function DashboardData() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <MetricsRow data={data.metrics} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingMeetings meetings={data.meetings} />
        <PipelineSnapshot stages={data.pipeline} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity schools={data.activity} />
        <QuickActions />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardData />
            </Suspense>
        </div>
    );
}

