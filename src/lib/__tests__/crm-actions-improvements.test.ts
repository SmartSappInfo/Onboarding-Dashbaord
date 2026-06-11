import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateContactForEntity } from '../automations/actions/entity-actions';
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
  updateEntityAction: (...args: any[]) => mockUpdateEntityAction(...args),
}));

vi.mock('../phone-utils', () => ({
  normalizePhoneNumber: vi.fn((phone) => ({ e164: phone, countryCode: 'GH', callingCode: '233' })),
}));

vi.mock('../entity-contact-helpers', () => ({
  normalizeContactType: vi.fn((role) => role.toLowerCase().replace(' ', '_')),
}));

describe('handleCreateContactForEntity (Improvements)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockWhere.mockClear();
    mockDoc.mockClear();
    mockUpdateEntityAction.mockReset();
  });

  it('performs case-sensitive matching by default', async () => {
    const config = {
      entityName: 'Acme Corp',
      contactName: 'John Doe',
      contactPhone: '+233241112222',
      contactRole: 'Billing Manager',
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    // Mock exact match workspace_entities query
    mockGet.mockImplementationOnce(async () => ({
      empty: false,
      docs: [
        {
          data: () => ({
            entityId: 'ent-1',
            entityType: 'institution',
            displayName: 'Acme Corp',
          }),
        },
      ],
    }));

    // Mock entities doc get
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        entityContacts: [],
      }),
    }));

    // Mock organization get
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        defaultCountryCode: 'GH',
      }),
    }));

    mockUpdateEntityAction.mockResolvedValue({ success: true });

    await handleCreateContactForEntity(config, context);

    expect(mockUpdateEntityAction).toHaveBeenCalled();
    expect(context.entityId).toBe('ent-1');
  });

  it('performs case-insensitive matching when caseInsensitive flag is true', async () => {
    const config = {
      entityName: 'acme corp', // lowercase query
      contactName: 'John Doe',
      contactPhone: '+233241112222',
      contactRole: 'Billing Manager',
      caseInsensitive: true,
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    // Mock workspace-wide workspace_entities list
    mockGet.mockImplementationOnce(async () => ({
      docs: [
        {
          data: () => ({
            entityId: 'ent-1',
            entityType: 'institution',
            displayName: 'Acme Corp', // Mixed case displayName in DB
          }),
        },
      ],
    }));

    // Mock entities doc get
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        entityContacts: [],
      }),
    }));

    // Mock organization get
    mockGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({
        defaultCountryCode: 'GH',
      }),
    }));

    mockUpdateEntityAction.mockResolvedValue({ success: true });

    await handleCreateContactForEntity(config, context);

    expect(mockUpdateEntityAction).toHaveBeenCalled();
    expect(context.entityId).toBe('ent-1');
  });

  it('throws error when case-insensitive name match is not found', async () => {
    const config = {
      entityName: 'Acme Corp',
      contactName: 'John Doe',
      contactPhone: '+233241112222',
      contactRole: 'Billing Manager',
      caseInsensitive: true,
    };

    const context: ExecutionContext = {
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    // Return different displayName
    mockGet.mockImplementationOnce(async () => ({
      docs: [
        {
          data: () => ({
            entityId: 'ent-2',
            entityType: 'institution',
            displayName: 'Other Company',
          }),
        },
      ],
    }));

    await expect(handleCreateContactForEntity(config, context)).rejects.toThrow(/case-insensitive/);
  });
});
