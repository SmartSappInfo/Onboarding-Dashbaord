
'use client';
import DashboardCard from "./DashboardCard";
import { Skeleton } from "@/components/ui/skeleton";

export function MonthlySchoolsChart({ data }: { data: any[] }) {
    return (
        <DashboardCard title="Schools Added Per Month">
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
                 <p className="mb-4">Bar chart will be implemented in a future phase.</p>
                 <Skeleton className="w-full h-48" />
            </div>
        </DashboardCard>
    );
}
