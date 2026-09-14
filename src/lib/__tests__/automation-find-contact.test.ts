import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../automations/execution-types';

const mockCreateEntityAction = vi.fn();
const mockUpdateEntityAction = vi.fn().mockResolvedValue({ success: true });

vi.mock('../entity-actions', () => ({
  createEntityAction: (...args: unknown[]) => mockCreateEntityAction(...args),
  updateEntityAction: (...args: unknown[]) => mockUpdateEntityAction(...args),
}));

const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn().mockResolvedValue({});
let mockQueryDocs: Array<{ data: () => Record<string, unknown>; id?: string }> = [];

const mockQueryObj: any = {
  where: vi.fn().mockImplementation(() => mockQueryObj),
  limit: vi.fn().mockImplementation(() => mockQueryObj),
  get: vi.fn().mockImplementation(async () => ({
    empty: mockQueryDocs.length === 0,
    docs: mockQueryDocs,
  })),
};

const mockCollection = vi.fn().mockReturnValue({
  doc: vi.fn().mockImplementation((id: string) => ({
    get: vi.fn().mockImplementation(async () => {
      const res = await mockDocGet(id);
      return { id, exists: !!res, data: () => res };
    }),
    update: (...args: unknown[]) => mockDocUpdate(...args),
  })),
  add: vi.fn().mockResolvedValue({ id: 'doc_added_1' }),
  where: vi.fn().mockImplementation(() => mockQueryObj),
  limit: vi.fn().mockImplementation(() => mockQueryObj),
  get: vi.fn().mockImplementation(async () => ({
    empty: mockQueryDocs.length === 0,
    docs: mockQueryDocs,
  })),
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (...args: unknown[]) => mockCollection(...args),
    runTransaction: vi.fn().mockImplementation(async (cb: (txn: unknown) => unknown) => {
      return cb({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ leadScore: 0 }),
        }),
        update: vi.fn(),
      });
    }),
  },
}));

vi.mock('../phone-utils', () => ({
  normalizePhoneNumber: (phone: string) => ({
    e164: phone.startsWith('+') ? phone : `+233${phone.replace(/^0/, '')}`,
    countryCode: 'GH',
    callingCode: '233',
  }),
}));

vi.mock('../entity-contact-helpers', () => ({
  normalizeContactType: (role: string) => role.toLowerCase(),
  enforceContactConstraints: (contacts: unknown[]) => contacts,
}));

vi.mock('../../automation-log', () => ({
  logAutomationEvent: vi.fn().mockResolvedValue({}),
}));

import { processActionNode } from '../automations/actions/index';

