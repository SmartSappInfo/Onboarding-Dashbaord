import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../automations/execution-types';

const mockUpdateEntityAction = vi.fn().mockResolvedValue({ success: true });
vi.mock('../entity-actions', () => ({
  updateEntityAction: (...args: unknown[]) => mockUpdateEntityAction(...args),
}));

const mockDocGet = vi.fn();
const mockDocUpdate = vi.fn().mockResolvedValue({});
const mockCollection = vi.fn().mockReturnValue({
  doc: vi.fn().mockImplementation((id: string) => ({
    get: vi.fn().mockImplementation(async () => {
      const res = await mockDocGet(id);
      return { id, ...res };
    }),
    update: (...args: unknown[]) => mockDocUpdate(...args),
  })),
  where: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (...args: unknown[]) => mockCollection(...args),
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

import { handleCreateContactForEntity, handleUpdateContact } from '../automations/actions/entity-actions';

describe('Automation Contact & Entity Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleCreateContactForEntity', () => {
    it('should automatically target context.entityId in automatic mode', async () => {
      // 1. Entity doc read
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Acme Corp',
          entityContacts: [],
        }),
      });
      // 2. Organization doc read
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ defaultCountryCode: 'GH' }),
      });

      const context: ExecutionContext = {
        runId: 'run_1',
        automationId: 'auto_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        entityId: 'ent_123',
        entityType: 'institution',
        payload: {},
      };

      await handleCreateContactForEntity(
        {
          targetEntityMode: 'automatic',
          contactName: 'Jane Doe',
          contactEmail: 'jane@example.com',
          contactPhone: '0241234567',
        },
        context
      );

      expect(mockUpdateEntityAction).toHaveBeenCalledTimes(1);
      const updateArgs = mockUpdateEntityAction.mock.calls[0];
      expect(updateArgs[0]).toBe('ent_123');
      const contacts = updateArgs[1].entityContacts;
      expect(contacts.length).toBe(1);
      expect(contacts[0].name).toBe('Jane Doe');
      expect(contacts[0].email).toBe('jane@example.com');
    });

    it('should deduplicate existing contacts by email or phone instead of adding duplicate entries', async () => {
      const existingContacts = [
        {
          id: 'ec_1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+233241234567',
          typeKey: 'other',
          typeLabel: 'Other',
          isPrimary: false,
          isSignatory: false,
          order: 0,
        },
      ];

      // 1. Entity doc read
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Acme Corp',
          entityContacts: existingContacts,
        }),
      });
      // 2. Organization doc read
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ defaultCountryCode: 'GH' }),
      });

      const context: ExecutionContext = {
        runId: 'run_1',
        automationId: 'auto_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        entityId: 'ent_123',
        entityType: 'institution',
        payload: {},
      };

      await handleCreateContactForEntity(
        {
          targetEntityMode: 'automatic',
          contactName: 'Jane Doe Updated',
          contactEmail: 'JANE@EXAMPLE.COM',
          contactRole: 'Manager',
          isPrimary: true,
        },
        context
      );

      expect(mockUpdateEntityAction).toHaveBeenCalledTimes(1);
      const updateArgs = mockUpdateEntityAction.mock.calls[0];
      const contacts = updateArgs[1].entityContacts;
      // Deduplication: should remain 1 contact object!
      expect(contacts.length).toBe(1);
      expect(contacts[0].id).toBe('ec_1');
      expect(contacts[0].name).toBe('Jane Doe Updated');
      expect(contacts[0].isPrimary).toBe(true);
      expect(contacts[0].typeLabel).toBe('Manager');
    });
  });

  describe('handleUpdateContact', () => {
    it('should automatically target context.entityId in automatic mode', async () => {
      const existingContacts = [
        {
          id: 'ec_1',
          name: 'John Smith',
          email: 'john@example.com',
          phone: '+233240000000',
          typeKey: 'primary',
          typeLabel: 'Primary',
          isPrimary: true,
          isSignatory: false,
        },
      ];

      // 1. Organization doc read (handleUpdateContact calls resolveOrgId / org doc first)
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ defaultCountryCode: 'GH' }),
      });
      // 2. Entity doc read
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Acme Corp',
          entityContacts: existingContacts,
        }),
      });

      const context: ExecutionContext = {
        runId: 'run_1',
        automationId: 'auto_1',
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        entityId: 'ent_123',
        entityType: 'institution',
        payload: {},
      };

      await handleUpdateContact(
        {
          targetEntityMode: 'automatic',
          contactName: 'John Smith PhD',
          contactRole: 'Executive Officer',
        },
        context
      );

      expect(mockUpdateEntityAction).toHaveBeenCalledTimes(1);
      const updateArgs = mockUpdateEntityAction.mock.calls[0];
      expect(updateArgs[0]).toBe('ent_123');
      const contacts = updateArgs[1].entityContacts;
      expect(contacts[0].name).toBe('John Smith PhD');
      expect(contacts[0].typeLabel).toBe('Executive Officer');
    });
  });
});
