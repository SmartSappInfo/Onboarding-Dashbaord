// @ts-nocheck
/**
 * Firestore rules for meeting knowledge (Phase 11 M1 · T2, findings B3/G2/G5).
 *
 * Transcripts, intelligence, recordings, consents and compliance policies are written only by
 * server code via the Admin SDK (which bypasses rules). Clients may READ transcripts, intelligence
 * and recordings of their own workspace (unchanged) and nothing else. The compliance policy was
 * publicly readable and member-writable; both are now closed.
 *
 * Runs against the emulator (`pnpm test:rules`); skipped when no emulator is listening.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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

const SERVER_ONLY = ['meeting_transcripts/t-a', 'meeting_intelligence/m-a', 'meeting_recordings/r-a'];

describe.skipIf(!up)('meeting knowledge rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: `meeting-knowledge-${Date.now()}`,
      firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/member'), { isAuthorized: true, permissions: ['meetings_manage'], organizationId: 'org-a', workspaceIds: ['ws-a'] });
      await setDoc(doc(db, 'users/outsider'), { isAuthorized: true, permissions: [], organizationId: 'org-b', workspaceIds: ['ws-b'] });
      for (const path of SERVER_ONLY) await setDoc(doc(db, path), { workspaceId: 'ws-a', meetingId: 'm-a' });
      await setDoc(doc(db, 'meeting_transcripts/t-a/segments/0000'), { index: 0, segments: [] });
      await setDoc(doc(db, 'meeting_consents/m-a/records/c1'), { type: 'transcription', granted: true });
      await setDoc(doc(db, 'meeting_compliance_policies/ws-a'), { workspaceId: 'ws-a', enforceHostConsentForAI: true });
    });
  });

  const anon = () => env.unauthenticatedContext().firestore();
  const member = () => env.authenticatedContext('member').firestore();
  const outsider = () => env.authenticatedContext('outsider').firestore();

  it('members can still read their workspace transcripts, intelligence and recordings', async () => {
    for (const path of SERVER_ONLY) await assertSucceeds(getDoc(doc(member(), path)));
  });

  it('anonymous users and other workspaces cannot read them', async () => {
    for (const path of SERVER_ONLY) {
      await assertFails(getDoc(doc(anon(), path)));
      await assertFails(getDoc(doc(outsider(), path)));
    }
  });

  it('no client can create, change or delete them, even a member with meetings_manage', async () => {
    for (const path of SERVER_ONLY) {
      await assertFails(setDoc(doc(member(), `${path}-new`), { workspaceId: 'ws-a', meetingId: 'm-a' }));
      await assertFails(updateDoc(doc(member(), path), { workspaceId: 'ws-a', forged: true }));
      await assertFails(deleteDoc(doc(member(), path)));
    }
  });

  it('transcript chunks and consent records are server-only for read and write', async () => {
    await assertFails(getDoc(doc(member(), 'meeting_transcripts/t-a/segments/0000')));
    await assertFails(setDoc(doc(member(), 'meeting_transcripts/t-a/segments/0001'), { index: 1, segments: [] }));
    await assertFails(getDoc(doc(member(), 'meeting_consents/m-a/records/c1')));
    await assertFails(setDoc(doc(member(), 'meeting_consents/m-a/records/c2'), { type: 'aiProcessing', granted: true }));
  });

  it('the compliance policy is no longer public or client-writable', async () => {
    await assertFails(getDoc(doc(anon(), 'meeting_compliance_policies/ws-a')));
    await assertFails(getDoc(doc(outsider(), 'meeting_compliance_policies/ws-a')));
    await assertFails(setDoc(doc(member(), 'meeting_compliance_policies/ws-a'), { workspaceId: 'ws-a', enforceHostConsentForAI: false }));
  });
});
