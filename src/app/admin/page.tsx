
import { Suspense } from "react";
import { 
    QuickActions,
    MetricsRow,
    LatestSurveys,
    RecentActivity,
    UpcomingMeetings,
    PipelinePieChart,
    UserAssignments,
    MonthlySchoolsChart
} from "@/components/dashboard";
import { getDashboardData } from "@/lib/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Row 1: Metrics */}
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-8 w-1/3" />
                </Card>
            ))}

            {/* Row 2: Quick Actions & Latest Surveys */}
            <div className="md:col-span-2">
                <Card className="p-4 space-y-2 h-full">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </Card>
            </div>
            <div className="md:col-span-2">
                <Card className="p-4 space-y-3 h-full">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-6 w-20" />
                        </div>
                    ))}
                </Card>
            </div>

            {/* Row 3: Recent Activity & Upcoming Meetings */}
            <div className="lg:col-span-2">
                <Card className="p-4 space-y-3 h-full">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <Skeleton className="h-5 w-3/5" />
                            <Skeleton className="h-4 w-1/5" />
                        </div>
                    ))}
                </Card>
            </div>
            <div className="lg:col-span-2">
                 <Card className="p-4 space-y-3 h-full">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="space-y-1">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-5 w-20" />
                        </div>
                    ))}
                </Card>
            </div>

            {/* Row 4: Charts */}
            <div className="lg:col-span-2">
                <Card className="p-4 flex flex-col items-center justify-center min-h-[300px]">
                    <Skeleton className="h-5 w-1/3 mb-4" />
                    <Skeleton className="w-48 h-48 rounded-full" />
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="p-4 flex flex-col items-center justify-center min-h-[300px]">
                    <Skeleton className="h-5 w-1/3 mb-4" />
                    <Skeleton className="w-full h-64" />
                </Card>
            </div>
            
            {/* Row 5: User Assignments */}
            <div className="lg:col-span-4">
                <Card className="p-4 space-y-4">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-5 w-32" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}


async function DashboardData() {
  const data = await getDashboardData();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Row 1: Metrics */}
        <MetricsRow data={data.metrics} />

        {/* Row 2: Quick Actions & Latest Surveys */}
        <div className="md:col-span-2">
            <QuickActions />
        </div>
        <div className="md:col-span-2">
            <LatestSurveys surveys={data.latestSurveys} />
        </div>
        
        {/* Row 3: Lists */}
        <div className="lg:col-span-2">
            <RecentActivity schools={data.recentSchools} />
        </div>
        <div className="lg:col-span-2">
            <UpcomingMeetings meetings={data.upcomingMeetings} />
        </div>
        
        {/* Row 4: Charts */}
        <div className="lg:col-span-2">
            <PipelinePieChart stages={data.pipelineCounts} />
        </div>
        <div className="lg:col-span-2">
           <MonthlySchoolsChart data={data.monthlySchools} />
        </div>
        
        {/* Row 5: User Assignments */}
        <div className="lg:col-span-4">
            <UserAssignments data={data.userAssignments} />
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

    