
'use client';

import DashboardCard from "./DashboardCard";
import { Skeleton } from "@/components/ui/skeleton";

export function PipelinePieChart({ stages }: { stages: { name: string; count: number }[] }) {
  return (
    <DashboardCard title="Onboarding Pipeline">
        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
             <p className="mb-4">Pie chart will be implemented in a future phase.</p>
             <Skeleton className="w-48 h-48 rounded-full" />
        </div>
    </DashboardCard>
  )
}
