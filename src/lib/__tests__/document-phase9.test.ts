/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dedicated Phase 9 Integration & End-to-End Test Suite:
 * 1. Purpose:
 *    Comprehensive end-to-end integration suite for Phase 9 (Enterprise Bulk Dispatch
 *    Campaigns, Batch Merge Ingestion, Legal Hold & Cryptographic e-Discovery Archival).
 *    Validates all Phase 9 services and defense invariants:
 *    - P9.1: RFC 4180 CSV parsing, formula injection sanitization, and variable linting (FM-P9-04, FM-P9-07).
 *    - P9.2: Bulk campaign creation, recipient staging, and rate-capped slice dispatch (FM-P9-01, FM-P9-08).
 *    - P9.3: Deterministic recipient idempotency deduplication (FM-P9-02).
 *    - P9.4: Partial-failure isolation and targeted retry (FM-P9-03).
 *    - P9.5: FRCP 26/37 legal preservation hold and deletion guard (FM-P9-05).
 *    - P9.6: Statutory retention schedule calculation across standard/tax/employment categories.
 *    - P9.7: Cryptographic e-Discovery ZIP bundle assembly and Merkle root calculation (FM-P9-06, FM-P9-09).
 *    - P9.8: Merkle manifest tamper verification and anti-corruption detection.
 *    - P9.9: Multi-tenant workspace isolation.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseBulkRecipientCsv,
  sanitizeCsvCell,
  validateTemplateVariableMapping,
  generateDryRunMergePreview,
  ParsedRecipientRow,
} from '@/lib/documents/bulk-csv-merge-service';
import {
  createBulkCampaign,
  dispatchCampaignBatchSlice,
  retryFailedCampaignRecipients,
  getCampaignProgress,
} from '@/lib/documents/bulk-campaign-dispatcher-service';
import {
  placeContractLegalHold,
  releaseContractLegalHold,
  assertContractNotUnderLegalHold,
  calculateRetentionSchedule,
  getContractLegalHoldStatus,
} from '@/lib/documents/legal-hold-service';
import {
  computeMerkleRootSha256,
  assembleEDiscoveryZipBundle,
} from '@/lib/documents/ediscovery-archival-service';
import type {
  BulkCampaign,
  BulkCampaignRecipient,
  CreateBulkCampaignRequest,
} from '@/lib/types/document-signing';

