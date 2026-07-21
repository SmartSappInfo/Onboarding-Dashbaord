// @ts-nocheck
/**
 * Firestore Security Rules: message_templates tenant isolation.
 *
 * The read rule used to be a blanket `isAuthorized()`, so any authorised user
 * could read every organization's templates. It is now scoped to global
 * blueprints, the caller's own organization, or a workspace the caller belongs
 * to.
 *
 * Because Firestore evaluates `list` per returned document, a query that could
 * return a non-permitted document fails outright. These tests therefore assert
 * BOTH halves: cross-tenant reads are denied, and every query the app actually
 * issues still succeeds.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

async function isEmulatorRunning(port: number): Promise<boolean> {
  return new Promise<boolean>((res) => {
    const socket = connect(port, '127.0.0.1');
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.end(); socket.destroy(); res(true); });
    socket.on('timeout', () => { socket.destroy(); res(false); });
    socket.on('error', () => { socket.destroy(); res(false); });
  });
}

const emulatorRunning = await isEmulatorRunning(8080);

describe.skipIf(!emulatorRunning)('message_templates tenant isolation', () => {
  let testEnv: RulesTestEnvironment;

  const ORG_A = 'org-A';
  const ORG_B = 'org-B';
  const WS_A = 'ws-A';
  const WS_B = 'ws-B';

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `tpl-isolation-${Date.now()}`,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => { await testEnv?.cleanup(); });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Users
      await setDoc(doc(db, 'users/user-a'), {
        isAuthorized: true, organizationId: ORG_A, workspaceIds: [WS_A], permissions: [],
      });
      await setDoc(doc(db, 'users/user-b'), {
        isAuthorized: true, organizationId: ORG_B, workspaceIds: [WS_B], permissions: [],
      });
      await setDoc(doc(db, 'users/root'), {
        isAuthorized: true, organizationId: ORG_B, workspaceIds: [], permissions: ['system_admin'],
      });

      // Templates
      await setDoc(doc(db, 'message_templates/tpl-a'), {
        scope: 'organization', organizationId: ORG_A, workspaceIds: [WS_A],
        channel: 'whatsapp', name: 'order_update',
      });
      await setDoc(doc(db, 'message_templates/tpl-b'), {
        scope: 'organization', organizationId: ORG_B, workspaceIds: [WS_B],
        channel: 'whatsapp', name: 'order_update',
      });
      await setDoc(doc(db, 'message_templates/tpl-global'), {
        scope: 'global', channel: 'email', name: 'welcome',
      });
    });
  });

  const asUserA = () => testEnv.authenticatedContext('user-a').firestore();
  const asUserB = () => testEnv.authenticatedContext('user-b').firestore();
  const asRoot = () => testEnv.authenticatedContext('root').firestore();

  describe('document reads', () => {
    it("allows reading a template from the caller's own organization", async () => {
      await assertSucceeds(getDoc(doc(asUserA(), 'message_templates/tpl-a')));
    });

    it("denies reading another organization's template", async () => {
      await assertFails(getDoc(doc(asUserA(), 'message_templates/tpl-b')));
      await assertFails(getDoc(doc(asUserB(), 'message_templates/tpl-a')));
    });

    it('allows reading global blueprints', async () => {
      await assertSucceeds(getDoc(doc(asUserA(), 'message_templates/tpl-global')));
      await assertSucceeds(getDoc(doc(asUserB(), 'message_templates/tpl-global')));
    });

    it('allows a system admin to read across organizations', async () => {
      await assertSucceeds(getDoc(doc(asRoot(), 'message_templates/tpl-a')));
      await assertSucceeds(getDoc(doc(asRoot(), 'message_templates/tpl-b')));
    });
  });

  describe('the queries the app actually issues', () => {
    it('allows the workspace-scoped gallery query', async () => {
      const q = query(
        collection(asUserA(), 'message_templates'),
        where('workspaceIds', 'array-contains', WS_A),
      );
      const snap = await assertSucceeds(getDocs(q));
      expect(snap.docs.map((d) => d.id)).toEqual(['tpl-a']);
    });

    it('allows the global-blueprint query', async () => {
      const q = query(collection(asUserA(), 'message_templates'), where('scope', '==', 'global'));
      const snap = await assertSucceeds(getDocs(q));
      expect(snap.docs.map((d) => d.id)).toEqual(['tpl-global']);
    });

    it('allows the org-scoped diagnostics query', async () => {
      const q = query(
        collection(asUserA(), 'message_templates'),
        where('scope', '==', 'organization'),
        where('organizationId', '==', ORG_A),
      );
      await assertSucceeds(getDocs(q));
    });

    it('rejects an unscoped collection read', async () => {
      // This is why every caller must scope its query.
      await assertFails(getDocs(collection(asUserA(), 'message_templates')));
    });

    it("rejects a query targeting another tenant's workspace", async () => {
      const q = query(
        collection(asUserA(), 'message_templates'),
        where('workspaceIds', 'array-contains', WS_B),
      );
      await assertFails(getDocs(q));
    });
  });
});
