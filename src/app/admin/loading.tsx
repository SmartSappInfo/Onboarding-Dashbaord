import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
    return (
        <div className="h-full w-full bg-background p-4 sm:p-8 animate-in fade-in duration-500">
            <div className="space-y-10">
                {/* Header Context Skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/10">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-48 rounded-xl" />
                            <Skeleton className="h-6 w-32 rounded-lg" />
                        </div>
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-24 rounded-xl" />
                        <Skeleton className="h-9 w-24 rounded-xl" />
                        <Skeleton className="h-9 w-24 rounded-xl" />
                    </div>
                </div>

                {/* Dashboard Visualization Grid Skeleton */}
                <DashboardSkeleton />
            </div>
        </div>
    );
}
