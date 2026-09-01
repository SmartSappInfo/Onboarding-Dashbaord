/**
 * @fileOverview Immutable Security Audit Logging Service (Governance 2.0)
 *
 * Provides an append-only audit trail capturing privilege escalations,
 * policy overrides, JIT grants, session revocations, and certification decisions.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Immutable records: documents are append-only without delete/update mutations.
 * - Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { SecurityAuditEvent } from '@/lib/types';

export class SecurityAuditService {
  private static collectionName = 'security_audit_events';

  /**
   * Appends an immutable security audit event.
   */
  static async logEvent(
    organizationId: string,
    payload: Omit<SecurityAuditEvent, 'id' | 'organizationId' | 'timestamp'>
  ): Promise<SecurityAuditEvent> {
    const docRef = adminDb.collection(this.collectionName).doc();
    const event: SecurityAuditEvent = {
      ...payload,
      id: docRef.id,
      organizationId,
      timestamp: new Date().toISOString(),
    };

    await docRef.set(event);
    return event;
  }

  /**
   * Lists security audit events for an organization.
   */
  static async listEvents(
    organizationId: string,
    limitCount: number = 50,
    eventType?: SecurityAuditEvent['eventType']
  ): Promise<SecurityAuditEvent[]> {
    let q = adminDb
      .collection(this.collectionName)
      .where('organizationId', '==', organizationId);

    if (eventType) {
      q = q.where('eventType', '==', eventType);
    }

    const snap = await q.limit(limitCount).get();
    const events = snap.docs.map((d) => d.data() as SecurityAuditEvent);
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
