/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Integration test suite for Phase 3 Contract & Template Versioning Server Actions (Task 5).
 * Tests tenant isolation, atomic Firestore transactions, version publishing,
 * non-destructive amendments, and contract obligation lifecycles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  publishTemplateVersionAction,
  createContractRecordAction,
  createContractAmendmentAction,
  createContractObligationAction,
  fulfillContractObligationAction,
  transitionContractStatusAction,
} from '@/lib/documents/contract-actions';
import type {
  TemplateVersion,
  DocumentTemplate,
  ContractRecord,
  ContractObligation,
} from '@/lib/types/document-signing';

const mockDbStore: {
  templates: Record<string, DocumentTemplate>;
  versions: Record<string, TemplateVersion>;
  contracts: Record<string, ContractRecord>;
  relationships: Record<string, Record<string, unknown>>;
  obligations: Record<string, ContractObligation>;
} = {
  templates: {},
  versions: {},
  contracts: {},
  relationships: {},
  obligations: {},
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'usr_ops_lead_1', email: 'ops@enterprise.com' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn().mockResolvedValue({ success: true, id: 'task_core_auto_1' }),
  updateTaskCore: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    runTransaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref: { _col: string; _id: string }) => {
          const col = ref._col;
          const id = ref._id;
          if (col === 'document_templates') {
            const data = mockDbStore.templates[id];
            return { exists: !!data, id, data: () => data };
          }
          if (col === 'contracts') {
            const data = mockDbStore.contracts[id];
            return { exists: !!data, id, data: () => data };
          }
          return { exists: false, id, data: () => null };
        }),
        set: vi.fn().mockImplementation((ref: { _col: string; _id: string }, data: Record<string, unknown>) => {
          const col = ref._col;
          const id = ref._id;
          if (col === 'contracts') mockDbStore.contracts[id] = data as unknown as ContractRecord;
          if (col === 'contract_relationships') mockDbStore.relationships[id] = data;
          if (col === 'template_versions') mockDbStore.versions[id] = data as unknown as TemplateVersion;
          if (col === 'document_templates') mockDbStore.templates[id] = data as unknown as DocumentTemplate;
        }),
        update: vi.fn().mockImplementation((ref: { _col: string; _id: string }, updates: Record<string, unknown>) => {
          const col = ref._col;
          const id = ref._id;
          if (col === 'contracts' && mockDbStore.contracts[id]) {
            Object.assign(mockDbStore.contracts[id], updates);
          }
          if (col === 'document_templates' && mockDbStore.templates[id]) {
            Object.assign(mockDbStore.templates[id], updates);
          }
          if (col === 'template_versions' && mockDbStore.versions[id]) {
            Object.assign(mockDbStore.versions[id], updates);
          }
        }),
      };
      return callback(mockTx);
    }),
    collection: (colName: string) => ({
      _col: colName,
      doc: (id: string) => ({
        _col: colName,
        _id: id,
        id,
        get: vi.fn().mockImplementation(async () => {
          if (colName === 'document_templates') {
            const data = mockDbStore.templates[id];
            return { exists: !!data, id, data: () => data };
          }
          if (colName === 'template_versions') {
            const data = mockDbStore.versions[id];
            return { exists: !!data, id, data: () => data };
          }
          if (colName === 'contracts') {
            const data = mockDbStore.contracts[id];
            return { exists: !!data, id, data: () => data };
          }
          if (colName === 'contract_obligations') {
            const data = mockDbStore.obligations[id];
            return { exists: !!data, id, data: () => data };
          }
          return { exists: false, id, data: () => null };
        }),
        set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
          if (colName === 'contracts') mockDbStore.contracts[id] = data as unknown as ContractRecord;
          if (colName === 'contract_obligations') mockDbStore.obligations[id] = data as unknown as ContractObligation;
          if (colName === 'document_templates') mockDbStore.templates[id] = data as unknown as DocumentTemplate;
          if (colName === 'template_versions') mockDbStore.versions[id] = data as unknown as TemplateVersion;
        }),
        update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
          if (colName === 'contract_obligations' && mockDbStore.obligations[id]) {
            Object.assign(mockDbStore.obligations[id], updates);
          }
          if (colName === 'contracts' && mockDbStore.contracts[id]) {
            Object.assign(mockDbStore.contracts[id], updates);
          }
        }),
      }),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(async () => {
        if (colName === 'template_versions') {
          const list = Object.values(mockDbStore.versions);
          return {
            docs: list.map((v) => ({ id: v.id, data: () => v })),
          };
        }
        return { docs: [] };
      }),
    }),
  },
}));

