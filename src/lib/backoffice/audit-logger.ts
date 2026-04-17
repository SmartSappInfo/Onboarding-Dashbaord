'use server';

import { adminDb } from '../firebase-admin';
import type { AuditActor, PlatformAuditLog } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Audit Logger
// Writes immutable audit entries to `platform_audit_logs`.
// Follows Google Cloud Audit Log principles:
//   - who did what, where, and when
//   - before/after snapshots for diffing
//   - immutable once written
// ─────────────────────────────────────────────────

/**
 * Logs a backoffice action to `platform_audit_logs`.
 *
 * This should be called from every server action that mutates data.
 * Uses fire-and-forget pattern — audit log failures should not
 * block the main operation (server-after-nonblocking principle).
 *
 * @param actor - Who performed the action
 * @param action - What was done (e.g., "feature.toggle", "org.suspend")
 * @param resourceType - Type of resource affected (e.g., "feature", "organization")
 * @param resourceId - ID of the affected resource
 * @param options - Additional context
 */
export async function logBackofficeAction(
  actor: AuditActor,
  action: string,
  resourceType: string,
  resourceId: string,
  options: {
    scope?: 'platform' | 'organization' | 'workspace';
    scopeId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    isBulk?: boolean;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const entry: Omit<PlatformAuditLog, 'id'> = {
      actor,
      action,
      resourceType,
      resourceId,
      scope: options.scope ?? 'platform',
      scopeId: options.scopeId,
      before: options.before ?? null,
      after: options.after ?? null,
      timestamp: new Date().toISOString(),
      isBulk: options.isBulk ?? false,
      metadata: options.metadata,
    };

    await adminDb.collection('platform_audit_logs').add(entry);
  } catch (error) {
    // Audit log failures must not crash the calling operation.
    // Log to console for monitoring, but don't re-throw.
    console.error('[BACKOFFICE_AUDIT] Failed to write audit log:', error);
  }
}

/**
 * Fetches audit logs with filtering and pagination.
 *
 * @param filters - Query filters
 * @param limit - Maximum records to return
 * @param startAfter - Cursor for pagination (timestamp)
 */
export async function queryAuditLogs(
  filters: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    scope?: 'platform' | 'organization' | 'workspace';
    scopeId?: string;
    startDate?: string;
    endDate?: string;
  } = {},
  limit: number = 50,
  startAfter?: string
): Promise<{ logs: PlatformAuditLog[]; hasMore: boolean }> {
  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection('platform_audit_logs')
      .orderBy('timestamp', 'desc');

    // Apply filters
    if (filters.actorId) {
      query = query.where('actor.userId', '==', filters.actorId);
    }
    if (filters.action) {
      query = query.where('action', '==', filters.action);
    }
    if (filters.resourceType) {
      query = query.where('resourceType', '==', filters.resourceType);
    }
    if (filters.resourceId) {
      query = query.where('resourceId', '==', filters.resourceId);
    }
    if (filters.scope) {
      query = query.where('scope', '==', filters.scope);
    }
    if (filters.scopeId) {
      query = query.where('scopeId', '==', filters.scopeId);
    }
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    // Pagination
    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    // Fetch one extra to detect "has more"
    const snapshot = await query.limit(limit + 1).get();

    const logs: PlatformAuditLog[] = snapshot.docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformAuditLog));

    return {
      logs,
      hasMore: snapshot.docs.length > limit,
    };
  } catch (error) {
    console.error('[BACKOFFICE_AUDIT] Failed to query audit logs:', error);
    return { logs: [], hasMore: false };
  }
}
