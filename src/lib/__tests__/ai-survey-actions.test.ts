import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSurveyFromAiAction } from '../ai-survey-actions';
import type { Survey, SurveyResultPage } from '../types';

// Mock dependencies
const mockCollectionAdd = vi.fn();
const mockCollectionWhere = vi.fn();
const mockBatchCommit = vi.fn();
const mockBatchSet = vi.fn();
const mockDocRef = {
  id: 'survey_new_123',
  collection: vi.fn(),
};

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((colName: string) => {
        if (colName === 'surveys') {
          return {
            add: mockCollectionAdd,
            where: mockCollectionWhere,
          };
        }
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }),
      batch: vi.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit,
      })),
    },
  };
});

vi.mock('../workspace-permissions', () => {
  return {
    canUser: vi.fn(async (_userId: string, _section: string, _feature: string, _action: string, workspaceId: string) => {
      if (workspaceId === 'denied_ws') {
        return { granted: false, reason: 'User not a member of this workspace' };
      }
      return { granted: true };
    }),
  };
});

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('createSurveyFromAiAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDocRef.collection.mockReturnValue({
      doc: vi.fn((id?: string) => ({ id: id || 'page_doc_1' })),
    });

    mockCollectionAdd.mockResolvedValue(mockDocRef);
    mockCollectionWhere.mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true }),
      }),
    });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  const validSurveyData: Partial<Survey> = {
    title: 'Customer Satisfaction Q3',
    description: 'A detailed survey measuring feedback for Q3 performance.',
    elements: [
      {
        id: 'q1',
        type: 'rating',
        title: 'How satisfied are you?',
      } as any,
    ],
  };

  it('successfully creates survey for "onboarding" workspace', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      workspaceId: 'onboarding',
      userId: 'user_123',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('survey_new_123');
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Customer Satisfaction Q3',
        workspaceIds: ['onboarding'],
        status: 'draft',
      })
    );
  });

  it('successfully creates survey for custom workspace ID', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      workspaceId: 'ws_tenant_456',
      userId: 'user_123',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('survey_new_123');
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceIds: ['ws_tenant_456'],
      })
    );
  });

  it('rejects creation when workspaceId is missing or empty', async () => {
    const resultEmpty = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      workspaceId: '',
      userId: 'user_123',
    });

    expect(resultEmpty.success).toBe(false);
    expect(resultEmpty.error).toBe('A survey must be associated with a valid workspace.');

    const resultWhitespace = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      workspaceId: '   ',
      userId: 'user_123',
    });

    expect(resultWhitespace.success).toBe(false);
    expect(resultWhitespace.error).toBe('A survey must be associated with a valid workspace.');
  });

  it('rejects creation when canUser returns granted: false', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      workspaceId: 'denied_ws',
      userId: 'user_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied: User not a member of this workspace');
    expect(mockCollectionAdd).not.toHaveBeenCalled();
  });

  it('rejects creation when title is too short or missing', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: {
        ...validSurveyData,
        title: 'A',
      },
      workspaceId: 'onboarding',
      userId: 'user_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Survey title is required and must be at least 2 characters long.');
  });

  it('rejects creation when description is too short or missing', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: {
        ...validSurveyData,
        description: 'Short',
      },
      workspaceId: 'onboarding',
      userId: 'user_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Survey description is required and must be at least 10 characters long.');
  });

  it('rejects creation when elements array is empty', async () => {
    const result = await createSurveyFromAiAction({
      surveyData: {
        ...validSurveyData,
        elements: [],
      },
      workspaceId: 'onboarding',
      userId: 'user_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Survey must have at least one element (question or section).');
  });

  it('saves resultPages in batch subcollection when provided', async () => {
    const resultPages: SurveyResultPage[] = [
      {
        id: 'page_1',
        name: 'High Score Outcome',
        isDefault: true,
        blocks: [],
      },
    ];

    const result = await createSurveyFromAiAction({
      surveyData: validSurveyData,
      resultPages,
      workspaceId: 'onboarding',
      userId: 'user_123',
    });

    expect(result.success).toBe(true);
    expect(mockDocRef.collection).toHaveBeenCalledWith('resultPages');
    expect(mockBatchSet).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
