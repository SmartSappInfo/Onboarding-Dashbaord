// @ts-nocheck
/**
 * Firestore Security Rules Tests: sender_profiles tenant isolation (Phase 6).
 *
 * Validates that a sender profile can only be created/updated/deleted by an org
 * admin of the SAME organization, and that organizationId is immutable.
 *
 * Requires the Firestore emulator on localhost:8080
 * (e.g. `firebase emulators:exec --only firestore "npx vitest run src/lib/__tests__/sender-profile-security-rules.test.ts"`).
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { connect } from 'node:net';

async function isEmulatorRunning(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = connect(port, '127.0.0.1');
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.end();
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const emulatorRunning = await isEmulatorRunning(8080);

describe.skipIf(!emulatorRunning)('sender_profiles Security Rules (org isolation)', () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = `test-sender-profiles-${Date.now()}`;

  const ORG_A_ADMIN = 'org-a-admin';
  const ORG_B_ADMIN = 'org-b-admin';
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const WS_A = 'ws-a';

  const profile = (organizationId: string) => ({
    organizationId,
    name: 'Sender',
    channel: 'sms',
    identifier: 'ACME',
    isDefault: false,
    isActive: true,
    workspaceIds: [WS_A],
    createdAt: '2026-06-24T00:00:00Z',
    updatedAt: '2026-06-24T00:00:00Z',
  });

  beforeEach(async () => {
    const rules = readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules, host: 'localhost', port: 8080 },
    });

    const admin = testEnv.authenticatedContext('seed', { email: 'admin@smartsapp.com' });
    await admin.firestore().collection('users').doc(ORG_A_ADMIN).set({
      isAuthorized: true, permissions: ['studios_edit'], organizationId: ORG_A, workspaceIds: [WS_A],
    });
    await admin.firestore().collection('users').doc(ORG_B_ADMIN).set({
      isAuthorized: true, permissions: ['studios_edit'], organizationId: ORG_B, workspaceIds: [WS_A],
    });
    // Seed an existing Org-A profile for update/delete cases.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('sender_profiles').doc('p-a').set(profile(ORG_A));
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('lets an org admin create a profile for their OWN org', async () => {
    const db = testEnv.authenticatedContext(ORG_A_ADMIN).firestore();
    await assertSucceeds(setDoc(doc(db, 'sender_profiles', 'p-new'), profile(ORG_A)));
  });

  it('rejects creating a profile for ANOTHER org', async () => {
    const db = testEnv.authenticatedContext(ORG_A_ADMIN).firestore();
    await assertFails(setDoc(doc(db, 'sender_profiles', 'p-evil'), profile(ORG_B)));
  });

  it('rejects a foreign org admin updating an Org-A profile', async () => {
    const db = testEnv.authenticatedContext(ORG_B_ADMIN).firestore();
    await assertFails(updateDoc(doc(db, 'sender_profiles', 'p-a'), { identifier: 'HACK' }));
  });

  it('lets the owning org admin update their profile', async () => {
    const db = testEnv.authenticatedContext(ORG_A_ADMIN).firestore();
    await assertSucceeds(updateDoc(doc(db, 'sender_profiles', 'p-a'), { identifier: 'NEWID' }));
  });

  it('rejects changing organizationId on update (immutable tenant)', async () => {
    const db = testEnv.authenticatedContext(ORG_A_ADMIN).firestore();
    await assertFails(updateDoc(doc(db, 'sender_profiles', 'p-a'), { organizationId: ORG_B }));
  });

  it('rejects a foreign org admin deleting an Org-A profile', async () => {
    const db = testEnv.authenticatedContext(ORG_B_ADMIN).firestore();
    await assertFails(deleteDoc(doc(db, 'sender_profiles', 'p-a')));
  });
});
