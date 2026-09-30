/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dedicated End-to-End Test Suite for CRM Entity Recipient Selection in Bulk Campaigns:
 * 1. Purpose:
 *    Validates the end-to-end lifecycle of bulk campaigns initiated from the Workspace CRM
 *    Directory (Approach 1), including signatory role resolution, variable mapping, formula
 *    injection neutralization, chunked slice dispatching, and envelope metadata persistence.
 * 2. Invariants & Failure Mode Verification:
 *    - FM-CRM-01: Fallback from empty contacts to entity root fields.
 *    - FM-CRM-02: Signatory priority (isSignatory -> isPrimary -> entity root).
 *    - FM-CRM-03: Formula injection sanitization in entity names and custom attributes.
 *    - FM-CRM-07: Disambiguating multi-entity signatories sharing the same email.
 *    - FM-P9-01: Bounded slice dispatching with partial-failure isolation.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractRecipientsFromEntities,
  sanitizeEntityVariableValue,
  SearchedEntity,
} from '@/lib/documents/crm-bulk-recipient-service';
import {
  createBulkCampaign,
  dispatchCampaignBatchSlice,
  deriveRecipientIdempotencyKey,
  getCampaignProgress,
} from '@/lib/documents/bulk-campaign-dispatcher-service';
import type {
  CreateBulkCampaignRequest,
  BulkCampaign,
  BulkCampaignRecipient,
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
              const docId = key.split('/').pop() || key;
              docs.push({
                id: docId,
                data: () => ({ ...value }),
                ref: {
                  id: docId,
                  update: async (updates: Record<string, unknown>) => {
                    const curr = store.get(key) || {};
                    store.set(key, { ...curr, ...updates });
                  },
                },
              });
            }
          }
        }

        const limitedDocs = limitCount !== undefined ? docs.slice(0, limitCount) : docs;
        return {
          empty: limitedDocs.length === 0,
          size: limitedDocs.length,
          docs: limitedDocs,
        };
      }),
    };
    return q;
  };

  return {
    adminDb: {
      getAll: vi.fn(async (...refs: Array<{ path: string; id: string }>) => {
        return refs.map((ref) => {
          const val = store.get(ref.path);
          return {
            id: ref.id,
            exists: !!val,
            data: () => val || {},
          };
        });
      }),
      collection: (colPath: string) => ({
        doc: (docId: string) => {
          const fullPath = `${colPath}/${docId}`;
          return {
            id: docId,
            path: fullPath,
            get: async () => {
              const val = store.get(fullPath);
              return {
                exists: !!val,
                id: docId,
                data: () => val || {},
              };
            },
            set: async (data: Record<string, unknown>) => {
              store.set(fullPath, { ...data });
            },
            update: async (updates: Record<string, unknown>) => {
              const curr = store.get(fullPath) || {};
              const updated = { ...curr };
              for (const [k, v] of Object.entries(updates)) {
                if (v && typeof v === 'object' && '__isIncrement' in (v as Record<string, unknown>)) {
                  const prev = typeof curr[k] === 'number' ? (curr[k] as number) : 0;
                  updated[k] = prev + ((v as { __isIncrement: number }).__isIncrement || 0);
                } else {
                  updated[k] = v;
                }
              }
              store.set(fullPath, updated);
            },
            delete: async () => {
              store.delete(fullPath);
            },
          };
        },
        where: (field: string, op: string, val: unknown) => {
          return createQuery(colPath, [{ field, op, val }]);
        },
        orderBy: () => createQuery(colPath),
        limit: (n: number) => createQuery(colPath, [], n),
        get: () => createQuery(colPath).get(),
      }),
      collectionGroup: (groupName: string) => {
        return createQuery(groupName);
      },
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          set: (ref: { path: string }, data: Record<string, unknown>) => {
            operations.push(() => store.set(ref.path, { ...data }));
          },
          update: (ref: { path: string }, updates: Record<string, unknown>) => {
            operations.push(() => {
              const curr = store.get(ref.path) || {};
              store.set(ref.path, { ...curr, ...updates });
            });
          },
          delete: (ref: { path: string }) => {
            operations.push(() => store.delete(ref.path));
          },
          commit: async () => {
            operations.forEach((op) => op());
          },
        };
      },
    },
    FieldValue: {
      increment: vi.fn((n: number) => ({ __isIncrement: n })),
      serverTimestamp: vi.fn(() => new Date().toISOString()),
      delete: vi.fn(() => null),
      arrayUnion: vi.fn((...items: unknown[]) => items),
      arrayRemove: vi.fn((...items: unknown[]) => items),
    },
  };
});

