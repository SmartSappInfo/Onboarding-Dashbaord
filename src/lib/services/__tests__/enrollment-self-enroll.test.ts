// @vitest-environment node
/**
 * @fileOverview Review-fix item 1 (agents_mcp Phase 1 §1.1a, Round 4): enrolment entitlement by source.
 * - `self_enroll` (a member clicking Enroll): course must be published; plan gating enforced.
 * - `manual_admin` (staff) and `purchase` (a settled order granting the course): explicit grants, no plan gate.
 * - Other sources keep the plan gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  seq: 0,
}));

function col(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('@/lib/firebase-admin', () => {
  const docRef = (name: string, id: string) => ({
    id,
    get: async () => ({ exists: col(name).has(id), id, data: () => col(name).get(id) }),
    set: async (d: Doc) => void col(name).set(id, { ...(col(name).get(id) ?? {}), ...d }),
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => d, ref: docRef(name, id) }));
      return { empty: docs.length === 0, docs };
    },
  });
  return {
    adminDb: {
      collection: (name: string) => ({ ...query(name, []), doc: (id?: string) => docRef(name, id ?? `auto-${++h.seq}`) }),
    },
  };
});
vi.mock('@/lib/services/portal-membership-service', () => ({ PortalMembershipService: { awardPoints: vi.fn(async () => undefined) } }));

import { EnrollmentService } from '../enrollment-service';

beforeEach(() => {
  h.store.clear();
  col('courses').set('free', { portalId: 'p1', status: 'published', title: 'Free' });
  col('courses').set('gold', { portalId: 'p1', status: 'published', title: 'Gold', requiredPlanIds: ['plan-gold'] });
  col('courses').set('draft', { portalId: 'p1', status: 'draft', title: 'Draft' });
  col('portal_memberships').set('m-basic', { portalId: 'p1', userId: 'basic', planId: 'plan-free' });
  col('portal_memberships').set('m-gold', { portalId: 'p1', userId: 'goldie', planId: 'plan-gold' });
});

describe('self_enroll', () => {
  it('refuses a plan-gated course without the plan (the reported bypass)', async () => {
    await expect(EnrollmentService.enrollUserInCourse('gold', 'basic', 'p1', 'self_enroll')).rejects.toThrow(/exclusive to specific membership tiers/);
    expect(col('course_enrollments').size).toBe(0);
  });

  it('refuses draft courses and courses of another portal', async () => {
    await expect(EnrollmentService.enrollUserInCourse('draft', 'basic', 'p1', 'self_enroll')).rejects.toThrow('This course is not open for enrolment.');
    await expect(EnrollmentService.enrollUserInCourse('free', 'basic', 'p2', 'self_enroll')).rejects.toThrow('This course is not open for enrolment.');
  });

  it('still enrols members in free published courses, and plan holders in gated ones', async () => {
    await expect(EnrollmentService.enrollUserInCourse('free', 'basic', 'p1', 'self_enroll')).resolves.toMatchObject({ source: 'self_enroll', status: 'active' });
    await expect(EnrollmentService.enrollUserInCourse('gold', 'goldie', 'p1', 'self_enroll')).resolves.toMatchObject({ courseId: 'gold' });
  });
});

describe('explicit grants', () => {
  it('lets staff enrol anyone (manual_admin), including into drafts', async () => {
    await expect(EnrollmentService.enrollUserInCourse('gold', 'basic', 'p1', 'manual_admin')).resolves.toMatchObject({ courseId: 'gold' });
    await expect(EnrollmentService.enrollUserInCourse('draft', 'basic', 'p1', 'manual_admin')).resolves.toMatchObject({ courseId: 'draft' });
  });

  it('provisions purchases even when the plan is granted after the course (checkout order)', async () => {
    await expect(EnrollmentService.enrollUserInCourse('gold', 'basic', 'p1', 'purchase')).resolves.toMatchObject({ source: 'purchase' });
  });

  it('keeps the plan gate for automation and invitation sources', async () => {
    await expect(EnrollmentService.enrollUserInCourse('gold', 'basic', 'p1', 'automation')).rejects.toThrow(/exclusive/);
  });
});
