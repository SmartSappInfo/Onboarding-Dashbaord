import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MessageTemplate } from '@/lib/types';

/**
 * Tenant-isolation tests for the sendable-doc writer.
 *
 * `writeSendableWhatsAppDoc` deletes same-named WhatsApp docs so a template never
 * appears twice. Template names are only unique WITHIN a Meta account, so without
 * an organizationId filter enabling `order_update` in org A would delete org B's
 * `order_update`. These tests pin the query scope.
 */

const h = vi.hoisted(() => ({
  filters: [] as Array<{ field: string; op: string; value: unknown }>,
  deleted: [] as string[],
  written: [] as Array<{ id: string; data: Record<string, unknown> }>,
  docsInQuery: [] as Array<{ id: string }>,
}));

vi.mock('@/lib/firebase-admin', () => {
  const makeQuery = () => ({
    where: (field: string, op: string, value: unknown) => {
      h.filters.push({ field, op, value });
      return makeQuery();
    },
    get: async () => ({
      docs: h.docsInQuery.map((d) => ({ id: d.id, ref: { id: d.id } })),
    }),
  });
  return {
    adminDb: {
      collection: () => ({
        ...makeQuery(),
        doc: (id: string) => ({ id }),
      }),
      batch: () => ({
        delete: (ref: { id: string }) => h.deleted.push(ref.id),
        set: (ref: { id: string }, data: Record<string, unknown>) =>
          h.written.push({ id: ref.id, data }),
        commit: async () => undefined,
      }),
    },
  };
});

import { writeSendableWhatsAppDoc } from '../whatsapp-enable';

function template(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: 'wa_orgA_order_update_en_US',
    scope: 'organization',
    organizationId: 'org-A',
    category: 'general',
    channel: 'whatsapp',
    target: 'external_client',
    name: 'order_update',
    contentMode: 'template',
    body: 'Hi {{1}}',
    templateType: 'whatsapp',
    variableContext: 'common',
    declaredVariables: ['firstName'],
    status: 'active',
    version: 1,
    whatsappTemplateName: 'order_update',
    whatsappLanguage: 'en_US',
    whatsappParamMap: ['firstName'],
    createdAt: 'T',
    updatedAt: 'T',
    ...overrides,
  };
}

beforeEach(() => {
  h.filters.length = 0;
  h.deleted.length = 0;
  h.written.length = 0;
  h.docsInQuery.length = 0;
});

describe('writeSendableWhatsAppDoc', () => {
  it('scopes the duplicate lookup to the owning organization', async () => {
    await writeSendableWhatsAppDoc(template());

    const fields = h.filters.map((f) => f.field);
    expect(fields).toContain('organizationId');
    expect(fields).toContain('channel');
    expect(fields).toContain('whatsappTemplateName');

    const orgFilter = h.filters.find((f) => f.field === 'organizationId');
    expect(orgFilter?.value).toBe('org-A');
  });

  it('writes the canonical doc and removes only same-org duplicates', async () => {
    h.docsInQuery.push({ id: 'legacy-random-id' }, { id: 'wa_orgA_order_update_en_US' });

    await writeSendableWhatsAppDoc(template());

    expect(h.deleted).toEqual(['legacy-random-id']); // never deletes itself
    expect(h.written.map((w) => w.id)).toEqual(['wa_orgA_order_update_en_US']);
  });

  it('refuses to run unscoped when the template has no organization', async () => {
    await expect(
      writeSendableWhatsAppDoc(template({ organizationId: undefined })),
    ).rejects.toThrow(/organization/i);
    expect(h.deleted).toHaveLength(0);
    expect(h.written).toHaveLength(0);
  });
});