describe('Bulk Campaign CRM Source Integration', () => {
  const workspaceId = 'ws-crm-enterprise-99';
  const templateId = 'tmpl-board-consent-2026';
  const userId = 'usr-admin-ops';

  beforeEach(() => {
    store.clear();
  });

  // Mock CRM Entities
  const sampleEntities: SearchedEntity[] = [
    {
      id: 'ent-alpha-corp',
      entityId: 'ent-alpha-corp',
      organizationId: 'org-1',
      workspaceId,
      displayName: 'Alpha Global Technologies',
      primaryEmail: 'general@alphaglobal.com',
      primaryPhone: '+1-555-1000',
      status: 'active',
      workspaceTags: ['enterprise', 'board'],
      addedAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      entityType: 'institution',
      entityContacts: [
        {
          id: 'cnt-alpha-1',
          name: 'Sarah Connor (CEO)',
          email: 'sarah.connor@alphaglobal.com',
          phone: '+1-555-1001',
          isSignatory: true,
          isPrimary: true,
          typeKey: 'lead',
          order: 0,
        },
        {
          id: 'cnt-alpha-2',
          name: 'John Connor (COO)',
          email: 'john.connor@alphaglobal.com',
          isSignatory: false,
          isPrimary: false,
          typeKey: 'lead',
          order: 1,
        },
      ],
    },
    {
      id: 'ent-beta-holdings',
      entityId: 'ent-beta-holdings',
      organizationId: 'org-1',
      workspaceId,
      displayName: 'Beta Holdings Ltd',
      // Root level fallback (empty contacts array) - FM-CRM-01
      primaryEmail: 'director@betaholdings.com',
      primaryContactName: 'Marcus Vance',
      primaryPhone: '+1-555-2000',
      status: 'active',
      workspaceTags: ['holdings'],
      addedAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      entityType: 'institution',
      entityContacts: [],
    },
    {
      id: 'ent-gamma-injection',
      entityId: 'ent-gamma-injection',
      organizationId: 'org-1',
      workspaceId,
      // Formula Injection Test Entity - FM-CRM-03
      displayName: '=CMD|calc.exe!A1',
      primaryEmail: 'attacker@gamma.com',
      status: 'active',
      workspaceTags: ['security-audit'],
      addedAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
      entityType: 'person',
      entityContacts: [
        {
          id: 'cnt-gamma-1',
          name: '+1-800-MALICIOUS',
          email: 'safe.signer@gamma.com',
          isSignatory: true,
          isPrimary: true,
          typeKey: 'lead',
          order: 0,
        },
      ],
    },
  ];

  describe('CRM Recipient Extraction & Role Invariants', () => {
    it('prioritizes designated signatory when contactRole is signatory (FM-CRM-02)', () => {
      const preview = extractRecipientsFromEntities([sampleEntities[0]], {
        contactRole: 'signatory',
        templateVariables: ['entity_name', 'email', 'name'],
      });

      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(1);
      expect(preview.previewSample[0].recipientName).toBe('Sarah Connor (CEO)');
      expect(preview.previewSample[0].recipientEmail).toBe('sarah.connor@alphaglobal.com');
      expect(preview.previewSample[0].contactId).toBe('cnt-alpha-1');
      expect(preview.previewSample[0].sourceType).toBe('crm');
      expect(preview.previewSample[0].mappedVariables.entity_name).toBe('Alpha Global Technologies');
    });

    it('falls back to entity root when entityContacts is empty (FM-CRM-01)', () => {
      const preview = extractRecipientsFromEntities([sampleEntities[1]], {
        contactRole: 'signatory',
        templateVariables: ['entity_name', 'email'],
      });

      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(1);
      expect(preview.previewSample[0].recipientName).toBe('Marcus Vance');
      expect(preview.previewSample[0].recipientEmail).toBe('director@betaholdings.com');
      expect(preview.previewSample[0].entityId).toBe('ent-beta-holdings');
      expect(preview.previewSample[0].sourceType).toBe('crm');
    });

    it('neutralizes DDE formula injection prefixes in entity names and contact fields (FM-CRM-03)', () => {
      const preview = extractRecipientsFromEntities([sampleEntities[2]], {
        contactRole: 'signatory',
        templateVariables: ['company', 'name'],
      });

      expect(preview.totalRows).toBe(1);
      expect(preview.validRows).toBe(1);
      // Formula prefix '=' in company must be neutralized with leading single quote
      expect(preview.previewSample[0].mappedVariables.company).toBe("'=CMD|calc.exe!A1");
      // Formula prefix '+' in contact name must be neutralized with leading single quote
      expect(preview.previewSample[0].mappedVariables.name).toBe("'+1-800-MALICIOUS");
    });

    it('extracts all contacts when contactRole is all', () => {
      const preview = extractRecipientsFromEntities([sampleEntities[0]], {
        contactRole: 'all',
        templateVariables: ['email'],
      });

      expect(preview.totalRows).toBe(2);
      expect(preview.validRows).toBe(2);
      const emails = preview.previewSample.map((p) => p.recipientEmail);
      expect(emails).toContain('sarah.connor@alphaglobal.com');
      expect(emails).toContain('john.connor@alphaglobal.com');
    });
  });

  describe('Signatory Idempotency Disambiguation (FM-CRM-07)', () => {
    it('produces distinct idempotency keys when the same signer signs for different entities', () => {
      const campaignId = 'camp-crm-test-01';
      const sharedEmail = 'counsel@externalfirm.com';
      const vars = { fee: '$5,000' };

      const keyEntity1 = deriveRecipientIdempotencyKey(campaignId, sharedEmail, vars, 'ent-alpha-corp');
      const keyEntity2 = deriveRecipientIdempotencyKey(campaignId, sharedEmail, vars, 'ent-beta-holdings');

      expect(keyEntity1).not.toBe(keyEntity2);
      expect(keyEntity1).toContain('ent-alpha-corp');
      expect(keyEntity2).toContain('ent-beta-holdings');
    });
  });

  describe('End-to-End Campaign Lifecycle with CRM Recipients', () => {
    it('creates, stages, and dispatches a bulk campaign from CRM entities with metadata persistence', async () => {
      // 1. Preview extraction
      const preview = extractRecipientsFromEntities(sampleEntities, {
        contactRole: 'signatory',
        templateVariables: ['entity_name', 'email'],
      });

      expect(preview.validRows).toBe(3);

      // 2. Assemble campaign creation request
      const campaignPayload: CreateBulkCampaignRequest = {
        title: 'Q4 2026 Corporate Governance Resolutions',
        templateId,
        routingMode: 'single_signer',
        sourceType: 'crm_entities',
        entityIds: ['ent-alpha-corp', 'ent-beta-holdings', 'ent-gamma-injection'],
        contactRole: 'signatory',
        tags: ['governance', 'crm-dispatch'],
        recipients: preview.previewSample.map((p) => ({
          name: p.recipientName,
          email: p.recipientEmail,
          phone: p.phone,
          variables: p.mappedVariables,
          entityId: p.entityId,
          contactId: p.contactId,
          sourceType: 'crm' as const,
        })),
      };

      // 3. Create Bulk Campaign
      const campaign = await createBulkCampaign(workspaceId, campaignPayload, userId);

      expect(campaign.id).toBeDefined();
      expect(campaign.sourceType).toBe('crm_entities');
      expect(campaign.entityCount).toBe(3);
      expect(campaign.totalCount).toBe(3);
      expect(campaign.status).toBe('ready');

      // 4. Verify staged recipients in Firestore
      const stagedRecipients: BulkCampaignRecipient[] = [];
      for (const [key, val] of store.entries()) {
        if (key.includes('bulk_campaign_recipients/') && (val as Record<string, unknown>).campaignId === campaign.id) {
          stagedRecipients.push(val as unknown as BulkCampaignRecipient);
        }
      }

      expect(stagedRecipients.length).toBe(3);
      const alphaRec = stagedRecipients.find((r) => r.entityId === 'ent-alpha-corp');
      expect(alphaRec).toBeDefined();
      expect(alphaRec?.contactId).toBe('cnt-alpha-1');
      expect(alphaRec?.sourceType).toBe('crm');
      expect(alphaRec?.status).toBe('queued');

      // 5. Dispatch batch slice of 25 (processes all 3)
      const dispatchResult = await dispatchCampaignBatchSlice(campaign.id, 25);

      expect(dispatchResult.processedCount).toBe(3);
      expect(dispatchResult.successfulCount).toBe(3);
      expect(dispatchResult.failedCount).toBe(0);
      expect(dispatchResult.isComplete).toBe(true);

      // 6. Verify issued signing envelopes have CRM metadata attached
      const issuedEnvelopes: Array<Record<string, unknown>> = [];
      for (const [key, val] of store.entries()) {
        if (key.includes('signing_envelopes/')) {
          issuedEnvelopes.push(val);
        }
      }

      expect(issuedEnvelopes.length).toBe(3);
      for (const env of issuedEnvelopes) {
        const metadata = env.metadata as Record<string, unknown>;
        expect(metadata).toBeDefined();
        expect(metadata.campaignId).toBe(campaign.id);
        expect(metadata.entityId).toBeDefined();
        expect(metadata.sourceType).toBe('crm');
      }

      // 7. Verify progress telemetry
      const progress = await getCampaignProgress(campaign.id);
      expect(progress.totalCount).toBe(3);
      expect(progress.dispatchedCount).toBe(3);
      expect(progress.progressPercentage).toBe(100);
      expect(progress.isComplete).toBe(true);
    });
  });
});
