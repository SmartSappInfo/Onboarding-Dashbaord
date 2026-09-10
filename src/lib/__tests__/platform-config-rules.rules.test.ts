// @ts-nocheck
/**
 * Firestore rules for platform_config (backoffice isolation).
 *
 * This document controls whether the platform may message customers. The rules deny ALL
 * client writes: the only writer is a server action running under
 * authorizeBackofficeSession via the Admin SDK, which bypasses rules. That means an XSS in
 * the backoffice cannot pause the platform's outbound messaging.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
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

describe.skipIf(!up)('platform_config rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: `platform-config-${Date.now()}`,
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
      await setDoc(doc(db, 'users/root'), {
        isAuthorized: true, permissions: ['system_admin'], organizationId: 'org-a', workspaceIds: [],
      });
      await setDoc(doc(db, 'users/tenant'), {
        isAuthorized: true, permissions: [], organizationId: 'org-a', workspaceIds: ['ws-a'],
      });
      await setDoc(doc(db, 'platform_config/messaging_controls'), {
        outboundEnabled: true, pausedReason: '',
      });
    });
  });

  const anon = () => env.unauthenticatedContext().firestore();
  const tenant = () => env.authenticatedContext('tenant').firestore();
  const root = () => env.authenticatedContext('root').firestore();

  it('denies anonymous read — operational posture is not public', async () => {
    await assertFails(getDoc(doc(anon(), 'platform_config/messaging_controls')));
  });

  it('denies an ordinary tenant user', async () => {
    await assertFails(getDoc(doc(tenant(), 'platform_config/messaging_controls')));
  });

  it('denies anonymous listing of the collection', async () => {
    await assertFails(getDocs(collection(anon(), 'platform_config')));
  });

  it('allows a system admin to read', async () => {
    await assertSucceeds(getDoc(doc(root(), 'platform_config/messaging_controls')));
  });

  it('denies writes even from a system admin, because only the server may write', async () => {
    await assertFails(setDoc(doc(root(), 'platform_config/messaging_controls'), { outboundEnabled: false }));
  });

  it('denies updates from a system admin', async () => {
    await assertFails(updateDoc(doc(root(), 'platform_config/messaging_controls'), { outboundEnabled: false }));
  });

  it('denies deletion from a system admin', async () => {
    await assertFails(deleteDoc(doc(root(), 'platform_config/messaging_controls')));
  });

  it('denies an anonymous write, the case that matters most', async () => {
    await assertFails(setDoc(doc(anon(), 'platform_config/messaging_controls'), { outboundEnabled: false }));
  });
});
