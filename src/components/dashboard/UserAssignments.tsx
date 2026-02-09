
'use client';
import DashboardCard from "./DashboardCard";
import { Skeleton } from "@/components/ui/skeleton";

export function UserAssignments({ data }: { data: any[] }) {
    return (
        <DashboardCard title="Users & Assigned Schools">
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                <p className="mb-4">User assignment chart will be implemented in a future phase.</p>
                <div className="w-full space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
            </div>
        </DashboardCard>
    );
}
