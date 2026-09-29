// @vitest-environment node
/**
 * @fileOverview Review-fix item 6 (agents_mcp Phase 1 §1.1a, Round 4): invitation acceptance.
 * - Uses are re-checked INSIDE the transaction (no over-redemption under concurrency).
 * - An existing member does not consume a use.
 * - A targeted invite (invitation.email set) can only be accepted by that email address.
 * - The CRM contact link is never caller-supplied.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  invitations: new Map<string, Record<string, unknown>>(),
  memberships: new Map<string, Record<string, unknown>>(),
  txQueue: Promise.resolve() as Promise<unknown>,
}));

vi.mock('@/lib/firebase-admin', () => {
  const invRef = (id: string) => ({
    id,
    get: async () => ({ exists: h.invitations.has(id), data: () => h.invitations.get(id) }),
  });
  return {
    adminDb: {
      collection: () => ({
        doc: (id: string) => invRef(id),
        where: (field: string, _op: string, value: unknown) => ({
          where: (field2: string, _op2: string, value2: unknown) => ({
            limit: () => ({
              get: async () => {
                const docs = [...h.invitations.entries()]
                  .filter(([, d]) => d[field] === value && d[field2] === value2)
                  .map(([id, d]) => ({ id, data: () => d }));
                return { empty: docs.length === 0, docs };
              },
            }),
          }),
        }),
      }),
      // Firestore serializes conflicting transactions; model that with a queue.
      runTransaction: async <T,>(fn: (t: { get: (ref: { id: string }) => Promise<unknown>; update: (ref: { id: string }, d: Doc) => void }) => Promise<T>): Promise<T> => {
        const run = h.txQueue.then(() =>
          fn({
            get: async ref => ({ exists: h.invitations.has(ref.id), data: () => h.invitations.get(ref.id) }),
            update: (ref, d) => void h.invitations.set(ref.id, { ...(h.invitations.get(ref.id) ?? {}), ...d }),
          })
        );
        h.txQueue = run.catch(() => undefined);
        return run;
      },
    },
  };
});

const createMembership = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>) => {
    const m = { id: `m-${String(input.userId)}`, ...input };
    h.memberships.set(`${String(input.portalId)}:${String(input.userId)}`, m);
    return m;
  })
);
vi.mock('@/lib/services/portal-membership-service', () => ({
  PortalMembershipService: {
    createMembership,
    getMembership: vi.fn(async (portalId: string, userId: string) => h.memberships.get(`${portalId}:${userId}`) ?? null),
  },
}));

import { PortalInvitationService } from '../portal-invitation-service';

function invite(id: string, over: Record<string, unknown> = {}) {
  h.invitations.set(id, {
    id,
    portalId: 'p1',
    organizationId: 'org-1',
    workspaceIds: ['ws'],
    token: `tok-${id}`,
    role: 'member',
    maxUses: 1,
    usedCount: 0,
    status: 'pending',
    ...over,
  });
}

beforeEach(() => {
  h.invitations.clear();
  h.memberships.clear();
  createMembership.mockClear();
});

describe('acceptInvitation', () => {
  it('never over-redeems a single-use invite under concurrent accepts', async () => {
    invite('i1');
    const results = await Promise.all([
      PortalInvitationService.acceptInvitation('p1', 'tok-i1', 'u1', { email: 'a@x.com' }),
      PortalInvitationService.acceptInvitation('p1', 'tok-i1', 'u2', { email: 'b@x.com' }),
    ]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(h.invitations.get('i1')?.usedCount).toBe(1);
    expect(createMembership).toHaveBeenCalledTimes(1);
  });

  it('does not consume a use when the user is already a member', async () => {
    invite('i2', { maxUses: 5 });
    h.memberships.set('p1:u1', { id: 'm-existing', portalId: 'p1', userId: 'u1' });
    const res = await PortalInvitationService.acceptInvitation('p1', 'tok-i2', 'u1', { email: 'a@x.com' });
    expect(res).toMatchObject({ success: true, membership: { id: 'm-existing' } });
    expect(h.invitations.get('i2')?.usedCount).toBe(0);
  });

  it('binds a targeted invite to its email (case-insensitive)', async () => {
    invite('i3', { email: 'ama@school.org', role: 'instructor' });
    const wrong = await PortalInvitationService.acceptInvitation('p1', 'tok-i3', 'u9', { email: 'eve@x.com' });
    expect(wrong).toEqual({ success: false, error: 'This invitation was sent to a different email address.' });
    expect(h.invitations.get('i3')?.usedCount).toBe(0);

    const right = await PortalInvitationService.acceptInvitation('p1', 'tok-i3', 'u3', { email: 'Ama@School.org' });
    expect(right.success).toBe(true);
    expect(createMembership).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u3', role: 'instructor' }), 'u3');
  });

  it('keeps shareable links working up to maxUses', async () => {
    invite('i4', { maxUses: 2 });
    expect((await PortalInvitationService.acceptInvitation('p1', 'tok-i4', 'u1', { email: 'a@x.com' })).success).toBe(true);
    expect((await PortalInvitationService.acceptInvitation('p1', 'tok-i4', 'u2', { email: 'b@x.com' })).success).toBe(true);
    const third = await PortalInvitationService.acceptInvitation('p1', 'tok-i4', 'u3', { email: 'c@x.com' });
    expect(third.success).toBe(false);
    expect(h.invitations.get('i4')).toMatchObject({ usedCount: 2, status: 'accepted' });
  });

  it('never links a caller-supplied CRM contact', async () => {
    invite('i5');
    const profile = { email: 'a@x.com', contactId: 'someone-elses-contact' } as Parameters<typeof PortalInvitationService.acceptInvitation>[3];
    await PortalInvitationService.acceptInvitation('p1', 'tok-i5', 'u1', profile);
    expect(createMembership.mock.calls[0][0]).not.toHaveProperty('contactId');
  });
});
