'use server';

/**
 * @fileOverview Secure Server Actions for Workforce Intelligence & Executive Analytics (Phase 11)
 *
 * Provides cryptographically verified server endpoints for fetching and refreshing
 * pre-aggregated organizational intelligence snapshots.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All actions perform `adminAuth.verifyIdToken()`.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { WorkforceIntelligenceService } from '@/lib/services/workforce-intelligence/workforce-intelligence-service';
import type { WorkforceIntelligenceSnapshot } from '@/lib/types';

async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

export async function getWorkforceIntelligenceSnapshotAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  snapshot?: WorkforceIntelligenceSnapshot;
  error?: string;
}> {
  try {
    await verifyCaller(params.idToken);
    const snapshot = await WorkforceIntelligenceService.getLatestSnapshot(params.organizationId);
    return { success: true, snapshot };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch intelligence snapshot';
    return { success: false, error: msg };
  }
}

export async function refreshWorkforceIntelligenceSnapshotAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  snapshot?: WorkforceIntelligenceSnapshot;
  error?: string;
}> {
  try {
    await verifyCaller(params.idToken);
    const snapshot = await WorkforceIntelligenceService.generateIntelligenceSnapshot(
      params.organizationId
    );
    return { success: true, snapshot };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to refresh intelligence snapshot';
    return { success: false, error: msg };
  }
}
