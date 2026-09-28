/**
 * PURPOSE: Unit tests for Transactional Idempotent Finalization Engine & Downstream Event Wiring.
 * ARCHITECTURAL CONTEXT:
 * Tests the hardened `finalizeAgreementAction` in `src/lib/pdf-actions.ts`.
 * Validates:
 * 1. Idempotency: Double-clicking / re-finalization on already-signed contracts returns gracefully
 *    without duplicate alerts or re-triggering confirmation emails.
 * 2. Signature Offloading: Strips heavy base64 signatures and replaces them with Cloud Storage paths.
 * 3. Cryptographic Evidence: Creates append-only evidence logs and appends vector Audit Certificate.
 * 4. CRM Event Wiring: Emits `deal.contract.signed` when a deal is associated.
 * TESTABILITY: Runs in Vitest. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finalizeAgreementAction } from '../pdf-actions';

const mockPdfsStore: Record<string, Record<string, unknown>> = {};
const mockContractsStore: Record<string, Record<string, unknown>> = {};
const mockSubmissionsStore: Record<string, Record<string, unknown>> = {};
const mockEvidenceStore: Record<string, unknown>[] = [];
const mockEmittedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

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
  logActivity: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: vi.fn().mockImplementation((eventType: string, payload: Record<string, unknown>) => {
    mockEmittedEvents.push({ eventType, payload });
    return { eventId: 'evt_test', eventType, payload, timestamp: new Date().toISOString() };
  }),
}));

const { mockBlankPdfBytes } = vi.hoisted(() => {
  const minimalPdfBase64 =
    'JVBERi0xLjcKJYGBgYEKCjUgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA0Ci9GaXJzdCAyMAovTGVuZ3RoIDI2OAo+PgpzdHJlYW0KeJzVkktLxDAQx+/5FHPUy2Y6TdtESmHt4yLCsnhy8RC2YSnIZukD9Ns7aVbFg3iW8CeP+U1e/0kAgUApSKHQoCBLCcpSyKf3iwO5syc3Cfkw9BMcOIqwhxcha7+cZ0hEVYlvtrazffUnEZMgCfAnsRt9vxzdCGXXdh1igYi5YuWI1HBfswyLeM4x0jxmFeoqXitSxHTLsS4qL2JOiK9sds1vuWc2D0wTWaXj/OvccFYb96C/7mMqIR9939jZwU1zR0g5GtJESmX6+Za/Y3R29v/3cev9B3/+9YU/fA72BpNHF2pgdVnu3eSX8ci2M1eF/3L9YO/9G1cNcstMtiENWiUbbbiCGPkArpqPPwplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqCjw8Ci9TaXplIDcKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCAzNAovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCA3IF0KPj4Kc3RyZWFtCnicFcQxDgAgCASwHsbdN/txCB2K7nLZstV24pF8BkOhArYKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjM4NgolJUVPRg==';
  return {
    mockBlankPdfBytes: Buffer.from(minimalPdfBase64, 'base64'),
  };
});

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
                    get: async () => ({ data: () => docData }),
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
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            const id = `ev_${Date.now()}`;
            const record = { id, ...data };
            mockEvidenceStore.push(record);
            return { id };
          }),
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
    }),
  },
}));

describe('P1.3 Transactional Idempotent Finalization Engine', () => {
  const pdfId = 'pdf_agreement_test';

  beforeEach(() => {
    Object.keys(mockPdfsStore).forEach((k) => delete mockPdfsStore[k]);
    Object.keys(mockContractsStore).forEach((k) => delete mockContractsStore[k]);
    Object.keys(mockSubmissionsStore).forEach((k) => delete mockSubmissionsStore[k]);
    mockEvidenceStore.length = 0;
    mockEmittedEvents.length = 0;
    vi.clearAllMocks();

    mockPdfsStore[pdfId] = {
      id: pdfId,
      name: 'Master Service Agreement',
      publicTitle: 'Master Service Agreement',
      slug: 'msa-2026',
      downloadUrl: 'https://example.com/msa.pdf',
      storagePath: 'templates/msa.pdf',
      status: 'published',
      workspaceIds: ['ws_main_01'],
      fields: [
        {
          id: 'sig_field',
          type: 'signature',
          label: 'Authorized Signature',
          pageNumber: 1,
          position: { x: 10, y: 50 },
          dimensions: { width: 30, height: 10 },
        },
        {
          id: 'signer_email',
          type: 'email',
          label: 'Signer Email',
          pageNumber: 1,
          position: { x: 10, y: 70 },
          dimensions: { width: 40, height: 5 },
        },
      ],
      confirmationMessagingEnabled: false,
      adminAlertsEnabled: false,
    };
  });

  it('finalizes new agreement and offloads base64 signature to cloud storage', async () => {
    const fakeSignatureDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await finalizeAgreementAction(
      pdfId,
      'ent_client_001',
      {
        sig_field: fakeSignatureDataUrl,
        signer_email: 'client@company.com',
        signer_name: 'Ama Serwaa',
      }
    );

    expect(result.success).toBe(true);
    expect(result.submissionId).toBeDefined();

    // Verify submission record
    const sub = mockSubmissionsStore[result.submissionId!];
    expect(sub).toBeDefined();
    expect(sub.status).toBe('submitted');

    // Base64 signature must be offloaded (not raw data URL in submission)
    const subFormData = sub.formData as Record<string, unknown>;
    expect(typeof subFormData.sig_field).toBe('string');
    expect(subFormData.sig_field).not.toMatch(/^data:image\//);
    expect(subFormData.sig_field).toMatch(/^signatures\/ws_main_01\//);

    // Cryptographic evidence record created
    expect(mockEvidenceStore.length).toBeGreaterThan(0);
    const signedEvent = mockEvidenceStore.find((e) => e.action === 'signed');
    expect(signedEvent).toBeDefined();
    expect(signedEvent?.recipientEmail).toBe('client@company.com');
  });

  it('handles idempotency gracefully on double submission', async () => {
    // Simulate pre-existing signed contract
    mockContractsStore['contract_already_signed'] = {
      id: 'contract_already_signed',
      entityId: 'ent_client_002',
      status: 'signed',
      submissionId: 'sub_preexisting_999',
      pdfId,
      signedAt: '2026-09-28T18:00:00Z',
    };
    mockSubmissionsStore['sub_preexisting_999'] = {
      id: 'sub_preexisting_999',
      status: 'submitted',
      formData: { signer_email: 'already@signed.com' },
    };

    const result = await finalizeAgreementAction(
      pdfId,
      'ent_client_002',
      { signer_email: 'already@signed.com' }
    );

    expect(result.success).toBe(true);
    expect(result.submissionId).toBe('sub_preexisting_999');
    expect(result.alreadyFinalized).toBe(true);
  });

  it('emits deal.contract.signed domain event when associated dealId is provided', async () => {
    const result = await finalizeAgreementAction(
      pdfId,
      'ent_client_003',
      {
        signer_email: 'deal_client@example.com',
        dealId: 'deal_enterprise_456',
      }
    );

    expect(result.success).toBe(true);
    expect(mockEmittedEvents.some((e) => e.eventType === 'deal.contract.signed')).toBe(true);
    const dealEvent = mockEmittedEvents.find((e) => e.eventType === 'deal.contract.signed');
    expect(dealEvent?.payload.dealId).toBe('deal_enterprise_456');
    expect(dealEvent?.payload.workspaceId).toBe('ws_main_01');
  });
});
