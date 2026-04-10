
import { MetricCard } from "./MetricCard"
import { School, CalendarDays, FileText, BarChart2 } from "lucide-react"

export function MetricsRow({ data }: { data: any }) {
  return (
    <>
      <MetricCard label="Total Schools" value={data.totalSchools} href="/admin/entities" icon={School} />
      <MetricCard label="Upcoming Meetings" value={data.upcomingMeetings} href="/admin/meetings" icon={CalendarDays} />
      <MetricCard label="Published Surveys" value={data.publishedSurveys} href="/admin/surveys" icon={FileText} />
      <MetricCard label="Total Responses" value={data.totalResponses} href="/admin/surveys" icon={BarChart2} />
    </>
  )
}
