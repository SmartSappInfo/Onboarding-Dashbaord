import { describe, it, expect } from 'vitest';
import {
  AssuranceLevelSchema,
  AssuranceProfileSchema,
  WebhookDeliveryStatusSchema,
  WebhookSubscriptionSchema,
  WebhookDeliveryLogSchema,
  LegalHoldStatusSchema,
  ContractRetentionPolicySchema,
  EvidencePackageManifestSchema,
  ComputedFieldFormulaSchema,
  WorkspaceBrandingSchema,
} from '@/lib/types/document-signing';

describe('Phase 6 Enterprise Governance Schemas', () => {
  describe('AssuranceLevelSchema and AssuranceProfileSchema', () => {
    it('accepts valid assurance levels and rejects invalid ones', () => {
      expect(AssuranceLevelSchema.parse('simple')).toBe('simple');
      expect(AssuranceLevelSchema.parse('advanced')).toBe('advanced');
      expect(AssuranceLevelSchema.parse('qualified')).toBe('qualified');
      expect(() => AssuranceLevelSchema.parse('standard')).toThrow();
    });

    it('validates a complete SES and QES assurance profile', () => {
      const sesProfile = {
        id: 'prof_ses_default',
        workspaceId: 'ws_corp',
        name: 'Standard Electronic Signature (SES)',
        level: 'simple',
        description: 'Standard link-based signing flow',
        requiredAuth: ['email_link'],
        requireSignatureBiometrics: false,
        certificateStandard: 'standard',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      const parsed = AssuranceProfileSchema.parse(sesProfile);
      expect(parsed.level).toBe('simple');
      expect(parsed.certificateStandard).toBe('standard');

      const qesProfile = {
        id: 'prof_qes_eu',
        workspaceId: 'ws_corp',
        name: 'Qualified eIDAS Assurance (QES)',
        level: 'qualified',
        description: 'Requires national eID and video verification',
        requiredAuth: ['id_verification', 'sms_otp'],
        requireSignatureBiometrics: true,
        certificateStandard: 'qualified_trust',
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      expect(AssuranceProfileSchema.parse(qesProfile).level).toBe('qualified');
    });

    it('rejects profiles with invalid certificate standards or missing required fields', () => {
      expect(() =>
        AssuranceProfileSchema.parse({
          id: 'prof_bad',
          workspaceId: 'ws_corp',
          name: '',
          level: 'simple',
          requiredAuth: ['email_link'],
          requireSignatureBiometrics: false,
          certificateStandard: 'invalid_standard',
          createdAt: '2026-09-29T10:00:00.000Z',
          updatedAt: '2026-09-29T10:00:00.000Z',
        })
      ).toThrow();
    });
  });

  describe('WebhookSubscriptionSchema and WebhookDeliveryLogSchema', () => {
    it('validates a webhook subscription with strict URL and 16-char secret', () => {
      const validSub = {
        id: 'wh_sub_01',
        workspaceId: 'ws_corp',
        url: 'https://api.enterprise-crm.com/v1/webhooks/agreements',
        secret: 'sec_prod_wh_abcdef1234567890',
        events: ['document.completed', 'signing.recipient_completed'],
        isActive: true,
        retryLimit: 5,
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      const parsed = WebhookSubscriptionSchema.parse(validSub);
      expect(parsed.retryLimit).toBe(5);
      expect(parsed.events).toHaveLength(2);
    });

    it('rejects invalid webhook URLs and secrets shorter than 16 characters', () => {
      expect(() =>
        WebhookSubscriptionSchema.parse({
          id: 'wh_sub_bad',
          workspaceId: 'ws_corp',
          url: 'not-a-valid-url',
          secret: 'short_secret',
          events: ['document.completed'],
          isActive: true,
          retryLimit: 5,
          createdAt: '2026-09-29T10:00:00.000Z',
          updatedAt: '2026-09-29T10:00:00.000Z',
        })
      ).toThrow();
    });

    it('validates webhook delivery log and statuses including dead_letter', () => {
      expect(WebhookDeliveryStatusSchema.parse('pending')).toBe('pending');
      expect(WebhookDeliveryStatusSchema.parse('delivered')).toBe('delivered');
      expect(WebhookDeliveryStatusSchema.parse('failed')).toBe('failed');
      expect(WebhookDeliveryStatusSchema.parse('dead_letter')).toBe('dead_letter');

      const log = {
        id: 'wh_log_01',
        subscriptionId: 'wh_sub_01',
        workspaceId: 'ws_corp',
        event: 'document.completed',
        payload: { envelopeId: 'env_123', contractId: 'con_abc' },
        status: 'dead_letter',
        attemptCount: 5,
        nextRetryAt: null,
        lastAttemptAt: '2026-09-29T10:05:00.000Z',
        responseStatusCode: 504,
        responseBody: 'Gateway Timeout from downstream host',
        errorMessage: 'Max retry limit reached',
        createdAt: '2026-09-29T10:00:00.000Z',
      };
      const parsed = WebhookDeliveryLogSchema.parse(log);
      expect(parsed.status).toBe('dead_letter');
      expect(parsed.attemptCount).toBe(5);
    });
  });

  describe('LegalHoldStatusSchema and ContractRetentionPolicySchema', () => {
    it('validates legal hold active and released states', () => {
      const activeHold = {
        isUnderLegalHold: true,
        holdId: 'hold_lit_2026_01',
        matterId: 'MATTER-88219',
        reason: 'DOJ investigation inquiry preservation',
        placedByUserId: 'usr_counsel_01',
        placedAt: '2026-09-29T09:00:00.000Z',
      };
      const parsedActive = LegalHoldStatusSchema.parse(activeHold);
      expect(parsedActive.isUnderLegalHold).toBe(true);
      expect(parsedActive.matterId).toBe('MATTER-88219');

      const inactiveHold = {
        isUnderLegalHold: false,
      };
      expect(LegalHoldStatusSchema.parse(inactiveHold).isUnderLegalHold).toBe(false);
    });

    it('validates statutory retention policies', () => {
      const retentionPolicy = {
        id: 'ret_fin_7y',
        workspaceId: 'ws_corp',
        category: 'financial',
        retentionYears: 7,
        autoPurgeAfterRetention: false,
        createdAt: '2026-09-29T10:00:00.000Z',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      const parsed = ContractRetentionPolicySchema.parse(retentionPolicy);
      expect(parsed.category).toBe('financial');
      expect(parsed.retentionYears).toBe(7);
    });
  });

  describe('EvidencePackageManifestSchema', () => {
    it('validates 64-character SHA-256 checksums in package manifest', () => {
      const sha256Regex = /^[a-f0-9]{64}$/;
      const validHash = 'a'.repeat(64);
      expect(sha256Regex.test(validHash)).toBe(true);

      const manifest = {
        packageId: 'pkg_evidence_9921',
        workspaceId: 'ws_corp',
        contractId: 'con_001',
        envelopeId: 'env_001',
        generatedAt: '2026-09-29T10:00:00.000Z',
        documentSha256: validHash,
        certificateSha256: validHash,
        auditEventsCount: 14,
        manifestSha256: validHash,
        overallChecksum: validHash,
      };
      const parsed = EvidencePackageManifestSchema.parse(manifest);
      expect(parsed.auditEventsCount).toBe(14);
      expect(parsed.documentSha256).toBe(validHash);
    });

    it('rejects malformed hashes in manifest', () => {
      expect(() =>
        EvidencePackageManifestSchema.parse({
          packageId: 'pkg_evidence_bad',
          workspaceId: 'ws_corp',
          contractId: 'con_001',
          generatedAt: '2026-09-29T10:00:00.000Z',
          documentSha256: 'too_short',
          certificateSha256: 'too_short',
          auditEventsCount: 5,
          manifestSha256: 'too_short',
          overallChecksum: 'too_short',
        })
      ).toThrow();
    });
  });

  describe('ComputedFieldFormulaSchema and WorkspaceBrandingSchema', () => {
    it('validates dynamic computed formula schema', () => {
      const formula = {
        type: 'sum',
        expression: 'SUM(line_item_1, line_item_2)',
        sourceFieldIds: ['line_item_1', 'line_item_2'],
        decimalPlaces: 2,
        currencySymbol: '$',
      };
      const parsed = ComputedFieldFormulaSchema.parse(formula);
      expect(parsed.type).toBe('sum');
      expect(parsed.decimalPlaces).toBe(2);
      expect(parsed.sourceFieldIds).toEqual(['line_item_1', 'line_item_2']);
    });

    it('validates workspace branding with strict hex colors', () => {
      const branding = {
        workspaceId: 'ws_corp',
        primaryColor: '#4F46E5',
        logoUrl: 'https://assets.corp.com/brand/logo.png',
        companyDisplayName: 'Acme Enterprises Inc.',
        emailSenderName: 'Acme Legal Operations',
        customInviteMessage: 'Please review and execute the agreement promptly.',
        portalSlug: 'acme-agreements',
        updatedAt: '2026-09-29T10:00:00.000Z',
      };
      const parsed = WorkspaceBrandingSchema.parse(branding);
      expect(parsed.primaryColor).toBe('#4F46E5');
      expect(parsed.companyDisplayName).toBe('Acme Enterprises Inc.');

      // Rejects invalid hex color
      expect(() =>
        WorkspaceBrandingSchema.parse({
          ...branding,
          primaryColor: 'blue',
        })
      ).toThrow();
    });
  });
});
