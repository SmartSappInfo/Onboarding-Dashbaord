import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callCentreListCampaignsTool, callCentreGetCampaignAnalyticsTool } from '../call-centre-tools';
import type { McpExecutionContext } from '../../types';

vi.mock('@/lib/firebase-admin', () => {
  const mockGet = vi.fn();
  const mockCount = vi.fn();
  const mockLimit = vi.fn();
  const mockWhere = vi.fn();
  const mockDoc = vi.fn();
  const mockCollection = vi.fn();

  const queryChain: Record<string, unknown> = {
    where: mockWhere,
    limit: mockLimit,
    get: mockGet,
    count: mockCount,
  };

  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockCount.mockReturnValue({
    get: vi.fn().mockResolvedValue({ data: () => ({ count: 5 }) }),
  });
  mockCollection.mockReturnValue(queryChain);

  return {
    adminDb: {
      collection: mockCollection,
      doc: mockDoc,
    },
    __mocks: {
      mockGet,
      mockWhere,
      mockLimit,
      mockCount,
      mockDoc,
      mockCollection,
    },
  };
});

describe('callCentreListCampaignsTool', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_call_1',
    organizationId: 'org_call_1',
    callerId: 'user_1',
    callerType: 'user',
    callDepth: 0,
    requestId: 'req_1',
    timestamp: '2026-10-10T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('declares protocol-compliant metadata', () => {
    expect(callCentreListCampaignsTool.name).toBe('call_centre.list_campaigns');
    expect(callCentreListCampaignsTool.riskLevel).toBe('read_only');
    expect(callCentreListCampaignsTool.category).toBe('campaign');
    expect(callCentreListCampaignsTool.schemaHash).toHaveLength(64);
  });

  it('fails closed when workspaceId is missing', async () => {
    const invalidContext = { ...mockContext, workspaceId: '' };
    await expect(
      callCentreListCampaignsTool.handler({}, invalidContext)
    ).rejects.toThrow(/workspaceId/i);
  });
});

describe('callCentreGetCampaignAnalyticsTool', () => {
  const mockContext: McpExecutionContext = {
    workspaceId: 'ws_call_1',
    organizationId: 'org_call_1',
    callerId: 'user_1',
    callerType: 'user',
    callDepth: 0,
    requestId: 'req_2',
    timestamp: '2026-10-10T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('declares protocol-compliant metadata', () => {
    expect(callCentreGetCampaignAnalyticsTool.name).toBe('call_centre.get_campaign_analytics');
    expect(callCentreGetCampaignAnalyticsTool.riskLevel).toBe('read_only');
    expect(callCentreGetCampaignAnalyticsTool.category).toBe('campaign');
    expect(callCentreGetCampaignAnalyticsTool.schemaHash).toHaveLength(64);
  });

  it('fails closed when campaignId is missing or empty', async () => {
    await expect(
      callCentreGetCampaignAnalyticsTool.handler({ campaignId: '' }, mockContext)
    ).rejects.toThrow();
  });
});
