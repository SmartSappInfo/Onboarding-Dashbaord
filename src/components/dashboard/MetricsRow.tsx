import * as React from 'react';
import { MetricCard } from "./MetricCard"
import { School, CalendarDays, FileText, BarChart2 } from "lucide-react"

export function MetricsRow({ 
  data,
  terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
  data: any,
  terminology?: { singular: string, plural: string }
}) {
  return (
    <>
      <MetricCard title={`Total ${terminology.plural}`} value={data.totalSchools} href="/admin/entities" icon={School} />
      <MetricCard title="Upcoming Meetings" value={data.upcomingMeetings} href="/admin/meetings" icon={CalendarDays} />
      <MetricCard title="Published Surveys" value={data.publishedSurveys} href="/admin/surveys" icon={FileText} />
      <MetricCard title="Data Metrics" value={data.totalResponses} href="/admin/surveys" icon={BarChart2} />
    </>
  )
}
