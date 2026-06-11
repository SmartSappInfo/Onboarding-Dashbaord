// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const mockTransaction = {
    get: vi.fn(),
    update: vi.fn(),
  };

  const mockDoc = {
    get: vi.fn(),
    update: vi.fn(),
  };

  const mockCollection = {
    doc: vi.fn(() => mockDoc),
    add: vi.fn(),
    where: vi.fn(),
  };

  const mockDb = {
    collection: vi.fn(() => mockCollection),
    runTransaction: vi.fn((cb) => cb(mockTransaction)),
  };

  return {
    adminDb: mockDb,
    __mocks: { mockTransaction, mockDoc, mockCollection, mockDb },
  };
});

// Mock messaging-actions and bulk-messaging inside the hoisted factories
vi.mock('../messaging-actions', () => {
  const previewCampaignAudience = vi.fn();
  const resolveRecipientContacts = vi.fn();
  return {
    previewCampaignAudience,
    resolveRecipientContacts,
    __mocks: { previewCampaignAudience, resolveRecipientContacts }
  };
});

vi.mock('../bulk-messaging', () => {
  const createBulkMessageJob = vi.fn();
  const processBulkJobChunk = vi.fn();
  return {
    createBulkMessageJob,
    processBulkJobChunk,
    __mocks: { createBulkMessageJob, processBulkJobChunk }
  };
});

import { getSplitAssignment } from '../automations/nodes/traverse';
import * as firebaseAdmin from '../firebase-admin';
import * as messagingActions from '../messaging-actions';
import * as bulkMessaging from '../bulk-messaging';
import { evaluateCampaignABTest } from '../campaign-automation-jobs';

const dbMocks = () => (firebaseAdmin as any).__mocks;
const messagingMocks = () => (messagingActions as any).__mocks;
const bulkMocks = () => (bulkMessaging as any).__mocks;

describe('A/B Testing Hashing & Sticky Splits', () => {
  it('assigns sticky path deterministically based on split ratio', () => {
    const contactId1 = 'contact-123';
    const contactId2 = 'contact-456';
    const automationId = 'auto-abc';
    const nodeId = 'node-xyz';

    // 50/50 split check
    const res1_50 = getSplitAssignment(contactId1, automationId, nodeId, 50, {});
    const res2_50 = getSplitAssignment(contactId2, automationId, nodeId, 50, {});

    // Repeated executions must yield identical results (sticky property)
    expect(getSplitAssignment(contactId1, automationId, nodeId, 50, {})).toBe(res1_50);
    expect(getSplitAssignment(contactId2, automationId, nodeId, 50, {})).toBe(res2_50);

    // 100% Split A should always assign path a
    expect(getSplitAssignment(contactId1, automationId, nodeId, 100, {})).toBe('a');
    expect(getSplitAssignment(contactId2, automationId, nodeId, 100, {})).toBe('a');

    // 0% Split A should always assign path b
    expect(getSplitAssignment(contactId1, automationId, nodeId, 0, {})).toBe('b');
    expect(getSplitAssignment(contactId2, automationId, nodeId, 0, {})).toBe('b');
  });

  it('falls back to email or phone if entityId is missing', () => {
    const automationId = 'auto-abc';
    const nodeId = 'node-xyz';

    const emailRes = getSplitAssignment('', automationId, nodeId, 50, { email: 'test@example.com' });
    const phoneRes = getSplitAssignment('', automationId, nodeId, 50, { phone: '+1234567890' });

    expect(emailRes).toMatch(/^[ab]$/);
    expect(phoneRes).toMatch(/^[ab]$/);
  });
});

describe('Campaign A/B Test Winner Evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set default chain return values for where() queries
    dbMocks().mockCollection.where.mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    });
  });

  it('selects Variant A based on higher open rate', async () => {
    const campaignId = 'camp-ab-open';
    const campaignData = {
      id: campaignId,
      status: 'testing',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      channel: 'email',
      abTestEnabled: true,
      abTestConfig: {
        winnerMetric: 'open_rate',
        testDurationHours: 4,
        testSizePercentage: 20,
      },
      variants: [
        {
          id: 'A',
          templateId: 'tmpl-a',
          templateName: 'Template A',
          stats: { totalSent: 100, totalOpened: 40, totalClicked: 5 },
        },
        {
          id: 'B',
          templateId: 'tmpl-b',
          templateName: 'Template B',
          stats: { totalSent: 100, totalOpened: 20, totalClicked: 10 },
        },
      ],
      stats: { totalTargeted: 1000, totalSent: 200, totalOpened: 60, totalClicked: 15 },
    };

    dbMocks().mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => campaignData,
    });

    messagingMocks().previewCampaignAudience.mockResolvedValue({
      success: true,
      count: 0,
      preview: [],
    });

    await evaluateCampaignABTest(campaignId);

    // Verify transaction updated the winning variant to 'A'
    expect(dbMocks().mockTransaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'abTestConfig.winningVariantId': 'A',
        status: 'sending',
      })
    );
  });

  it('selects Variant B based on higher click rate', async () => {
    const campaignId = 'camp-ab-click';
    const campaignData = {
      id: campaignId,
      status: 'testing',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      channel: 'email',
      abTestEnabled: true,
      abTestConfig: {
        winnerMetric: 'click_rate',
        testDurationHours: 4,
        testSizePercentage: 20,
      },
      variants: [
        {
          id: 'A',
          templateId: 'tmpl-a',
          templateName: 'Template A',
          stats: { totalSent: 100, totalOpened: 40, totalClicked: 5 },
        },
        {
          id: 'B',
          templateId: 'tmpl-b',
          templateName: 'Template B',
          stats: { totalSent: 100, totalOpened: 20, totalClicked: 10 },
        },
      ],
      stats: { totalTargeted: 1000, totalSent: 200, totalOpened: 60, totalClicked: 15 },
    };

    dbMocks().mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => campaignData,
    });

    messagingMocks().previewCampaignAudience.mockResolvedValue({
      success: true,
      count: 0,
      preview: [],
    });

    await evaluateCampaignABTest(campaignId);

    // Verify Variant B is selected
    expect(dbMocks().mockTransaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'abTestConfig.winningVariantId': 'B',
        status: 'sending',
      })
    );
  });

  it('selects Variant A based on lower unsubscribe rate', async () => {
    const campaignId = 'camp-ab-unsub';
    const campaignData = {
      id: campaignId,
      status: 'testing',
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      channel: 'email',
      abTestEnabled: true,
      abTestConfig: {
        winnerMetric: 'low_unsubscribe_rate',
        testDurationHours: 4,
        testSizePercentage: 20,
      },
      variants: [
        {
          id: 'A',
          templateId: 'tmpl-a',
          templateName: 'Template A',
          stats: { totalSent: 100, totalOpened: 40, totalClicked: 5, totalUnsubscribed: 1 },
        },
        {
          id: 'B',
          templateId: 'tmpl-b',
          templateName: 'Template B',
          stats: { totalSent: 100, totalOpened: 40, totalClicked: 5, totalUnsubscribed: 8 },
        },
      ],
      stats: { totalTargeted: 1000, totalSent: 200, totalOpened: 80, totalClicked: 10 },
    };

    dbMocks().mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => campaignData,
    });

    messagingMocks().previewCampaignAudience.mockResolvedValue({
      success: true,
      count: 0,
      preview: [],
    });

    await evaluateCampaignABTest(campaignId);

    expect(dbMocks().mockTransaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'abTestConfig.winningVariantId': 'A',
        status: 'sending',
      })
    );
  });
});
