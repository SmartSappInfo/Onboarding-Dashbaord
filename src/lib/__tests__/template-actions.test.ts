// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before vi.mock calls (hoisting-safe via vi.hoisted)
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ _increment: n }) },
}));

// ---------------------------------------------------------------------------
// Shared mutable state (module-level, reset in beforeEach)
// ---------------------------------------------------------------------------

let mockDocs: Record<string, Record<string, unknown>> = {};
let queryOverrides: Record<string, any> = {};
let autoIdCounter = 0;

function makeRef(collectionName: string, id: string) {
  const key = `${collectionName}/${id}`;
  return {
    id,
    set: vi.fn(async (data: Record<string, unknown>) => {
      mockDocs[key] = { ...data };
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      mockDocs[key] = { ...(mockDocs[key] ?? {}), ...data };
    }),
    delete: vi.fn(async () => {
      delete mockDocs[key];
    }),
    get: vi.fn(async () => {
      const data = mockDocs[key];
      if (data) return { id, exists: true, data: () => data };
      return { id, exists: false, data: () => undefined };
    }),
  };
}

function makeQuery(snap: { empty: boolean; docs: any[] }) {
  const q: any = { where: () => q, limit: () => q, get: vi.fn().mockResolvedValue(snap) };
  return q;
}

function makeSnap(docs: { id: string; data: () => Record<string, unknown> }[]) {
  return { empty: docs.length === 0, docs };
}

function makeEmptySnap() {
  return { empty: true, docs: [] };
}

// Use vi.mock with a factory that closes over the module-level variables
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id ?? `auto-${++autoIdCounter}`;
          return makeRef(name, docId);
        },
        where: () => queryOverrides[name] ?? makeQuery(makeEmptySnap()),
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import {
  createGlobalTemplate,
  updateGlobalTemplate,
  deleteGlobalTemplate,
  listGlobalTemplates,
  createOrgOverride,
  updateOrgTemplate,
  revertToGlobal,
  listTemplates,
  activateTemplate,
  archiveTemplate,
  unarchiveTemplate,
} from '../template-actions';
import type { MessageTemplate } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseTemplate(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: 'tpl-1',
    scope: 'global',
    category: 'meetings',
    templateType: 'meeting_invitation',
    name: 'Meeting Invite',
    channel: 'email',
    body: 'Hello {{contact_name}}',
    variableContext: 'meeting',
    declaredVariables: ['contact_name'],
    status: 'draft',
    isActive: false,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    ...overrides,
  };
}

