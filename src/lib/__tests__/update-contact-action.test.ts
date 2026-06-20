import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpdateContact } from '../automations/actions/entity-actions';
import type { ExecutionContext } from '../automations/execution-types';

const mockGet = vi.fn();
const mockWhere = vi.fn(() => ({
  where: mockWhere,
  limit: vi.fn().mockReturnThis(),
  get: mockGet,
}));
const mockDoc = vi.fn(() => ({
  get: mockGet,
  update: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: mockWhere,
      get: mockGet,
      doc: mockDoc,
    })),
  },
}));

const mockUpdateEntityAction = vi.fn();
vi.mock('../entity-actions', () => ({
  updateEntityAction: mockUpdateEntityAction,
}));

vi.mock('../phone-utils', () => ({
  normalizePhoneNumber: vi.fn((phone: string) => {
    if (phone.startsWith('+')) {
      return { e164: phone, countryCode: 'GH', callingCode: '233' };
    }
    return { e164: '+233' + phone.substring(1), countryCode: 'GH', callingCode: '233' };
  }),
}));

vi.mock('../entity-contact-helpers', () => ({
  normalizeContactType: vi.fn((role: string) => role.toLowerCase().replace(' ', '_')),
  enforceContactConstraints: vi.fn((contacts) => contacts),
}));

describe('handleUpdateContact', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockWhere.mockClear();
    mockDoc.mockClear();
    mockUpdateEntityAction.mockReset();
  });

  it('updates a single contact successfully when criteria matches', async () => {
    const config = {
      filterEntityName: 'Acme Corp',
      filterContactEmail: 'alice@acme.com',
      matchLogic: 'all',
      caseInsensitive: false,
      contactName: 'Alice Updated',
      contactPhone: '0241112222',
      contactRole: 'Lead Manager',
      isPrimary: true,
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    // resolveOrgId lookup:
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ organizationId: 'org-123' }),
    }));
    // defaultCountryCode lookup:
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ defaultCountryCode: 'GH' }),
    }));

    // queryByContactEmail workspace_contacts query:
    mockGet.mockImplementationOnce(async () => ({
      empty: false,
      docs: [
        {
          data: () => ({
            entityId: 'ent-1',
            contactId: 'c-1',
          }),
        },
      ],
    }));

    // entities doc get lookup:
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        id: 'ent-1',
        name: 'Acme Corp',
        entityContacts: [
          {
            id: 'c-1',
            name: 'Alice',
            email: 'alice@acme.com',
            phone: '+233241112222',
            isPrimary: false,
          },
        ],
      }),
    }));

    mockUpdateEntityAction.mockResolvedValue({ success: true });

    await handleUpdateContact(config, context);

    expect(mockUpdateEntityAction).toHaveBeenCalled();
    const updatedContacts = mockUpdateEntityAction.mock.calls[0][1].entityContacts;
    expect(updatedContacts[0].name).toBe('Alice Updated');
    expect(updatedContacts[0].phone).toBe('+233241112222');
    expect(updatedContacts[0].isPrimary).toBe(true);
    expect(context.entityId).toBe('ent-1');
  });

  it('fails execution when no candidate matches filters', async () => {
    const config = {
      filterContactEmail: 'none@acme.com',
      matchLogic: 'all',
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ organizationId: 'org-123' }),
    }));
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ defaultCountryCode: 'GH' }),
    }));

    mockGet.mockImplementationOnce(async () => ({
      empty: true,
      docs: [],
    }));

    await expect(handleUpdateContact(config, context)).rejects.toThrow(
      'Update contact failed: No matching contact/entity found.'
    );
  });

  it('fails execution when multiple entities match criteria (ambiguity)', async () => {
    const config = {
      filterContactName: 'John',
      matchLogic: 'any',
      caseInsensitive: true,
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ organizationId: 'org-123' }),
    }));
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ defaultCountryCode: 'GH' }),
    }));

    mockGet.mockImplementationOnce(async () => ({
      empty: false,
      docs: [
        {
          data: () => ({ entityId: 'ent-1', contactId: 'c-1' }),
        },
        {
          data: () => ({ entityId: 'ent-2', contactId: 'c-2' }),
        },
      ],
    }));

    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        id: 'ent-1',
        name: 'Alpha Corp',
        entityContacts: [
          { id: 'c-1', name: 'John', isPrimary: true },
        ],
      }),
    }));
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        id: 'ent-2',
        name: 'Beta Corp',
        entityContacts: [
          { id: 'c-2', name: 'John', isPrimary: true },
        ],
      }),
    }));

    await expect(handleUpdateContact(config, context)).rejects.toThrow(
      'Update contact failed: Multiple matching entities found'
    );
  });
});
