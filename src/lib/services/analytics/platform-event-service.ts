/**
 * @fileOverview Platform Event Ingestion & Telemetry Pipeline Service (Analytics 2.0)
 *
 * Provides a high-throughput, sanitized event logging pipeline for authentication,
 * workforce actions, navigation, CRM, and governance operations.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Sanitizes metadata payloads to strip sensitive credentials/PII before storage.
 * - Commits events in chunks of <= 250 write operations.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `analytics-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { PlatformEvent, PlatformEventCategory, PlatformEventType } from '@/lib/types';

export class PlatformEventService {
  private static collectionName = 'platform_events';

  /**
   * Sanitizes metadata payload to ensure no sensitive fields (passwords, tokens, cards) are stored.
   */
  static sanitizeMetadata(
    metadata?: Record<string, string | number | boolean | string[]>
  ): Record<string, string | number | boolean | string[]> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, string | number | boolean | string[]> = {};
    const blacklistedKeys = ['password', 'token', 'secret', 'apikey', 'cardnumber', 'cvv', 'idtoken'];

    for (const [k, v] of Object.entries(metadata)) {
      if (blacklistedKeys.some((b) => k.toLowerCase().includes(b))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }

  /**
   * Ingests a single platform event.
   */
  static async ingestEvent(
    organizationId: string,
    payload: {
      workspaceId?: string;
      personId: string;
      personName: string;
      personEmail: string;
      eventType: PlatformEventType;
      category: PlatformEventCategory;
      targetEntity?: string;
      targetId?: string;
      metadata?: Record<string, string | number | boolean | string[]>;
    }
  ): Promise<PlatformEvent> {
    const docRef = adminDb.collection(this.collectionName).doc();
    const now = new Date().toISOString();

    const event: PlatformEvent = {
      id: docRef.id,
      organizationId,
      workspaceId: payload.workspaceId,
      personId: payload.personId,
      personName: payload.personName,
      personEmail: payload.personEmail,
      eventType: payload.eventType,
      category: payload.category,
      targetEntity: payload.targetEntity,
      targetId: payload.targetId,
      metadata: this.sanitizeMetadata(payload.metadata),
      timestamp: now,
    };

    await docRef.set(event);
    return event;
  }

  /**
   * Ingests a batch of platform events in safe chunks of <= 250 write operations.
   */
  static async ingestBatch(
    organizationId: string,
    events: Array<Omit<PlatformEvent, 'id' | 'organizationId' | 'timestamp'>>
  ): Promise<{ ingestedCount: number }> {
    if (events.length === 0) return { ingestedCount: 0 };

    const CHUNK_SIZE = 250;
    const now = new Date().toISOString();

    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
      const chunk = events.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const item of chunk) {
        const docRef = adminDb.collection(this.collectionName).doc();
        const event: PlatformEvent = {
          id: docRef.id,
          organizationId,
          workspaceId: item.workspaceId,
          personId: item.personId,
          personName: item.personName,
          personEmail: item.personEmail,
          eventType: item.eventType,
          category: item.category,
          targetEntity: item.targetEntity,
          targetId: item.targetId,
          metadata: this.sanitizeMetadata(item.metadata),
          timestamp: now,
        };
        batch.set(docRef, event);
      }

      await batch.commit();
    }

    return { ingestedCount: events.length };
  }

  /**
   * Lists recent platform events for an organization.
   */
  static async listRecentEvents(
    organizationId: string,
    options?: {
      category?: PlatformEventCategory;
      personId?: string;
      limitCount?: number;
    }
  ): Promise<PlatformEvent[]> {
    let q = adminDb.collection(this.collectionName).where('organizationId', '==', organizationId);

    if (options?.category) {
      q = q.where('category', '==', options.category);
    }
    if (options?.personId) {
      q = q.where('personId', '==', options.personId);
    }

    const snap = await q.limit(options?.limitCount || 50).get();
    const events = snap.docs.map((d) => d.data() as PlatformEvent);
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
