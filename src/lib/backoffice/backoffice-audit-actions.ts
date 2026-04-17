'use server';

import { adminDb } from '../firebase-admin';
import type { PlatformAuditLog } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Audit Actions
// Fetching historical audit trails for governance visibility. 
// Writing is handled strictly by `logBackofficeAction` in audit-logger.ts.
// ─────────────────────────────────────────────────

export async function fetchAuditLogs(options?: {
  limit?: number;
  actorId?: string;
  resourceType?: string;
  actionPrefix?: string;
}): Promise<{
  success: boolean;
  data?: PlatformAuditLog[];
  error?: string;
}> {
  try {
    let query: FirebaseFirestore.Query = adminDb.collection('platform_audit_logs');

    if (options?.actorId) {
      query = query.where('actor.userId', '==', options.actorId);
    }
    if (options?.resourceType) {
      query = query.where('resourceType', '==', options.resourceType);
    }

    query = query.orderBy('timestamp', 'desc');

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(200); // Guard rails
    }

    const snap = await query.get();
    let logs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformAuditLog));

    // In-memory filter for actionPrefix if requested (due to Firestore limitations on substring)
    if (options?.actionPrefix) {
       const p = options.actionPrefix.toLowerCase();
       logs = logs.filter(lg => lg.action.toLowerCase().includes(p));
    }

    return { success: true, data: logs };
  } catch (error: any) {
    console.error('[BACKOFFICE_AUDIT] fetchAuditLogs failed:', error);
    return { success: false, error: error.message };
  }
}
