import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSurveysForContact, getSurveyResponsesForContact } from '../survey-actions';

// Mock firebase-admin
const mockGet = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => {
      mockCollection(collectionName);
      return {
        where: mockWhere,
        doc: mockDoc,
      };
    }),
  },
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

describe('Surveys Module Unit Tests (Entity Scope)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain for queries
    mockWhere.mockReturnValue({
      where: mockWhere,
      get: mockGet,
    });
    
    // Setup doc mock for subcollections
    mockDoc.mockReturnValue({
      collection: vi.fn(() => ({
        where: mockWhere,
        get: mockGet,
      })),
    });
    
    mockGet.mockResolvedValue({
      empty: true,
      docs: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Survey Queries by entityId (Requirement 13.5, 22.1)', () => {
    it('should query surveys by entityId', async () => {
      const mockSurveys = [
        {
          id: 'survey_1',
          workspaceIds: ['workspace_1'],
          title: 'Survey 1',
          entityId: 'entity_123',
        },
      ];

      mockGet.mockResolvedValue({
        empty: false,
        docs: mockSurveys.map(survey => ({
          id: survey.id,
          data: () => survey,
        })),
      });

      const result = await getSurveysForContact(
        'entity_123',
        'workspace_1'
      );

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('entity_123');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should return empty array when no identifier provided', async () => {
      const result = await getSurveysForContact(
        '',
        'workspace_1'
      );

      expect(result).toHaveLength(0);
      
      const entityIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'entityId'
      );
      expect(entityIdCalls).toHaveLength(0);
    });

    it('should return empty array when no surveys found', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getSurveysForContact(
        'entity_nonexistent',
        'workspace_1'
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Survey Response Queries (Requirement 13.5, 22.1)', () => {
    it('should query survey responses by entityId', async () => {
      const mockResponses = [
        {
          id: 'response_1',
          surveyId: 'survey_1',
          entityId: 'entity_123',
          submittedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockGet.mockResolvedValue({
        empty: false,
        docs: mockResponses.map(response => ({
          id: response.id,
          data: () => response,
        })),
      });

      const result = await getSurveyResponsesForContact(
        'survey_1',
        'entity_123'
      );

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('entity_123');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should return empty array when no responses found', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getSurveyResponsesForContact(
        'survey_1',
        'entity_nonexistent'
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no identifier provided for responses', async () => {
      const result = await getSurveyResponsesForContact(
        'survey_1',
        ''
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully for surveys', async () => {
      mockGet.mockRejectedValue(new Error('Firestore query failed'));

      await expect(
        getSurveysForContact(
          'entity_123',
          'workspace_1'
        )
      ).rejects.toThrow('Firestore query failed');
    });

    it('should handle query errors gracefully for responses', async () => {
      mockGet.mockRejectedValue(new Error('Query failed'));

      await expect(
        getSurveyResponsesForContact(
          'survey_1',
          'entity_123'
        )
      ).rejects.toThrow('Query failed');
    });
  });
});
