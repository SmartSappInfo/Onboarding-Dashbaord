
// components/dashboard/RecentActivity.tsx
import DashboardCard from "./DashboardCard"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Button } from "../ui/button"
import { User, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function RecentActivity({ schools }: { schools: any[] }) {
  return (
    <DashboardCard title="Recently Added Schools" description="The last 5 schools that were created.">
       {schools.length > 0 ? (
        <ul className="space-y-1">
          {schools.map(s => (
            <li key={s.id}>
                 <Link href={`/admin/schools/${s.id}/edit`} className="block p-3 rounded-lg hover:bg-muted/50 transition-colors -m-2">
                    <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground shrink-0 ml-4 whitespace-nowrap">
                            {s.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : null}
                        </p>
                    </div>
                    <div className="mt-2 flex flex-col items-start gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            <span>{s.assignedTo?.name || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3 w-3" />
                            <span>{s.nominalRoll?.toLocaleString() || 0} students</span>
                        </div>
                        {s.modules && s.modules.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {s.modules.slice(0, 3).map((mod: any) => (
                                    <Badge key={mod.id} style={{ backgroundColor: mod.color, color: 'hsl(var(--primary-foreground))' }} className="text-xs font-normal border-transparent">{mod.abbreviation}</Badge>
                                ))}
                            </div>
                        )}
                    </div>
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

    