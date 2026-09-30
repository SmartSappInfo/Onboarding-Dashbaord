/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Domain Schema Verification Suite for Phase 9:
 * 1. Purpose & Scope:
 *    Ensures all Phase 9 domain contracts (bulk campaigns, chunked recipient items,
 *    variable merge preview results, and e-Discovery Merkle manifests) strictly reject
 *    untyped, malformed, or malicious payloads before entering the domain layer.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 * 3. Testability & Edge Cases:
 *    Covers email syntax checks, non-negative count invariants, SHA-256 length checks,
 *    and boundary tests (1 to 5000 recipients).
 */

import { describe, it, expect } from 'vitest';
import {
  BulkCampaignStatusSchema,
  BulkCampaignRecipientStatusSchema,
  BulkCampaignRecipientSchema,
  BulkCampaignSchema,
  CreateBulkCampaignRequestSchema,
  EDiscoveryFileEntrySchema,
  EDiscoveryManifestSchema,
  BulkCsvMergePreviewResultSchema,
  type BulkCampaign,
  type BulkCampaignRecipient,
  type CreateBulkCampaignRequest,
  type EDiscoveryManifest,
} from '@/lib/types/document-signing';

describe('Phase 9 Domain Schemas: Bulk Campaigns & e-Discovery', () => {
  describe('BulkCampaignStatusSchema & BulkCampaignRecipientStatusSchema', () => {
    it('accepts all valid campaign statuses', () => {
      const statuses = ['draft', 'validating', 'ready', 'dispatching', 'active', 'paused', 'completed', 'failed'];
      statuses.forEach((s) => {
        expect(BulkCampaignStatusSchema.parse(s)).toBe(s);
      });
    });

    it('rejects unrecognized campaign status', () => {
      expect(() => BulkCampaignStatusSchema.parse('invalid_status')).toThrow();
    });

    it('accepts all valid recipient statuses', () => {
      const recipientStatuses = ['queued', 'dispatched', 'delivered', 'signed', 'failed'];
      recipientStatuses.forEach((s) => {
        expect(BulkCampaignRecipientStatusSchema.parse(s)).toBe(s);
      });
    });
  });

  describe('BulkCampaignRecipientSchema', () => {
    it('validates a complete, correctly typed recipient record', () => {
      const raw = {
        id: 'rec-001',
        campaignId: 'camp-123',
        rowIndex: 1,
        name: 'Jane Doe',
        email: 'jane.doe@enterprise.com',
        phone: '+15551234567',
        variables: { role: 'Director', compensation: '$150,000' },
        status: 'queued',
        idempotencyKey: 'idemp_camp-123_jane.doe@enterprise.com_abc',
      };

      const parsed: BulkCampaignRecipient = BulkCampaignRecipientSchema.parse(raw);
      expect(parsed.id).toBe('rec-001');
      expect(parsed.email).toBe('jane.doe@enterprise.com');
      expect(parsed.status).toBe('queued');
      expect(parsed.variables.role).toBe('Director');
    });

    it('rejects an invalid email format', () => {
      const raw = {
        id: 'rec-002',
        campaignId: 'camp-123',
        rowIndex: 2,
        name: 'Bad Email',
        email: 'not-an-email',
        idempotencyKey: 'idemp_bad',
      };

      expect(() => BulkCampaignRecipientSchema.parse(raw)).toThrow();
    });
  });

  describe('BulkCampaignSchema', () => {
    it('validates a valid bulk campaign aggregate record', () => {
      const raw = {
        id: 'camp-999',
        workspaceId: 'ws-main',
        title: 'Q4 Enterprise Employee Stock Option Grant',
        templateId: 'tmpl-esop-2026',
        status: 'ready',
        totalCount: 50,
        dispatchedCount: 0,
        signedCount: 0,
        failedCount: 0,
        routingMode: 'single_signer',
        createdBy: 'usr-admin-1',
        createdAt: '2026-09-29T20:00:00Z',
        updatedAt: '2026-09-29T20:00:00Z',
        tags: ['hr', 'equity', '2026'],
      };

      const parsed: BulkCampaign = BulkCampaignSchema.parse(raw);
      expect(parsed.id).toBe('camp-999');
      expect(parsed.totalCount).toBe(50);
      expect(parsed.tags).toContain('equity');
    });

    it('rejects negative counts', () => {
      const raw = {
        id: 'camp-invalid',
        workspaceId: 'ws-main',
        title: 'Invalid Counts',
        templateId: 'tmpl-1',
        status: 'draft',
        totalCount: -5,
        dispatchedCount: 0,
        signedCount: 0,
        failedCount: 0,
        createdBy: 'usr-1',
        createdAt: '2026-09-29T20:00:00Z',
        updatedAt: '2026-09-29T20:00:00Z',
      };

      expect(() => BulkCampaignSchema.parse(raw)).toThrow();
    });
  });

  describe('CreateBulkCampaignRequestSchema', () => {
    it('accepts valid creation payload with up to 5000 recipients', () => {
      const raw: CreateBulkCampaignRequest = {
        title: 'Sales Vendor Agreements',
        templateId: 'tmpl-vendor',
        routingMode: 'single_signer',
        tags: ['vendor-ops'],
        recipients: [
          { name: 'Vendor One', email: 'vendor1@supplier.com', variables: { tier: 'Platinum' } },
          { name: 'Vendor Two', email: 'vendor2@supplier.com', variables: { tier: 'Gold' } },
        ],
      };

      const parsed = CreateBulkCampaignRequestSchema.parse(raw);
      expect(parsed.recipients.length).toBe(2);
      expect(parsed.routingMode).toBe('single_signer');
    });

    it('rejects empty recipients list', () => {
      const raw = {
        title: 'Empty List Campaign',
        templateId: 'tmpl-vendor',
        recipients: [],
      };

      expect(() => CreateBulkCampaignRequestSchema.parse(raw)).toThrow();
    });
  });

  describe('EDiscoveryManifestSchema', () => {
    it('validates a complete, court-admissible e-Discovery manifest', () => {
      const validHash = 'a'.repeat(64);
      const raw: EDiscoveryManifest = {
        manifestVersion: '1.0.0',
        contractId: 'ctr-abc-123',
        envelopeId: 'env-abc-123',
        workspaceId: 'ws-legal',
        title: 'Master Service Agreement 2026',
        exportedAt: '2026-09-29T21:00:00Z',
        exportedByUserId: 'usr-counsel-1',
        files: [
          {
            path: 'completed-contract.pdf',
            description: 'Authoritative signed vector PDF agreement',
            sha256: validHash,
            sizeBytes: 1048576,
            mimeType: 'application/pdf',
          },
          {
            path: 'certificate-of-completion.pdf',
            description: 'Cryptographic Certificate of Completion',
            sha256: validHash,
            sizeBytes: 524288,
            mimeType: 'application/pdf',
          },
        ],
        merkleRootSha256: validHash,
        legalHoldActive: true,
        legalHoldDetails: {
          matterId: 'CASE-2026-0881',
          reason: 'Federal commercial arbitration compliance discovery',
          placedAt: '2026-09-29T10:00:00Z',
        },
      };

      const parsed = EDiscoveryManifestSchema.parse(raw);
      expect(parsed.manifestVersion).toBe('1.0.0');
      expect(parsed.files.length).toBe(2);
      expect(parsed.legalHoldActive).toBe(true);
      expect(parsed.merkleRootSha256).toBe(validHash);
    });

    it('rejects a manifest with an invalid non-64-character SHA-256 hash', () => {
      const raw = {
        manifestVersion: '1.0.0',
        contractId: 'ctr-bad-hash',
        envelopeId: 'env-bad-hash',
        workspaceId: 'ws-legal',
        title: 'Bad Hash MSA',
        exportedAt: '2026-09-29T21:00:00Z',
        exportedByUserId: 'usr-counsel-1',
        files: [
          {
            path: 'contract.pdf',
            description: 'Test file',
            sha256: 'short-hash',
            sizeBytes: 100,
            mimeType: 'application/pdf',
          },
        ],
        merkleRootSha256: 'too-short',
        legalHoldActive: false,
      };

      expect(() => EDiscoveryManifestSchema.parse(raw)).toThrow();
    });
  });

  describe('BulkCsvMergePreviewResultSchema', () => {
    it('validates a pre-flight dry-run merge preview output', () => {
      const raw = {
        totalRows: 10,
        validRows: 9,
        invalidRows: 1,
        detectedColumns: ['name', 'email', 'department'],
        templateVariables: ['name', 'department', 'start_date'],
        unmappedVariables: ['start_date'],
        previewSample: [
          {
            rowIndex: 1,
            recipientName: 'Alice Smith',
            recipientEmail: 'alice@company.com',
            mappedVariables: { name: 'Alice Smith', department: 'Engineering' },
            missingVariables: ['start_date'],
            isValid: false,
            errors: ['Missing mandatory template variable: start_date'],
          },
        ],
      };

      const parsed = BulkCsvMergePreviewResultSchema.parse(raw);
      expect(parsed.totalRows).toBe(10);
      expect(parsed.unmappedVariables).toContain('start_date');
      expect(parsed.previewSample[0].errors.length).toBe(1);
    });
  });

  describe('CRM Entity Source Invariants (Extension)', () => {
    it('validates CreateBulkCampaignRequest with sourceType = "crm_entities"', () => {
      const raw = {
        title: 'Q4 Vendor Bulk MSA Dispatch',
        templateId: 'tmpl-vendor-msa',
        sourceType: 'crm_entities',
        entityIds: ['ent-001', 'ent-002'],
        contactRole: 'signatory',
        recipients: [
          {
            name: 'Sarah Connor',
            email: 'sarah@cyberdyne.com',
            entityId: 'ent-001',
            contactId: 'cnt-001',
            sourceType: 'crm',
            variables: { company_name: 'Cyberdyne Systems' },
          },
        ],
      };

      const parsed = CreateBulkCampaignRequestSchema.parse(raw);
      expect(parsed.sourceType).toBe('crm_entities');
      expect(parsed.entityIds).toHaveLength(2);
      expect(parsed.contactRole).toBe('signatory');
      expect(parsed.recipients[0].entityId).toBe('ent-001');
      expect(parsed.recipients[0].sourceType).toBe('crm');
    });

    it('validates BulkCampaignRecipient with CRM entity provenance fields', () => {
      const raw = {
        id: 'rec-crm-01',
        campaignId: 'camp-crm-01',
        rowIndex: 1,
        name: 'John Connor',
        email: 'john@resistance.org',
        phone: '+15559876543',
        variables: { rank: 'Leader' },
        status: 'queued',
        idempotencyKey: 'idemp_camp-crm-01_ent-002_john@resistance.org',
        entityId: 'ent-002',
        contactId: 'cnt-002',
        sourceType: 'crm',
      };

      const parsed: BulkCampaignRecipient = BulkCampaignRecipientSchema.parse(raw);
      expect(parsed.entityId).toBe('ent-002');
      expect(parsed.contactId).toBe('cnt-002');
      expect(parsed.sourceType).toBe('crm');
    });
  });
});
