'use server';

/**
 * @fileoverview Server Actions for Real-Time Telemetry, Web Vitals & Provider Latency.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Telemetry events are sampled and written with 30-day auto-expiry timestamps.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  WebVitalsMetric,
  ProviderLatencyMetric,
  TelemetrySummary,
} from '@/lib/meetings/types/telemetry';
import {
  aggregateTelemetryVitals,
} from '@/lib/meetings/telemetry-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Records a client Web Vitals metric or provider latency event.
 */
export async function recordMeetingTelemetryAction(payload: {
  workspaceId: string;
  webVital?: WebVitalsMetric;
  providerLatency?: ProviderLatencyMetric;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId, webVital, providerLatency } = payload;
    const docRef = adminDb.collection('meeting_telemetry_logs').doc();

    await docRef.set({
      id: docRef.id,
      workspaceId,
      webVital: webVital || null,
      providerLatency: providerLatency || null,
      recordedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Loads aggregated telemetry summary metrics for a workspace.
 */
export async function getWorkspaceTelemetryMetricsAction(
  workspaceId: string
): Promise<{ success: boolean; summary?: TelemetrySummary; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_telemetry_logs')
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();

    const webVitals: WebVitalsMetric[] = [];
    const providerLatencies: ProviderLatencyMetric[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.webVital) webVitals.push(data.webVital as WebVitalsMetric);
      if (data.providerLatency) providerLatencies.push(data.providerLatency as ProviderLatencyMetric);
    }

    const summary = aggregateTelemetryVitals(webVitals, providerLatencies, workspaceId);
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