describe('FIND_CONTACT Action Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryDocs = [];
  });

  const baseContext: ExecutionContext = {
    runId: 'run_find_1',
    automationId: 'auto_find_1',
    workspaceId: 'ws_test_1',
    organizationId: 'org_test_1',
    entityId: undefined, // Simulating a webhook run that starts with no bound entity!
    entityType: undefined,
    payload: {
      phone: '+233241234567',
      email: 'alex@example.com',
      name: 'Alex Johnson',
      company: 'Acme Global',
    },
  };

  it('should find existing contact by phone and bind context.entityId', async () => {
    // Mock workspace_contacts query finding matching contact
    mockQueryDocs = [
      {
        data: () => ({
          entityId: 'ent_existing_1',
          contactId: 'c_phone_1',
          workspaceId: 'ws_test_1',
          phone: '+233241234567',
        }),
      },
    ];

    // Mock entity doc read
    mockDocGet.mockImplementation((docId: string) => {
      if (docId === 'ent_existing_1') {
        return {
          displayName: 'Acme Existing Corp',
          name: 'Acme Existing Corp',
          entityType: 'institution',
          entityContacts: [
            {
              id: 'c_phone_1',
              name: 'Alex Johnson',
              phone: '+233241234567',
              email: 'alex@example.com',
              isPrimary: true,
            },
          ],
        };
      }
      return null;
    });

    const context: ExecutionContext = { ...baseContext, payload: { ...baseContext.payload } };

    const result = await processActionNode(
      {
        data: {
          actionType: 'FIND_CONTACT',
          config: {
            searchPhone: '{{phone}}',
            searchEmail: '{{email}}',
            searchName: '{{name}}',
            matchStrategy: 'priority',
            createIfNotFound: true,
          },
        },
      },
      context
    );

    expect(result).toBeDefined();
    expect(result).toMatchObject({
      entityId: 'ent_existing_1',
      entityName: 'Acme Existing Corp',
      entityType: 'institution',
      contactId: 'c_phone_1',
      contactFound: true,
      isNew: false,
    });

    // ExecutionContext must now be bound!
    expect(context.entityId).toBe('ent_existing_1');
    expect(context.entityType).toBe('institution');
    expect(context.payload.contactId).toBe('c_phone_1');

    // Run record must be updated in Firestore
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 'ent_existing_1',
      entityName: 'Acme Existing Corp',
    }));
  });

  it('should find existing contact by email if phone query yields no match', async () => {
    mockQueryDocs = [
      {
        data: () => ({
          entityId: 'ent_email_match',
          contactId: 'c_email_1',
          workspaceId: 'ws_test_1',
          emailLower: 'alex@example.com',
        }),
      },
    ];

    mockDocGet.mockImplementation((docId: string) => {
      if (docId === 'ent_email_match') {
        return {
          displayName: 'Email Match Co',
          name: 'Email Match Co',
          entityType: 'person',
          entityContacts: [
            {
              id: 'c_email_1',
              name: 'Alex Email',
              email: 'alex@example.com',
              isPrimary: true,
            },
          ],
        };
      }
      return null;
    });

    const context: ExecutionContext = { ...baseContext, payload: { ...baseContext.payload } };

    const result = await processActionNode(
      {
        data: {
          actionType: 'FIND_CONTACT',
          config: {
            searchPhone: '',
            searchEmail: '{{email}}',
            matchStrategy: 'priority',
            createIfNotFound: true,
          },
        },
      },
      context
    );

    expect(result).toMatchObject({
      entityId: 'ent_email_match',
      contactFound: true,
      isNew: false,
    });
    expect(context.entityId).toBe('ent_email_match');
  });

  it('should auto-create entity and contact when contact is not found and createIfNotFound is true', async () => {
    mockQueryDocs = [];

    // Mock successful entity creation
    mockCreateEntityAction.mockResolvedValueOnce({
      success: true,
      id: 'ent_auto_created_99',
    });

    const context: ExecutionContext = { ...baseContext, payload: { ...baseContext.payload } };

    const result = await processActionNode(
      {
        data: {
          actionType: 'FIND_CONTACT',
          config: {
            searchPhone: '{{phone}}',
            searchEmail: '{{email}}',
            searchName: '{{name}}',
            searchEntityName: '{{company}}',
            createIfNotFound: true,
            newEntityType: 'institution',
            newContactRole: 'Owner',
          },
        },
      },
      context
    );

    expect(mockCreateEntityAction).toHaveBeenCalledTimes(1);
    const [creationPayload, actor, workspaceId, entityType] = mockCreateEntityAction.mock.calls[0];
    expect(creationPayload.name).toBe('Acme Global');
    expect(creationPayload.contacts[0]).toMatchObject({
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '+233241234567',
      isPrimary: true,
    });
    expect(workspaceId).toBe('ws_test_1');
    expect(entityType).toBe('institution');

    expect(result).toMatchObject({
      entityId: 'ent_auto_created_99',
      entityName: 'Acme Global',
      contactFound: false,
      contactCreated: true,
      isNew: true,
    });

    // Context must now be bound to the new entity!
    expect(context.entityId).toBe('ent_auto_created_99');
    expect(context.entityType).toBe('institution');
  });

  it('should halt execution cleanly when contact not found and createIfNotFound is false with onNotFoundAction halt', async () => {
    mockQueryDocs = [];

    const context: ExecutionContext = { ...baseContext, payload: { ...baseContext.payload } };

    const result = await processActionNode(
      {
        data: {
          actionType: 'FIND_CONTACT',
          config: {
            searchPhone: '{{phone}}',
            createIfNotFound: false,
            onNotFoundAction: 'halt',
          },
        },
      },
      context
    );

    expect(mockCreateEntityAction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      contactFound: false,
      __halt: true,
    });
  });

  it('should enable downstream steps to execute against the bound context.entityId after FIND_CONTACT runs', async () => {
    // 1. First step: FIND_CONTACT finds ent_bound_42
    mockQueryDocs = [
      {
        data: () => ({
          entityId: 'ent_bound_42',
          contactId: 'c_bound_42',
          workspaceId: 'ws_test_1',
          phone: '+233241234567',
        }),
      },
    ];

    mockDocGet.mockImplementation((docId: string) => {
      if (docId === 'ent_bound_42') {
        return {
          displayName: 'Bound Entity Corp',
          name: 'Bound Entity Corp',
          entityType: 'institution',
          entityContacts: [
            {
              id: 'c_bound_42',
              name: 'Bound Person',
              phone: '+233241234567',
              email: 'bound@example.com',
              isPrimary: true,
            },
          ],
        };
      }
      return null;
    });

    // Start with completely empty entityId (as from webhook)
    const context: ExecutionContext = {
      ...baseContext,
      entityId: undefined,
      entityType: undefined,
      payload: { phone: '+233241234567' },
    };

    // Verify that without context.entityId, ADD_NOTE throws an error
    const uncontexted: ExecutionContext = { ...baseContext, entityId: undefined };
    await expect(
      processActionNode(
        { data: { actionType: 'ADD_NOTE', config: { content: 'test' } } },
        uncontexted
      )
    ).rejects.toThrow('Add note action requires entityId and content.');

    // Step 1: Run FIND_CONTACT to bind context.entityId
    await processActionNode(
      {
        data: {
          actionType: 'FIND_CONTACT',
          config: {
            searchPhone: '{{phone}}',
            createIfNotFound: true,
          },
        },
      },
      context
    );

    expect(context.entityId).toBe('ent_bound_42');
    expect(context.entityType).toBe('institution');

    // Step 2: With bound context.entityId, ADD_NOTE completes without error!
    await expect(
      processActionNode(
        { data: { actionType: 'ADD_NOTE', config: { content: 'Follow up note' } } },
        context
      )
    ).resolves.not.toThrow();
  });
});
