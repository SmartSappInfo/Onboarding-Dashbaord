
import { Suspense } from "react";
import { 
    QuickActions,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2">
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
            
            <div className="lg:col-span-2 lg:row-span-2">
                <Card className="p-4 flex flex-col items-center justify-center min-h-[400px]">
                    <Skeleton className="h-5 w-1/3 mb-4" />
                    <Skeleton className="w-64 h-64 rounded-full" />
                </Card>
            </div>

            <div className="lg:col-span-2">
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

             <div className="lg:col-span-2">
                <Card className="p-4 flex flex-col items-center justify-center min-h-[300px]">
                    <Skeleton className="h-5 w-1/3 mb-4" />
                    <Skeleton className="w-full h-64" />
                </Card>
            </div>

            <div className="lg:col-span-4">
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

            <div className="lg:col-span-4">
                <Card className="p-4 space-y-4">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    <Skeleton className="h-8 w-1/3 mb-4" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                </Card>
            </div>
        </div>
    );
}


async function DashboardData() {
  const data = await getDashboardData();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2">
            <QuickActions />
        </div>
        
        <div className="lg:col-span-2 lg:row-span-2">
            <PipelinePieChart stages={data.pipelineCounts} />
        </div>

        <div className="lg:col-span-2">
            <LatestSurveys surveys={data.latestSurveys} />
        </div>
        
        <div className="lg:col-span-2">
            <UpcomingMeetings meetings={data.upcomingMeetings} />
        </div>

        <div className="lg:col-span-2">
           <MonthlySchoolsChart data={data.monthlySchools} />
        </div>
        
        <div className="lg:col-span-4">
            <RecentActivity schools={data.recentSchools} />
        </div>
        
        <div className="lg:col-span-4">
            <UserAssignments data={data.userAssignments} totalSchools={data.metrics.totalSchools} />
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
