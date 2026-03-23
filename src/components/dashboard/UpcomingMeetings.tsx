
// components/dashboard/UpcomingMeetings.tsx
import DashboardCard from "./DashboardCard"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "../ui/button"

export function UpcomingMeetings({ meetings }: { meetings: any[] }) {
  return (
    <DashboardCard title="Upcoming Meetings">
      {meetings.length > 0 ? (
        <ul className="space-y-3">
          {meetings.map(m => (
            <li key={m.id}>
              <Link href={`/admin/meetings/${m.id}/edit`} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.schoolName}</p>
                  <p className="text-sm text-muted-foreground">{m.type.name}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-medium">{m.date}</p>
                  <Badge variant="outline" className="mt-1">{m.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
            <p>No upcoming meetings scheduled.</p>
             <Button variant="link" asChild><Link href="/admin/meetings/new">Schedule one now</Link></Button>
        </div>
      )}
    </DashboardCard>
  )
}
