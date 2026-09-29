// @vitest-environment node
/**
 * @fileOverview Portal Membership behavioral baseline (round-2 blocker R6)
 *
 * Characterizes the REAL `PortalMembershipService` against an in-memory Firestore, so the Phase 1
 * `experience_portal` capability adapters can prove parity. Until this file there were no tests for
 * this service (the file named portal-membership-service.test.ts tests MembershipPlanService).
 *
 * "KNOWN RISK" cases pin current behavior that Phase 1 should change DELIBERATELY. When a Phase 1
 * fix lands, update the matching assertion in the same PR so the behavior change is explicit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const fake = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return fake.db;
  },
}));
const emitContentEvent = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/services/portal-event-service', () => ({ PortalEventService: { emitContentEvent } }));

import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type { CreateMembershipInput } from '@/lib/types/membership';

const COLLECTION = 'portal_memberships';
let db: FakeFirestore;

const baseInput: CreateMembershipInput = {
  organizationId: 'org-1',
  portalId: 'portal-1',
  workspaceIds: ['ws-1'],
  userId: 'user-1',
  email: '  Ama.Mensah@Example.COM ',
  displayName: 'Ama Mensah',
};

/**
 * Server actions receive client JSON without runtime validation, so the service's fallbacks for
 * missing `workspaceIds` / `displayName` are reachable in production even though the type requires them.
 */
function untypedClientPayload(): CreateMembershipInput {
  const { workspaceIds: _ws, displayName: _dn, ...rest } = baseInput;
  return rest as CreateMembershipInput;
}

beforeEach(() => {
  db = new FakeFirestore();
  fake.db = db;
  emitContentEvent.mockClear();
});

describe('PortalMembershipService.createMembership', () => {
  it('requires organizationId, portalId, userId and email', async () => {
    await expect(PortalMembershipService.createMembership({ ...baseInput, email: '' })).rejects.toThrow(/required/);
  });

  it('normalizes email, derives display name and applies defaults', async () => {
    const m = await PortalMembershipService.createMembership(untypedClientPayload());
    expect(m).toMatchObject({
      email: 'ama.mensah@example.com',
      displayName: '  Ama.Mensah', // KNOWN RISK: derived from the untrimmed email
      role: 'member',
      status: 'active',
      joinedVia: 'direct_join',
      points: 0,
      streakDays: 1,
      tags: [],
    });
    expect(db.read(`${COLLECTION}/${m.id}`)).toMatchObject({ userId: 'user-1', portalId: 'portal-1' });
  });

  it("KNOWN RISK: falls back to workspaceIds ['default'] when none are given", async () => {
    const m = await PortalMembershipService.createMembership(untypedClientPayload());
    expect(m.workspaceIds).toEqual(['default']);
  });

  it('is idempotent per (portal, user): a second call returns the existing membership', async () => {
    const first = await PortalMembershipService.createMembership(baseInput);
    const second = await PortalMembershipService.createMembership({ ...baseInput, role: 'admin' });
    expect(second.id).toBe(first.id);
    expect(second.role).toBe('member');
    expect(emitContentEvent).toHaveBeenCalledTimes(1);
  });

  it('KNOWN RISK: the existing-membership lookup ignores organizationId', async () => {
    const first = await PortalMembershipService.createMembership(baseInput);
    const other = await PortalMembershipService.createMembership({ ...baseInput, organizationId: 'org-OTHER' });
    expect(other.id).toBe(first.id);
    expect(other.organizationId).toBe('org-1');
  });

  it("emits content.created, attributed to 'system' when no actor is passed", async () => {
    const m = await PortalMembershipService.createMembership(baseInput);
    expect(emitContentEvent).toHaveBeenCalledWith(
      'content.created',
      expect.objectContaining({ id: m.id, type: 'member', portalId: 'portal-1', organizationId: 'org-1' }),
      'system' // KNOWN RISK: unauthenticated callers are attributed to 'system'
    );
  });
});

describe('PortalMembershipService lifecycle', () => {
  it('updates role and status through updateMembership', async () => {
    const m = await PortalMembershipService.createMembership(baseInput);
    expect((await PortalMembershipService.updateRole(m.id, 'instructor', 'admin-1')).role).toBe('instructor');
    expect((await PortalMembershipService.suspendMembership(m.id, 'admin-1')).status).toBe('suspended');
    expect((await PortalMembershipService.reactivateMembership(m.id, 'admin-1')).status).toBe('active');
  });

  it('KNOWN RISK: updateMembership merges any field, including tenant identifiers', async () => {
    const m = await PortalMembershipService.createMembership(baseInput);
    const moved = await PortalMembershipService.updateMembership(m.id, { organizationId: 'org-OTHER' } as never);
    expect(moved.organizationId).toBe('org-OTHER');
  });

  it('throws for unknown memberships', async () => {
    await expect(PortalMembershipService.updateMembership('missing', { role: 'admin' })).rejects.toThrow(/not found/);
    await expect(PortalMembershipService.awardPoints('missing', 5, 'x')).rejects.toThrow(/not found/);
  });

  it('awards points and keeps the latest 50 history entries, newest first', async () => {
    const m = await PortalMembershipService.createMembership(baseInput);
    for (let i = 1; i <= 52; i += 1) {
      await PortalMembershipService.awardPoints(m.id, 2, `action-${i}`);
    }
    const final = await PortalMembershipService.getMembershipById(m.id);
    expect(final?.points).toBe(104);
    expect(final?.pointsHistory).toHaveLength(50);
    expect(final?.pointsHistory?.[0].action).toBe('action-52');
  });

  it('KNOWN RISK: deleteMembership hard-deletes and reports true even when nothing existed', async () => {
    const m = await PortalMembershipService.createMembership(baseInput);
    expect(await PortalMembershipService.deleteMembership(m.id, 'admin-1')).toBe(true);
    expect(db.read(`${COLLECTION}/${m.id}`)).toBeUndefined();
    expect(await PortalMembershipService.deleteMembership('never-existed', 'admin-1')).toBe(true);
  });
});

describe('PortalMembershipService.listMembers', () => {
  beforeEach(async () => {
    await PortalMembershipService.createMembership({ ...baseInput, userId: 'u1', email: 'kofi@x.com', role: 'admin', tags: ['vip'] });
    await PortalMembershipService.createMembership({ ...baseInput, userId: 'u2', email: 'efua@x.com' });
    await PortalMembershipService.createMembership({ ...baseInput, userId: 'u3', email: 'yaw@x.com', portalId: 'portal-2' });
  });

  it('is scoped to one portal and filters by role and search (name, email, tags)', async () => {
    expect(await PortalMembershipService.listMembers('portal-1')).toHaveLength(2);
    expect((await PortalMembershipService.listMembers('portal-1', { role: 'admin' })).map((m) => m.userId)).toEqual(['u1']);
    expect((await PortalMembershipService.listMembers('portal-1', { search: 'VIP' })).map((m) => m.userId)).toEqual(['u1']);
    expect((await PortalMembershipService.listMembers('portal-1', { search: 'efua' })).map((m) => m.userId)).toEqual(['u2']);
  });
});
