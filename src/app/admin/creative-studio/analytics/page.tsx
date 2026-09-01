/**
 * ARCHITECTURE:
 * Performance Intelligence & Business Attribution Page (Phase 10)
 * 
 * Server Component fetching campaign-level attribution and project performance metrics.
 */

import {
  listWorkspaceCampaignPerformanceAction,
  getProjectPerformanceMetricsAction,
} from '@/app/actions/creative-performance-actions';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const workspaceId = 'default-workspace';

  const [campaignsRes, sampleMetricsRes] = await Promise.all([
    listWorkspaceCampaignPerformanceAction(workspaceId),
    getProjectPerformanceMetricsAction('proj-demo-1'),
  ]);

  const campaigns = campaignsRes.success && campaignsRes.data ? campaignsRes.data : [];
  const sampleMetrics = sampleMetricsRes.success && sampleMetricsRes.data ? [sampleMetricsRes.data] : [];

  return (
    <AnalyticsClient
      initialCampaigns={campaigns}
      sampleMetrics={sampleMetrics}
    />
  );
}
