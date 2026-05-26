// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared state & Mock setup
// ---------------------------------------------------------------------------

let mockDocs: Record<string, Record<string, unknown>> = {};
let batchCommitsCount = 0;
let batchUpdates: Array<{ id: string; updates: Record<string, any> }> = [];

const mockBatch = {
  update: vi.fn((ref, updates) => {
    batchUpdates.push({ id: ref.id, updates });
  }),
  commit: vi.fn(async () => {
    batchCommitsCount++;
    // Apply batch updates to mockDocs
    for (const op of batchUpdates) {
      const key = `message_templates/${op.id}`;
      if (mockDocs[key]) {
        mockDocs[key] = { ...mockDocs[key], ...op.updates };
      }
    }
    batchUpdates = [];
  }),
};

function makeRef(collectionName: string, id: string) {
  const key = `${collectionName}/${id}`;
  return {
    id,
    ref: { id },
    get: vi.fn(async () => {
      const data = mockDocs[key];
      if (data) return { id, exists: true, data: () => data, ref: { id } };
      return { id, exists: false, data: () => undefined, ref: { id } };
    }),
  };
}

vi.mock('../../lib/firebase-admin', () => {
  return {
    adminDb: {
      batch: () => mockBatch,
      collection: (name: string) => ({
        doc: (id: string) => makeRef(name, id),
        get: vi.fn(async () => {
          const docs = Object.keys(mockDocs)
            .filter(k => k.startsWith(`${name}/`))
            .map(k => {
              const id = k.split('/')[1];
              return {
                id,
                ref: { id },
                data: () => mockDocs[k],
              };
            });
          return {
            size: docs.length,
            docs,
          };
        }),
      }),
    },
  };
});

// Import the action under test after mocking firebase-admin
import { migrateTemplatesAction } from '../../app/actions/migrate-templates-action';

describe('migrateTemplatesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocs = {};
    batchUpdates = [];
    batchCommitsCount = 0;
  });

  it('returns errors if user profile does not exist', async () => {
    const result = await migrateTemplatesAction('missing-user-id');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('User profile not found');
  });

  it('returns errors if user is not a system_admin', async () => {
    mockDocs['users/user-1'] = {
      permissions: ['contacts_view'],
    };

    const result = await migrateTemplatesAction('user-1');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Only system administrators can run this template migration');
  });

  it('successfully executes migration and processes templates', async () => {
    // 1. Setup system admin profile
    mockDocs['users/admin-1'] = {
      permissions: ['system_admin'],
    };

    // 2. Setup templates with legacy school_* variables
    mockDocs['message_templates/tpl-1'] = {
      id: 'tpl-1',
      subject: 'Welcome to {{school_name}}!',
      previewText: 'Reach us at {{school_email}} or {{school_phone}}',
      body: 'Welcome! Enjoy our {{school_package}} package at {{school_location}} ({{school_initials}}).',
      declaredVariables: ['school_name', 'school_email', 'school_phone', 'contact_name'],
      variables: ['school_name', 'school_email'],
      createdAt: '2026-05-24T00:00:00Z',
      updatedAt: '2026-05-24T00:00:00Z',
    };

    mockDocs['message_templates/tpl-2'] = {
      id: 'tpl-2',
      subject: 'Standard subject',
      body: 'Hello {{contact_name}}',
      declaredVariables: ['contact_name'],
      createdAt: '2026-05-24T00:00:00Z',
      updatedAt: '2026-05-24T00:00:00Z',
    };

    mockDocs['message_templates/tpl-3'] = {
      id: 'tpl-3',
      subject: 'Block Template',
      body: '',
      blocks: [
        {
          id: 'b1',
          type: 'heading',
          title: 'Welcome to {{school_name}}',
          visibilityLogic: {
            rules: [
              {
                variableKey: 'school_name',
                operator: 'isEqualTo',
                value: 'My Campus',
              },
            ],
            matchType: 'all',
          },
        },
        {
          id: 'b2',
          type: 'list',
          items: ['Item 1 for {{school_name}}', 'Item 2'],
        },
      ],
      createdAt: '2026-05-24T00:00:00Z',
      updatedAt: '2026-05-24T00:00:00Z',
    };

    // 3. Execute migration
    const result = await migrateTemplatesAction('admin-1');

    // 4. Validate output statistics
    expect(result.total).toBe(3);
    expect(result.migrated).toBe(2); // tpl-1 and tpl-3
    expect(result.skipped).toBe(1);  // tpl-2
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);

    // 5. Verify batch commit was called
    expect(batchCommitsCount).toBe(1);

    // 6. Verify template 1 replacements
    const updatedTpl1 = mockDocs['message_templates/tpl-1'];
    expect(updatedTpl1.subject).toBe('Welcome to {{entity_name}}!');
    expect(updatedTpl1.previewText).toBe('Reach us at {{entity_email}} or {{entity_phone}}');
    expect(updatedTpl1.body).toBe('Welcome! Enjoy our {{entity_package}} package at {{entity_location}} ({{entity_initials}}).');
    expect(updatedTpl1.declaredVariables).toEqual(['entity_name', 'entity_email', 'entity_phone', 'contact_name']);
    expect(updatedTpl1.variables).toEqual(['entity_name', 'entity_email']);
    expect(updatedTpl1.updatedAt).not.toBe('2026-05-24T00:00:00Z'); // Updated

    // 7. Verify template 2 was NOT modified
    const updatedTpl2 = mockDocs['message_templates/tpl-2'];
    expect(updatedTpl2.updatedAt).toBe('2026-05-24T00:00:00Z');

    // 8. Verify template 3 block replacements
    const updatedTpl3 = mockDocs['message_templates/tpl-3'];
    expect(updatedTpl3.blocks[0].title).toBe('Welcome to {{entity_name}}');
    expect(updatedTpl3.blocks[0].visibilityLogic.rules[0].variableKey).toBe('entity_name');
    expect(updatedTpl3.blocks[1].items[0]).toBe('Item 1 for {{entity_name}}');
    expect(updatedTpl3.updatedAt).not.toBe('2026-05-24T00:00:00Z');
  });
});
