import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Security + resilience regression tests for the bulk skeleton push.
 *
 * The action authorises the CALLER's organization, then loads arbitrary
 * document ids supplied by the client. Without a per-document ownership check
 * an org admin could push (and mutate) another organization's templates through
 * their own Meta account — these tests pin that hole shut.
 */

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  updates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  created: [] as Array<Record<string, unknown>>,
  mirrored: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/auth/require-org-admin', () => ({
  requireOrgAdmin: vi.fn(async () => ({ uid: 'user-1' })),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: h.docs.has(id), data: () => h.docs.get(id) }),
        update: async (data: Record<string, unknown>) => {
          h.updates.push({ id, data });
        },
      }),
    }),
  },
}));

vi.mock('@/lib/whatsapp/whatsapp-credential-repository', () => ({
  WhatsAppCredentialRepository: {
    getCredentials: vi.fn(async () => ({
      wabaId: 'waba-1',
      phoneNumberId: 'pn-1',
      accessToken: 'tok',
    })),
  },
}));

vi.mock('@/lib/whatsapp/meta-cloud-client', () => ({
  MetaCloudApiClient: class {
    async createMessageTemplate(payload: Record<string, unknown>) {
      h.created.push(payload);
      return { id: `meta_${h.created.length}` };
    }
  },
}));

vi.mock('@/lib/whatsapp/whatsapp-template-repository', () => ({
  WhatsAppTemplateRepository: {
    upsertMany: vi.fn(async (templates: Array<Record<string, unknown>>) => {
      h.mirrored.push(...templates);
      return templates.length;
    }),
  },
}));

import { bulkPushWhatsAppSkeletonsAction } from '../bulk-push-whatsapp-skeletons-action';

function skeleton(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Order Update',
    body: 'Your order is ready',
    channel: 'whatsapp',
    organizationId: 'org-A',
    category: 'general',
    ...overrides,
  };
}

beforeEach(() => {
  h.docs.clear();
  h.updates.length = 0;
  h.created.length = 0;
  h.mirrored.length = 0;
});

describe('bulkPushWhatsAppSkeletonsAction — tenant isolation', () => {
  it('refuses to push a skeleton belonging to another organization', async () => {
    h.docs.set('foreign-1', skeleton({ organizationId: 'org-B', name: 'Org B Secret' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['foreign-1']);

    // Nothing may reach Meta, and the foreign document must not be mutated.
    expect(h.created).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
    expect(h.mirrored).toHaveLength(0);
    expect(res.pushed).toBe(0);
    expect(res.failed.concat(res.skipped as never[]).length).toBeGreaterThan(0);
  });

  it('pushes only the caller-owned skeletons in a mixed batch', async () => {
    h.docs.set('mine', skeleton({ name: 'Mine' }));
    h.docs.set('theirs', skeleton({ organizationId: 'org-B', name: 'Theirs' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['mine', 'theirs']);

    expect(res.pushed).toBe(1);
    expect(h.created).toHaveLength(1);
    expect(h.updates.map((u) => u.id)).toEqual(['mine']);
  });
});

describe('bulkPushWhatsAppSkeletonsAction — resilience & limits', () => {
  it('continues past a failing item and reports it per-item', async () => {
    h.docs.set('bad', skeleton({ name: '!!!' })); // slugifies to empty -> failure
    h.docs.set('good', skeleton({ name: 'Good One' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['bad', 'good']);

    expect(res.success).toBe(true);
    expect(res.pushed).toBe(1);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].id).toBe('bad');
  });

  it('skips templates that were already pushed', async () => {
    h.docs.set('done', skeleton({ whatsappTemplateName: 'order_update' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['done']);

    expect(res.pushed).toBe(0);
    expect(h.created).toHaveLength(0);
    expect(res.skipped[0].reason).toMatch(/already pushed/i);
  });

  it('caps how many templates one invocation may push', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      const id = `t-${i}`;
      ids.push(id);
      h.docs.set(id, skeleton({ name: `Template ${i}` }));
    }

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ids);

    // Bounded work per invocation (resource-exhaustion guard); remainder reported.
    expect(res.pushed).toBeLessThanOrEqual(25);
    expect(h.created.length).toBeLessThanOrEqual(25);
    expect(res.skipped.some((s) => /remaining|limit/i.test(s.reason))).toBe(true);
  });

  it('rejects a body that ends with a variable locally, without calling Meta', async () => {
    // Meta rejects these with an opaque "Invalid parameter" — catch it here.
    h.docs.set('trailing', skeleton({ name: 'Trailing', body: 'Your order number is {{orderId}}' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['trailing']);

    expect(h.created).toHaveLength(0); // never hit the Graph API
    expect(res.pushed).toBe(0);
    expect(res.failed[0].error).toMatch(/cannot end with a variable/i);
  });

  it('ignores duplicate ids in the request', async () => {
    h.docs.set('dup', skeleton({ name: 'Dup' }));

    const res = await bulkPushWhatsAppSkeletonsAction('tok', 'org-A', ['dup', 'dup', 'dup']);

    expect(res.pushed).toBe(1);
    expect(h.created).toHaveLength(1);
  });
});
