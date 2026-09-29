// @ts-nocheck
/**
 * Firestore Security Rules: Document Signing & Contract Lifecycle.
 *
 * Tests the security rules for:
 * - template_versions
 * - signing_envelopes
 * - contract_obligations
 * - contract_relationships
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
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
        title: 'Obligation A',
        status: 'pending',
      });

      // Contract relationships
      await setDoc(doc(db, 'contract_relationships/rel-1'), {
        workspaceId: WS_A,
        sourceContractId: 'c-1',
        targetContractId: 'c-2',
        relationshipType: 'amendment',
      });
    });
  });

  describe('template_versions rules', () => {
    it('allows public read of published and superseded versions', async () => {
      const anonDb = env.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(anonDb, 'template_versions/tv-published')));
      await assertSucceeds(getDoc(doc(anonDb, 'template_versions/tv-superseded')));
      await assertFails(getDoc(doc(anonDb, 'template_versions/tv-draft-a')));
    });

    it('allows workspace member to read draft versions in their workspace', async () => {
      const userDb = env.authenticatedContext('user-studio-a').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'template_versions/tv-draft-a')));
      await assertFails(getDoc(doc(userDb, 'template_versions/tv-draft-b')));
    });

    it('allows studios_edit user to write a template version in their workspace', async () => {
      const userDb = env.authenticatedContext('user-studio-a').firestore();
      await assertSucceeds(setDoc(doc(userDb, 'template_versions/tv-new'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 4,
        status: 'draft',
      }));
    });

    it('denies user without studios_edit to write a template version', async () => {
      const viewerDb = env.authenticatedContext('viewer-a').firestore();
      await assertFails(setDoc(doc(viewerDb, 'template_versions/tv-new-2'), {
        workspaceId: WS_A,
        templateId: 'tpl-1',
        versionNumber: 4,
        status: 'draft',
      }));
    });
  });

  describe('signing_envelopes rules', () => {
    it('denies unauthenticated read/write', async () => {
      const anonDb = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anonDb, 'signing_envelopes/env-a')));
    });

    it('allows workspace member to read envelopes in their workspace', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'signing_envelopes/env-a')));
      await assertFails(getDoc(doc(userDb, 'signing_envelopes/env-b')));
    });

    it('allows finance_manage user to create envelope in their workspace', async () => {
      const userDb = env.authenticatedContext('user-finance-a').firestore();
      await assertSucceeds(setDoc(doc(userDb, 'signing_envelopes/env-new'), {
        workspaceId: WS_A,
        title: 'New Envelope',
        status: 'draft',
      }));
    });

    it('denies non-finance user to create envelope', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertFails(setDoc(doc(userDb, 'signing_envelopes/env-new-2'), {
        workspaceId: WS_A,
        title: 'New Envelope 2',
        status: 'draft',
      }));
    });
  });

  describe('contract_obligations rules', () => {
    it('allows workspace member to read obligations in their workspace', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'contract_obligations/ob-a')));
    });

    it('allows finance_manage user to create obligation in their workspace', async () => {
      const userDb = env.authenticatedContext('user-finance-a').firestore();
      await assertSucceeds(setDoc(doc(userDb, 'contract_obligations/ob-new'), {
        workspaceId: WS_A,
        title: 'New Obligation',
        status: 'pending',
      }));
    });
  });

  describe('bulk_campaigns rules', () => {
    it('allows workspace member to read bulk campaigns in their workspace', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'bulk_campaigns/camp-a')));
    });

    it('denies user without workspace access to read bulk campaigns', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertFails(getDoc(doc(userDb, 'bulk_campaigns/camp-b')));
    });

    it('allows finance_manage user to create bulk campaign in their workspace', async () => {
      const userDb = env.authenticatedContext('user-finance-a').firestore();
      await assertSucceeds(setDoc(doc(userDb, 'bulk_campaigns/camp-new'), {
        workspaceId: WS_A,
        title: 'New Bulk Campaign',
        status: 'ready',
      }));
    });
  });

  describe('bulk_campaign_recipients rules', () => {
    it('allows authorized user to read bulk campaign recipients', async () => {
      const userDb = env.authenticatedContext('viewer-a').firestore();
      await assertSucceeds(getDoc(doc(userDb, 'bulk_campaign_recipients/rec-1')));
    });

    it('allows finance_manage user to create recipient item', async () => {
      const userDb = env.authenticatedContext('user-finance-a').firestore();
      await assertSucceeds(setDoc(doc(userDb, 'bulk_campaign_recipients/rec-new'), {
        campaignId: 'camp-a',
        email: 'test@recipient.com',
        status: 'queued',
      }));
    });
  });
});

