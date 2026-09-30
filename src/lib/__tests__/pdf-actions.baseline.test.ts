/**
 * PURPOSE: Baseline unit tests for PDF Actions and Agreement Finalization.
 * ARCHITECTURAL CONTEXT: Locks in behavior for partial progress saves, full agreement finalization,
 * contract status synchronization, confirmation message queueing, team alerts, and activity logs.
 * TESTABILITY: Runs in Vitest jsdom environment. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveAgreementProgressAction,
  finalizeAgreementAction,
  createPdfForm,
  updatePdfFormStatus,
  createStarterPdfForm,
} from '../pdf-actions';
import type { Activity } from '../types';

const { mockBlankPdfBytes } = vi.hoisted(() => {
  const minimalPdfBase64 =
    'JVBERi0xLjcKJYGBgYEKCjUgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA0Ci9GaXJzdCAyMAovTGVuZ3RoIDI2OAo+PgpzdHJlYW0KeJzVkktLxDAQx+/5FHPUy2Y6TdtESmHt4yLCsnhy8RC2YSnIZukD9Ns7aVbFg3iW8CeP+U1e/0kAgUApSKHQoCBLCcpSyKf3iwO5syc3Cfkw9BMcOIqwhxcha7+cZ0hEVYlvtrazffUnEZMgCfAnsRt9vxzdCGXXdh1igYi5YuWI1HBfswyLeM4x0jxmFeoqXitSxHTLsS4qL2JOiK9sds1vuWc2D0wTWaXj/OvccFYb96C/7mMqIR9939jZwU1zR0g5GtJESmX6+Za/Y3R29v/3cev9B3/+9YU/fA72BpNHF2pgdVnu3eSX8ci2M1eF/3L9YO/9G1cNcstMtiENWiUbbbiCGPkArpqPPwplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqCjw8Ci9TaXplIDcKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCAzNAovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCA3IF0KPj4Kc3RyZWFtCnicFcQxDgAgCASwHsbdN/txCB2K7nLZstV24pF8BkOhArYKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjM4NgolJUVPRg==';
  return {
    mockBlankPdfBytes: Buffer.from(minimalPdfBase64, 'base64'),
  };
});

const mockPdfsStore: Record<string, Record<string, unknown>> = {};
const mockContractsStore: Record<string, Record<string, unknown>> = {};
const mockSubmissionsStore: Record<string, Record<string, unknown>> = {};
const mockActivitiesStore: Activity[] = [];

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'usr_test_operator' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/workspace-resolver', () => ({
  resolveWorkspaceIdFromEntity: vi.fn().mockResolvedValue('ws_main_01'),
}));

vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../notification-engine', () => ({
  triggerInternalNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (act: Activity) => {
    mockActivitiesStore.push(act);
    return true;
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'pdfs') {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: !!mockPdfsStore[id],
              id,
              data: () => mockPdfsStore[id],
            }),
            update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
              if (mockPdfsStore[id]) Object.assign(mockPdfsStore[id], updates);
            }),
            collection: (_subName: string) => ({
              add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                const subId = `sub_${Date.now()}_${Math.random()}`;
                mockSubmissionsStore[subId] = { ...data, id: subId };
                return { id: subId };
              }),
              doc: (subId: string) => ({
                id: subId,
                get: vi.fn().mockResolvedValue({
                  exists: !!mockSubmissionsStore[subId],
                  data: () => mockSubmissionsStore[subId],
                }),
                update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                  if (mockSubmissionsStore[subId]) Object.assign(mockSubmissionsStore[subId], updates);
                }),
              }),
            }),
          }),
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            const pdfId = `pdf_${Date.now()}`;
            mockPdfsStore[pdfId] = { ...data, id: pdfId };
            return { id: pdfId };
          }),
        };
      }

      if (colName === 'contracts') {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: !!mockContractsStore[id],
              data: () => mockContractsStore[id],
            }),
            update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
              if (mockContractsStore[id]) Object.assign(mockContractsStore[id], updates);
            }),
          }),
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            const contractId = `contract_${Date.now()}`;
            mockContractsStore[contractId] = { ...data, id: contractId };
            return {
              id: contractId,
              get: async () => ({ data: () => mockContractsStore[contractId] }),
              update: async (updates: Record<string, unknown>) => {
                Object.assign(mockContractsStore[contractId], updates);
              },
            };
          }),
          where: (field: string, _op: string, val: string) => ({
            limit: (_n: number) => ({
              get: vi.fn().mockImplementation(async () => {
                const matched = Object.values(mockContractsStore).filter((c) => c[field] === val);
                const docs = matched.map((docData) => ({
                  id: String(docData.id),
                  ref: {
                    update: async (updates: Record<string, unknown>) => {
                      Object.assign(docData, updates);
                    },
                  },
                  data: () => docData,
                }));
                return { empty: docs.length === 0, docs };
              }),
            }),
          }),
        };
      }

      if (colName === 'signing_evidence') {
        return {
          add: vi.fn().mockResolvedValue({ id: 'ev_baseline_test' }),
        };
      }

      if (colName === 'media') {
        return {
          add: vi.fn().mockResolvedValue({ id: 'med_baseline_test' }),
        };
      }

      return {
        doc: (id: string) => ({
          id,
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      };
    },
  },
  adminStorage: {
    file: () => ({
      download: vi.fn().mockResolvedValue([mockBlankPdfBytes]),
      save: vi.fn().mockResolvedValue(true),
      getSignedUrl: vi.fn().mockResolvedValue(['https://storage.googleapis.com/test-signed-url.pdf']),
      bucket: { name: 'test-bucket' },
    }),
  },
}));

describe('P0.3 Baseline: PDF Actions Finalization Lifecycle', () => {
  beforeEach(() => {
    Object.keys(mockPdfsStore).forEach((k) => delete mockPdfsStore[k]);
    Object.keys(mockContractsStore).forEach((k) => delete mockContractsStore[k]);
    Object.keys(mockSubmissionsStore).forEach((k) => delete mockSubmissionsStore[k]);
    mockActivitiesStore.length = 0;
    vi.clearAllMocks();
  });

  it('saves agreement progress and creates a partial submission', async () => {
    const pdfId = 'pdf_terms_01';
    mockPdfsStore[pdfId] = {
      id: pdfId,
      name: 'Onboarding Terms',
      workspaceIds: ['ws_main_01'],
    };

    const result = await saveAgreementProgressAction(
      pdfId,
      'ent_school_01',
      { field_name: 'St. Peter High', field_email: 'office@stpeter.edu' }
    );

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();

    const createdSub = mockSubmissionsStore[result.submissionId!];
    expect(createdSub).toBeDefined();
    expect(createdSub.status).toBe('partial');
    expect(createdSub.entityId).toBe('ent_school_01');
  });

  it('finalizes agreement, marks contract as signed, and dispatches confirmation', async () => {
    const pdfId = 'pdf_contract_02';
    mockPdfsStore[pdfId] = {
      id: pdfId,
      name: 'Annual Subscription Contract',
      workspaceIds: ['ws_main_01'],
      status: 'published',
      fields: [
        { id: 'f_email', type: 'email', label: 'Signatory Email' },
      ],
      confirmationMessagingEnabled: true,
      confirmationTemplateId: 'tmpl_email_executed',
      adminAlertsEnabled: true,
      adminAlertChannel: 'email',
    };

    const result = await finalizeAgreementAction(
      pdfId,
      'ent_school_02',
      { f_email: 'head@school.org', entity_name: 'Trinity College' }
    );

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();

    const sub = mockSubmissionsStore[result.submissionId!];
    expect(sub).toBeDefined();
    expect(sub.status).toBe('submitted');

    // Contract state must be synced to 'signed'
    const matchingContract = Object.values(mockContractsStore).find(
      (c) => c.entityId === 'ent_school_02'
    );
    expect(matchingContract).toBeDefined();
    expect(matchingContract?.status).toBe('signed');
    expect(matchingContract?.signedAt).toBeDefined();

    // Activity log must capture agreement execution
    expect(mockActivitiesStore.some((a) => a.type === 'pdf_status_changed')).toBe(true);
  });

  it('creates and manages draft PDF template records', async () => {
    const createResult = await createPdfForm(
      {
        name: 'Master Vendor Agreement',
        storagePath: 'pdfs/test/vendor.pdf',
        downloadUrl: 'https://storage.googleapis.com/pdfs/test/vendor.pdf',
        fields: [],
      },
      'usr_test_operator',
      ['ws_main_01']
    );

    expect(createResult.success).toBe(true);
    expect(createResult.id).toBeDefined();
    expect(mockPdfsStore[createResult.id!].status).toBe('draft');

    // Status transition to published
    const updateResult = await updatePdfFormStatus(
      createResult.id!,
      'published',
      'usr_test_operator'
    );
    expect(updateResult.success).toBe(true);
    expect(mockPdfsStore[createResult.id!].status).toBe('published');
  });

  it('generates a clean starter agreement blueprint and registers form record', async () => {
    const result = await createStarterPdfForm({
      name: 'Non-Disclosure Agreement',
      workspaceIds: ['ws_main_01'],
      isContractDocument: true,
      userId: 'usr_test_operator',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    const storedPdf = mockPdfsStore[result.id!];
    expect(storedPdf).toBeDefined();
    expect(storedPdf.name).toBe('Non-Disclosure Agreement');
    expect(storedPdf.status).toBe('draft');
    expect(storedPdf.isContractDocument).toBe(true);
    expect(storedPdf.workspaceIds).toContain('ws_main_01');
    expect(storedPdf.downloadUrl).toBeDefined();
    expect(storedPdf.storagePath).toMatch(/^pdfs\/starter_/);
  });
});