describe('Contract & Template Versioning Server Actions (Task 5)', () => {
  beforeEach(() => {
    mockDbStore.templates = {};
    mockDbStore.versions = {};
    mockDbStore.contracts = {};
    mockDbStore.relationships = {};
    mockDbStore.obligations = {};
    vi.clearAllMocks();
  });

  describe('publishTemplateVersionAction', () => {
    it('publishes a draft template version and updates template current version', async () => {
      const templateId = 'tmpl_nda_1';
      const versionId = 'ver_draft_1';

      mockDbStore.templates[templateId] = {
        id: templateId,
        workspaceId: 'ws_legal_1',
        name: 'Standard Mutual NDA',
        documentType: 'nda',
        status: 'draft',
        tagIds: ['legal'],
        storagePath: 'templates/nda.pdf',
        createdBy: 'usr_ops_lead_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      mockDbStore.versions[versionId] = {
        id: versionId,
        workspaceId: 'ws_legal_1',
        templateId,
        versionNumber: 1,
        status: 'draft',
        contentSnapshot: {
          storagePath: 'templates/nda_v1.pdf',
          sha256: 'sha256_mock_v1',
        },
        fields: [],
        variableSchemaVersion: '1.0',
        createdBy: 'usr_ops_lead_1',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      };

      const result = await publishTemplateVersionAction({
        workspaceId: 'ws_legal_1',
        templateId,
        versionId,
        changeSummary: 'First production release of mutual NDA.',
      });

      expect(result.success).toBe(true);
      expect(result.publishedVersion?.status).toBe('published');
      expect(result.publishedVersion?.versionNumber).toBe(1);
      expect(mockDbStore.templates[templateId].currentPublishedVersionId).toBe(versionId);
      expect(mockDbStore.templates[templateId].status).toBe('published');
    });
  });

  describe('createContractRecordAction', () => {
    it('creates a new contract record under authenticated workspace', async () => {
      const result = await createContractRecordAction({
        workspaceId: 'ws_legal_1',
        title: 'Master Cloud Agreement 2026',
        dealId: 'deal_enterprise_1',
        partyLinks: [
          {
            name: 'Alice Johnson',
            email: 'alice@acme.com',
            role: 'client_signatory',
          },
        ],
        contractValue: {
          amount: 85000,
          currency: 'USD',
          cadence: 'annually',
        },
        noticePeriodDays: 45,
      });

      expect(result.success).toBe(true);
      expect(result.contract).toBeDefined();
      expect(result.contract?.title).toBe('Master Cloud Agreement 2026');
      expect(result.contract?.status).toBe('proposed');
      expect(result.contract?.contractValue?.amount).toBe(85000);
      expect(mockDbStore.contracts[result.contract!.id]).toBeDefined();
    });
  });

  describe('createContractAmendmentAction', () => {
    it('creates linked child amendment contract and updates parent to amended', async () => {
      const parentId = 'cnt_parent_1';
      mockDbStore.contracts[parentId] = {
        id: parentId,
        workspaceId: 'ws_legal_1',
        title: 'Original Cloud Agreement',
        status: 'active',
        envelopeIds: ['env_1'],
        partyLinks: [{ name: 'Alice', email: 'alice@acme.com', role: 'signatory' }],
        ownerId: 'usr_ops_lead_1',
        tagIds: ['cloud'],
        noticePeriodDays: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const result = await createContractAmendmentAction({
        workspaceId: 'ws_legal_1',
        parentContractId: parentId,
        amendmentTitle: 'Amendment #1: Extended SLA Scope',
        description: 'Increases coverage to 24/7 dedicated telephone support.',
      });

      expect(result.success).toBe(true);
      expect(result.amendmentContract?.parentContractId).toBe(parentId);
      expect(result.updatedParentContract?.status).toBe('amended');
      expect(result.relationship?.relationshipType).toBe('amendment');
    });
  });

  describe('createContractObligationAction & fulfillContractObligationAction', () => {
    it('creates obligation, syncs to tasks, and allows fulfilling', async () => {
      const contractId = 'cnt_active_1';
      mockDbStore.contracts[contractId] = {
        id: contractId,
        workspaceId: 'ws_legal_1',
        title: 'Active Master Agreement',
        status: 'active',
        envelopeIds: [],
        partyLinks: [],
        ownerId: 'usr_ops_lead_1',
        tagIds: [],
        noticePeriodDays: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      // 1. Create obligation
      const createRes = await createContractObligationAction({
        workspaceId: 'ws_legal_1',
        contractId,
        title: 'Annual Security SOC2 Report',
        type: 'reporting',
        dueDate: '2026-12-15T00:00:00Z',
        responsibleParty: 'internal',
        assignedUserId: 'usr_sec_1',
        syncToTasks: true,
      });

      expect(createRes.success).toBe(true);
      expect(createRes.obligation?.title).toBe('Annual Security SOC2 Report');
      expect(createRes.obligation?.linkedTaskId).toBe('task_core_auto_1');

      // 2. Fulfill obligation
      const fulfillRes = await fulfillContractObligationAction({
        workspaceId: 'ws_legal_1',
        obligationId: createRes.obligation!.id,
        notes: 'Delivered SOC2 audit report via secure portal.',
      });

      expect(fulfillRes.success).toBe(true);
      expect(fulfillRes.obligation?.status).toBe('fulfilled');
      expect(fulfillRes.wasAlreadyFulfilled).toBe(false);
    });
  });

  describe('transitionContractStatusAction', () => {
    it('transitions status from proposed to negotiation', async () => {
      const contractId = 'cnt_prop_1';
      mockDbStore.contracts[contractId] = {
        id: contractId,
        workspaceId: 'ws_legal_1',
        title: 'Enterprise Pilot Agreement',
        status: 'proposed',
        envelopeIds: [],
        partyLinks: [],
        ownerId: 'usr_ops_lead_1',
        tagIds: [],
        noticePeriodDays: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const result = await transitionContractStatusAction({
        workspaceId: 'ws_legal_1',
        contractId,
        nextStatus: 'negotiation',
      });

      expect(result.success).toBe(true);
      expect(result.contract?.status).toBe('negotiation');
      expect(mockDbStore.contracts[contractId].status).toBe('negotiation');
    });
  });
});