function seedDoc(collection: string, id: string, data: Record<string, unknown> | MessageTemplate) {
  mockDocs[`${collection}/${id}`] = data as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('template-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocs = {};
    queryOverrides = {};
    autoIdCounter = 0;
  });

  // -------------------------------------------------------------------------
  // createGlobalTemplate
  // -------------------------------------------------------------------------

  describe('createGlobalTemplate', () => {
    it('creates a template with scope global, status draft, version 1', async () => {
      const result = await createGlobalTemplate({
        name: 'Meeting Invite',
        category: 'meetings',
        templateType: 'meeting_invitation',
        channel: 'email',
        body: 'Hello {{contact_name}}',
        variableContext: 'meeting',
        declaredVariables: ['contact_name'],
        createdBy: 'user-1',
      });

      expect(result.scope).toBe('global');
      expect(result.status).toBe('draft');
      expect(result.version).toBe(1);
      expect(result.isActive).toBe(false);
      expect(result.category).toBe('meetings');
      expect(result.templateType).toBe('meeting_invitation');
    });

    it('defaults declaredVariables to empty array when not provided', async () => {
      const result = await createGlobalTemplate({
        name: 'Test',
        category: 'general',
        templateType: 'welcome_message',
        channel: 'sms',
        body: 'Hi there',
        variableContext: 'common',
        createdBy: 'user-1',
      });

      expect(result.declaredVariables).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // updateGlobalTemplate
  // -------------------------------------------------------------------------

  describe('updateGlobalTemplate', () => {
    it('throws when template does not exist', async () => {
      await expect(
        updateGlobalTemplate('missing-id', { name: 'New Name' }, 'user-1'),
      ).rejects.toThrow('not found');
    });

    it('throws when template is not global scope', async () => {
      seedDoc('message_templates', 'tpl-org', baseTemplate({ id: 'tpl-org', scope: 'organization' }));

      await expect(
        updateGlobalTemplate('tpl-org', { name: 'New Name' }, 'user-1'),
      ).rejects.toThrow('not a global template');
    });

    it('updates the template and passes updatedBy', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate());

      await updateGlobalTemplate('tpl-1', { name: 'Updated Name' }, 'user-2');

      // The doc should have been updated
      const updated = mockDocs['message_templates/tpl-1'];
      expect(updated?.updatedBy).toBe('user-2');
      expect(updated?.name).toBe('Updated Name');
    });
  });

  // -------------------------------------------------------------------------
  // deleteGlobalTemplate
  // -------------------------------------------------------------------------

  describe('deleteGlobalTemplate', () => {
    it('throws when pending scheduled messages reference the template', async () => {
      queryOverrides['scheduled_messages'] = makeQuery(
        makeSnap([{ id: 'sm-1', data: () => ({ templateId: 'tpl-1', status: 'pending' }) }]),
      );

      await expect(deleteGlobalTemplate('tpl-1')).rejects.toThrow(
        'referenced by pending scheduled messages',
      );
    });

    it('throws when template does not exist', async () => {
      queryOverrides['scheduled_messages'] = makeQuery(makeEmptySnap());

      await expect(deleteGlobalTemplate('missing')).rejects.toThrow('not found');
    });

    it('throws when template is not global scope', async () => {
      queryOverrides['scheduled_messages'] = makeQuery(makeEmptySnap());
      seedDoc('message_templates', 'tpl-org', baseTemplate({ id: 'tpl-org', scope: 'organization' }));

      await expect(deleteGlobalTemplate('tpl-org')).rejects.toThrow('not a global template');
    });

    it('deletes the template when no pending messages reference it', async () => {
      queryOverrides['scheduled_messages'] = makeQuery(makeEmptySnap());
      seedDoc('message_templates', 'tpl-1', baseTemplate());

      await deleteGlobalTemplate('tpl-1');

      expect(mockDocs['message_templates/tpl-1']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // createOrgOverride
  // -------------------------------------------------------------------------

  describe('createOrgOverride', () => {
    it('throws when global template does not exist', async () => {
      await expect(
        createOrgOverride('missing-global', 'org-1', {}, 'user-1'),
      ).rejects.toThrow('not found');
    });

    it('throws when referenced template is not global scope', async () => {
      seedDoc('message_templates', 'tpl-org', baseTemplate({ id: 'tpl-org', scope: 'organization' }));

      await expect(
        createOrgOverride('tpl-org', 'org-1', {}, 'user-1'),
      ).rejects.toThrow('not a global template');
    });

    it('creates an org override with correct scope and linkage', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate());

      const result = await createOrgOverride(
        'tpl-1',
        'org-1',
        { name: 'Custom Invite' },
        'user-1',
      );

      expect(result.scope).toBe('organization');
      expect(result.organizationId).toBe('org-1');
      expect(result.globalTemplateId).toBe('tpl-1');
      expect(result.status).toBe('draft');
      expect(result.version).toBe(1);
      expect(result.name).toBe('Custom Invite');
    });

    it('inherits body from global template when not overridden', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ body: 'Original body' }));

      const result = await createOrgOverride('tpl-1', 'org-1', {}, 'user-1');

      expect(result.body).toBe('Original body');
    });
  });

  // -------------------------------------------------------------------------
  // updateOrgTemplate
  // -------------------------------------------------------------------------

  describe('updateOrgTemplate', () => {
    it('throws when template does not exist', async () => {
      await expect(
        updateOrgTemplate('missing', 'org-1', { name: 'X' }, 'user-1'),
      ).rejects.toThrow('not found');
    });

    it('throws when template is not org-scoped', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ scope: 'global' }));

      await expect(
        updateOrgTemplate('tpl-1', 'org-1', { name: 'X' }, 'user-1'),
      ).rejects.toThrow('not an org-scoped template');
    });

    it('throws when template belongs to a different org', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ scope: 'organization', organizationId: 'org-2' }));

      await expect(
        updateOrgTemplate('tpl-1', 'org-1', { name: 'X' }, 'user-1'),
      ).rejects.toThrow('does not belong to organization');
    });

    it('updates the template when org matches', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ scope: 'organization', organizationId: 'org-1' }));

      await updateOrgTemplate('tpl-1', 'org-1', { name: 'Updated' }, 'user-1');

      const updated = mockDocs['message_templates/tpl-1'];
      expect(updated?.name).toBe('Updated');
      expect(updated?.updatedBy).toBe('user-1');
    });
  });

  // -------------------------------------------------------------------------
  // revertToGlobal
  // -------------------------------------------------------------------------

  describe('revertToGlobal', () => {
    it('throws when template does not exist', async () => {
      await expect(revertToGlobal('missing')).rejects.toThrow('not found');
    });

    it('throws when template is not an org override', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ scope: 'global' }));

      await expect(revertToGlobal('tpl-1')).rejects.toThrow('not an org override');
    });

    it('deletes the org override document', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ scope: 'organization', organizationId: 'org-1' }));

      await revertToGlobal('tpl-1');

      expect(mockDocs['message_templates/tpl-1']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // listTemplates (merged list)
  // -------------------------------------------------------------------------

  describe('listTemplates', () => {
    it('returns org overrides and non-overridden global templates, excludes overridden globals', async () => {
      const orgTpl = baseTemplate({
        id: 'org-tpl-1',
        scope: 'organization',
        organizationId: 'org-1',
        globalTemplateId: 'global-tpl-1',
      }) as unknown as Record<string, unknown>;
      const globalTpl1 = baseTemplate({ id: 'global-tpl-1', scope: 'global' }) as unknown as Record<string, unknown>;
      const globalTpl2 = baseTemplate({
        id: 'global-tpl-2',
        scope: 'global',
        templateType: 'meeting_confirmation',
      }) as unknown as Record<string, unknown>;

      // listTemplates calls .where('scope', '==', 'organization') first, then 'global'.
      // We use a counter inside the query to alternate responses.
      let callCount = 0;
      const alternatingQuery: any = {
        where: () => alternatingQuery,
        limit: () => alternatingQuery,
        get: vi.fn(async () => {
          callCount++;
          if (callCount === 1) {
            return makeSnap([{ id: 'org-tpl-1', data: () => orgTpl }]);
          }
          return makeSnap([
            { id: 'global-tpl-1', data: () => globalTpl1 },
            { id: 'global-tpl-2', data: () => globalTpl2 },
          ]);
        }),
      };

      queryOverrides['message_templates'] = alternatingQuery;

      const results = await listTemplates('org-1');
      const ids = results.map((t) => t.id);

      expect(ids).toContain('org-tpl-1');
      expect(ids).toContain('global-tpl-2');
      expect(ids).not.toContain('global-tpl-1'); // overridden
    });
  });

  // -------------------------------------------------------------------------
  // activateTemplate
  // -------------------------------------------------------------------------

  describe('activateTemplate', () => {
    it('throws when template does not exist', async () => {
      await expect(activateTemplate('missing', 'user-1')).rejects.toThrow('not found');
    });

    it('sets status to active and isActive to true', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ status: 'draft', isActive: false }));

      await activateTemplate('tpl-1', 'user-1');

      const updated = mockDocs['message_templates/tpl-1'];
      expect(updated?.status).toBe('active');
      expect(updated?.isActive).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // archiveTemplate
  // -------------------------------------------------------------------------

  describe('archiveTemplate', () => {
    it('throws when template does not exist', async () => {
      await expect(archiveTemplate('missing', 'user-1')).rejects.toThrow('not found');
    });

    it('sets status to archived and isActive to false', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ status: 'active', isActive: true }));

      await archiveTemplate('tpl-1', 'user-1');

      const updated = mockDocs['message_templates/tpl-1'];
      expect(updated?.status).toBe('archived');
      expect(updated?.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // unarchiveTemplate
  // -------------------------------------------------------------------------

  describe('unarchiveTemplate', () => {
    it('unarchives template back to active', async () => {
      seedDoc('message_templates', 'tpl-1', baseTemplate({ status: 'archived', isActive: false }));

      await unarchiveTemplate('tpl-1', 'user-1');

      const updated = mockDocs['message_templates/tpl-1'];
      expect(updated?.status).toBe('active');
      expect(updated?.isActive).toBe(true);
    });
  });
});
