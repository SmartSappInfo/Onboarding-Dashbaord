'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Platform Observability Server Actions:
 *    Fetches live SLO compliance and system health telemetry for the workspace (PRD Section 87 & Phase 13).
 * 2. Multi-Tenant Verification:
 *    Strictly validates `workspaceId` parameter.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import type {
  DocumentObservabilityMetric,
  DocumentObservabilitySummary,
} from '@/lib/types/document-types';
import {
  summarizeWorkspaceObservability,
  recordObservabilityMetric,
} from './document-observability-service';

export async function getWorkspaceHealthReportAction(
  workspaceId: string
): Promise<{ success: boolean; report?: DocumentObservabilitySummary; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const report = summarizeWorkspaceObservability(workspaceId);
    return { success: true, report };
  } catch (err) {
    console.error('Error fetching workspace health report:', err);
    return { success: false, error: 'Failed to generate observability health report.' };
  }
}

export async function recordObservabilityMetricAction(
  metric: Omit<DocumentObservabilityMetric, 'id' | 'timestamp'>
): Promise<{ success: boolean; metricId?: string; error?: string }> {
  try {
    if (!metric || !metric.workspaceId) {
      return { success: false, error: 'Invalid metric payload.' };
    }

    const saved = recordObservabilityMetric(metric);
    return { success: true, metricId: saved.id };
  } catch (err) {
    console.error('Error recording observability metric:', err);
    return { success: false, error: 'Failed to record observability metric.' };
  }
}
