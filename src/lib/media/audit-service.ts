'use server';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Enterprise Audit Trail Service
 *
 * Implements an immutable, append-only compliance audit trail capturing all critical media operations
 * (asset creation/publishing, experience modifications, CTA gate changes, API key issuance/revocation,
 * and retention policy configurations).
 *
 * ARCHITECTURAL INVARIANTS & COMPLIANCE GUIDANCE (RULE 10):
 * 1. Append-Only Immutability: Documents in `/media_audit_logs` are strictly append-only.
 *    Client-side mutations, updates, and deletes are rejected at both the Firestore security rules and service layer.
 * 2. Diff Tracking: State changes capture serialized `beforeState` and `afterState` to enable exact diff auditing.
 * 3. RFC 4180 Export: Compliance CSV exports properly escape quotes, delimiters, and multiline content.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 80 (Audit Log) & Sec 132 (Phase 9 - Enterprise Platform).
 * - UX Sec 133 (Admin - Audit Log) & Screen 60 (Audit).
 */

import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { MediaAuditLog, MediaAuditResourceType } from '@/lib/types/media-2.0';

export interface AuditLogQueryOptions {
  resourceType?: MediaAuditResourceType;
  actorId?: string;
  limitCount?: number;
}

/**
 * Appends an immutable audit log entry.
 * Can be called from any server action or mutation pipeline.
 */
export async function logMediaAuditEventAction(
  workspaceId: string,
  entry: Omit<MediaAuditLog, 'id' | 'workspaceId' | 'timestamp'>
): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    if (!workspaceId || !entry.action || !entry.resourceType) {
      return { success: false, error: 'Workspace ID, action, and resource type are required.' };
    }

    const id = `audit_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const record: MediaAuditLog = {
      ...entry,
      id,
      workspaceId,
      timestamp,
    };

    await adminDb.collection('media_audit_logs').doc(id).set(record);

    return { success: true, logId: id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to write audit log entry.';
    return { success: false, error: msg };
  }
}

/**
 * Queries audit log records for a workspace with optional resource-type and actor filters.
 */
export async function listMediaAuditLogsAction(
  workspaceId: string,
  options?: AuditLogQueryOptions
): Promise<{ success: boolean; logs?: MediaAuditLog[]; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const limitCount = options?.limitCount || 50;
    let query = adminDb
      .collection('media_audit_logs')
      .where('workspaceId', '==', workspaceId);

    if (options?.resourceType) {
      query = query.where('resourceType', '==', options.resourceType);
    }

    if (options?.actorId) {
      query = query.where('actorId', '==', options.actorId);
    }

    const snap = await query.orderBy('timestamp', 'desc').limit(limitCount).get();
    const logs: MediaAuditLog[] = snap.docs.map((d) => d.data() as MediaAuditLog);

    return { success: true, logs };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to query audit logs.';
    return { success: false, error: msg };
  }
}

/**
 * Exports audit logs to an RFC 4180 compliant CSV string for compliance reporting.
 */
export async function exportMediaAuditLogsCsvAction(
  workspaceId: string,
  options?: AuditLogQueryOptions
): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    const result = await listMediaAuditLogsAction(workspaceId, { ...options, limitCount: 500 });
    if (!result.success || !result.logs) {
      return { success: false, error: result.error || 'No audit records available.' };
    }

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Timestamp',
      'Action',
      'Resource Type',
      'Resource ID',
      'Resource Title',
      'Actor Name',
      'Actor Email',
      'Reason',
      'IP Address',
      'Request ID',
    ];

    const rows = result.logs.map((l) => [
      escapeCsv(l.timestamp),
      escapeCsv(l.action),
      escapeCsv(l.resourceType),
      escapeCsv(l.resourceId),
      escapeCsv(l.resourceTitle),
      escapeCsv(l.actorName),
      escapeCsv(l.actorEmail),
      escapeCsv(l.reason || ''),
      escapeCsv(l.ipAddress || ''),
      escapeCsv(l.requestId || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    return { success: true, csv: csvContent };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to export audit logs.';
    return { success: false, error: msg };
  }
}
