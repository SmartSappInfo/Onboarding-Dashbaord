'use server';

/**
 * {{Org_name}} Experience Platform — Unified Analytics & Intelligence Server Actions
 *
 * Strongly typed Next.js Server Actions for retrieving cached analytics snapshots,
 * triggering on-demand statistical recalculation, and revalidating studio pages.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { PortalAnalyticsService } from '@/lib/services/portal-analytics-service';
import { getErrorMessage } from '@/lib/errors/report-error';
import type {
  AnalyticsPeriod,
  PortalAnalyticsSnapshot,
} from '@/lib/types/portal-analytics';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

// ── 1. Get Portal Analytics Snapshot Action ──────────────────────────────────

export async function getPortalAnalyticsAction(
  portalId: string,
  organizationId: string,
  period: AnalyticsPeriod = 'all_time'
): Promise<ActionResponse<PortalAnalyticsSnapshot>> {
  try {
    const snapshot = await PortalAnalyticsService.getPortalAnalyticsSnapshot(
      portalId,
      organizationId,
      period,
      false
    );
    return { success: true, data: snapshot };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) || 'Failed to retrieve portal analytics.' };
  }
}

// ── 2. Force Refresh Portal Analytics Snapshot Action ────────────────────────

export async function refreshPortalAnalyticsAction(
  portalId: string,
  organizationId: string,
  portalSlug?: string
): Promise<ActionResponse<PortalAnalyticsSnapshot>> {
  try {
    const snapshot = await PortalAnalyticsService.getPortalAnalyticsSnapshot(
      portalId,
      organizationId,
      'all_time',
      true
    );

    if (portalSlug) {
      revalidatePath(`/admin/portals/${portalId}`);
    }

    return { success: true, data: snapshot };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err) || 'Failed to refresh portal analytics.' };
  }
}
