// @vitest-environment node
/**
 * @fileOverview Review-fix item 4 (agents_mcp Phase 1 §1.1a, Round 4): gated content never leaves the
 * server in full for a viewer without access. Uses the REAL EntitlementService rules; only the
 * content store, the membership lookup and viewer identity are faked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContentItem } from '@/lib/types/content';
import type { PageBlock } from '@/lib/types';

const h = vi.hoisted(() => ({
  viewer: { userId: null as string | null, isStaff: false },
  membership: null as Record<string, unknown> | null,
  items: [] as ContentItem[],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, f: string) => f }));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => {
      const q = { where: () => q, limit: () => q, get: async () => ({ empty: true, docs: [] }) };
      return q;
    },
  },
}));
vi.mock('@/lib/services/portal-membership-service', () => ({
  PortalMembershipService: { getMembership: vi.fn(async () => h.membership) },
}));
vi.mock('@/lib/auth/require-portal-access', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-portal-access')>();
  return {
    ...actual,
    resolvePortalViewer: vi.fn(async () => ({ ...h.viewer })),
    isPortalAdminCaller: vi.fn(async () => h.viewer.isStaff),
  };
});
vi.mock('@/lib/services/content-service', () => ({
  ContentService: {
    listContentItems: vi.fn(async () => h.items),
    searchPortalContent: vi.fn(async () => h.items.map(item => ({ item, score: 1 }))),
    getContentItemBySlug: vi.fn(async (_p: string, _t: string, slug: string) => h.items.find(i => i.slug === slug) ?? null),
  },
}));

import { getContentItemForViewerAction, listContentItemsByPortalAction, searchPortalContentAction } from '../content-actions';

const block = (id: string): PageBlock => ({ id, type: 'text' }) as unknown as PageBlock;

function item(slug: string, over: Partial<ContentItem>): ContentItem {
  return {
    id: slug,
    organizationId: 'org-1',
    portalId: 'p1',
    workspaceIds: [],
    type: 'lesson',
    title: slug,
    slug,
    status: 'published',
    visibility: 'public',
    blocks: [block('b1'), block('b2'), block('b3')],
    content: 'First paragraph.\n\nSecret second paragraph.',
    version: 1,
    createdAt: '',
    updatedAt: '',
    createdBy: 'staff',
    ...over,
  };
}

beforeEach(() => {
  h.viewer = { userId: null, isStaff: false };
  h.membership = null;
  h.items = [
    item('open', {}),
    item('gold', {
      visibility: 'authenticated',
      requiredPlanIds: ['plan-gold'],
      media: { videoUrl: 'https://video/secret', audioUrl: 'https://audio/secret', downloadUrl: 'https://dl/secret', fileUrl: 'https://file/secret', thumbnailUrl: 'https://thumb' },
    }),
    item('draft', { status: 'draft' }),
  ];
});

function find(list: ContentItem[] | undefined, slug: string) {
  return list?.find(i => i.slug === slug);
}

describe('anonymous visitor', () => {
  it('gets public items in full and gated items as a teaser only', async () => {
    const res = await listContentItemsByPortalAction('p1', { status: 'draft' });
    expect(res.success).toBe(true);
    expect(find(res.data, 'open')?.blocks).toHaveLength(3);
    const gold = find(res.data, 'gold');
    expect(gold?.blocks).toHaveLength(1);
    expect(gold?.content).toBe('First paragraph.');
    expect(gold?.media).toEqual({ thumbnailUrl: 'https://thumb' });
    expect(gold?.isGated).toBe(true);
    expect(find(res.data, 'draft')).toBeUndefined();
  });

  it('search results are sanitised the same way', async () => {
    const res = await searchPortalContentAction('p1', 'x');
    const gold = res.data?.find(r => r.item.slug === 'gold')?.item;
    expect(gold?.blocks).toHaveLength(1);
    expect(gold?.media?.videoUrl).toBeUndefined();
  });

  it('the reader gets the teaser plus the reason, and never a draft', async () => {
    const res = await getContentItemForViewerAction(null, 'p1', 'lesson', 'gold');
    expect(res.data?.access).toMatchObject({ hasAccess: false, reason: 'auth_required' });
    expect(res.data?.item?.blocks).toHaveLength(1);
    await expect(getContentItemForViewerAction(null, 'p1', 'lesson', 'draft')).resolves.toMatchObject({ data: { item: null } });
  });
});

describe('members', () => {
  it('a member without the plan gets the teaser and the upgrade reason', async () => {
    h.viewer = { userId: 'm1', isStaff: false };
    h.membership = { status: 'active', role: 'member', planId: 'plan-free' };
    const res = await getContentItemForViewerAction('token', 'p1', 'lesson', 'gold');
    expect(res.data?.access).toMatchObject({ hasAccess: false, reason: 'plan_upgrade_required', requiredPlanIds: ['plan-gold'] });
    expect(res.data?.item?.content).toBe('First paragraph.');
  });

  it('a member with the plan gets the full item', async () => {
    h.viewer = { userId: 'm1', isStaff: false };
    h.membership = { status: 'active', role: 'member', planId: 'plan-gold' };
    const res = await getContentItemForViewerAction('token', 'p1', 'lesson', 'gold');
    expect(res.data?.access.hasAccess).toBe(true);
    expect(res.data?.item?.blocks).toHaveLength(3);
    expect(res.data?.item?.media?.videoUrl).toBe('https://video/secret');
  });
});

describe('portal staff', () => {
  it('see drafts and full bodies (admin content manager keeps working)', async () => {
    h.viewer = { userId: null, isStaff: true };
    const res = await listContentItemsByPortalAction('p1');
    expect(res.data).toHaveLength(3);
    expect(find(res.data, 'gold')?.blocks).toHaveLength(3);
  });
});
