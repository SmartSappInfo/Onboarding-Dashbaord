// components/dashboard/MetricsRow.tsx
import { MetricCard } from "./MetricCard"
import { School, CalendarDays, FileText, BarChart2 } from "lucide-react"

export function MetricsRow({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Total Schools" value={data.totalSchools} href="/admin/schools" icon={School} />
      <MetricCard label="Upcoming Meetings" value={data.upcomingMeetings} href="/admin/meetings" icon={CalendarDays} />
      <MetricCard label="Published Surveys" value={data.publishedSurveys} href="/admin/surveys" icon={FileText} />
      <MetricCard label="Total Responses" value={data.totalResponses} href="/admin/surveys" icon={BarChart2} />
    </div>
  )
}