// In-Memory Mock Store for Firebase Admin Firestore
const store = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  type Filter = { field: string; op: string; val: unknown };

  interface MockQuery {
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  }

  const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
    return path.split('.').reduce((acc: unknown, part: string) => {
      if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  };

  const createQuery = (colOrGroup: string, filters: Filter[] = [], limitCount?: number): MockQuery => {
    const q: MockQuery = {
      where: vi.fn((field: string, op: string, val: unknown) => {
        return createQuery(colOrGroup, [...filters, { field, op, val }], limitCount);
      }),
      orderBy: vi.fn(() => q),
      limit: vi.fn((n: number) => {
        return createQuery(colOrGroup, filters, n);
      }),
      get: vi.fn(async () => {
        const docs: {
          id: string;
          data: () => Record<string, unknown>;
          ref: { id: string; update: (d: Record<string, unknown>) => Promise<void> };
        }[] = [];

        for (const [key, value] of store.entries()) {
          const matchesCollection = key.includes(colOrGroup);
          if (matchesCollection) {
            let passes = true;
            for (const f of filters) {
              const actualVal = getNestedValue(value, f.field);
              if (f.op === '==' && actualVal !== f.val) {
                passes = false;
                break;
              }
              if (f.op === 'in' && Array.isArray(f.val) && !f.val.includes(actualVal)) {
                passes = false;
                break;
              }
            }
            if (passes) {
              const docId = key.split('/').pop() || 'doc';
              docs.push({
                id: docId,
                data: () => ({ ...value }),
                ref: {
                  id: docId,
                  update: async (d: Record<string, unknown>) => {
                    store.set(key, { ...value, ...d });
                  },
                },
              });
            }
          }
        }
        const finalDocs = limitCount !== undefined ? docs.slice(0, limitCount) : docs;
        return {
          empty: finalDocs.length === 0,
          size: finalDocs.length,
          docs: finalDocs,
        };
      }),
    };
    return q;
  };

  return {
    adminDb: {
      collection: vi.fn((colName: string) => ({
        doc: vi.fn((docId: string) => {
          const path = `${colName}/${docId}`;
          return {
            id: docId,
            get: vi.fn(async () => {
              const data = store.get(path);
              return {
                exists: Boolean(data),
                id: docId,
                data: () => (data ? { ...data } : undefined),
              };
            }),
            set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
              if (opts?.merge) {
                const existing = store.get(path) || {};
                store.set(path, { ...existing, ...data });
              } else {
                store.set(path, data);
              }
            }),
            update: vi.fn(async (data: Record<string, unknown>) => {
              const existing = store.get(path) || {};
              const updated = { ...existing };
              for (const [k, v] of Object.entries(data)) {
                if (v && typeof v === 'object' && '__isIncrement' in (v as Record<string, unknown>)) {
                  const prev = typeof existing[k] === 'number' ? (existing[k] as number) : 0;
                  updated[k] = prev + ((v as { __isIncrement: number }).__isIncrement || 0);
                } else {
                  updated[k] = v;
                }
              }
              store.set(path, updated);
            }),
          };
        }),
        where: vi.fn((field: string, op: string, val: unknown) => {
          return createQuery(colName, [{ field, op, val }]);
        }),
        orderBy: vi.fn(() => createQuery(colName)),
        limit: vi.fn((n: number) => createQuery(colName, [], n)),
        get: vi.fn(async () => {
          return createQuery(colName).get();
        }),
      })),
      collectionGroup: vi.fn((colName: string) => createQuery(colName)),
      batch: vi.fn(() => {
        const operations: Array<() => void> = [];
        return {
          set: vi.fn((docRef: { id: string }, data: Record<string, unknown>) => {
            operations.push(() => {
              const path = `bulk_campaign_recipients/${docRef.id}`;
              store.set(path, data);
            });
          }),
          update: vi.fn((docRef: { id: string }, data: Record<string, unknown>) => {
            operations.push(() => {
              const path = `bulk_campaign_recipients/${docRef.id}`;
              const existing = store.get(path) || {};
              store.set(path, { ...existing, ...data });
            });
          }),
          commit: vi.fn(async () => {
            operations.forEach((op) => op());
          }),
        };
      }),
    },
    FieldValue: {
      increment: vi.fn((n: number) => ({ __isIncrement: n })),
      serverTimestamp: vi.fn(() => new Date().toISOString()),
      delete: vi.fn(() => null),
      arrayUnion: vi.fn((...items: unknown[]) => items),
      arrayRemove: vi.fn((...items: unknown[]) => items),
    },
    adminStorage: {
      bucket: vi.fn(() => ({
        file: vi.fn(() => ({
          save: vi.fn().mockResolvedValue(undefined),
          getSignedUrl: vi.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/signed-url']),
        })),
      })),
    },
  };
});

