import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * @fileOverview High-fidelity skeleton for the dashboard grid.
 * Matches the Pro Max UI card layouts to minimize visual layout shift.
 */
export function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI Summary Card */}
            <div className="lg:col-span-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="p-6 h-32 rounded-[2rem] border-none ring-1 ring-border bg-white shadow-sm flex items-center gap-5">
                            <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-8 w-3/4" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Distribution Card */}
            <div className="lg:col-span-2">
                <Card className="p-8 space-y-6 h-full rounded-[2rem] border-none ring-1 ring-border bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-full rounded-md" />
                        <div className="flex gap-4">
                            <Skeleton className="h-12 w-1/2 rounded-xl" />
                            <Skeleton className="h-12 w-1/2 rounded-xl" />
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Pipeline Donut Card */}
            <div className="lg:col-span-2 lg:row-span-2">
                <Card className="p-8 flex flex-col items-center justify-center min-h-[450px] rounded-[2rem] border-none ring-1 ring-border bg-white shadow-sm">
                    <Skeleton className="h-5 w-1/3 mb-8" />
                    <Skeleton className="w-64 h-64 rounded-full border-[30px] border-muted" />
                    <div className="mt-8 grid grid-cols-2 gap-4 w-full px-10">
                        <Skeleton className="h-8 w-full rounded-lg" />
                        <Skeleton className="h-8 w-full rounded-lg" />
                    </div>
                </Card>
            </div>

            {/* Messaging/Task Small Widgets */}
            <div className="lg:col-span-2">
                <Card className="p-8 space-y-6 h-full rounded-[2rem] border-none ring-1 ring-border bg-white shadow-sm">
                    <Skeleton className="h-5 w-1/4 mb-4" />
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Large Activity/Chart Row */}
            <div className="lg:col-span-4">
                 <Card className="p-8 space-y-6 h-full rounded-[2.5rem] border-none ring-1 ring-border bg-white shadow-sm">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-10 w-32 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
