// @vitest-environment node
/**
 * @fileOverview Review-fix item 3 (agents_mcp Phase 1 §1.1a, Round 4): community integrity.
 * - Author name/avatar/role come from the server (membership / staff profile), never the caller.
 * - Posting, commenting, reacting and voting respect the space's visibility (plan / cohort gating).
 * - A comment's space is the post's stored space.
 * - Authors cannot pin or lock their own posts.
 * Uses the REAL `assertRecordInPortal` over an in-memory Firestore (only identity is mocked).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  member: {
    uid: 'm1',
    email: 'ama@x.com',
    isPortalStaff: false,
    membership: { id: 'mem-1', displayName: 'Ama Mensah', avatarUrl: 'https://img/ama.png', role: 'member', planId: 'plan-free', status: 'active' } as Record<string, unknown> | null,
  },
}));

function col(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => {
  const docRef = (name: string, id: string) => ({
    id,
    get: async () => ({ exists: col(name).has(id), id, data: () => col(name).get(id) }),
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, data: () => d }));
      return { empty: docs.length === 0, docs };
    },
  });
  return { adminDb: { collection: (name: string) => ({ ...query(name, []), doc: (id: string) => docRef(name, id) }) } };
});

vi.mock('@/lib/auth/require-portal-access', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-portal-access')>();
  return {
    ...actual,
    requirePortalMember: vi.fn(async () => ({ ...h.member })),
    requirePortalAdmin: vi.fn(async () => {
      throw new actual.ForbiddenError('No access to this portal.');
    }),
  };
});
vi.mock('@/lib/services/portal-service', () => ({
  PortalService: { getPortalById: vi.fn(async (id: string) => ({ id, organizationId: 'org-1' })) },
}));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, f: string) => f }));

const svc = vi.hoisted(() => ({
  createPost: vi.fn(async (input: Record<string, unknown>) => ({ id: 'post-new', ...input })),
  createComment: vi.fn(async (input: Record<string, unknown>) => ({ id: 'c-new', ...input })),
  updatePost: vi.fn(async (_id: string, u: Record<string, unknown>) => ({ id: 'post-1', ...u })),
  toggleReaction: vi.fn(async () => ({ reacted: true, type: 'like', count: 1 })),
  castPollVote: vi.fn(async () => ({ id: 'poll-1' })),
}));
vi.mock('@/lib/services/community-service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/services/community-service')>();
  // Keep the real entitlement logic (canParticipateInSpace / isUserEntitledToSpace); stub only the writes.
  return { CommunityService: Object.assign(actual.CommunityService, svc) };
});

import { castPollVoteAction, createCommentAction, createPostAction, toggleReactionAction, updatePostAction } from '../community-actions';

const postInput = { portalId: 'p1', spaceId: 'open', type: 'discussion' as const, title: 'Hi', content: 'Hello' };

beforeEach(() => {
  h.store.clear();
  Object.values(svc).forEach(fn => fn.mockClear());
  h.member = {
    uid: 'm1',
    email: 'ama@x.com',
    isPortalStaff: false,
    membership: { id: 'mem-1', displayName: 'Ama Mensah', avatarUrl: 'https://img/ama.png', role: 'member', planId: 'plan-free', status: 'active' },
  };
  col('community_spaces').set('open', { portalId: 'p1', visibility: 'members_only' });
  col('community_spaces').set('vip', { portalId: 'p1', visibility: 'plan_gated', allowedPlanIds: ['plan-vip'] });
  col('community_spaces').set('cohort', { portalId: 'p1', visibility: 'private_cohort' });
  col('community_spaces').set('other-portal', { portalId: 'p2', visibility: 'public' });
  col('course_cohorts').set('march', { portalId: 'p1', linkedSpaceId: 'cohort' });
  col('community_posts').set('post-open', { portalId: 'p1', spaceId: 'open', authorId: 'm1' });
  col('community_posts').set('post-vip', { portalId: 'p1', spaceId: 'vip', authorId: 'someone' });
  col('community_comments').set('c-vip', { portalId: 'p1', spaceId: 'vip', postId: 'post-vip', authorId: 'someone' });
});

describe('author identity', () => {
  it('ignores caller-supplied author fields and uses the membership profile', async () => {
    const spoof = { ...postInput, authorName: 'Portal Admin', authorRole: 'admin', authorAvatarUrl: 'https://evil' } as Parameters<typeof createPostAction>[1];
    const res = await createPostAction('token', spoof);
    expect(res.success).toBe(true);
    expect(svc.createPost).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'm1', authorName: 'Ama Mensah', authorAvatarUrl: 'https://img/ama.png', authorRole: 'member', organizationId: 'org-1' })
    );
  });

  it('labels portal staff without a membership as admin, named from their email', async () => {
    h.member = { uid: 's1', email: 'kofi@school.org', isPortalStaff: true, membership: null };
    await createPostAction('token', postInput);
    expect(svc.createPost).toHaveBeenCalledWith(expect.objectContaining({ authorId: 's1', authorName: 'kofi', authorRole: 'admin' }));
  });
});

describe('space access', () => {
  it('refuses a plan-gated space without the plan, allows it with the plan', async () => {
    const res = await createPostAction('token', { ...postInput, spaceId: 'vip' });
    expect(res).toEqual({ success: false, error: 'You do not have access to post in this space.' });
    expect(svc.createPost).not.toHaveBeenCalled();

    h.member.membership = { ...(h.member.membership ?? {}), planId: 'plan-vip' };
    await expect(createPostAction('token', { ...postInput, spaceId: 'vip' })).resolves.toMatchObject({ success: true });
  });

  it('lets cohort members (and only them) post in a cohort-linked private space', async () => {
    await expect(createPostAction('token', { ...postInput, spaceId: 'cohort' })).resolves.toMatchObject({ success: false });
    col('cohort_members').set('cm1', { cohortId: 'march', userId: 'm1', status: 'active' });
    await expect(createPostAction('token', { ...postInput, spaceId: 'cohort' })).resolves.toMatchObject({ success: true });
  });

  it('refuses a space of another portal', async () => {
    await expect(createPostAction('token', { ...postInput, spaceId: 'other-portal' })).resolves.toMatchObject({ success: false });
  });

  it('uses the post\'s stored space for comments, not the claimed one', async () => {
    const res = await createCommentAction('token', { portalId: 'p1', spaceId: 'open', postId: 'post-vip', content: 'hi' });
    expect(res.success).toBe(false);
    expect(svc.createComment).not.toHaveBeenCalled();
  });

  it('gates reactions and poll votes by the target\'s space', async () => {
    await expect(toggleReactionAction('token', { portalId: 'p1', targetType: 'comment', targetId: 'c-vip', type: 'like' })).resolves.toMatchObject({ success: false });
    await expect(castPollVoteAction('token', { portalId: 'p1', postId: 'post-vip', pollId: 'poll-1', selectedOptionIds: ['a'] })).resolves.toMatchObject({ success: false });
    await expect(toggleReactionAction('token', { portalId: 'p1', targetType: 'post', targetId: 'post-open', type: 'like' })).resolves.toMatchObject({ success: true });
  });

  it('keeps open spaces working for comments', async () => {
    await expect(createCommentAction('token', { portalId: 'p1', spaceId: 'open', postId: 'post-open', content: 'hi' })).resolves.toMatchObject({ success: true });
    expect(svc.createComment).toHaveBeenCalledWith(expect.objectContaining({ spaceId: 'open', authorName: 'Ama Mensah' }));
  });
});

describe('author edits', () => {
  it('strips pin/lock from an author\'s edit but keeps content changes', async () => {
    await updatePostAction('token', 'post-open', { title: 'New', isPinned: true, isLocked: false });
    expect(svc.updatePost).toHaveBeenCalledWith('post-open', { title: 'New' });
  });

  it('lets portal staff pin and lock through edits', async () => {
    h.member = { ...h.member, uid: 's1', isPortalStaff: true };
    await updatePostAction('token', 'post-open', { isPinned: true, isLocked: true });
    expect(svc.updatePost).toHaveBeenCalledWith('post-open', { isPinned: true, isLocked: true });
  });
});
