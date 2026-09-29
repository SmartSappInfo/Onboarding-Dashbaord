/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Phase 2 Document Signing Domain Schemas & Contracts (P2.1).
 * 2. Invariants Tested:
 *    - Strict Zod validation on Envelopes, Recipients, Roles, Statuses, and Fields.
 *    - Role state machines & routing mode enumerations.
 *    - Zero-tolerance for unvalidated types (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  RecipientRoleSchema,
  RecipientStatusSchema,
  EnvelopeRoutingModeSchema,
  EnvelopeStatusSchema,
  DocumentFieldDefinitionSchema,
  EnvelopeRecipientSchema,
  SigningEnvelopeSchema,
} from '@/lib/types/document-signing';

describe('Document Signing Domain Schemas (P2.1)', () => {
  describe('Enumerations & Value Objects', () => {
    it('validates supported recipient roles', () => {
      expect(RecipientRoleSchema.parse('signer')).toBe('signer');
      expect(RecipientRoleSchema.parse('approver')).toBe('approver');
      expect(RecipientRoleSchema.parse('countersigner')).toBe('countersigner');
      expect(RecipientRoleSchema.parse('viewer')).toBe('viewer');
      expect(() => RecipientRoleSchema.parse('superadmin')).toThrow();
    });

    it('validates recipient statuses', () => {
      expect(RecipientStatusSchema.parse('pending')).toBe('pending');
      expect(RecipientStatusSchema.parse('invited')).toBe('invited');
      expect(RecipientStatusSchema.parse('opened')).toBe('opened');
      expect(RecipientStatusSchema.parse('signed')).toBe('signed');
      expect(RecipientStatusSchema.parse('declined')).toBe('declined');
      expect(RecipientStatusSchema.parse('reassigned')).toBe('reassigned');
      expect(() => RecipientStatusSchema.parse('unknown_status')).toThrow();
    });

    it('validates envelope routing modes', () => {
      expect(EnvelopeRoutingModeSchema.parse('sequential')).toBe('sequential');
      expect(EnvelopeRoutingModeSchema.parse('parallel')).toBe('parallel');
      expect(EnvelopeRoutingModeSchema.parse('mixed')).toBe('mixed');
      expect(() => EnvelopeRoutingModeSchema.parse('circular')).toThrow();
    });

    it('validates envelope lifecycle statuses', () => {
      expect(EnvelopeStatusSchema.parse('draft')).toBe('draft');
      expect(EnvelopeStatusSchema.parse('sent')).toBe('sent');
      expect(EnvelopeStatusSchema.parse('in_progress')).toBe('in_progress');
      expect(EnvelopeStatusSchema.parse('completed')).toBe('completed');
      expect(EnvelopeStatusSchema.parse('declined')).toBe('declined');
      expect(EnvelopeStatusSchema.parse('voided')).toBe('voided');
      expect(() => EnvelopeStatusSchema.parse('deleted')).toThrow();
    });
  });

  describe('DocumentFieldDefinitionSchema', () => {
    it('parses valid field definition with role assignment and percentage coordinates', () => {
      const field = {
        id: 'field_sig_1',
        key: 'primary_signature',
        label: 'Client Signature',
        type: 'signature',
        page: 1,
        x: 10.5,
        y: 80.0,
        width: 35.0,
        height: 12.0,
        required: true,
        assignedRole: 'signer',
      };

      const parsed = DocumentFieldDefinitionSchema.parse(field);
      expect(parsed.id).toBe('field_sig_1');
      expect(parsed.assignedRole).toBe('signer');
      expect(parsed.required).toBe(true);
    });

    it('rejects field definition with out-of-bounds coordinates (> 100%)', () => {
      const field = {
        id: 'field_invalid',
        key: 'bad_coord',
        type: 'text',
        page: 1,
        x: 105.0, // Invalid: exceeds 100%
        y: 50.0,
        width: 20.0,
        height: 10.0,
      };

      expect(() => DocumentFieldDefinitionSchema.parse(field)).toThrow();
    });
  });

  describe('EnvelopeRecipientSchema', () => {
    it('validates complete recipient payload with token hash and metadata', () => {
      const recipient = {
        id: 'rec_123',
        workspaceId: 'ws_demo',
        envelopeId: 'env_456',
        role: 'signer',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        routingOrder: 1,
        status: 'pending',
        tokenHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const parsed = EnvelopeRecipientSchema.parse(recipient);
      expect(parsed.id).toBe('rec_123');
      expect(parsed.role).toBe('signer');
      expect(parsed.routingOrder).toBe(1);
    });

    it('rejects recipient with invalid email address', () => {
      const invalidRecipient = {
        id: 'rec_bad',
        workspaceId: 'ws_demo',
        envelopeId: 'env_456',
        role: 'signer',
        name: 'Bad Email',
        email: 'not-an-email',
        routingOrder: 1,
        status: 'pending',
        tokenHash: 'hash123',
        tokenExpiresAt: new Date().toISOString(),
      };

      expect(() => EnvelopeRecipientSchema.parse(invalidRecipient)).toThrow();
    });

    it('rejects non-positive routingOrder', () => {
      const invalidRecipient = {
        id: 'rec_bad',
        workspaceId: 'ws_demo',
        envelopeId: 'env_456',
        role: 'signer',
        name: 'Jane',
        email: 'jane@example.com',
        routingOrder: 0, // Invalid: must be >= 1
        status: 'pending',
        tokenHash: 'hash123',
        tokenExpiresAt: new Date().toISOString(),
      };

      expect(() => EnvelopeRecipientSchema.parse(invalidRecipient)).toThrow();
    });
  });

  describe('SigningEnvelopeSchema', () => {
    it('validates a complete multi-party envelope with sequential routing', () => {
      const envelope = {
        id: 'env_master_001',
        workspaceId: 'ws_demo',
        title: 'Master Institutional Agreement',
        status: 'in_progress',
        templateId: 'tmpl_annual_01',
        templateVersionId: 'v1.0.0',
        dealId: 'deal_enterprise_789',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        recipients: [
          {
            id: 'rec_client_1',
            workspaceId: 'ws_demo',
            envelopeId: 'env_master_001',
            role: 'signer',
            name: 'Client Signatory',
            email: 'client@company.com',
            routingOrder: 1,
            status: 'pending',
            tokenHash: 'hash_token_1',
            tokenExpiresAt: new Date(Date.now() + 864000000).toISOString(),
          },
          {
            id: 'rec_counsel_2',
            workspaceId: 'ws_demo',
            envelopeId: 'env_master_001',
            role: 'countersigner',
            name: 'Legal Counsel',
            email: 'legal@enterprise.com',
            routingOrder: 2,
            status: 'pending',
            tokenHash: 'hash_token_2',
            tokenExpiresAt: new Date(Date.now() + 864000000).toISOString(),
          },
        ],
        documentStoragePath: 'agreements/ws_demo/env_master_001_initial.pdf',
        preExecutionSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        expiresAt: new Date(Date.now() + 1209600000).toISOString(),
        createdBy: 'usr_sales_lead',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = SigningEnvelopeSchema.parse(envelope);
      expect(parsed.id).toBe('env_master_001');
      expect(parsed.recipients).toHaveLength(2);
      expect(parsed.routingMode).toBe('sequential');
      expect(parsed.currentRoutingOrder).toBe(1);
    });

    it('rejects envelope with missing title or invalid status', () => {
      const invalidEnvelope = {
        id: 'env_missing_title',
        workspaceId: 'ws_demo',
        title: '', // Invalid
        status: 'non_existent_status',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        recipients: [],
        documentStoragePath: 'path.pdf',
        preExecutionSha256: 'hash',
        expiresAt: new Date().toISOString(),
        createdBy: 'usr_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => SigningEnvelopeSchema.parse(invalidEnvelope)).toThrow();
    });
  });
});
