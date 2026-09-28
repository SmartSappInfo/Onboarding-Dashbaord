/**
 * PURPOSE: Baseline unit tests for Contract Actions Lifecycle.
 * ARCHITECTURAL CONTEXT: Locks in behavior for contract draft upsert, multi-channel dispatch,
 * permission checks, atomic batch deletion, and timeline activity logging prior to Phase 1 refactoring.
 * TESTABILITY: Runs in Vitest jsdom environment. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertContractAction, sendContractAction, deleteContractAction } from '../contract-actions';
import type { Activity } from '../types';

interface MockDocSnapshot {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
  ref: {
    update: (updates: Record<string, unknown>) => Promise<void>;
  };
}

const mockContractsStore: Record<string, Record<string, unknown>> = {};
const mockSubmissionsStore: Record<string, Record<string, unknown>> = {};
const mockActivitiesStore: Activity[] = [];

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'usr_test_admin' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('../workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async (_userId: string, _mod: string, _res: string, action: string) => {
    if (action === 'unauthorized_action') return { granted: false, reason: 'Insufficient permissions' };
    return { granted: true };
  }),
}));

vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Activity) => {
    mockActivitiesStore.push(activity);
    return true;
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../services/workspace-resolver', () => ({
  resolveWorkspaceIdFromEntity: vi.fn().mockResolvedValue('ws_default'),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'contracts') {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: !!mockContractsStore[id],
              id,
              data: () => mockContractsStore[id],
              ref: {
                update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                  if (mockContractsStore[id]) {
                    Object.assign(mockContractsStore[id], updates);
                  }
                }),
              },
            }),
            update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
              if (mockContractsStore[id]) {
                Object.assign(mockContractsStore[id], updates);
              }
            }),
          }),
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            const docId = `contract_${Date.now()}`;
            mockContractsStore[docId] = { ...data, id: docId };
            return { id: docId };
          }),
          where: (field1: string, _op1: string, val1: string) => ({
            where: (_field2: string, _op2: string, _val2: string) => ({
              limit: (_count: number) => ({
                get: vi.fn().mockImplementation(async () => {
                  const matching = Object.values(mockContractsStore).filter(
                    (c) => c[field1] === val1
                  );
                  const docs: MockDocSnapshot[] = matching.map((docData) => ({
                    exists: true,
                    id: String(docData.id),
                    data: () => docData,
                    ref: {
                      update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                        Object.assign(docData, updates);
                      }),
                    },
                  }));
                  return { empty: docs.length === 0, docs };
                }),
              }),
            }),
          }),
        };
      }

      if (colName === 'pdfs') {
        return {
          doc: (_pdfId: string) => ({
            collection: (_subName: string) => ({
              doc: (subId: string) => ({
                id: subId,
                get: vi.fn().mockResolvedValue({
                  exists: !!mockSubmissionsStore[subId],
                  data: () => mockSubmissionsStore[subId],
                }),
              }),
            }),
          }),
        };
      }

      return {
        doc: (id: string) => ({ id, get: vi.fn().mockResolvedValue({ exists: false }) }),
      };
    },
    batch: () => ({
      delete: vi.fn().mockImplementation((docRef: { id?: string }) => {
        if (docRef?.id && mockContractsStore[docRef.id]) {
          delete mockContractsStore[docRef.id];
        }
      }),
      commit: vi.fn().mockResolvedValue(true),
    }),
  },
}));

describe('P0.3 Baseline: Contract Actions Lifecycle', () => {
  beforeEach(() => {
    Object.keys(mockContractsStore).forEach((k) => delete mockContractsStore[k]);
    Object.keys(mockSubmissionsStore).forEach((k) => delete mockSubmissionsStore[k]);
    mockActivitiesStore.length = 0;
    vi.clearAllMocks();
  });

  it('creates a new contract draft record when one does not exist', async () => {
    const result = await upsertContractAction({
      entityId: 'ent_alpha_01',
      entityName: 'Alpha Academy',
      pdfId: 'pdf_msa_01',
      pdfName: 'Master Services Agreement',
      status: 'draft',
      userId: 'usr_test_admin',
      workspaceId: 'ws_alpha_01',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();

    const created = mockContractsStore[result.id!];
    expect(created).toBeDefined();
    expect(created.entityName).toBe('Alpha Academy');
    expect(created.status).toBe('draft');
  });

  it('updates an existing contract draft when one already exists for the entity', async () => {
    const existingId = 'contract_existing_01';
    mockContractsStore[existingId] = {
      id: existingId,
      entityId: 'ent_beta_02',
      workspaceId: 'ws_beta_02',
      pdfId: 'pdf_old_01',
      status: 'draft',
    };

    const result = await upsertContractAction({
      entityId: 'ent_beta_02',
      entityName: 'Beta Institute',
      pdfId: 'pdf_new_02',
      pdfName: 'Renewed Agreement',
      status: 'draft',
      userId: 'usr_test_admin',
      workspaceId: 'ws_beta_02',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(existingId);
    expect(mockContractsStore[existingId].pdfId).toBe('pdf_new_02');
  });

  it('dispatches contract to email and SMS recipients and stamps status as sent', async () => {
    const contractId = 'contract_dispatch_01';
    mockContractsStore[contractId] = {
      id: contractId,
      entityId: 'ent_gamma_03',
      entityName: 'Gamma College',
      workspaceId: 'ws_gamma_03',
      status: 'draft',
    };

    const result = await sendContractAction({
      contractId,
      entityId: 'ent_gamma_03',
      entityName: 'Gamma College',
      emailTemplateId: 'tmpl_email_welcome',
      smsTemplateId: 'tmpl_sms_sign_link',
      recipients: [
        { name: 'Dr. Kwame Nkrumah', email: 'kwame@gamma.edu', phone: '+233201234567', type: 'Signatory' },
      ],
      userId: 'usr_test_admin',
      publicUrl: 'https://app.smartsapp.io/forms/pdf_gamma?entityId=ent_gamma_03',
      workspaceId: 'ws_gamma_03',
    });

    expect(result.success).toBe(true);
    expect(mockContractsStore[contractId].status).toBe('sent');
    expect(mockContractsStore[contractId].sentAt).toBeDefined();
    expect(mockActivitiesStore.some((a) => a.type === 'notification_sent')).toBe(true);
  });

  it('deletes contract document and updates audit timeline', async () => {
    const contractId = 'contract_to_delete';
    mockContractsStore[contractId] = {
      id: contractId,
      entityId: 'ent_delta_04',
      workspaceId: 'ws_delta_04',
      status: 'draft',
    };

    const result = await deleteContractAction(
      contractId,
      'pdf_delta',
      'sub_delta',
      'ent_delta_04',
      'usr_test_admin'
    );

    expect(result.success).toBe(true);
    expect(mockContractsStore[contractId]).toBeUndefined();
    expect(mockActivitiesStore.some((a) => a.type === 'pdf_status_changed')).toBe(true);
  });
});
