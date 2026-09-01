/**
 * SmartSapp Forms 2.0: Executive Cross-Form Analytics Page
 * 
 * Server Component fetching executive workspace data.
 */

import React from 'react';
import { cookies } from 'next/headers';
import FormsExecutiveReportClient from './components/FormsExecutiveReportClient';
import { getWorkspaceFormsExecutiveReportAction } from '@/lib/forms/form-reports-actions';

export const metadata = {
  title: 'Forms Executive Analytics | SmartSapp',
  description: 'Cross-form conversion intelligence, revenue attribution, and cohort performance.',
};

export default async function FormsExecutiveReportsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('activeWorkspaceId')?.value || 'default';

  const res = await getWorkspaceFormsExecutiveReportAction({ workspaceId, dateRange: '30d' });

  const report = res.data || {
    workspaceId,
    dateRange: '30d' as const,
    totalForms: 0,
    totalSubmissions: 0,
    totalViews: 0,
    averageCompletionRate: 0,
    totalPipelineRevenue: 0,
    totalClosedWonRevenue: 0,
    totalDealsWon: 0,
    positiveSentimentPercentage: 0,
    topPerformingForms: [],
    cohortComparison: [],
    channelBreakdown: [],
    generatedAt: new Date().toISOString(),
  };

  return <FormsExecutiveReportClient initialReport={report} workspaceId={workspaceId} />;
}
