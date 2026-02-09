// components/dashboard/QuickActions.tsx
import DashboardCard from "./DashboardCard"
import { Button } from "@/components/ui/button"
import { PlusCircle, CalendarPlus, FilePlus, UploadCloud } from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  return (
    <DashboardCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/admin/schools/new">
            <PlusCircle className="h-4 w-4" /> Add New School
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2" variant="secondary">
           <Link href="/admin/meetings/new">
            <CalendarPlus className="h-4 w-4" /> Schedule Meeting
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2" variant="outline">
          <Link href="/admin/surveys/new">
            <FilePlus className="h-4 w-4" /> Create Survey
          </Link>
        </Button>
        <Button asChild className="w-full justify-start gap-2" variant="ghost">
           <Link href="/admin/media">
            <UploadCloud className="h-4 w-4" /> Upload Media
          </Link>
        </Button>
      </div>
    </DashboardCard>
  )
}
