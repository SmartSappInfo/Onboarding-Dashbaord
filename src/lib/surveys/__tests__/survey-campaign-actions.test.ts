import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSurveyDistributionCampaignAction,
  estimateAudienceSizeAction,
} from '../survey-campaign-actions';

const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);

const mockDoc = vi.fn((id?: string) => ({
  id: id || 'cmp_mock_123',
  set: mockSet,
  get: mockGet,
  update: mockUpdate,
}));

const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();

const mockCollection = vi.fn((name: string) => ({
  doc: mockDoc,
  where: mockWhere,
  limit: mockLimit,
  get: mockGet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => mockCollection(name),
  },
}));

vi.mock('@/lib/messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true, id: 'msg_123' }),
}));

describe('Survey Campaign Distribution Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new distribution campaign document with initial stats', async () => {
    const res = await createSurveyDistributionCampaignAction({
      surveyId: 'survey_123',
      deploymentId: 'dep_456',
      workspaceId: 'ws_test',
      name: 'Parent Feedback Wave 1',
      channel: 'whatsapp',
      audienceConfig: {
        targetType: 'tags',
        filterTagIds: ['tag_parents'],
        recipientCount: 50,
      },
      messageConfig: {
        templateId: 'tmpl_123',
        buttonText: 'Start Survey',
      },
      createdBy: 'user_1',
    });

    expect(res.success).toBe(true);
    expect(res.campaignId).toBe('cmp_mock_123');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId: 'survey_123',
        deploymentId: 'dep_456',
        workspaceId: 'ws_test',
        channel: 'whatsapp',
        status: 'draft',
      })
    );
  });

  it('estimates audience size filtering by contact tag IDs', async () => {
    mockGet.mockResolvedValueOnce({
      size: 3,
      docs: [
        { id: 'c1', data: () => ({ tagIds: ['tag_parents', 'tag_vip'] }) },
        { id: 'c2', data: () => ({ tagIds: ['tag_teachers'] }) },
        { id: 'c3', data: () => ({ tagIds: ['tag_parents'] }) },
      ],
    });

    const res = await estimateAudienceSizeAction('ws_test', ['tag_parents']);
    expect(res.count).toBe(2);
  });

  it('returns count of all contacts when no tag filter is specified', async () => {
    mockGet.mockResolvedValueOnce({
      size: 15,
      docs: [],
    });

    const res = await estimateAudienceSizeAction('ws_test');
    expect(res.count).toBe(15);
  });
});
