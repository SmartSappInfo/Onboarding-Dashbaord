/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose & Domain Placement:
 *    Authoritative Server-Side Query Service for Lifecycle Analytics (P4.4 Server Layer).
 *    Safely interacts with Firestore Admin SDK without leaking Node.js built-ins to client components.
 * 2. Invariants Enforced:
 *    - Query Bounding (FM-P4-06): Firestore queries strictly bound result sets using limit(100) and time windowing.
 *    - Tenant Scoping (Rule 5 & Rule 8): All database queries mandate `workspaceId`.
 * 3. Strict Typing (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`. Output validates against `SigningAnalyticsMetricSchema`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  SigningAnalyticsMetric,
  SigningEnvelope,
  ContractRecord,
} from '@/lib/types/document-signing';
import { computeSigningAnalyticsSummary } from './signing-analytics-service';

/**
 * Fetches analytics summary for a workspace with bounded queries (FM-P4-06).
 */
export async function fetchWorkspaceSigningAnalytics(
  workspaceId: string,
  options?: { timeWindowDays?: number }
): Promise<SigningAnalyticsMetric> {
  if (!workspaceId) {
    throw new Error('[SigningAnalytics] workspaceId is mandatory.');
  }

  const timeWindowDays = options?.timeWindowDays || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
  const cutoffIso = cutoffDate.toISOString();

  // Query Envelopes bounded by workspace and time window (limit 100)
  const envelopesSnap = await adminDb
    .collection('signing_envelopes')
    .where('workspaceId', '==', workspaceId)
    .where('createdAt', '>=', cutoffIso)
    .limit(100)
    .get();

  const envelopes = envelopesSnap.docs.map((d) => d.data() as SigningEnvelope);

  // Query Contracts bounded by workspace (limit 100)
  const contractsSnap = await adminDb
    .collection('contracts')
    .where('workspaceId', '==', workspaceId)
    .limit(100)
    .get();

  const contracts = contractsSnap.docs.map((d) => d.data() as ContractRecord);

  return computeSigningAnalyticsSummary(envelopes, contracts);
}
