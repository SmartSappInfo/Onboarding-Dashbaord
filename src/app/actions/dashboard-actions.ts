'use server';

import { getMetricStats, getPipelineStats, getUpcomingMeetings, getLatestSurveys, getRecentActivities } from '@/lib/dashboard-server';
import { adminDb } from '@/lib/firebase-admin';
import { cache } from 'react';

/**
 * We use `cache` to deduplicate requests across different widgets during the same render pass.
 */

const fetchSaasMetrics = cache(async (workspaceId: string) => {
  const stats = await getMetricStats(workspaceId);
  
  // Since we don't have a real billing module yet, we will map Entities to Active Users.
  // In a real SaaS scenario, we would query the 'subscriptions' or 'invoices' collection.
  
  // Fake MRR for demonstration based on entity count ($50 per entity)
  const mrr = stats.totalEntities * 50;
  
  // Fake churn rate (random between 1-5%)
  const churn = 2.4; 

  return {
    mrr: `$${mrr.toLocaleString()}`,
    mrrTrend: '+12%',
    activeUsers: stats.totalEntities.toString(),
    activeUsersTrend: '+5%',
    churnRate: `${churn}%`,
    churnTrend: '-0.5%',
  };
});

export async function getSaasMetrics(workspaceId: string) {
  return fetchSaasMetrics(workspaceId);
}

const fetchPipelineData = cache(async (workspaceId: string) => {
  return await getPipelineStats(workspaceId);
});

export async function getPipelineData(workspaceId: string) {
  return fetchPipelineData(workspaceId);
}

const fetchUpcomingMeetingsData = cache(async (workspaceId: string) => {
  return await getUpcomingMeetings(workspaceId);
});

export async function getUpcomingMeetingsData(workspaceId: string) {
  return fetchUpcomingMeetingsData(workspaceId);
}

const fetchLatestSurveysData = cache(async (workspaceId: string) => {
  return await getLatestSurveys(workspaceId);
});

export async function getLatestSurveysData(workspaceId: string) {
  return fetchLatestSurveysData(workspaceId);
}

const fetchRecentActivitiesData = cache(async (workspaceId: string) => {
  return await getRecentActivities(workspaceId);
});

export async function getRecentActivitiesData(workspaceId: string) {
  return fetchRecentActivitiesData(workspaceId);
}
