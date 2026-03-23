// components/dashboard/PipelineSnapshot.tsx
import DashboardCard from "./DashboardCard"
import Link from "next/link"

export function PipelineSnapshot({ stages }: { stages: { name: string; count: number }[] }) {
  return (
    <DashboardCard title="Onboarding Pipeline">
      {stages.length > 0 ? (
        <div className="space-y-3">
          {stages.map(stage => (
            <Link key={stage.name} href="/admin/pipeline" className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
              <span className="text-sm text-foreground">{stage.name}</span>
              <span className="font-semibold">{stage.count}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No pipeline stages configured.
        </div>
      )}
    </DashboardCard>
  )
}
