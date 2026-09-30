// @ts-nocheck
/**
 * Firestore Security Rules: Document Signing & Contract Lifecycle.
 *
 * Tests the security rules for:
 * - template_versions
 * - signing_envelopes
 * - contract_obligations
 * - contract_relationships
 * - bulk_campaigns
 * - bulk_campaign_recipients
 *
 * Every collection is tenant-scoped by a single `workspaceId`. Because Firestore `list` rules
 * are not filters, a query that could return another tenant's document fails outright. These
 * tests therefore assert BOTH halves: cross-tenant access is denied, and every query shape the
 * app issues (always filtered on `workspaceId`) still succeeds.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { connect } from 'node:net';

async function emulatorUp(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = connect(port, '127.0.0.1');
    s.setTimeout(1000);
    s.on('connect', () => { s.end(); s.destroy(); res(true); });
    s.on('timeout', () => { s.destroy(); res(false); });
    s.on('error', () => { s.destroy(); res(false); });
  });
}
const up = await emulatorUp(8080);

describe.skipIf(!up)('document signing security rules', () => {
  let env: RulesTestEnvironment;

  const WS_A = 'ws-a';
  const WS_B = 'ws-b';

  /** Firestore handle for one of the signed-in users seeded under `users/*` below. */
  const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: `doc-signing-rules-${Date.now()}`,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Users
      await setDoc(doc(db, 'users/admin'), {
        isAuthorized: true,
        permissions: ['system_admin'],
        workspaceIds: [],
      });
      await setDoc(doc(db, 'users/user-studio-a'), {
        isAuthorized: true,
        permissions: ['studios_edit'],
        workspaceIds: [WS_A],
      });
      await setDoc(doc(db, 'users/user-finance-a'), {
        isAuthorized: true,
        permissions: ['finance_manage'],
        workspaceIds: [WS_A],
      });
      await setDoc(doc(db, 'users/user-b'), {
        isAuthorized: true,
        permissions: ['studios_edit', 'finance_manage'],
        workspaceIds: [WS_B],
      });
      await setDoc(doc(db, 'users/viewer-a'), {
        isAuthorized: true,
        permissions: [],
        workspaceIds: [WS_A],
      });

      // Template versions
      await setDoc(doc(db, 'template_versions/tv-published'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 1,
        status: 'published',
      });
      await setDoc(doc(db, 'template_versions/tv-superseded'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 2,
        status: 'superseded',
      });
      await setDoc(doc(db, 'template_versions/tv-draft-a'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 3,
        status: 'draft',
      });
      await setDoc(doc(db, 'template_versions/tv-draft-b'), {
        workspaceId: WS_B,
        templateId: 'tpl-2',
        versionNumber: 1,
        status: 'draft',
      });

      // Signing envelopes
      await setDoc(doc(db, 'signing_envelopes/env-a'), {
        workspaceId: WS_A,
        title: 'Envelope A',
        status: 'pending',
      });
      await setDoc(doc(db, 'signing_envelopes/env-b'), {
        workspaceId: WS_B,
        title: 'Envelope B',
        status: 'pending',
      });

      // Contract obligations
      await setDoc(doc(db, 'contract_obligations/ob-a'), {
        workspaceId: WS_A,
        contractId: 'c-1',
        title: 'Obligation A',
        status: 'pending',
      });
      await setDoc(doc(db, 'contract_obligations/ob-b'), {
        workspaceId: WS_B,
        contractId: 'c-b',
        title: 'Obligation B',
        status: 'pending',
      });
      // A document written before workspaceId was enforced: only system admins may read it.
      await setDoc(doc(db, 'contract_obligations/ob-legacy'), {
        contractId: 'c-legacy',
        title: 'Legacy obligation',
        status: 'pending',
      });

      // Contract relationships
      await setDoc(doc(db, 'contract_relationships/rel-1'), {
        workspaceId: WS_A,
        sourceContractId: 'c-1',
        targetContractId: 'c-2',
        relationshipType: 'amendment',
      });
      await setDoc(doc(db, 'contract_relationships/rel-b'), {
        workspaceId: WS_B,
        sourceContractId: 'c-b',
        targetContractId: 'c-b2',
        relationshipType: 'amendment',
      });

      // Bulk campaigns and recipients. The read tests below need real documents: reading a
      // missing document leaves `resource` null, so a deny would pass without testing the rule.
      await setDoc(doc(db, 'bulk_campaigns/camp-a'), {
        workspaceId: WS_A,
        title: 'Campaign A',
        status: 'ready',
      });
      await setDoc(doc(db, 'bulk_campaigns/camp-b'), {
        workspaceId: WS_B,
        title: 'Campaign B',
        status: 'ready',
      });
      await setDoc(doc(db, 'bulk_campaign_recipients/rec-1'), {
        campaignId: 'camp-a',
        email: 'recipient@example.com',
        status: 'queued',
      });
    });
  });

  describe('template_versions rules', () => {
    it('denies every unauthenticated read, including published and superseded versions', async () => {
      const anonDb = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'template_versions/tv-published')));
      await assertFails(getDoc(doc(anonDb, 'template_versions/tv-superseded')));
      await assertFails(getDoc(doc(anonDb, 'template_versions/tv-draft-a')));
    });

    it('lets staff read versions in their own workspace only', async () => {
      const db = dbAs('user-studio-a');
      await assertSucceeds(getDoc(doc(db, 'template_versions/tv-published')));
      await assertSucceeds(getDoc(doc(db, 'template_versions/tv-draft-a')));
      await assertFails(getDoc(doc(db, 'template_versions/tv-draft-b')));
      // Published versions are not readable across tenants either.
      await assertFails(getDoc(doc(dbAs('user-b'), 'template_versions/tv-published')));
    });

    it('lets system admins read versions in any workspace', async () => {
      await assertSucceeds(getDoc(doc(dbAs('admin'), 'template_versions/tv-draft-b')));
    });

    it('allows the PDF editor query, which filters on workspaceId and templateId', async () => {
      await assertSucceeds(getDocs(query(
        collection(dbAs('user-studio-a'), 'template_versions'),
        where('workspaceId', '==', WS_A),
        where('templateId', '==', 'tpl-1'),
      )));
    });

    it('rejects a versions query without a workspace filter, or for another workspace', async () => {
      const db = dbAs('user-studio-a');
      await assertFails(getDocs(query(
        collection(db, 'template_versions'),
        where('templateId', '==', 'tpl-1'),
      )));
      await assertFails(getDocs(query(
        collection(db, 'template_versions'),
        where('workspaceId', '==', WS_B),
      )));
    });

    it('allows studios_edit user to write a template version in their workspace', async () => {
      await assertSucceeds(setDoc(doc(dbAs('user-studio-a'), 'template_versions/tv-new'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 4,
        status: 'draft',
      }));
    });

    it('denies user without studios_edit to write a template version', async () => {
      await assertFails(setDoc(doc(dbAs('viewer-a'), 'template_versions/tv-new-2'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 4,
        status: 'draft',
      }));
    });

    it('denies taking over or re-homing a version on update', async () => {
      // user-b edits ws-b only; tv-draft-a belongs to ws-a. Checking only the new data would
      // have let this update move the version into ws-b.
      await assertFails(updateDoc(doc(dbAs('user-b'), 'template_versions/tv-draft-a'), {
        workspaceId: WS_B,
      }));
      // Even the owning workspace cannot move a version to another workspace.
      await assertFails(updateDoc(doc(dbAs('user-studio-a'), 'template_versions/tv-draft-a'), {
        workspaceId: WS_B,
      }));
      await assertSucceeds(updateDoc(doc(dbAs('user-studio-a'), 'template_versions/tv-draft-a'), {
        versionNumber: 5,
      }));
    });

    it('denies deleting a version in another workspace', async () => {
      await assertFails(deleteDoc(doc(dbAs('user-b'), 'template_versions/tv-draft-a')));
    });
  });

  describe('signing_envelopes rules', () => {
    it('denies unauthenticated read', async () => {
      const anonDb = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'signing_envelopes/env-a')));
    });

    it('allows workspace member to read envelopes in their workspace', async () => {
      const db = dbAs('viewer-a');
      await assertSucceeds(getDoc(doc(db, 'signing_envelopes/env-a')));
      await assertFails(getDoc(doc(db, 'signing_envelopes/env-b')));
    });

    it('allows the envelope list queries the app issues, scoped to the workspace', async () => {
      const db = dbAs('viewer-a');
      // DealContractsCard / unified timeline shape.
      await assertSucceeds(getDocs(query(
        collection(db, 'signing_envelopes'),
        where('workspaceId', '==', WS_A),
        where('dealId', '==', 'deal-1'),
        orderBy('createdAt', 'desc'),
      )));
      await assertFails(getDocs(query(
        collection(db, 'signing_envelopes'),
        where('workspaceId', '==', WS_B),
      )));
    });

    it('allows finance_manage user to create envelope in their workspace', async () => {
      await assertSucceeds(setDoc(doc(dbAs('user-finance-a'), 'signing_envelopes/env-new'), {
        workspaceId: WS_A,
        title: 'New Envelope',
        status: 'draft',
      }));
    });

    it('denies non-finance user to create envelope', async () => {
      await assertFails(setDoc(doc(dbAs('viewer-a'), 'signing_envelopes/env-new-2'), {
        workspaceId: WS_A,
        title: 'New Envelope 2',
        status: 'draft',
      }));
    });

    it('denies creating an envelope in another workspace', async () => {
      await assertFails(setDoc(doc(dbAs('user-finance-a'), 'signing_envelopes/env-x'), {
        workspaceId: WS_B,
        title: 'Envelope X',
        status: 'draft',
      }));
    });

    it('denies cross-tenant update and delete, and allows same-workspace updates', async () => {
      const otherTenant = dbAs('user-b');
      await assertFails(updateDoc(doc(otherTenant, 'signing_envelopes/env-a'), {
        workspaceId: WS_B,
        status: 'completed',
      }));
      await assertFails(deleteDoc(doc(otherTenant, 'signing_envelopes/env-a')));
      await assertSucceeds(updateDoc(doc(dbAs('user-finance-a'), 'signing_envelopes/env-a'), {
        status: 'sent',
      }));
    });
  });

  describe('contract_obligations rules', () => {
    it('lets workspace members read obligations in their own workspace only', async () => {
      const db = dbAs('viewer-a');
      await assertSucceeds(getDoc(doc(db, 'contract_obligations/ob-a')));
      await assertFails(getDoc(doc(db, 'contract_obligations/ob-b')));
    });

    it('keeps a document without workspaceId away from everyone but system admins', async () => {
      await assertFails(getDoc(doc(dbAs('viewer-a'), 'contract_obligations/ob-legacy')));
      await assertSucceeds(getDoc(doc(dbAs('admin'), 'contract_obligations/ob-legacy')));
    });

    it('allows the obligation queries the app issues', async () => {
      const db = dbAs('viewer-a');
      // ObligationsSummaryTab
      await assertSucceeds(getDocs(query(
        collection(db, 'contract_obligations'),
        where('workspaceId', '==', WS_A),
      )));
      // ContractLifecycleDetailModal
      await assertSucceeds(getDocs(query(
        collection(db, 'contract_obligations'),
        where('workspaceId', '==', WS_A),
        where('contractId', '==', 'c-1'),
      )));
    });

    it('rejects an obligation query filtered only by contract', async () => {
      await assertFails(getDocs(query(
        collection(dbAs('viewer-a'), 'contract_obligations'),
        where('contractId', '==', 'c-1'),
      )));
    });

    it('allows finance_manage user to create obligation in their workspace', async () => {
      await assertSucceeds(setDoc(doc(dbAs('user-finance-a'), 'contract_obligations/ob-new'), {
        workspaceId: WS_A,
        title: 'New Obligation',
        status: 'pending',
      }));
    });

    it('denies cross-tenant update and delete', async () => {
      const otherTenant = dbAs('user-b');
      await assertFails(updateDoc(doc(otherTenant, 'contract_obligations/ob-a'), { workspaceId: WS_B }));
      await assertFails(deleteDoc(doc(otherTenant, 'contract_obligations/ob-a')));
    });
  });

  describe('contract_relationships rules', () => {
    it('lets workspace members read relationships in their own workspace only', async () => {
      const db = dbAs('viewer-a');
      await assertSucceeds(getDoc(doc(db, 'contract_relationships/rel-1')));
      await assertFails(getDoc(doc(db, 'contract_relationships/rel-b')));
    });

    it('allows the relationship query the app issues and rejects an unscoped one', async () => {
      const db = dbAs('viewer-a');
      await assertSucceeds(getDocs(query(
        collection(db, 'contract_relationships'),
        where('workspaceId', '==', WS_A),
        where('sourceContractId', '==', 'c-1'),
      )));
      await assertFails(getDocs(query(
        collection(db, 'contract_relationships'),
        where('sourceContractId', '==', 'c-1'),
      )));
    });

    it('limits writes to finance_manage staff in the same workspace', async () => {
      const relationship = {
        workspaceId: WS_A,
        sourceContractId: 'c-1',
        targetContractId: 'c-3',
        relationshipType: 'renewal',
      };
      await assertSucceeds(setDoc(doc(dbAs('user-finance-a'), 'contract_relationships/rel-new'), relationship));
      await assertFails(setDoc(doc(dbAs('viewer-a'), 'contract_relationships/rel-new-2'), relationship));
      await assertFails(updateDoc(doc(dbAs('user-b'), 'contract_relationships/rel-1'), {
        relationshipType: 'renewal',
      }));
      await assertFails(deleteDoc(doc(dbAs('user-b'), 'contract_relationships/rel-1')));
    });
  });

  describe('bulk_campaigns rules', () => {
    it('allows workspace member to read bulk campaigns in their workspace', async () => {
      await assertSucceeds(getDoc(doc(dbAs('viewer-a'), 'bulk_campaigns/camp-a')));
    });

    it('denies user without workspace access to read bulk campaigns', async () => {
      await assertFails(getDoc(doc(dbAs('viewer-a'), 'bulk_campaigns/camp-b')));
    });

    it('allows the campaign list query the app issues', async () => {
      await assertSucceeds(getDocs(query(
        collection(dbAs('viewer-a'), 'bulk_campaigns'),
        where('workspaceId', '==', WS_A),
        orderBy('createdAt', 'desc'),
      )));
    });

    it('allows finance_manage user to create bulk campaign in their workspace', async () => {
      await assertSucceeds(setDoc(doc(dbAs('user-finance-a'), 'bulk_campaigns/camp-new'), {
        workspaceId: WS_A,
        title: 'New Bulk Campaign',
        status: 'ready',
      }));
    });

    it('denies cross-tenant update and delete', async () => {
      const otherTenant = dbAs('user-b');
      // Rewriting workspaceId to the caller's own workspace used to pass the create-style check.
      await assertFails(updateDoc(doc(otherTenant, 'bulk_campaigns/camp-a'), {
        workspaceId: WS_B,
        status: 'cancelled',
      }));
      await assertFails(deleteDoc(doc(otherTenant, 'bulk_campaigns/camp-a')));
    });
  });

  describe('bulk_campaign_recipients rules', () => {
    it('denies every client read: recipients are server-only', async () => {
      await assertFails(getDoc(doc(dbAs('viewer-a'), 'bulk_campaign_recipients/rec-1')));
      await assertFails(getDoc(doc(dbAs('admin'), 'bulk_campaign_recipients/rec-1')));
    });

    it('denies every client write', async () => {
      await assertFails(setDoc(doc(dbAs('user-finance-a'), 'bulk_campaign_recipients/rec-new'), {
        campaignId: 'camp-a',
        email: 'test@recipient.com',
        status: 'queued',
      }));
    });
  });
});
