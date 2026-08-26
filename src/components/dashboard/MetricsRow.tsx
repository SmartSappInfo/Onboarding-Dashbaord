import * as React from 'react';
import { MetricCard } from "./MetricCard"
import { School, CalendarDays, FileText, BarChart2 } from "lucide-react"

interface MetricsRowData {
  totalSchools?: number;
  upcomingMeetings?: number;
  publishedSurveys?: number;
  totalResponses?: number;
}

export function MetricsRow({ 
  data,
  terminology = { singular: 'Entity', plural: 'Entities' }
}: { 
  data: MetricsRowData;
  terminology?: { singular: string; plural: string };
}) {
  return (
    <>
      <MetricCard key="total" title={`Total ${terminology.plural}`} value={data.totalSchools ?? 0} href="/admin/entities" icon={School} />
      <MetricCard key="meetings" title="Upcoming Meetings" value={data.upcomingMeetings ?? 0} href="/admin/meetings" icon={CalendarDays} />
      <MetricCard key="surveys" title="Published Surveys" value={data.publishedSurveys ?? 0} href="/admin/surveys" icon={FileText} />
      <MetricCard key="metrics" title="Data Metrics" value={data.totalResponses ?? 0} href="/admin/surveys" icon={BarChart2} />
    </>
  );
}
