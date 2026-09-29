/**
 * @fileOverview Messaging Pipeline Baseline Regression Test (Phase 0)
 *
 * Validates the baseline behavior of the messaging pipeline:
 * 1. Strict single-source-of-truth variable resolution via FieldsVariablesService.
 * 2. Suppression checking (email, SMS, WhatsApp) with query-aware mock testing:
 *    - Positive match (suppressed recipient -> true)
 *    - Negative match (clean recipient -> false)
 *    - Expired snooze self-healing (deletes doc and returns false)
 *    - Unexpired snooze (returns true)
 *    - Fail-open resilience (database failure -> logs and returns false)
 * 3. DomainEvent generation for dispatched and suppressed messages.
 * 4. Strict typing compliance (zero any / any[]).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import { isSuppressed } from '@/lib/suppression-service';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { DataResolutionContext } from '@/lib/types/variables';
import messagingFixture from './fixtures/messaging-pipeline.fixture.json';

interface MockSuppressionDoc {
  id: string;
  recipient: string;
  workspaceId: string;
  channel: string;
  status: string;
  reason?: string;
  snoozedUntil?: string;
}

let mockSuppressions: MockSuppressionDoc[] = [];
let simulateDatabaseError = false;

// Query-aware mock for firebase-admin
vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: (colName: string) => {
        if (colName === 'suppressions') {
          let currentList = [...mockSuppressions];
          const queryObj = {
            where: (field: string, op: string, val: unknown) => {
              if (simulateDatabaseError) {
                return queryObj;
              }
              if (op === '==') {
                currentList = currentList.filter(
                  (doc) => (doc as unknown as Record<string, unknown>)[field] === val
                );
              } else if (op === 'in' && Array.isArray(val)) {
                currentList = currentList.filter((doc) =>
                  val.includes((doc as unknown as Record<string, unknown>)[field])
                );
              }
              return queryObj;
            },
            get: async () => {
              if (simulateDatabaseError) {
                throw new Error('Simulated Firestore Unavailable Error (503)');
              }
              return {
                empty: currentList.length === 0,
                docs: currentList.map((doc) => ({
                  id: doc.id,
                  data: () => doc,
                  ref: {
                    delete: async () => {
                      mockSuppressions = mockSuppressions.filter((s) => s.id !== doc.id);
                    },
                  },
                })),
              };
            },
          };
          return queryObj;
        }

        return {
          where: () => ({
            where: () => ({
              get: async () => ({ empty: true, docs: [] }),
            }),
            get: async () => ({ empty: true, docs: [] }),
          }),
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
          }),
          get: async () => ({ empty: true, docs: [] }),
        };
      },
    },
  };
});

describe('Messaging Pipeline Behavioral Baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simulateDatabaseError = false;
    mockSuppressions = [
      {
        id: 'sup-1',
        recipient: 'blocked@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
        status: 'active',
        reason: 'unsubscribed',
      },
      {
        id: 'sup-2',
        recipient: '+233201112222',
        workspaceId: 'global',
        channel: 'sms',
        status: 'active',
        reason: 'dnc_requested',
      },
      {
        id: 'sup-snooze-expired',
        recipient: 'snooze_expired@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
        status: 'active',
        reason: 'snoozed',
        snoozedUntil: new Date(Date.now() - 3600_000).toISOString(), // 1 hour in the past
      },
      {
        id: 'sup-snooze-active',
        recipient: 'snooze_active@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
        status: 'active',
        reason: 'snoozed',
        snoozedUntil: new Date(Date.now() + 3600_000 * 24).toISOString(), // 24 hours in the future
      },
    ];
  });

  it('loads and validates frozen baseline snapshot fixture', () => {
    expect(messagingFixture.version).toBe('1.0.0');
    expect(messagingFixture.sampleTokens).toContain('{{contact_name}}');
    expect(messagingFixture.suppressionChannels).toContain('whatsapp');
    expect(messagingFixture.pipelineEvents).toContain('messaging.message.suppressed');
  });

  describe('FieldsVariablesService Variable Replacement (SSOT)', () => {
    it('resolves fixture template strictly via FieldsVariablesService without raw regex leakage', async () => {
      const template = messagingFixture.sampleTemplate;
      const context: DataResolutionContext = {
        workspaceId: 'ws-test-1',
        entityId: 'ent-123',
        extraVars: {
          contact_name: 'Kwame Mensah',
          entity_name: 'SmartSapp Academy',
          verification_code: '482910',
        },
      };

      const resolved = await FieldsVariablesService.resolveTemplateVariables(template, context);

      expect(resolved).toBe(messagingFixture.expectedResolved);
      expect(resolved).not.toContain('{{');
      expect(resolved).not.toContain('}}');
    });

    it('gracefully handles missing variables with empty strings without crashing', async () => {
      const template = 'Dear {{contact_name}}, your appointment is at {{meeting_time}}. Details: {{missing_field}}';
      const context: DataResolutionContext = {
        workspaceId: 'ws-test-1',
        extraVars: {
          contact_name: 'Kwame Mensah',
          meeting_time: '10:00 AM',
        },
      };

      const resolved = await FieldsVariablesService.resolveTemplateVariables(template, context);

      expect(resolved).toBe('Dear Kwame Mensah, your appointment is at 10:00 AM. Details: ');
    });
  });

  describe('Suppression Pipeline & Query Filters', () => {
    it('returns true for blocked recipient on active channel suppression (positive test)', async () => {
      const suppressed = await isSuppressed({
        recipient: 'blocked@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
      });

      expect(suppressed).toBe(true);
    });

    it('returns false for clean recipient not present in suppressions (negative test)', async () => {
      const suppressed = await isSuppressed({
        recipient: 'clean_recipient@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
      });

      expect(suppressed).toBe(false);
    });

    it('returns false and self-heals (deletes doc) for expired snooze records', async () => {
      const suppressed = await isSuppressed({
        recipient: 'snooze_expired@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
      });

      expect(suppressed).toBe(false);
      // The expired snooze doc should have been self-healed (deleted)
      expect(mockSuppressions.some((s) => s.id === 'sup-snooze-expired')).toBe(false);
    });

    it('returns true for active (unexpired) snooze records', async () => {
      const suppressed = await isSuppressed({
        recipient: 'snooze_active@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
      });

      expect(suppressed).toBe(true);
      expect(mockSuppressions.some((s) => s.id === 'sup-snooze-active')).toBe(true);
    });

    it('fails open (returns false) when database throws an exception', async () => {
      simulateDatabaseError = true;

      const suppressed = await isSuppressed({
        recipient: 'blocked@example.com',
        workspaceId: 'ws-test-1',
        channel: 'email',
      });

      // Fail-open guarantees delivery pipeline is not paralyzed by transient DB errors
      expect(suppressed).toBe(false);
    });

    it('emits a DomainEvent when delivery is suppressed', () => {
      const suppressionEvent = createDomainEvent({
        type: 'messaging.message.suppressed',
        organizationId: 'org-test',
        workspaceId: 'ws-test-1',
        actor: {
          type: 'system',
          id: 'messaging-guard',
        },
        entity: {
          type: 'contact',
          id: 'contact-blocked-99',
        },
        payload: {
          channel: 'email',
          recipient: 'blocked@example.com',
          reason: 'recipient_unsubscribed',
          suppressionId: 'sup-1',
        },
        correlationId: 'msg-trace-001',
        source: 'messaging_pipeline',
      });

      expect(suppressionEvent.type).toBe('messaging.message.suppressed');
      expect(suppressionEvent.payload.channel).toBe('email');
      expect(suppressionEvent.payload.reason).toBe('recipient_unsubscribed');
      expect(suppressionEvent.version).toBe('1.0.0');
    });

    it('emits a DomainEvent when message is successfully dispatched', () => {
      const dispatchEvent = createDomainEvent({
        type: 'messaging.message.dispatched',
        organizationId: 'org-test',
        workspaceId: 'ws-test-1',
        actor: {
          type: 'agent',
          id: 'agent-sdr-01',
        },
        entity: {
          type: 'message',
          id: 'msg-out-555',
        },
        payload: {
          channel: 'whatsapp',
          recipient: '+233244000111',
          templateId: 'tmpl-welcome-gh',
          resolvedLength: 85,
        },
        correlationId: 'msg-trace-002',
        source: 'messaging_pipeline',
      });

      expect(dispatchEvent.type).toBe('messaging.message.dispatched');
      expect(dispatchEvent.payload.channel).toBe('whatsapp');
      expect(dispatchEvent.actor.type).toBe('agent');
    });
  });
});
