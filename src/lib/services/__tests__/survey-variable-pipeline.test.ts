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

// 2. Mock crypto
vi.mock('../../crypto', () => {
  return {
    decryptToken: vi.fn((token) => {
      if (token === 'encrypted:test:token') {
        return 'contact_123:entity_456';
      }
      return null;
    }),
  };
});

import { FieldsVariablesService } from '../fields-variables-service-impl';

describe('Survey Variable Resolution Integration', () => {
  beforeEach(() => {
    docRegistry.clear();
    queryRegistry.clear();
  });

  it('should compile result page variables context correctly', async () => {
    const workspaceId = 'ws_123';
    const entityId = 'entity_456';
    const contactEmail = 'respondent@example.com';

    // Mock entity variables map lookup returning a Map
    const mockMap = new Map();
    mockMap.set('contact_name', 'Alice Tester');
    mockMap.set('contact_email', contactEmail);
    mockMap.set('entity_name', 'Test Academy');

    vi.spyOn(FieldsVariablesService, 'getVariableValuesMap').mockResolvedValue(mockMap);

    // Call resolveTextWithMap using the valuesMap
    const valuesMap = await FieldsVariablesService.getVariableValuesMap({
      workspaceId,
      entityId,
      recipientContact: contactEmail,
    });

    valuesMap.set('score', '85');
    valuesMap.set('max_score', '100');
    valuesMap.set('survey_title', 'Onboarding Feedback');

    const resolvedTitle = FieldsVariablesService.resolveTextWithMap(
      'Congrats {{contact_name}}! You got {{score}}/{{max_score}} for {{survey_title}}.',
      valuesMap
    );

    expect(resolvedTitle).toBe(
      'Congrats Alice Tester! You got 85/100 for Onboarding Feedback.'
    );
  });

  it('should fall back to raw token decryption when response fields are empty', async () => {
    const workspaceId = 'ws_123';
    const entityId = 'entity_456';
    const contactId = 'contact_123';
    const rawRefToken = 'encrypted:test:token';

    // Mock direct contactId workspace lookup
    queryRegistry.set('workspace_entities', {
      empty: false,
      docs: [
        {
          id: `${workspaceId}_entity_${entityId}`,
          data: () => ({
            entityId,
            workspaceId,
            primaryEmail: 'primary@academy.com',
            entityContacts: [
              {
                id: contactId,
                name: 'Alice Decrypted',
                email: 'decrypted@academy.com',
              },
            ],
          }),
        },
      ],
    });

    const { decryptToken } = await import('../../crypto');
    const decrypted = decryptToken(rawRefToken);
    expect(decrypted).toBe('contact_123:entity_456');

    const [resolvedContactId, resolvedEntityId] = decrypted.split(':');
    expect(resolvedContactId).toBe(contactId);
    expect(resolvedEntityId).toBe(entityId);

    const fallbackCtx = await FieldsVariablesService.resolveEntityContextFromParams(
      [workspaceId],
      { contactId: resolvedContactId, entityId: resolvedEntityId }
    );

    expect(fallbackCtx.entityId).toBe(entityId);
    expect(fallbackCtx.recipientContact).toBe('decrypted@academy.com');
  });
});
