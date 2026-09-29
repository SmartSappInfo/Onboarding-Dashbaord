/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Phase 4 CRM Document Links, Canonical Event Taxonomy,
 *    Event-Derived Analytics, and Reminder Configuration Schemas.
 * 2. Invariants Tested:
 *    - Strict Zod validation on canonical document domain events (13 event types).
 *    - CRM master entity and deal association links with relationship types.
 *    - Pure analytics metric aggregation structures and funnel schemas.
 *    - Reminder schedule configuration with multi-channel and quiet-hour definitions.
 *    - Zero-tolerance for unvalidated types and strict typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentDomainEventTypeSchema,
  DocumentDomainEventSchema,
  CrmDocumentLinkSchema,
  SigningAnalyticsMetricSchema,
  ReminderScheduleConfigSchema,
} from '@/lib/types/document-signing';

describe('Phase 4 CRM & Analytics Domain Schemas (P4.1 & P4.3)', () => {
  describe('DocumentDomainEventTypeSchema & DocumentDomainEventSchema', () => {
    it('validates all canonical document domain event types', () => {
      const validTypes = [
        'document.template_published',
        'document.instance_created',
        'document.dispatched',
        'document.viewed',
        'signing.recipient_completed',
        'signing.recipient_declined',
        'signing.envelope_completed',
        'contract.created',
        'contract.amended',
        'contract.renewed',
        'contract.renewal_due',
        'contract.terminated',
        'obligation.fulfilled',
      ] as const;

      for (const type of validTypes) {
        expect(DocumentDomainEventTypeSchema.parse(type)).toBe(type);
      }

      expect(() => DocumentDomainEventTypeSchema.parse('invalid.event_type')).toThrow();
    });

    it('validates a complete DocumentDomainEvent record', () => {
      const validEvent = {
        id: 'evt_123456789',
        workspaceId: 'ws_enterprise_1',
        type: 'signing.envelope_completed',
        envelopeId: 'env_abc_999',
        contractId: 'ctr_xyz_111',
        dealId: 'deal_acme_456',
        entityId: 'ent_acme_corp',
        contactId: 'ct_john_doe',
        recipientId: 'rec_signer_1',
        actorId: 'usr_admin_1',
        metadata: {
          ipAddress: '192.168.1.1',
          source: 'signature_portal',
          totalSigners: 2,
        },
        timestamp: new Date().toISOString(),
      };

      const parsed = DocumentDomainEventSchema.parse(validEvent);
      expect(parsed.id).toBe('evt_123456789');
      expect(parsed.type).toBe('signing.envelope_completed');
      expect(parsed.dealId).toBe('deal_acme_456');
    });

    it('rejects events without required core attributes', () => {
      expect(() =>
        DocumentDomainEventSchema.parse({
          id: 'evt_invalid',
          type: 'document.dispatched',
          // missing workspaceId, actorId, timestamp
        })
      ).toThrow();
    });
  });

  describe('CrmDocumentLinkSchema', () => {
    it('validates valid CRM document link relations', () => {
      const validLink = {
        id: 'link_deal_contract_1',
        workspaceId: 'ws_prod',
        contractId: 'ctr_001',
        dealId: 'deal_999',
        entityId: 'ent_777',
        relationshipType: 'primary',
        createdAt: new Date().toISOString(),
      };

      const parsed = CrmDocumentLinkSchema.parse(validLink);
      expect(parsed.relationshipType).toBe('primary');
      expect(parsed.contractId).toBe('ctr_001');
    });

    it('enforces valid relationshipType enum', () => {
      expect(() =>
        CrmDocumentLinkSchema.parse({
          id: 'link_invalid',
          workspaceId: 'ws_prod',
          dealId: 'deal_1',
          relationshipType: 'arbitrary_string',
          createdAt: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  describe('SigningAnalyticsMetricSchema', () => {
    it('validates a complete analytics metric aggregation snapshot', () => {
      const validMetrics = {
        completionRate: 85.5,
        medianHoursToSign: 4.2,
        averageHoursToSign: 6.8,
        totalEnvelopes: 120,
        completedCount: 102,
        declinedCount: 6,
        voidedCount: 4,
        expiredCount: 2,
        inProgressCount: 6,
        totalContractValue: 2450000,
        currency: 'USD',
        funnel: [
          { stage: 'Sent', count: 120, percentage: 100 },
          { stage: 'Opened', count: 114, percentage: 95 },
          { stage: 'Signed', count: 102, percentage: 85 },
        ],
        signerBottlenecks: [
          { role: 'signer', averageTurnaroundHours: 3.5, count: 102 },
          { role: 'countersigner', averageTurnaroundHours: 12.1, count: 48 },
        ],
        freshnessTimestamp: new Date().toISOString(),
      };

      const parsed = SigningAnalyticsMetricSchema.parse(validMetrics);
      expect(parsed.completionRate).toBe(85.5);
      expect(parsed.funnel).toHaveLength(3);
      expect(parsed.signerBottlenecks[1].averageTurnaroundHours).toBe(12.1);
    });

    it('rejects out of bounds completionRate', () => {
      expect(() =>
        SigningAnalyticsMetricSchema.parse({
          completionRate: 150, // exceeds 100
          medianHoursToSign: 5,
          averageHoursToSign: 5,
          totalEnvelopes: 10,
          completedCount: 10,
          declinedCount: 0,
          voidedCount: 0,
          expiredCount: 0,
          inProgressCount: 0,
          totalContractValue: 1000,
          currency: 'USD',
          funnel: [],
          signerBottlenecks: [],
          freshnessTimestamp: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  describe('ReminderScheduleConfigSchema', () => {
    it('validates reminder schedule configuration', () => {
      const validConfig = {
        workspaceId: 'ws_main',
        enabled: true,
        reminderDays: [3, 7, 14],
        channels: ['email', 'sms'],
        renewalAlertDays: [30, 60, 90],
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'America/New_York',
        },
        dealAutoStageAdvance: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 'usr_lead_ops',
      };

      const parsed = ReminderScheduleConfigSchema.parse(validConfig);
      expect(parsed.channels).toContain('email');
      expect(parsed.channels).toContain('sms');
      expect(parsed.quietHours.enabled).toBe(true);
      expect(parsed.reminderDays).toEqual([3, 7, 14]);
    });

    it('rejects unsupported reminder channels', () => {
      expect(() =>
        ReminderScheduleConfigSchema.parse({
          workspaceId: 'ws_main',
          enabled: true,
          reminderDays: [3],
          channels: ['telepathy'],
          renewalAlertDays: [30],
          quietHours: { enabled: false, start: '00:00', end: '00:00', timezone: 'UTC' },
          dealAutoStageAdvance: false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'usr_1',
        })
      ).toThrow();
    });
  });
});
