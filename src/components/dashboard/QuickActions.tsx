// components/dashboard/QuickActions.tsx
import DashboardCard from "./DashboardCard"
import { Button } from "@/components/ui/button"
import { PlusCircle, CalendarPlus, FilePlus, Upload } from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  return (
    <DashboardCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/admin/schools/new">
            <PlusCircle className="h-4 w-4" /> Add School
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2">
           <Link href="/admin/meetings/new">
            <CalendarPlus className="h-4 w-4" /> Schedule Meeting
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/admin/surveys/new">
            <FilePlus className="h-4 w-4" /> Create Survey
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2">
           <Link href="/admin/media">
            <Upload className="h-4 w-4" /> Upload Media
          </Link>
        </Button>
      </div>
    </DashboardCard>
  )
}
