// components/dashboard/UpcomingMeetings.tsx
import DashboardCard from "./DashboardCard"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export function UpcomingMeetings({ meetings }: { meetings: any[] }) {
  return (
    <DashboardCard title="Upcoming Meetings">
      {meetings.length > 0 ? (
        <ul className="space-y-3">
          {meetings.map(m => (
            <li key={m.id}>
              <Link href={`/admin/meetings/${m.id}/edit`} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
                <div>
                  <p className="font-medium">{m.schoolName}</p>
                  <p className="text-sm text-muted-foreground">{m.type}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">{m.date}</p>
                  <Badge variant="outline" className="mt-1">{m.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No upcoming meetings in the next 7 days.
        </div>
      )}
    </DashboardCard>
  )
}