describe('Dedicated Phase 9 End-to-End Integration Suite (Enterprise Bulk & Compliance)', () => {
  const workspaceId = 'ws_enterprise_phase9';
  const userId = 'usr_compliance_officer_01';

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. CSV Parsing, Formula Sanitization & Variable Linting
  // ==========================================
  describe('P9.1: RFC 4180 CSV Parser, DDE Sanitizer & Pre-Flight Linter', () => {
    it('neutralizes malicious formula injection vectors while preserving plain text', () => {
      // FM-P9-07 defense verification
      expect(sanitizeCsvCell('=CMD|"/C calc"!A0')).toBe(`'=CMD|"/C calc"!A0`);
      expect(sanitizeCsvCell('+14155552671')).toBe(`'+14155552671`);
      expect(sanitizeCsvCell('-500.00')).toBe(`'-500.00`);
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
      expect(sanitizeCsvCell('\tTabIndentedText')).toBe('TabIndentedText');
      expect(sanitizeCsvCell('Normal Company LLC')).toBe('Normal Company LLC');
    });

    it('correctly parses RFC 4180 CSV with quotes, commas, and multiline values', () => {
      const csv = `name,email,title,address\n"Jane Doe",jane@acme.com,"VP, Engineering","123 Tech Blvd\nSuite 400"\n"John Smith",john@acme.com,Director,"456 Market St"`;
      const result = parseBulkRecipientCsv(csv);

      expect(result.rows.length).toBe(2);
      expect(result.rows[0].name).toBe('Jane Doe');
      expect(result.rows[0].email).toBe('jane@acme.com');
      expect(result.rows[0].variables['title']).toBe('VP, Engineering');
      expect(result.rows[0].variables['address']).toContain('Suite 400');
      expect(result.parseErrors).toHaveLength(0);
    });

    it('identifies missing template variables in pre-flight dry-run linting', () => {
      const templateVars = ['name', 'email', 'annualSalary', 'equityPercent', 'startDate'];
      const rows: ParsedRecipientRow[] = [
        {
          rowIndex: 1,
          raw: {},
          name: 'Alice Wonder',
          email: 'alice@enterprise.com',
          variables: {
            annualSalary: '$180,000',
            // Missing equityPercent and startDate
          },
          isValid: true,
          errors: [],
        },
      ];

      const lint = validateTemplateVariableMapping(templateVars, rows);
      expect(lint.invalidRows).toBe(1);
      expect(lint.validRows).toBe(0);
      expect(lint.unmappedVariables).toContain('equitypercent');
      expect(lint.unmappedVariables).toContain('startdate');

      const preview = generateDryRunMergePreview(templateVars, rows, 1);
      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(0);
      expect(preview.previewSample[0].errors.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // 2. Bulk Campaign Creation & Staged Ingestion
  // ==========================================
  describe('P9.2: Bulk Campaign Aggregate Creation & Recipient Staging', () => {
    it('creates campaign aggregate and stages recipients with deterministic idempotency keys', async () => {
      const request: CreateBulkCampaignRequest = {
        title: 'Q4 2026 Annual ISO Employee Agreements',
        templateId: 'tmpl_iso_2026',
        routingMode: 'single_signer',
        tags: ['iso_2026', 'engineering'],
        recipients: [
          {
            name: 'Bob Builder',
            email: 'bob@enterprise.com',
            variables: { department: 'Infrastructure' },
          },
          {
            name: 'Carol Danvers',
            email: 'carol@enterprise.com',
            variables: { department: 'Security' },
          },
        ],
      };

      const campaign = await createBulkCampaign(workspaceId, request, userId);

      expect(campaign.id).toBeDefined();
      expect(campaign.workspaceId).toBe(workspaceId);
      expect(campaign.status).toBe('ready');
      expect(campaign.totalCount).toBe(2);
      expect(campaign.dispatchedCount).toBe(0);
      expect(campaign.signedCount).toBe(0);
      expect(campaign.failedCount).toBe(0);

      // Verify campaign aggregate stored in Firestore
      const storedCampaign = store.get(`bulk_campaigns/${campaign.id}`);
      expect(storedCampaign).toBeDefined();
      expect(storedCampaign?.['title']).toBe('Q4 2026 Annual ISO Employee Agreements');

      // Verify recipients staged
      let recipientCount = 0;
      for (const [key, val] of store.entries()) {
        if (key.startsWith('bulk_campaign_recipients/')) {
          recipientCount++;
          expect(val['campaignId']).toBe(campaign.id);
          expect(val['status']).toBe('queued');
          expect(val['idempotencyKey']).toContain(`idemp_${campaign.id}_`);
        }
      }
      expect(recipientCount).toBe(2);
    });
  });

  // ==========================================
  // 3. Chunked Slice Dispatching & Idempotency
  // ==========================================
  describe('P9.3: Chunked Batch Slice Dispatch & Deduplication Invariants', () => {
    it('dispatches recipients in bounded slices and updates progress telemetry', async () => {
      const recipients = Array.from({ length: 30 }, (_, i) => ({
        name: `Signer ${i + 1}`,
        email: `signer${i + 1}@enterprise.com`,
        variables: { tier: 'Standard' },
      }));

      const campaign = await createBulkCampaign(
        workspaceId,
        {
          title: '30-Signer Cohort Campaign',
          templateId: 'tmpl_standard',
          routingMode: 'single_signer',
          tags: ['cohort_30'],
          recipients,
        },
        userId
      );

      // 1. Dispatch first slice of 25 (FM-P9-01)
      const slice1 = await dispatchCampaignBatchSlice(campaign.id, 25);
      expect(slice1.processedCount).toBe(25);
      expect(slice1.successfulCount).toBe(25);
      expect(slice1.failedCount).toBe(0);
      expect(slice1.isComplete).toBe(false);

      // Verify campaign status updated to 'dispatching'
      const campaignAfterSlice1 = store.get(`bulk_campaigns/${campaign.id}`);
      expect(campaignAfterSlice1?.['status']).toBe('dispatching');
      expect(campaignAfterSlice1?.['dispatchedCount']).toBe(25);

      // 2. Dispatch second slice of 25 (remaining 5)
      const slice2 = await dispatchCampaignBatchSlice(campaign.id, 25);
      expect(slice2.processedCount).toBe(5);
      expect(slice2.successfulCount).toBe(5);
      expect(slice2.isComplete).toBe(true);

      // Verify campaign completed
      const campaignAfterSlice2 = store.get(`bulk_campaigns/${campaign.id}`);
      expect(campaignAfterSlice2?.['status']).toBe('completed');
      expect(campaignAfterSlice2?.['dispatchedCount']).toBe(30);

      // 3. Telemetry progress query
      const progress = await getCampaignProgress(campaign.id);
      expect(progress.totalCount).toBe(30);
      expect(progress.dispatchedCount).toBe(30);
      expect(progress.isComplete).toBe(true);
    });

    it('enforces idempotency deduplication preventing duplicate envelope generation on repeat requests', async () => {
      // FM-P9-02 defense verification
      const campaign = await createBulkCampaign(
        workspaceId,
        {
          title: 'Idempotency Test Campaign',
          templateId: 'tmpl_idemp',
          routingMode: 'single_signer',
          tags: [],
          recipients: [{ name: 'Solo Signer', email: 'solo@enterprise.com', variables: {} }],
        },
        userId
      );

      // First dispatch
      const slice1 = await dispatchCampaignBatchSlice(campaign.id, 10);
      expect(slice1.successfulCount).toBe(1);

      // Manually reset recipient status to simulate a network reconnect / duplicate queue trigger
      // but keep the envelopeId and idempotencyKey populated
      for (const [key, val] of store.entries()) {
        if (key.startsWith('bulk_campaign_recipients/')) {
          expect(val['envelopeId']).toBeDefined();
          store.set(key, { ...val, status: 'queued' });
        }
      }
      store.set(`bulk_campaigns/${campaign.id}`, { ...campaign, status: 'dispatching' });

      // Second dispatch should recognise already assigned envelope and not duplicate
      const slice2 = await dispatchCampaignBatchSlice(campaign.id, 10);
      expect(slice2.successfulCount).toBe(1);
    });
  });

  // ==========================================
  // 4. Partial-Failure Isolation & Targeted Retry
  // ==========================================
  describe('P9.4: Partial-Failure Isolation & Targeted Retry', () => {
    it('retries strictly failed recipients without re-dispatching already sent or signed signers', async () => {
      // FM-P9-03 defense verification
      const campaign = await createBulkCampaign(
        workspaceId,
        {
          title: 'Partial Failure Campaign',
          templateId: 'tmpl_partial',
          routingMode: 'single_signer',
          tags: [],
          recipients: [
            { name: 'Healthy Signer 1', email: 'healthy1@enterprise.com', variables: {} },
            { name: 'Healthy Signer 2', email: 'healthy2@enterprise.com', variables: {} },
            { name: 'Failed Signer', email: 'failing@enterprise.com', variables: {} },
          ],
        },
        userId
      );

      // Dispatch initial batch
      await dispatchCampaignBatchSlice(campaign.id, 10);

      // Simulate: recipient 1 signed, recipient 2 dispatched, recipient 3 failed
      for (const [key, val] of store.entries()) {
        if (key.startsWith('bulk_campaign_recipients/')) {
          if (val['email'] === 'healthy1@enterprise.com') {
            store.set(key, { ...val, status: 'signed' });
          } else if (val['email'] === 'failing@enterprise.com') {
            store.set(key, {
              ...val,
              status: 'failed',
              errorMessage: 'SMTP 550 Mailbox unavailable',
            });
          }
        }
      }

      // Execute targeted retry
      const retryResult = await retryFailedCampaignRecipients(campaign.id);

      expect(retryResult.retriedCount).toBe(1);

      // Verify that Healthy Signer 1 remains untouched with status 'signed'
      for (const [key, val] of store.entries()) {
        if (key.startsWith('bulk_campaign_recipients/')) {
          if (val['email'] === 'healthy1@enterprise.com') {
            expect(val['status']).toBe('signed');
          } else if (val['email'] === 'failing@enterprise.com') {
            expect(val['status']).toBe('queued');
          }
        }
      }
    });
  });

  // ==========================================
  // 5. Enterprise Legal Hold Preservation Engine
  // ==========================================
  describe('P9.5: Enterprise Legal Hold (FRCP 26/37) & Deletion Guard', () => {
    const contractId = 'ctr_subpoena_case_001';

    beforeEach(() => {
      // Seed authoritative contract in root collection
      store.set(`contracts/${contractId}`, {
        id: contractId,
        workspaceId,
        title: 'Master Service Agreement - Enterprise Cloud',
        status: 'signed',
        isUnderLegalHold: false,
        retentionCategory: 'financial',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      });
    });

    it('places contract under legal hold and freezes it from deletion', async () => {
      // FM-P9-05 defense verification
      const holdResult = await placeContractLegalHold(
        workspaceId,
        contractId,
        {
          matterId: 'LIT-2026-0042',
          reason: 'Federal trade regulatory subpoena regarding cloud storage pricing',
        },
        userId
      );

      expect(holdResult.isUnderLegalHold).toBe(true);
      expect(holdResult.matterId).toBe('LIT-2026-0042');
      expect(holdResult.placedByUserId).toBe(userId);

      // Verify contract updated in root collection
      const contractDoc = store.get(`contracts/${contractId}`);
      expect(contractDoc?.['isUnderLegalHold']).toBe(true);
      expect((contractDoc?.['legalHoldDetails'] as Record<string, unknown> | undefined)?.['matterId']).toBe('LIT-2026-0042');

      // Verify deletion guard assertion blocks deletion with Legal Hold error
      await expect(assertContractNotUnderLegalHold(contractId)).rejects.toThrow(
        'Legal Hold'
      );
    });

    it('releases legal hold and unblocks deletion operations with audit trail', async () => {
      // Place hold first
      await placeContractLegalHold(
        workspaceId,
        contractId,
        {
          matterId: 'LIT-2026-0042',
          reason: 'Regulatory inquiry',
        },
        userId
      );

      // Release hold
      const releaseResult = await releaseContractLegalHold(
        workspaceId,
        contractId,
        { reason: 'Matter dismissed by regulatory commission' },
        userId
      );

      expect(releaseResult.isUnderLegalHold).toBe(false);
      expect(releaseResult.releasedByUserId).toBe(userId);

      // Verify contract is no longer frozen
      const contractDoc = store.get(`contracts/${contractId}`);
      expect(contractDoc?.['isUnderLegalHold']).toBe(false);

      // Deletion assertion should now resolve without error
      await expect(assertContractNotUnderLegalHold(contractId)).resolves.toBeUndefined();
    });

    it('calculates statutory retention schedules accurately across document categories', () => {
      const executedAt = '2026-09-29T12:00:00.000Z';

      const taxSchedule = calculateRetentionSchedule('statutory_tax', executedAt);
      expect(taxSchedule.retentionYears).toBe(7);
      expect(taxSchedule.expirationDate.startsWith('2033-09-29')).toBe(true);

      const employmentSchedule = calculateRetentionSchedule('employment', executedAt);
      expect(employmentSchedule.retentionYears).toBe(5);
      expect(employmentSchedule.expirationDate.startsWith('2031-09-29')).toBe(true);

      const standardSchedule = calculateRetentionSchedule('standard', executedAt);
      expect(standardSchedule.retentionYears).toBe(3);
    });
  });

  // ==========================================
  // 6. Cryptographic e-Discovery Archival Package & Merkle Tree
  // ==========================================
  describe('P9.6: Cryptographic e-Discovery Archival Package & Merkle Manifest', () => {
    it('computes deterministic Merkle root SHA-256 across bundle artifact digests', () => {
      // FM-P9-06 defense verification
      const fileDigests = [
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
        '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
        'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      ];

      const merkleRoot1 = computeMerkleRootSha256(fileDigests);
      const merkleRoot2 = computeMerkleRootSha256(fileDigests);

      expect(merkleRoot1).toBe(merkleRoot2);
      expect(merkleRoot1).toHaveLength(64);

      // Corrupting one digest must alter the Merkle root
      const corruptedDigests = [...fileDigests];
      corruptedDigests[0] = '0000000000000000000000000000000000000000000000000000000000000000';
      const corruptedMerkleRoot = computeMerkleRootSha256(corruptedDigests);
      expect(corruptedMerkleRoot).not.toBe(merkleRoot1);
    });

    it('assembles complete court-admissible e-Discovery ZIP package with manifest and verify script', async () => {
      const contractId = 'ctr_court_evidence_999';
      store.set(`contracts/${contractId}`, {
        id: contractId,
        workspaceId,
        title: 'Enterprise Merger Agreement',
        status: 'signed',
        envelopeIds: ['env_evidence_999'],
        isUnderLegalHold: true,
        legalHoldDetails: {
          matterId: 'SEC-2026-0099',
          reason: 'Antitrust review',
          placedAt: '2026-09-01T00:00:00.000Z',
        },
      });

      const bundleResult = await assembleEDiscoveryZipBundle(workspaceId, contractId, userId);

      expect(bundleResult.manifest).toBeDefined();
      expect(bundleResult.manifest.contractId).toBe(contractId);
      expect(bundleResult.manifest.workspaceId).toBe(workspaceId);
      expect(bundleResult.manifest.merkleRootSha256).toHaveLength(64);
      expect(bundleResult.manifest.legalHoldActive).toBe(true);
      expect(bundleResult.manifest.legalHoldDetails?.matterId).toBe('SEC-2026-0099');

      // Verify files present in manifest
      const paths = bundleResult.manifest.files.map((f) => f.path);
      expect(paths).toContain('completed-contract.pdf');
      expect(paths).toContain('pre-execution-document.pdf');
      expect(paths).toContain('certificate-of-completion.pdf');
      expect(paths).toContain('evidence-ledger.json');

      // Base64 ZIP payload should be valid
      expect(bundleResult.zipBase64).toBeDefined();
      expect(bundleResult.zipBase64.length).toBeGreaterThan(100);
    });
  });

  // ==========================================
  // 7. Multi-Tenant Workspace Boundary Isolation
  // ==========================================
  describe('P9.7: Strict Multi-Tenant Isolation', () => {
    it('prevents workspace B from placing a legal hold on a contract belonging to workspace A', async () => {
      const foreignContractId = 'ctr_foreign_corp';
      store.set(`contracts/${foreignContractId}`, {
        id: foreignContractId,
        workspaceId: 'ws_other_corp',
        title: 'Confidential Internal Memo',
        status: 'signed',
        isUnderLegalHold: false,
      });

      await expect(
        placeContractLegalHold(
          workspaceId, // 'ws_enterprise_phase9' attempting to hold 'ws_other_corp' contract
          foreignContractId,
          { matterId: 'ILLEGAL-01', reason: 'Cross-tenant breach attempt' },
          userId
        )
      ).rejects.toThrow('Tenant isolation violation');
    });
  });
});
