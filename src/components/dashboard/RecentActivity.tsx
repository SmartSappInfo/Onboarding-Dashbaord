// components/dashboard/RecentActivity.tsx
import DashboardCard from "./DashboardCard"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Button } from "../ui/button"

export function RecentActivity({ schools }: { schools: any[] }) {
  return (
    <DashboardCard title="Recently Added Schools" description="The last 5 schools that were created.">
       {schools.length > 0 ? (
        <ul className="space-y-3">
          {schools.map(s => (
            <li key={s.id}>
                 <Link href={`/admin/schools/${s.id}/edit`} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {s.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : null}
                    </span>
                </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
            <p>No schools have been added yet.</p>
            <Button variant="link" asChild><Link href="/admin/schools/new">Add one now</Link></Button>
        </div>
      )}
    </DashboardCard>
  )
}
