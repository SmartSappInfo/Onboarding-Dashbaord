import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../automations/execution-types';

const mockAddContactsToCampaign = vi.fn().mockResolvedValue({ success: true, count: 1 });
vi.mock('../services/call-centre-service', () => ({
  CallCentreService: {
    addContactsToCampaign: (...args: unknown[]) => mockAddContactsToCampaign(...args),
  },
}));

const mockResolveContact = vi.fn();
vi.mock('../contact-adapter', () => ({
  resolveContact: (...args: unknown[]) => mockResolveContact(...args),
}));

const mockLogAutomationEvent = vi.fn().mockResolvedValue({});
vi.mock('../../automation-log', () => ({
  logAutomationEvent: (...args: unknown[]) => mockLogAutomationEvent(...args),
}));

import { processActionNode } from '../automations/actions/index';

describe('ADD_TO_CALL_CAMPAIGN Action Executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseContext: ExecutionContext = {
    runId: 'run_1',
    automationId: 'auto_1',
    workspaceId: 'ws_1',
    organizationId: 'org_1',
    entityId: 'ent_100',
    entityType: 'institution',
    payload: {
      contactId: 'c_trigger_1',
      phone: '+233241234567',
      name: 'Trigger Person',
      email: 'trigger@example.com',
    },
  };

  const sampleEntityContact = {
    id: 'ent_100',
    displayName: 'Acme Academy',
    entityContacts: [
      {
        id: 'c_primary',
        name: 'Primary Principal',
        phone: '+233240000001',
        email: 'primary@acme.edu',
        isPrimary: true,
        isSignatory: false,
        typeLabel: 'Principal',
        typeKey: 'principal',
      },
      {
        id: 'c_signatory',
        name: 'Board Signatory',
        phone: '+233240000002',
        email: 'signatory@acme.edu',
        isPrimary: false,
        isSignatory: true,
        typeLabel: 'Board Member',
        typeKey: 'board_member',
      },
      {
        id: 'c_billing',
        name: 'Finance Manager',
        phone: '+233240000003',
        email: 'billing@acme.edu',
        isPrimary: false,
        isSignatory: false,
        typeLabel: 'Billing',
        typeKey: 'billing',
      },
    ],
  };

  it('should resolve and add Triggering Contact when recipientTargets has triggering', async () => {
    mockResolveContact.mockResolvedValueOnce(sampleEntityContact);

    await processActionNode(
      {
        data: {
          actionType: 'ADD_TO_CALL_CAMPAIGN',
          config: {
            campaignId: 'camp_123',
            recipientTargets: ['triggering'],
          },
        },
      },
      baseContext
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledTimes(1);
    const [campaignId, entityIds, workspaceId, actor, overrides] = mockAddContactsToCampaign.mock.calls[0];
    expect(campaignId).toBe('camp_123');
    expect(entityIds).toEqual(['ent_100']);
    expect(workspaceId).toBe('ws_1');
    expect(actor).toBe('automation-actor');
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toEqual({
      entityId: 'ent_100',
      contactId: 'c_trigger_1',
      contactName: 'Trigger Person',
      phone: '+233241234567',
      email: 'trigger@example.com',
    });
  });

  it('should resolve Primary and Campus Signatories contacts when selected', async () => {
    mockResolveContact.mockResolvedValueOnce(sampleEntityContact);

    await processActionNode(
      {
        data: {
          actionType: 'ADD_TO_CALL_CAMPAIGN',
          config: {
            campaignId: 'camp_123',
            recipientTargets: ['primary', 'signatories'],
          },
        },
      },
      baseContext
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledTimes(1);
    const overrides = mockAddContactsToCampaign.mock.calls[0][4];
    expect(overrides).toHaveLength(2);
    expect(overrides.map((o: { contactId: string }) => o.contactId)).toEqual(['c_primary', 'c_signatory']);
  });

  it('should resolve specific roles based on recipientRoles list (case-insensitive)', async () => {
    mockResolveContact.mockResolvedValueOnce(sampleEntityContact);

    await processActionNode(
      {
        data: {
          actionType: 'ADD_TO_CALL_CAMPAIGN',
          config: {
            campaignId: 'camp_123',
            recipientTargets: ['roles'],
            recipientRoles: ['billing'],
          },
        },
      },
      baseContext
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledTimes(1);
    const overrides = mockAddContactsToCampaign.mock.calls[0][4];
    expect(overrides).toHaveLength(1);
    expect(overrides[0].contactId).toBe('c_billing');
    expect(overrides[0].contactName).toBe('Finance Manager');
  });

  it('should deduplicate contacts when a contact matches multiple target categories', async () => {
    // Entity where the primary contact is ALSO a signatory
    const multiMatchEntity = {
      id: 'ent_100',
      displayName: 'Acme Academy',
      entityContacts: [
        {
          id: 'c_dual',
          name: 'Dual Role Person',
          phone: '+233240000099',
          email: 'dual@acme.edu',
          isPrimary: true,
          isSignatory: true,
          typeLabel: 'Director',
        },
      ],
    };

    mockResolveContact.mockResolvedValueOnce(multiMatchEntity);

    await processActionNode(
      {
        data: {
          actionType: 'ADD_TO_CALL_CAMPAIGN',
          config: {
            campaignId: 'camp_123',
            recipientTargets: ['primary', 'signatories', 'all'],
          },
        },
      },
      baseContext
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledTimes(1);
    const overrides = mockAddContactsToCampaign.mock.calls[0][4];
    // Must only have 1 entry despite matching 3 selected target scopes!
    expect(overrides).toHaveLength(1);
    expect(overrides[0].contactId).toBe('c_dual');
  });

  it('should support backward compatibility fallback for legacy contactScope config', async () => {
    mockResolveContact.mockResolvedValueOnce(sampleEntityContact);

    await processActionNode(
      {
        data: {
          actionType: 'ADD_TO_CALL_CAMPAIGN',
          config: {
            campaignId: 'camp_legacy',
            contactScope: 'signatories',
          },
        },
      },
      baseContext
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledTimes(1);
    const overrides = mockAddContactsToCampaign.mock.calls[0][4];
    expect(overrides).toHaveLength(1);
    expect(overrides[0].contactId).toBe('c_signatory');
  });

  it('should throw error when campaignId is missing', async () => {
    await expect(
      processActionNode(
        {
          data: {
            actionType: 'ADD_TO_CALL_CAMPAIGN',
            config: {
              campaignId: '',
            },
          },
        },
        baseContext
      )
    ).rejects.toThrow('No campaignId specified for ADD_TO_CALL_CAMPAIGN automation step.');
  });
});
