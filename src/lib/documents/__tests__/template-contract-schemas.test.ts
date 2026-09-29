import { describe, it, expect } from 'vitest';
import {
  DocumentTypeSchema,
  TemplateStatusSchema,
  TemplateVersionStatusSchema,
  TemplateVersionSchema,
  DocumentTemplateSchema,
  ContractLifecycleStatusSchema,
  ContractRelationshipTypeSchema,
  ContractRelationshipSchema,
  ObligationTypeSchema,
  ObligationStatusSchema,
  ContractObligationSchema,
  ContractRecordSchema,
} from '@/lib/types/document-signing';

describe('Phase 3 Domain Schemas & Validation', () => {
  describe('Enumerations & Value Object Schemas', () => {
    it('validates supported DocumentType values', () => {
      expect(DocumentTypeSchema.parse('contract')).toBe('contract');
      expect(DocumentTypeSchema.parse('nda')).toBe('nda');
      expect(DocumentTypeSchema.parse('msa')).toBe('msa');
      expect(DocumentTypeSchema.parse('sow')).toBe('sow');
      expect(DocumentTypeSchema.parse('amendment')).toBe('amendment');
      expect(() => DocumentTypeSchema.parse('unsupported_type')).toThrow();
    });

    it('validates TemplateStatus and TemplateVersionStatus values', () => {
      expect(TemplateStatusSchema.parse('draft')).toBe('draft');
      expect(TemplateStatusSchema.parse('published')).toBe('published');
      expect(TemplateStatusSchema.parse('archived')).toBe('archived');
      expect(() => TemplateStatusSchema.parse('unknown')).toThrow();

      expect(TemplateVersionStatusSchema.parse('draft')).toBe('draft');
      expect(TemplateVersionStatusSchema.parse('published')).toBe('published');
      expect(TemplateVersionStatusSchema.parse('superseded')).toBe('superseded');
      expect(() => TemplateVersionStatusSchema.parse('archived')).toThrow();
    });

    it('validates ContractLifecycleStatus and ContractRelationshipType values', () => {
      expect(ContractLifecycleStatusSchema.parse('proposed')).toBe('proposed');
      expect(ContractLifecycleStatusSchema.parse('negotiation')).toBe('negotiation');
      expect(ContractLifecycleStatusSchema.parse('pending_execution')).toBe('pending_execution');
      expect(ContractLifecycleStatusSchema.parse('executed')).toBe('executed');
      expect(ContractLifecycleStatusSchema.parse('active')).toBe('active');
      expect(ContractLifecycleStatusSchema.parse('renewal_pending')).toBe('renewal_pending');
      expect(ContractLifecycleStatusSchema.parse('renewed')).toBe('renewed');
      expect(ContractLifecycleStatusSchema.parse('amended')).toBe('amended');
      expect(ContractLifecycleStatusSchema.parse('expired')).toBe('expired');
      expect(ContractLifecycleStatusSchema.parse('terminated')).toBe('terminated');
      expect(ContractLifecycleStatusSchema.parse('superseded')).toBe('superseded');
      expect(() => ContractLifecycleStatusSchema.parse('invalid')).toThrow();

      expect(ContractRelationshipTypeSchema.parse('amendment')).toBe('amendment');
      expect(ContractRelationshipTypeSchema.parse('renewal')).toBe('renewal');
      expect(ContractRelationshipTypeSchema.parse('supersedes')).toBe('supersedes');
      expect(ContractRelationshipTypeSchema.parse('parent_child')).toBe('parent_child');
      expect(() => ContractRelationshipTypeSchema.parse('sibling')).toThrow();
    });

    it('validates ObligationType and ObligationStatus values', () => {
      expect(ObligationTypeSchema.parse('deliverable')).toBe('deliverable');
      expect(ObligationTypeSchema.parse('payment')).toBe('payment');
      expect(ObligationTypeSchema.parse('reporting')).toBe('reporting');
      expect(ObligationTypeSchema.parse('renewal_notice')).toBe('renewal_notice');
      expect(ObligationTypeSchema.parse('audit')).toBe('audit');
      expect(ObligationTypeSchema.parse('compliance')).toBe('compliance');
      expect(() => ObligationTypeSchema.parse('invalid')).toThrow();

      expect(ObligationStatusSchema.parse('pending')).toBe('pending');
      expect(ObligationStatusSchema.parse('in_progress')).toBe('in_progress');
      expect(ObligationStatusSchema.parse('fulfilled')).toBe('fulfilled');
      expect(ObligationStatusSchema.parse('breached')).toBe('breached');
      expect(ObligationStatusSchema.parse('waived')).toBe('waived');
      expect(() => ObligationStatusSchema.parse('unknown')).toThrow();
    });
  });

  describe('DocumentTemplateSchema & TemplateVersionSchema', () => {
    it('validates a correct template version payload', () => {
      const validVersion = {
        id: 'ver_001',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_nda_1',
        versionNumber: 1,
        status: 'published',
        contentSnapshot: {
          storagePath: 'workspaces/ws_legal_1/templates/tmpl_nda_1/v1.pdf',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        fields: [
          {
            id: 'field_sig_1',
            key: 'counterparty_signature',
            label: 'Counterparty Signature',
            type: 'signature',
            page: 1,
            x: 20,
            y: 80,
            width: 30,
            height: 8,
            required: true,
            assignedRole: 'signer',
          },
        ],
        variableSchemaVersion: '1.0',
        changeSummary: 'Initial publication of mutual NDA template.',
        publishedAt: '2026-09-29T10:00:00Z',
        createdBy: 'user_admin_1',
        createdAt: '2026-09-29T09:30:00Z',
        updatedAt: '2026-09-29T10:00:00Z',
      };

      const parsed = TemplateVersionSchema.parse(validVersion);
      expect(parsed.versionNumber).toBe(1);
      expect(parsed.status).toBe('published');
      expect(parsed.fields).toHaveLength(1);
    });

    it('rejects a template version with non-positive integer versionNumber', () => {
      const invalidVersion = {
        id: 'ver_002',
        workspaceId: 'ws_legal_1',
        templateId: 'tmpl_nda_1',
        versionNumber: 0, // Invalid: must be >= 1
        status: 'draft',
        contentSnapshot: {
          storagePath: 'templates/v0.pdf',
          sha256: 'abcd1234efgh5678',
        },
        fields: [],
        createdBy: 'user_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => TemplateVersionSchema.parse(invalidVersion)).toThrow();
    });

    it('validates a complete DocumentTemplate payload', () => {
      const validTemplate = {
        id: 'tmpl_msa_1',
        workspaceId: 'ws_enterprise',
        name: 'Master Services Agreement (Enterprise Tier)',
        description: 'Standard MSA for enterprise tier clients.',
        documentType: 'contract',
        status: 'published',
        currentPublishedVersionId: 'ver_001',
        tagIds: ['tag_enterprise', 'tag_tier1'],
        storagePath: 'templates/msa_source.pdf',
        createdBy: 'user_legal_lead',
        createdAt: '2026-09-28T12:00:00Z',
        updatedAt: '2026-09-29T08:00:00Z',
      };

      const parsed = DocumentTemplateSchema.parse(validTemplate);
      expect(parsed.name).toBe('Master Services Agreement (Enterprise Tier)');
      expect(parsed.documentType).toBe('contract');
      expect(parsed.tagIds).toEqual(['tag_enterprise', 'tag_tier1']);
    });
  });

  describe('ContractRecordSchema & ContractRelationshipSchema', () => {
    it('validates an authoritative ContractRecord with commercial valuation cadence', () => {
      const validContract = {
        id: 'cnt_corp_2026_01',
        workspaceId: 'ws_finance_1',
        title: 'Cloud Infrastructure Service Agreement',
        status: 'active',
        templateId: 'tmpl_cloud_1',
        templateVersionId: 'ver_002',
        envelopeIds: ['env_exec_01'],
        dealId: 'deal_9901',
        entityId: 'ent_acme_corp',
        partyLinks: [
          {
            entityId: 'ent_acme_corp',
            contactId: 'con_ceo_1',
            name: 'Sarah Connor',
            email: 'sarah@acme.com',
            role: 'client_signatory',
          },
          {
            name: 'John Anderson',
            email: 'john@smartsapp.com',
            role: 'internal_countersigner',
          },
        ],
        contractValue: {
          amount: 120000,
          currency: 'USD',
          cadence: 'annually',
        },
        effectiveAt: '2026-10-01T00:00:00Z',
        expiresAt: '2027-10-01T00:00:00Z',
        renewalAt: '2027-08-01T00:00:00Z',
        noticePeriodDays: 60,
        ownerId: 'user_account_exec_1',
        executedPdfStoragePath: 'signed/cnt_corp_2026_01_executed.pdf',
        executedPdfSha256: 'a1b2c3d4e5f67890abcdef1234567890abcdef12',
        certificateStoragePath: 'certificates/cnt_corp_2026_01_cert.pdf',
        tagIds: ['cloud', 'tier_1'],
        createdAt: '2026-09-28T14:00:00Z',
        updatedAt: '2026-09-29T02:00:00Z',
      };

      const parsed = ContractRecordSchema.parse(validContract);
      expect(parsed.contractValue?.amount).toBe(120000);
      expect(parsed.contractValue?.cadence).toBe('annually');
      expect(parsed.partyLinks).toHaveLength(2);
      expect(parsed.status).toBe('active');
    });

    it('validates a non-destructive ContractRelationship payload', () => {
      const validRelationship = {
        id: 'rel_amend_01',
        workspaceId: 'ws_finance_1',
        sourceContractId: 'cnt_parent_01',
        targetContractId: 'cnt_amendment_01',
        relationshipType: 'amendment',
        description: 'Amendment #1: Increases SLA liability cap to $2M.',
        createdAt: new Date().toISOString(),
        createdBy: 'user_ops_1',
      };

      const parsed = ContractRelationshipSchema.parse(validRelationship);
      expect(parsed.relationshipType).toBe('amendment');
      expect(parsed.sourceContractId).toBe('cnt_parent_01');
    });

    it('rejects an invalid relationshipType', () => {
      const invalidRelationship = {
        id: 'rel_02',
        workspaceId: 'ws_1',
        sourceContractId: 'cnt_1',
        targetContractId: 'cnt_2',
        relationshipType: 'invalid_type',
        createdAt: new Date().toISOString(),
        createdBy: 'user_1',
      };

      expect(() => ContractRelationshipSchema.parse(invalidRelationship)).toThrow();
    });
  });

  describe('ContractObligationSchema', () => {
    it('validates an obligation linked to SmartSapp task core', () => {
      const validObligation = {
        id: 'ob_quarterly_report_1',
        workspaceId: 'ws_compliance_1',
        contractId: 'cnt_corp_2026_01',
        title: 'Q1 Security Compliance Audit Report',
        description: 'Provide audited SOC2 Type II compliance pack to counterparty legal counsel.',
        type: 'reporting',
        status: 'pending',
        dueDate: '2026-12-31T23:59:59Z',
        responsibleParty: 'internal',
        assignedUserId: 'user_compliance_officer',
        linkedTaskId: 'task_core_98765',
        reminderDaysBefore: [7, 14, 30],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = ContractObligationSchema.parse(validObligation);
      expect(parsed.type).toBe('reporting');
      expect(parsed.status).toBe('pending');
      expect(parsed.linkedTaskId).toBe('task_core_98765');
      expect(parsed.reminderDaysBefore).toEqual([7, 14, 30]);
    });

    it('validates fulfilled obligation attributes', () => {
      const fulfilledObligation = {
        id: 'ob_initial_payment_1',
        workspaceId: 'ws_finance_1',
        contractId: 'cnt_corp_2026_01',
        title: 'Initial Deployment Setup Fee ($25,000)',
        type: 'payment',
        status: 'fulfilled',
        dueDate: '2026-10-15T00:00:00Z',
        responsibleParty: 'counterparty',
        fulfilledAt: '2026-10-12T14:22:00Z',
        fulfilledBy: 'user_billing_analyst',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-10-12T14:22:00Z',
      };

      const parsed = ContractObligationSchema.parse(fulfilledObligation);
      expect(parsed.status).toBe('fulfilled');
      expect(parsed.fulfilledAt).toBeDefined();
    });
  });
});
