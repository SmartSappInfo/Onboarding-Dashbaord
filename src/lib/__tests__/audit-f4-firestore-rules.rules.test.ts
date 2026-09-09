// @ts-nocheck
/**
 * Firestore Security Rules: audit F4 regressions (Phase 1).
 *
 * Three classes of hole were closed and each is pinned here:
 *
 *   1. Cross-tenant read — survey subcollections carry no workspaceIds of their
 *      own, so tenancy resolves through the parent survey (`canAccessSurvey`).
 *      The former `isAuthorized() || isSignedIn()` disjunction collapsed to "any
 *      signed-in account", and signup is public.
 *   2. Anonymous list — `portal_waitlists` (PII) and `webinar_questions` were
 *      world-readable.
 *   3. Anonymous update — both collections were world-writable, letting anyone
 *      overwrite another person's record.
 *
 * The public paths that are *meant* to stay open (published survey reads,
 * anonymous response creation) are asserted too, so tightening the rules again
 * cannot silently break respondents.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where,
} from 'firebase/firestore';
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

describe.skipIf(!emulatorRunning)('audit F4 — firestore rules', () => {
  let testEnv: RulesTestEnvironment;

  const ORG_A = 'org-A';
  const ORG_B = 'org-B';
  const WS_A = 'ws-A';
  const WS_B = 'ws-B';

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `audit-f4-${Date.now()}`,
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

      await setDoc(doc(db, 'users/user-a'), {
        isAuthorized: true, organizationId: ORG_A, workspaceIds: [WS_A], permissions: ['studios_edit'],
      });
      await setDoc(doc(db, 'users/user-b'), {
        isAuthorized: true, organizationId: ORG_B, workspaceIds: [WS_B], permissions: ['studios_edit'],
      });
      await setDoc(doc(db, 'users/root'), {
        isAuthorized: true, organizationId: ORG_B, workspaceIds: [], permissions: ['system_admin'],
      });

      // Survey owned by workspace A, plus one draft and one published.
      await setDoc(doc(db, 'surveys/survey-a'), {
        workspaceIds: [WS_A], status: 'draft', title: 'Intake A',
      });
      await setDoc(doc(db, 'surveys/survey-published'), {
        workspaceIds: [WS_A], status: 'published', title: 'Public',
      });
      await setDoc(doc(db, 'surveys/survey-a/responses/resp-1'), { answer: 'private' });
      await setDoc(doc(db, 'surveys/survey-a/sessions/sess-1'), { progress: 1 });

      // PII collections that were world-readable / world-writable.
      await setDoc(doc(db, 'portal_waitlists/wl-1'), {
        name: 'Ada', email: 'ada@example.com', phone: '+233000000',
      });
      await setDoc(doc(db, 'webinar_questions/q-1'), {
        askedBy: 'attendee-1', question: 'original question',
      });
    });
  });

  const anon = () => testEnv.unauthenticatedContext().firestore();
  const asUserA = () => testEnv.authenticatedContext('user-a').firestore();
  const asUserB = () => testEnv.authenticatedContext('user-b').firestore();
  const asRoot = () => testEnv.authenticatedContext('root').firestore();

  describe('cross-tenant read of survey subcollections', () => {
    it("allows a member of the survey's workspace to read responses", async () => {
      await assertSucceeds(getDoc(doc(asUserA(), 'surveys/survey-a/responses/resp-1')));
    });

    it("denies another tenant reading the survey's responses", async () => {
      await assertFails(getDoc(doc(asUserB(), 'surveys/survey-a/responses/resp-1')));
    });

    it("denies another tenant listing the survey's responses", async () => {
      await assertFails(getDocs(collection(asUserB(), 'surveys/survey-a/responses')));
    });

    it("denies another tenant reading the survey's sessions", async () => {
      await assertFails(getDoc(doc(asUserB(), 'surveys/survey-a/sessions/sess-1')));
    });

    it('allows a system admin to read across tenants', async () => {
      await assertSucceeds(getDoc(doc(asRoot(), 'surveys/survey-a/responses/resp-1')));
    });
  });

  describe('anonymous list', () => {
    it('denies anonymous listing of surveys', async () => {
      await assertFails(getDocs(collection(anon(), 'surveys')));
    });

    it('denies anonymous listing of survey responses', async () => {
      await assertFails(getDocs(collection(anon(), 'surveys/survey-a/responses')));
    });

    it('denies anonymous listing of portal_waitlists (PII)', async () => {
      await assertFails(getDocs(collection(anon(), 'portal_waitlists')));
    });

    it('denies anonymous listing of webinar_questions', async () => {
      await assertFails(getDocs(collection(anon(), 'webinar_questions')));
    });

    it('denies an authorised non-admin reading portal_waitlists', async () => {
      await assertFails(getDoc(doc(asUserA(), 'portal_waitlists/wl-1')));
    });

    it('allows a system admin to read portal_waitlists', async () => {
      await assertSucceeds(getDoc(doc(asRoot(), 'portal_waitlists/wl-1')));
    });
  });

  describe('anonymous update', () => {
    it('denies anonymous overwrite of a webinar question', async () => {
      await assertFails(
        updateDoc(doc(anon(), 'webinar_questions/q-1'), { question: 'hijacked' }),
      );
    });

    it('denies anonymous overwrite of a waitlist entry', async () => {
      await assertFails(
        updateDoc(doc(anon(), 'portal_waitlists/wl-1'), { email: 'attacker@example.com' }),
      );
    });

    it('denies anonymous creation of a waitlist entry', async () => {
      await assertFails(
        setDoc(doc(anon(), 'portal_waitlists/wl-2'), { name: 'Mallory' }),
      );
    });

    it('denies anonymous deletion of a waitlist entry', async () => {
      const { deleteDoc } = await import('firebase/firestore');
      await assertFails(deleteDoc(doc(anon(), 'portal_waitlists/wl-1')));
    });
  });

  describe('public paths that must keep working', () => {
    it('allows anyone to read a published survey', async () => {
      await assertSucceeds(getDoc(doc(anon(), 'surveys/survey-published')));
    });

    it('denies anonymous read of an unpublished survey', async () => {
      await assertFails(getDoc(doc(anon(), 'surveys/survey-a')));
    });

    it('allows an anonymous respondent to submit a response', async () => {
      await assertSucceeds(
        addDoc(collection(anon(), 'surveys/survey-published/responses'), { answer: 'hello' }),
      );
    });

    it('allows anonymous session progress tracking', async () => {
      await assertSucceeds(
        setDoc(doc(anon(), 'surveys/survey-published/sessions/sess-anon'), { progress: 2 }),
      );
    });
  });
});
