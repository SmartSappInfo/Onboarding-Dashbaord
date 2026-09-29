'use server';

/**
 * {{Org_name}} Experience Platform — Unified Analytics & Intelligence Server Actions
 *
 * Strongly typed Next.js Server Actions for retrieving cached analytics snapshots,
 * triggering on-demand statistical recalculation, and revalidating studio pages.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a): staff only via `requirePortalAdmin`; the
 * organization comes from the portal (the `organizationId` argument is ignored).
 */

import { revalidatePath } from 'next/cache';
import { PortalAnalyticsService } from '@/lib/services/portal-analytics-service';
import { getErrorMessage } from '@/lib/errors/report-error';
import { portalAuthErrorMessage, requirePortalAdmin } from '@/lib/auth/require-portal-access';
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
  _organizationId: string,
  period: AnalyticsPeriod = 'all_time'
): Promise<ActionResponse<PortalAnalyticsSnapshot>> {
  try {
    const { portal } = await requirePortalAdmin(portalId);
    const snapshot = await PortalAnalyticsService.getPortalAnalyticsSnapshot(
      portalId,
      portal.organizationId,
      period,
      false
    );
    return { success: true, data: snapshot };
  } catch (err: unknown) {
    return { success: false, error: portalAuthErrorMessage(err) ?? (getErrorMessage(err) || 'Failed to retrieve portal analytics.') };
  }
}

// ── 2. Force Refresh Portal Analytics Snapshot Action ────────────────────────

export async function refreshPortalAnalyticsAction(
  portalId: string,
  _organizationId: string,
  portalSlug?: string
): Promise<ActionResponse<PortalAnalyticsSnapshot>> {
  try {
    const { portal } = await requirePortalAdmin(portalId);
    const snapshot = await PortalAnalyticsService.getPortalAnalyticsSnapshot(
      portalId,
      portal.organizationId,
      'all_time',
      true
    );

    if (portalSlug) {
      revalidatePath(`/admin/portals/${portalId}`);
    }

    return { success: true, data: snapshot };
  } catch (err: unknown) {
    return { success: false, error: portalAuthErrorMessage(err) ?? (getErrorMessage(err) || 'Failed to refresh portal analytics.') };
  }
}
