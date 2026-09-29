// @vitest-environment node
/**
 * @fileOverview Wiring tests for the portal auth hotfix (agents_mcp Phase 1 §1.1a).
 * Refused callers never reach the service; identities passed to services come from the guard
 * (session / verified token), never from arguments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  adminOk: true,
  memberUid: 'learner-1',
  memberOk: true,
  staff: false,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/auth/require-portal-access', () => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    portalAuthErrorMessage: (err: unknown) => (err instanceof ForbiddenError ? err.message : null),
    requirePortalAdmin: vi.fn(async (portalId: string) => {
      if (!h.adminOk) throw new ForbiddenError('No access to this portal.');
      return { auth: { uid: 'staff-1' }, portal: { id: portalId, slug: 's', organizationId: 'org-1', workspaceIds: ['ws-1'], accessPolicy: { visibility: 'public', defaultMemberRole: 'member' } } };
    }),
    requirePortalOrganizationAdmin: vi.fn(async () => {
      if (!h.adminOk) throw new ForbiddenError('No access to this organization.');
      return { uid: 'staff-1' };
    }),
    requirePortalUser: vi.fn(async () => {
      if (!h.memberOk) throw new ForbiddenError('Session expired or invalid.');
      return { uid: h.memberUid, email: 'learner@x.com' };
    }),
    requirePortalMember: vi.fn(async () => {
      if (!h.memberOk) throw new ForbiddenError('Not a member of this portal.');
      return { uid: h.memberUid, email: 'learner@x.com', membership: null, isPortalStaff: h.staff };
    }),
    isPortalStaff: vi.fn(async () => h.staff),
    assertRecordInPortal: vi.fn(async () => undefined),
    isPortalAdminCaller: vi.fn(async () => h.adminOk),
    resolvePortalViewer: vi.fn(async () => ({ userId: null, isStaff: h.adminOk })),
    portalIdOfRecord: vi.fn(async () => 'p1'),
  };
});

const svc = vi.hoisted(() => ({
  publishPortal: vi.fn(async () => ({ id: 'p1', slug: 's' })),
  createMembership: vi.fn(async (input: Record<string, unknown>) => ({ id: 'm1', ...input })),
  getMembership: vi.fn(async () => null),
  updateMemberProfile: vi.fn(async (input: Record<string, unknown>) => ({ id: 'm1', ...input })),
  createPost: vi.fn(async (input: Record<string, unknown>) => ({ id: 'post-1', ...input })),
  processCheckoutOrder: vi.fn(async (input: Record<string, unknown>) => ({ id: 'o1', paymentStatus: 'pending', ...input })),
  createOffer: vi.fn(async (input: Record<string, unknown>) => ({ id: 'offer-1', ...input })),
  listContentItems: vi.fn(async () => []),
  registerForEvent: vi.fn(async (input: Record<string, unknown>) => ({ id: 'r1', ...input })),
  recordEventAttendance: vi.fn(async (input: Record<string, unknown>) => ({ id: 'r1', ...input })),
  listAuditLogs: vi.fn(async () => []),
  getPortalById: vi.fn(async (id: string) => ({ id, slug: 's', organizationId: 'org-1', workspaceIds: ['ws-1'], accessPolicy: { visibility: 'public', defaultMemberRole: 'member' } })),
}));

vi.mock('@/lib/services/portal-service', () => ({ PortalService: { publishPortal: svc.publishPortal, getPortalById: svc.getPortalById } }));
vi.mock('@/lib/services/portal-access-service', () => ({ PortalAccessService: {} }));
vi.mock('@/lib/services/portal-membership-service', () => ({
  PortalMembershipService: { createMembership: svc.createMembership, getMembership: svc.getMembership, updateMemberProfile: svc.updateMemberProfile },
}));
vi.mock('@/lib/services/portal-invitation-service', () => ({ PortalInvitationService: {} }));
vi.mock('@/lib/services/membership-plan-service', () => ({ MembershipPlanService: {} }));
vi.mock('@/lib/services/entitlement-service', () => ({ EntitlementService: {} }));
// Space participation itself is covered by community-integrity.test.ts; here every space is open.
vi.mock('@/lib/services/community-service', () => ({
  CommunityService: { createPost: svc.createPost, canParticipateInSpace: async () => true },
}));
vi.mock('@/lib/services/commerce-service', () => ({
  CommerceService: { processCheckoutOrder: svc.processCheckoutOrder, createOffer: svc.createOffer },
}));
vi.mock('@/lib/services/content-service', () => ({ ContentService: { listContentItems: svc.listContentItems } }));
vi.mock('@/lib/services/event-service', () => ({
  EventService: { registerForEvent: svc.registerForEvent, recordEventAttendance: svc.recordEventAttendance },
}));
vi.mock('@/lib/services/cohort-service', () => ({ CohortService: {} }));
vi.mock('@/lib/services/enterprise-service', () => ({ EnterpriseService: { listAuditLogs: svc.listAuditLogs } }));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({ get: async () => ({ exists: true, id, data: () => ({ portalId: 'p1', visibility: 'public' }) }) }),
    }),
  },
}));
vi.mock('@/lib/auth/require-auth', () => ({ requireSystemAdmin: vi.fn(), requireAuth: vi.fn() }));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, fallback: string) => fallback }));

import { publishPortalAction } from '../portal-actions';
import { joinPortalDirectAction, updatePortalMemberProfileAction } from '../membership-actions';
import { createPostAction } from '../community-actions';
import { createOfferAction, processCheckoutOrderAction } from '../commerce-actions';
import { listContentItemsByPortalAction } from '../content-actions';
import { recordEventAttendanceAction, registerForEventAction } from '../event-actions';
import { listEnterpriseAuditLogsAction } from '../enterprise-actions';

beforeEach(() => {
  h.adminOk = true;
  h.memberOk = true;
  h.staff = false;
  Object.values(svc).forEach((fn) => fn.mockClear());
});

describe('portal admin actions', () => {
  it('refuse non-staff before touching the service', async () => {
    h.adminOk = false;
    await expect(publishPortalAction('p1')).resolves.toEqual({ success: false, error: 'No access to this portal.' });
    expect(svc.publishPortal).not.toHaveBeenCalled();
  });

  it('record the verified staff uid as the actor (was a caller-supplied default of "system_admin")', async () => {
    await publishPortalAction('p1');
    expect(svc.publishPortal).toHaveBeenCalledWith('p1', 'staff-1');
  });
});

describe('member self-join', () => {
  it('creates the membership for the token uid and email, with the default role', async () => {
    const res = await joinPortalDirectAction('token', 'p1', { displayName: 'Ama', role: 'admin' });
    expect(res.success).toBe(true);
    expect(svc.createMembership).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'learner-1', email: 'learner@x.com', role: 'member', organizationId: 'org-1' })
    );
  });

  it('lets verified staff request an elevated role', async () => {
    h.staff = true;
    await joinPortalDirectAction('token', 'p1', { role: 'admin' });
    expect(svc.createMembership).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('refuses an invalid token', async () => {
    h.memberOk = false;
    const res = await joinPortalDirectAction('forged', 'p1', {});
    expect(res.success).toBe(false);
    expect(svc.createMembership).not.toHaveBeenCalled();
  });
});

describe('member profile and community', () => {
  it('only edits the caller\'s own profile', async () => {
    await updatePortalMemberProfileAction('token', { portalId: 'p1', displayName: 'Ama' });
    expect(svc.updateMemberProfile).toHaveBeenCalledWith(expect.objectContaining({ userId: 'learner-1' }));
  });

  it('posts as the verified member and the portal\'s organization', async () => {
    await createPostAction('token', {
      portalId: 'p1',
      spaceId: 'space-1',
      authorName: 'Ama',
      authorRole: 'member',
      type: 'discussion',
      title: 'Hi',
      content: 'Hello',
    } as Parameters<typeof createPostAction>[1]);
    expect(svc.createPost).toHaveBeenCalledWith(expect.objectContaining({ authorId: 'learner-1', organizationId: 'org-1' }));
  });
});

describe('commerce', () => {
  const checkout = { portalId: 'p1', offerId: 'offer-1', customerName: 'Ama', customerEmail: 'a@x.com', paymentMethod: 'card' as const };

  it('buys as the verified uid and the portal\'s organization, ignoring caller identity fields', async () => {
    await processCheckoutOrderAction('token', { ...checkout, userId: 'victim', organizationId: 'org-evil' } as Parameters<typeof processCheckoutOrderAction>[1]);
    expect(svc.processCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 'learner-1', organizationId: 'org-1' }));
  });

  it('mints a server-side guest id when signed out', async () => {
    await processCheckoutOrderAction(null, checkout);
    expect(svc.processCheckoutOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: expect.stringMatching(/^guest_[0-9a-f-]{36}$/) }));
  });

  it('refuses a forged token instead of falling back to guest', async () => {
    h.memberOk = false;
    const res = await processCheckoutOrderAction('forged', checkout);
    expect(res.success).toBe(false);
    expect(svc.processCheckoutOrder).not.toHaveBeenCalled();
  });

  it('creates offers only for staff, under the portal\'s organization', async () => {
    const input = { organizationId: 'org-evil', portalId: 'p1', title: 'Pro', price: 10, offerType: 'one_time' } as Parameters<typeof createOfferAction>[0];
    await createOfferAction(input);
    expect(svc.createOffer).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));

    h.adminOk = false;
    svc.createOffer.mockClear();
    await expect(createOfferAction(input)).resolves.toMatchObject({ success: false });
    expect(svc.createOffer).not.toHaveBeenCalled();
  });
});

describe('content, events, enterprise', () => {
  it('pins non-staff content listings to published items', async () => {
    h.adminOk = false;
    await listContentItemsByPortalAction('p1', { status: 'draft' });
    expect(svc.listContentItems).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'published' }));

    h.adminOk = true;
    await listContentItemsByPortalAction('p1', { status: 'draft' });
    expect(svc.listContentItems).toHaveBeenLastCalledWith('p1', expect.objectContaining({ status: 'draft' }));
  });

  it('registers the verified member for an event, with the token email', async () => {
    await registerForEventAction('token', { portalId: 'p1', eventId: 'e1', userName: 'Ama' });
    expect(svc.registerForEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'learner-1', userEmail: 'learner@x.com', organizationId: 'org-1' })
    );
  });

  it('lets members check in only themselves; staff may mark anyone', async () => {
    const input = { portalId: 'p1', eventId: 'e1', userId: 'someone-else', attendedDurationSeconds: 60 };
    await recordEventAttendanceAction('token', input);
    expect(svc.recordEventAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'learner-1' }));

    await recordEventAttendanceAction(null, input);
    expect(svc.recordEventAttendance).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'someone-else' }));

    h.adminOk = false;
    svc.recordEventAttendance.mockClear();
    await expect(recordEventAttendanceAction(null, input)).resolves.toMatchObject({ success: false });
    expect(svc.recordEventAttendance).not.toHaveBeenCalled();
  });

  it('refuses enterprise audit logs to non-admins of the organization', async () => {
    h.adminOk = false;
    await expect(listEnterpriseAuditLogsAction('org-1')).resolves.toMatchObject({ success: false });
    expect(svc.listAuditLogs).not.toHaveBeenCalled();
  });
});
