// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

const docRegistry = new Map();
const queryRegistry = new Map();

// 1. Mock firebase-admin
vi.mock('../../firebase-admin', () => {
  const collectionMock = vi.fn((colName) => {
    return createQueryMock(colName);
  });

  function createQueryMock(colName) {
    const q = {
      where: vi.fn().mockImplementation(() => q),
      orderBy: vi.fn().mockImplementation(() => q),
      limit: vi.fn().mockImplementation(() => q),
      get: vi.fn(() => {
        if (queryRegistry.has(colName)) {
          const val = queryRegistry.get(colName);
          if (typeof val === 'function') return val();
          return Promise.resolve(val);
        }
        return Promise.resolve({ empty: true, docs: [] });
      }),
      doc: vi.fn((docId) => {
        return createDocMock(colName, docId);
      }),
    };
    return q;
  }

  function createDocMock(colName, docId) {
    const d = {
      get: vi.fn(() => {
        const key = `${colName}/${docId}`;
        if (docRegistry.has(key)) {
          const val = docRegistry.get(key);
          if (typeof val === 'function') return val();
          return Promise.resolve(val);
        }
        return Promise.resolve({ exists: false, data: () => ({}) });
      }),
      collection: vi.fn((subColName) => {
        return createQueryMock(`${colName}/${docId}/${subColName}`);
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    return d;
  }

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

import { FieldsVariablesService } from '../fields-variables-service-impl';

describe('FieldsVariablesService optimized lookup and resolution', () => {
  beforeEach(() => {
    docRegistry.clear();
    queryRegistry.clear();
  });

  it('should resolve context instantly in milliseconds when composite contactId:entityId is provided', async () => {
    const contactId = 'ec_test_123';
    const entityId = 'entity_test_456';
    const workspaceId = 'ws_test_789';

    // Mock the workspace_entities query matching workspaceId and entityId
    queryRegistry.set('workspace_entities', {
      empty: false,
      docs: [
        {
          id: `${workspaceId}_entity_${entityId}`,
          data: () => ({
            entityId,
            workspaceId,
            name: 'Test Institution Academy',
            entityContacts: [
              {
                id: contactId,
                name: 'Joe Tester',
                email: 'joe@tester.com',
                isPrimary: true
              }
            ]
          })
        }
      ]
    });

    const result = await FieldsVariablesService.resolveEntityContextFromParams(
      [workspaceId],
      { contactId: `${contactId}:${entityId}` }
    );

    expect(result.entityId).toBe(entityId);
    expect(result.recipientContact).toBe('joe@tester.com');
  });

  it('should fallback to contacts collection for legacy contactId lookup to avoid slow scans', async () => {
    const contactId = 'ec_legacy_999';
    const entityId = 'entity_legacy_888';
    const workspaceId = 'ws_test_789';

    // Mock contacts collection lookup
    docRegistry.set(`contacts/${contactId}`, {
      exists: true,
      data: () => ({
        id: contactId,
        entityId: entityId,
        name: 'Legacy Contact',
        email: 'legacy@tester.com'
      })
    });

    // Mock workspace_entities matching query
    queryRegistry.set('workspace_entities', {
      empty: false,
      docs: [
        {
          id: `${workspaceId}_entity_${entityId}`,
          data: () => ({
            entityId,
            workspaceId,
            name: 'Legacy School',
            entityContacts: [
              {
                id: contactId,
                name: 'Legacy Contact',
                email: 'legacy@tester.com',
                isPrimary: true
              }
            ]
          })
        }
      ]
    });

    const result = await FieldsVariablesService.resolveEntityContextFromParams(
      [workspaceId],
      { contactId }
    );

    expect(result.entityId).toBe(entityId);
    expect(result.recipientContact).toBe('legacy@tester.com');
  });

  it('should resolve template variables correctly on media page content', async () => {
    const entityId = 'entity_test_456';
    const workspaceId = 'ws_test_789';

    // Mock workspace and entity documents in the cache / registry
    docRegistry.set(`workspaces/${workspaceId}`, {
      exists: true,
      data: () => ({
        id: workspaceId,
        name: 'My Workspace',
        organizationId: 'org_123'
      })
    });

    docRegistry.set(`organizations/org_123`, {
      exists: true,
      data: () => ({
        name: 'Test Org'
      })
    });

    docRegistry.set(`entities/${entityId}`, {
      exists: true,
      data: () => ({
        id: entityId,
        name: 'Happy School Academy'
      })
    });

    const context = {
      workspaceId,
      entityId
    };

    const resolvedText = await FieldsVariablesService.resolveTemplateVariables(
      'Welcome to {{entity_name}}! Powered by {{org_name}}.',
      context
    );

    expect(resolvedText).toBe('Welcome to Happy School Academy! Powered by Test Org.');
  });
});
