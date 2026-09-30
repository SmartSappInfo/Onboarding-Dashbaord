// @ts-nocheck
/**
 * Firestore Security Rules: cohort_members tenant isolation.
 *
 * Cohort enrolments hold member names and emails. The read rule used to be `isSignedIn()`, so
 * any signed-in account (including a portal member of another organization) could list every
 * enrolment on the platform, and any authorized staff member could write any organization's.
 * Now a member reads only their own rows and staff read and write only their own organization's.
 *
 * Because Firestore evaluates `list` per returned document, a query that could return a
 * non-permitted document fails outright. These tests therefore assert BOTH halves: other
 * members' and other tenants' rows are denied, and every query the app issues still succeeds.
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
  limit,
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

describe.skipIf(!emulatorRunning)('cohort_members tenant isolation', () => {
  let testEnv: RulesTestEnvironment;

  const ORG_A = 'org-A';
  const ORG_B = 'org-B';

  /** Firestore handle for a signed-in account (staff profiles are seeded under `users/*`). */
  const dbAs = (uid: string) => testEnv.authenticatedContext(uid).firestore();

  const member = (userId: string, organizationId: string, cohortId: string, courseId: string) => ({
    id: `cm_${cohortId}_${userId}`,
    organizationId,
    portalId: `portal-${organizationId}`,
    cohortId,
    courseId,
    userId,
    userName: `Name ${userId}`,
    userEmail: `${userId}@example.com`,
    joinedAt: '2026-09-01T00:00:00.000Z',
    status: 'active',
    progressPercentage: 0,
    completedLessonCount: 0,
  });

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `cohort-isolation-${Date.now()}`,
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
      // Staff profiles. Portal members 'member-1', 'member-2' and 'member-b' have no staff profile.
      await setDoc(doc(db, 'users/staff-a'), { isAuthorized: true, organizationId: ORG_A, permissions: [] });
      await setDoc(doc(db, 'users/staff-b'), { isAuthorized: true, organizationId: ORG_B, permissions: [] });
      await setDoc(doc(db, 'users/admin'), { isAuthorized: true, organizationId: ORG_B, permissions: ['system_admin'] });
      // A profile in org A that is not an authorized staff member.
      await setDoc(doc(db, 'users/member-3'), { isAuthorized: false, organizationId: ORG_A, permissions: [] });

      for (const m of [
        member('member-1', ORG_A, 'c1', 'course-1'),
        member('member-2', ORG_A, 'c1', 'course-1'),
        member('member-3', ORG_A, 'c1', 'course-1'),
        member('member-b', ORG_B, 'cb', 'course-b'),
      ]) {
        await setDoc(doc(db, `cohort_members/${m.id}`), m);
      }
    });
  });

  describe('portal members', () => {
    it('can read their own enrolment and not anyone else\'s', async () => {
      const db = dbAs('member-1');
      await assertSucceeds(getDoc(doc(db, 'cohort_members/cm_c1_member-1')));
      await assertFails(getDoc(doc(db, 'cohort_members/cm_c1_member-2')));
      await assertFails(getDoc(doc(db, 'cohort_members/cm_cb_member-b')));
    });

    it('can run the course page query, which filters on their own userId', async () => {
      await assertSucceeds(getDocs(query(
        collection(dbAs('member-1'), 'cohort_members'),
        where('courseId', '==', 'course-1'),
        where('userId', '==', 'member-1'),
        where('status', '==', 'active'),
        limit(1),
      )));
    });

    it('cannot list a cohort roster or query another member\'s rows', async () => {
      const db = dbAs('member-1');
      await assertFails(getDocs(query(collection(db, 'cohort_members'), where('cohortId', '==', 'c1'))));
      await assertFails(getDocs(query(
        collection(db, 'cohort_members'),
        where('courseId', '==', 'course-1'),
        where('userId', '==', 'member-2'),
      )));
    });

    it('cannot read the roster through a non-staff profile in the same organization', async () => {
      await assertFails(getDocs(query(
        collection(dbAs('member-3'), 'cohort_members'),
        where('organizationId', '==', ORG_A),
        where('cohortId', '==', 'c1'),
      )));
    });

    it('cannot write enrolments, including their own', async () => {
      await assertFails(updateDoc(doc(dbAs('member-1'), 'cohort_members/cm_c1_member-1'), {
        progressPercentage: 100,
      }));
    });
  });

  describe('staff', () => {
    it('can run the roster query for their own organization', async () => {
      await assertSucceeds(getDocs(query(
        collection(dbAs('staff-a'), 'cohort_members'),
        where('organizationId', '==', ORG_A),
        where('cohortId', '==', 'c1'),
        orderBy('joinedAt', 'desc'),
      )));
    });

    it('cannot run a roster query without the organization filter', async () => {
      await assertFails(getDocs(query(
        collection(dbAs('staff-a'), 'cohort_members'),
        where('cohortId', '==', 'c1'),
        orderBy('joinedAt', 'desc'),
      )));
    });

    it('cannot read another organization\'s enrolments', async () => {
      const db = dbAs('staff-b');
      await assertFails(getDoc(doc(db, 'cohort_members/cm_c1_member-1')));
      await assertFails(getDocs(query(
        collection(db, 'cohort_members'),
        where('organizationId', '==', ORG_A),
        where('cohortId', '==', 'c1'),
      )));
    });

    it('can write enrolments in their own organization only', async () => {
      await assertSucceeds(setDoc(
        doc(dbAs('staff-a'), 'cohort_members/cm_c1_new'),
        member('new', ORG_A, 'c1', 'course-1'),
      ));
      await assertFails(setDoc(
        doc(dbAs('staff-b'), 'cohort_members/cm_c1_new-2'),
        member('new-2', ORG_A, 'c1', 'course-1'),
      ));
      await assertFails(deleteDoc(doc(dbAs('staff-b'), 'cohort_members/cm_c1_member-1')));
    });

    it('cannot move an enrolment to another organization', async () => {
      await assertFails(updateDoc(doc(dbAs('staff-a'), 'cohort_members/cm_c1_member-1'), {
        organizationId: ORG_B,
      }));
      await assertSucceeds(updateDoc(doc(dbAs('staff-a'), 'cohort_members/cm_c1_member-1'), {
        status: 'dropped',
      }));
    });
  });

  it('lets system admins read any organization\'s enrolments', async () => {
    await assertSucceeds(getDoc(doc(dbAs('admin'), 'cohort_members/cm_c1_member-1')));
  });

  it('denies unauthenticated reads', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'cohort_members/cm_c1_member-1')));
  });
});
