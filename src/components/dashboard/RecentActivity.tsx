// components/dashboard/RecentActivity.tsx
import DashboardCard from "./DashboardCard"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

export function RecentActivity({ schools }: { schools: any[] }) {
  return (
    <DashboardCard title="Recent Activity">
       {schools.length > 0 ? (
        <ul className="space-y-3">
          {schools.map(s => (
            <li key={s.id}>
                 <Link href={`/admin/schools/${s.id}/edit`} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </span>
                </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No recent activity.
        </div>
      )}
    </DashboardCard>
  )
}
