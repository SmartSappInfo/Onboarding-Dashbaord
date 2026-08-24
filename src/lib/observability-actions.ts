'use server';

/**
 * @file src/lib/observability-actions.ts
 * @description Next.js Server Actions for Platform Production Hardening & Global Observability.
 * Provides platform health diagnostics and edge CDN cache purging callbacks.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Fast non-blocking health check resolution.
 * - Revalidation tag execution for edge CDN cache purging.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { EdgeCacheStatus, SystemObservabilitySummary } from '@/lib/types';
import { evaluateEdgeCacheStatus, evaluatePlatformHealth } from '@/lib/page-builder/observability-engine';
import { revalidatePath } from 'next/cache';

/**
 * Fetches real-time platform observability metrics and health summary.
 */
export async function fetchPlatformObservabilityAction(): Promise<{
  success: boolean;
  summary?: SystemObservabilitySummary;
  error?: string;
}> {
  try {
    const countSnap = await adminDb.collection('custom_pages').count().get();
    const activePagesCount = countSnap.data().count;

    const summary = evaluatePlatformHealth([], activePagesCount);
    return { success: true, summary };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch observability summary';
    console.error('>>> [OBSERVABILITY] Fetch Failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Purges edge CDN cache tags for a published landing page.
 */
export async function purgeEdgeCacheAction(
  pageId: string,
): Promise<{ success: boolean; status?: EdgeCacheStatus; error?: string }> {
  try {
    if (!pageId) {
      return { success: false, error: 'Page ID is required' };
    }

    // Trigger Next.js Edge CDN revalidation paths
    revalidatePath(`/pages/${pageId}`);
    revalidatePath(`/admin/pages/${pageId}/builder`);

    const cacheStatus = evaluateEdgeCacheStatus(pageId, new Date().toISOString());
    return { success: true, status: cacheStatus };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to purge edge cache';
    console.error('>>> [OBSERVABILITY] Purge Failed:', message);
    return { success: false, error: message };
  }
}
