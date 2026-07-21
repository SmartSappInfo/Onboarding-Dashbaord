import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MessageTemplate } from '@/lib/types';
import type { WhatsAppTemplate } from '../whatsapp-types';

/**
 * Tenant-isolation and lifecycle tests for the sendable-doc writer/enabler.
 *
 * Two invariants are pinned here:
 *  1. Template names are unique only WITHIN a Meta account, so every lookup must
 *     be organization-scoped — otherwise enabling `order_update` in one org
 *     would delete another org's same-named template.
 *  2. Approval must ACTIVATE the template the user authored, in place. Deleting
 *     and recreating it churns the document id and drops workspace scoping,
 *     which makes the newly-live template vanish from workspace-scoped views.
 */

interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
}

const h = vi.hoisted(() => ({
  filters: [] as Array<{ field: string; op: string; value: unknown }>,
  deleted: [] as string[],
  written: [] as Array<{ id: string; data: Record<string, unknown> }>,
  updated: [] as Array<{ id: string; data: Record<string, unknown> }>,
  queryResult: [] as FakeDoc[],
}));

vi.mock('@/lib/firebase-admin', () => {
  const makeQuery = () => {
    const q = {
      where: (field: string, op: string, value: unknown) => {
        h.filters.push({ field, op, value });
        return q;
      },
      limit: () => q,
      get: async () => ({
        empty: h.queryResult.length === 0,
        docs: h.queryResult.map((d) => ({
          id: d.id,
          data: () => d.data,
          ref: {
            id: d.id,
            update: async (data: Record<string, unknown>) => {
              h.updated.push({ id: d.id, data });
            },
          },
        })),
      }),
    };
    return q;
  };
  return {
    adminDb: {
      collection: () => ({
        ...makeQuery(),
        doc: (id: string) => ({
          id,
          set: async (data: Record<string, unknown>) => {
            h.written.push({ id, data });
          },
        }),
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

import { writeSendableWhatsAppDoc, autoEnableApprovedWhatsAppTemplate } from '../whatsapp-enable';

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

function waTemplate(overrides: Partial<WhatsAppTemplate> = {}): WhatsAppTemplate {
  return {
    id: 'org-A_order_update_en_US',
    organizationId: 'org-A',
    metaTemplateId: 'meta-1',
    name: 'order_update',
    language: 'en_US',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Hi {{1}}' }],
    paramCount: 1,
    paramMap: ['firstName'],
    syncedAt: 'NOW',
    ...overrides,
  };
}

beforeEach(() => {
  h.filters.length = 0;
  h.deleted.length = 0;
  h.written.length = 0;
  h.updated.length = 0;
  h.queryResult.length = 0;
});

describe('writeSendableWhatsAppDoc', () => {
  it('scopes the duplicate lookup to the owning organization', async () => {
    await writeSendableWhatsAppDoc(template());

    const fields = h.filters.map((f) => f.field);
    expect(fields).toContain('organizationId');
    expect(fields).toContain('channel');
    expect(fields).toContain('whatsappTemplateName');
    expect(h.filters.find((f) => f.field === 'organizationId')?.value).toBe('org-A');
  });

  it('writes the canonical doc and removes only same-org duplicates', async () => {
    h.queryResult.push(
      { id: 'legacy-random-id', data: {} },
      { id: 'wa_orgA_order_update_en_US', data: {} },
    );

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

describe('autoEnableApprovedWhatsAppTemplate', () => {
  it('activates the existing authored document in place, never recreating it', async () => {
    h.queryResult.push({
      id: 'skeleton-abc',
      data: {
        organizationId: 'org-A',
        channel: 'whatsapp',
        whatsappTemplateName: 'order_update',
        workspaceIds: ['ws-1'],
        category: 'campaigns',
        templateType: 'order_flow',
        status: 'draft',
      },
    });

    const enabled = await autoEnableApprovedWhatsAppTemplate(waTemplate());

    expect(enabled).toBe(true);
    // Updated in place — the authored doc keeps its id and workspace scoping.
    expect(h.updated).toHaveLength(1);
    expect(h.updated[0].id).toBe('skeleton-abc');
    expect(h.updated[0].data.status).toBe('active');
    expect(h.updated[0].data).not.toHaveProperty('workspaceIds'); // untouched
    // Nothing is deleted or re-minted.
    expect(h.deleted).toHaveLength(0);
    expect(h.written).toHaveLength(0);
  });

  it('binds the Meta identifiers and runtime parameter map', async () => {
    h.queryResult.push({
      id: 'skeleton-abc',
      data: { organizationId: 'org-A', channel: 'whatsapp', whatsappTemplateName: 'order_update' },
    });

    await autoEnableApprovedWhatsAppTemplate(waTemplate());

    const patch = h.updated[0].data;
    expect(patch.whatsappTemplateName).toBe('order_update');
    expect(patch.whatsappLanguage).toBe('en_US');
    expect(patch.whatsappParamMap).toEqual(['firstName']);
    expect(patch.declaredVariables).toEqual(['firstName']);
  });

  it('does not overwrite classification the author already chose', async () => {
    h.queryResult.push({
      id: 'skeleton-abc',
      data: {
        organizationId: 'org-A',
        channel: 'whatsapp',
        whatsappTemplateName: 'order_update',
        category: 'campaigns',
        templateType: 'order_flow',
      },
    });

    await autoEnableApprovedWhatsAppTemplate(
      waTemplate({ appCategory: 'reminders', templateType: 'other' }),
    );

    const patch = h.updated[0].data;
    expect(patch).not.toHaveProperty('category');
    expect(patch).not.toHaveProperty('templateType');
  });

  it('fills classification when the document has none', async () => {
    h.queryResult.push({
      id: 'skeleton-abc',
      data: { organizationId: 'org-A', channel: 'whatsapp', whatsappTemplateName: 'order_update' },
    });

    await autoEnableApprovedWhatsAppTemplate(
      waTemplate({ appCategory: 'reminders', templateType: 'due_soon' }),
    );

    const patch = h.updated[0].data;
    expect(patch.category).toBe('reminders');
    expect(patch.templateType).toBe('due_soon');
  });

  it('does not mint a document for a Meta-authored template with no local doc', async () => {
    // No local doc: the server has no workspace context, so scoping would be lost.
    // These are surfaced for manual "Enable for campaigns" instead.
    const enabled = await autoEnableApprovedWhatsAppTemplate(waTemplate());

    expect(enabled).toBe(false);
    expect(h.updated).toHaveLength(0);
    expect(h.written).toHaveLength(0);
    expect(h.deleted).toHaveLength(0);
  });

  it('ignores templates that are not eligible', async () => {
    const pending = await autoEnableApprovedWhatsAppTemplate(waTemplate({ status: 'PENDING' }));
    expect(pending).toBe(false);

    // Parametrized with no stored map cannot be mapped to variables safely.
    const unmapped = await autoEnableApprovedWhatsAppTemplate(
      waTemplate({ paramMap: undefined }),
    );
    expect(unmapped).toBe(false);
    expect(h.updated).toHaveLength(0);
  });
});
