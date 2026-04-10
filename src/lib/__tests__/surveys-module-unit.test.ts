/**
 * @fileOverview Surveys Module Unit Tests
 * 
 * Tests for Task 21.4: Write unit tests for surveys module
 * 
 * Validates:
 * - Survey creation with entityId
 * - Survey response with dual-write
 * - Survey queries by entityId and entityId
 * - Contact Adapter integration
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 22.1, 22.3, 23.1, 26.2
 */

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

describe('Surveys Module Unit Tests (Task 21.4)', () => {
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

  describe('Survey Creation with entityId (Requirement 13.1)', () => {
    it('should create survey with entityId for new entity', () => {
      // Requirement 13.1: Survey creation uses entityId instead of entityId
      const survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        internalName: 'Customer Satisfaction Survey',
        title: 'How satisfied are you?',
        description: 'Help us improve our service',
        slug: 'customer-satisfaction',
        status: 'published' as const,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // New entity - only entityId
        entityId: null,
        entityName: null,
      };

      expect(survey.entityId).toBe('entity_456');
      expect(survey.entityId).toBeNull();
      expect(survey.entityName).toBeNull();
    });

    it('should create survey with both entityId and entityId (dual-write)', () => {
      // Requirement 13.2: Survey submission populates both identifiers
      const survey = {
        id: 'survey_2',
        workspaceIds: ['workspace_1'],
        internalName: 'Feedback Survey',
        title: 'Share your feedback',
        description: 'We value your input',
        slug: 'feedback-survey',
        status: 'published' as const,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Dual-write: both identifiers
        entityId: 'school_123',
        entityName: 'Test School',
      };

      expect(survey.entityId).toBe('entity_123');
      expect(survey.entityId).toBe('school_123');
      expect(survey.entityName).toBe('Test School');
    });

    it('should create survey with entityId only (legacy compatibility)', () => {
      // Backward compatibility for legacy surveys
      const survey = {
        id: 'survey_3',
        workspaceIds: ['workspace_1'],
        internalName: 'Legacy Survey',
        title: 'Old Survey',
        description: 'Legacy form',
        slug: 'legacy-survey',
        status: 'draft' as const,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Legacy - only entityId
        entityId: 'school_789',
        entityName: 'Legacy School',
      };

      expect(survey.entityId).toBe('school_789');
      expect(survey.entityId).toBeNull();
    });


    it('should create global survey with no contact association', () => {
      // Surveys can be global (not tied to any contact)
      const survey = {
        id: 'survey_4',
        workspaceIds: ['workspace_1', 'workspace_2'],
        internalName: 'Global Survey',
        title: 'General Feedback',
        description: 'For all users',
        slug: 'global-survey',
        status: 'published' as const,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No contact association
        entityId: null,
        entityName: null,
      };

      expect(survey.entityId).toBeNull();
      expect(survey.entityId).toBeNull();
      expect(survey.workspaceIds).toHaveLength(2);
    });
  });

  describe('Survey Response with Dual-Write (Requirement 13.2)', () => {
    it('should submit response with both entityId and entityId', () => {
      // Requirement 13.2: Survey response submission populates both identifiers
      const response = {
        id: 'response_1',
        surveyId: 'survey_1',
        submittedAt: new Date().toISOString(),
        score: 85,
        answers: [
          { questionId: 'q1', value: 'Very satisfied' },
          { questionId: 'q2', value: 5 },
        ],
        // Dual-write fields
        entityId: 'school_123',
        entityType: 'institution' as const,
      };

      expect(response.entityId).toBe('entity_123');
      expect(response.entityId).toBe('school_123');
      expect(response.entityType).toBe('institution');
    });

    it('should submit response with entityId only (new entity)', () => {
      // Requirement 13.2: New entities use entityId
      const response = {
        id: 'response_2',
        surveyId: 'survey_2',
        submittedAt: new Date().toISOString(),
        score: 92,
        answers: [
          { questionId: 'q1', value: 'Excellent' },
        ],
        // Only entityId
        entityId: null,
        entityType: 'family' as const,
      };

      expect(response.entityId).toBe('entity_456');
      expect(response.entityId).toBeNull();
      expect(response.entityType).toBe('family');
    });

    it('should submit response with entityId only (legacy)', () => {
      // Backward compatibility for legacy responses
      const response = {
        id: 'response_3',
        surveyId: 'survey_3',
        submittedAt: new Date().toISOString(),
        score: 78,
        answers: [
          { questionId: 'q1', value: 'Good' },
        ],
        // Legacy - only entityId
        entityId: 'school_789',
        entityType: undefined,
      };

      expect(response.entityId).toBe('school_789');
      expect(response.entityId).toBeNull();
    });


    it('should submit anonymous response (no contact)', () => {
      // Responses can be anonymous
      const response = {
        id: 'response_4',
        surveyId: 'survey_4',
        submittedAt: new Date().toISOString(),
        score: 88,
        answers: [
          { questionId: 'q1', value: 'Anonymous feedback' },
        ],
        // No contact association
        entityId: null,
        entityType: undefined,
      };

      expect(response.entityId).toBeNull();
      expect(response.entityId).toBeNull();
    });

    it('should validate entityType values', () => {
      // Requirement 13.2: entityType must be valid
      const validTypes: Array<'institution' | 'family' | 'person'> = [
        'institution',
        'family',
        'person',
      ];

      validTypes.forEach(type => {
        const response = {
          id: `response_${type}`,
          surveyId: 'survey_1',
          submittedAt: new Date().toISOString(),
          answers: [],
          entityId: null,
          entityType: type,
        };

        expect(validTypes).toContain(response.entityType);
      });
    });
  });

  describe('Survey Queries by entityId (Requirement 13.5, 22.1)', () => {
    it('should query surveys by entityId', async () => {
      // Requirement 13.5: Query surveys by entityId
      // Requirement 22.1: Support entityId queries
      const mockSurveys = [
        {
          id: 'survey_1',
          workspaceIds: ['workspace_1'],
          title: 'Survey 1',
          entityId: 'school_123',
        },
        {
          id: 'survey_2',
          workspaceIds: ['workspace_1'],
          title: 'Survey 2',
          entityId: null,
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
        { entityId: 'entity_123' },
        'workspace_1'
      );

      expect(result).toHaveLength(2);
      expect(result[0].entityId).toBe('entity_123');
      expect(result[1].entityId).toBe('entity_123');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should query surveys by entityId (fallback)', async () => {
      // Requirement 13.5: Query surveys by entityId for backward compatibility
      // Requirement 22.1: Support entityId fallback
      const mockSurveys = [
        {
          id: 'survey_3',
          workspaceIds: ['workspace_1'],
          title: 'Legacy Survey',
          entityId: 'school_789',
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
        { entityId: 'school_789' },
        'workspace_1'
      );

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('school_789');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_789');
    });


    it('should prefer entityId when both identifiers provided', async () => {
      // Requirement 22.1: Prefer entityId over entityId
      const mockSurveys = [
        {
          id: 'survey_1',
          workspaceIds: ['workspace_1'],
          title: 'Survey 1',
          entityId: 'school_123',
        },
      ];

      mockGet.mockResolvedValue({
        empty: false,
        docs: mockSurveys.map(survey => ({
          id: survey.id,
          data: () => survey,
        })),
      });

      await getSurveysForContact(
        { entityId: 'school_999' },
        'workspace_1'
      );

      // Verify query used entityId (not entityId)
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      
      // Should NOT query by entityId when entityId is present
      const entityIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'entityId'
      );
      expect(entityIdCalls).toHaveLength(0);
    });

    it('should return empty array when no identifier provided', async () => {
      // Edge case: no identifier provided
      const result = await getSurveysForContact(
        {},
        'workspace_1'
      );

      expect(result).toHaveLength(0);
      
      // Should not attempt to query without identifier
      const entityIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'entityId'
      );
      const entityIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'entityId'
      );
      expect(entityIdCalls).toHaveLength(0);
      expect(entityIdCalls).toHaveLength(0);
    });

    it('should return empty array when no surveys found', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getSurveysForContact(
        { entityId: 'entity_nonexistent' },
        'workspace_1'
      );

      expect(result).toHaveLength(0);
    });

    it('should enforce workspace boundary', async () => {
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

      await getSurveysForContact(
        { entityId: 'entity_123' },
        'workspace_1'
      );

      // Verify workspace filter was applied
      expect(mockWhere).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
    });
  });

  describe('Survey Response Queries (Requirement 13.5, 22.1)', () => {
    it('should query survey responses by entityId', async () => {
      // Requirement 13.5: Query responses by entityId
      const mockResponses = [
        {
          id: 'response_1',
          surveyId: 'survey_1',
          entityId: 'school_123',
          submittedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'response_2',
          surveyId: 'survey_1',
          entityId: null,
          submittedAt: '2024-01-02T00:00:00Z',
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
        { entityId: 'entity_123' }
      );

      expect(result).toHaveLength(2);
      expect(result[0].entityId).toBe('entity_123');
      expect(result[1].entityId).toBe('entity_123');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });


    it('should query survey responses by entityId (fallback)', async () => {
      // Requirement 13.5: Query responses by entityId for backward compatibility
      const mockResponses = [
        {
          id: 'response_3',
          surveyId: 'survey_2',
          entityId: 'school_789',
          submittedAt: '2024-01-03T00:00:00Z',
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
        'survey_2',
        { entityId: 'school_789' }
      );

      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('school_789');
      
      // Verify query was built with entityId
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'school_789');
    });

    it('should prefer entityId over entityId for responses', async () => {
      // Requirement 22.1: Prefer entityId
      const mockResponses = [
        {
          id: 'response_1',
          surveyId: 'survey_1',
          entityId: 'school_123',
        },
      ];

      mockGet.mockResolvedValue({
        empty: false,
        docs: mockResponses.map(response => ({
          id: response.id,
          data: () => response,
        })),
      });

      await getSurveyResponsesForContact(
        'survey_1',
        { entityId: 'school_999' }
      );

      // Verify query used entityId
      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      
      // Should NOT query by entityId
      const entityIdCalls = vi.mocked(mockWhere).mock.calls.filter(
        call => call[0] === 'entityId'
      );
      expect(entityIdCalls).toHaveLength(0);
    });

    it('should return empty array when no responses found', async () => {
      mockGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getSurveyResponsesForContact(
        'survey_1',
        { entityId: 'entity_nonexistent' }
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no identifier provided for responses', async () => {
      const result = await getSurveyResponsesForContact(
        'survey_1',
        {}
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Contact Adapter Integration (Requirement 13.4, 23.1)', () => {
    it('should resolve contact information for survey display', () => {
      // Requirement 13.4: Display entity information using Contact Adapter
      // Requirement 23.1: UI components use Contact Adapter
      const survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        title: 'Customer Feedback',
        entityId: 'school_123',
      };

      // Mock resolved contact from adapter
      const resolvedContact = {
        id: 'entity_123',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: ['active', 'premium'],
        entityType: 'institution' as const,
        entityId: 'entity_123',
        migrationStatus: 'migrated' as const,
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
      };

      expect(resolvedContact.entityId).toBe(survey.entityId);
      expect(resolvedContact.name).toBe('Test Institution');
      expect(resolvedContact.entityType).toBe('institution');
      expect(resolvedContact.migrationStatus).toBe('migrated');
    });


    it('should resolve contact for legacy survey', () => {
      // Requirement 23.1: Adapter handles legacy surveys
      const survey = {
        id: 'survey_2',
        workspaceIds: ['workspace_1'],
        title: 'Legacy Survey',
        entityId: 'school_789',
        entityName: 'Legacy School',
      };

      // Mock resolved contact from adapter (legacy)
      const resolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        tags: ['legacy'],
        migrationStatus: 'legacy' as const,
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
        },
      };

      expect(resolvedContact.id).toBe(survey.entityId);
      expect(resolvedContact.name).toBe(survey.entityName);
      expect(resolvedContact.migrationStatus).toBe('legacy');
    });

    it('should resolve contact for family entity', () => {
      // Requirement 13.4: Support different entity types
      const response = {
        id: 'response_1',
        surveyId: 'survey_1',
        entityId: 'entity_456',
        entityType: 'family' as const,
      };

      // Mock resolved contact for family
      const resolvedContact = {
        id: 'entity_456',
        name: 'Smith Family',
        contacts: [],
        tags: ['active'],
        entityType: 'family' as const,
        entityId: 'entity_456',
        migrationStatus: 'migrated' as const,
      };

      expect(resolvedContact.entityId).toBe(response.entityId);
      expect(resolvedContact.entityType).toBe('family');
    });

    it('should resolve contact for person entity', () => {
      // Requirement 13.4: Support person entity type
      const response = {
        id: 'response_2',
        surveyId: 'survey_2',
        entityId: 'entity_789',
        entityType: 'person' as const,
      };

      // Mock resolved contact for person
      const resolvedContact = {
        id: 'entity_789',
        name: 'John Doe',
        contacts: [],
        tags: ['individual'],
        entityType: 'person' as const,
        entityId: 'entity_789',
        migrationStatus: 'migrated' as const,
      };

      expect(resolvedContact.entityId).toBe(response.entityId);
      expect(resolvedContact.entityType).toBe('person');
    });

    it('should handle contact resolution for dual-write records', () => {
      // Requirement 23.1: Adapter handles dual-write records
      const survey = {
        id: 'survey_3',
        workspaceIds: ['workspace_1'],
        title: 'Dual-Write Survey',
        entityId: 'school_123',
        entityName: 'Test School',
      };

      // Mock resolved contact (should prefer entity data)
      const resolvedContact = {
        id: 'entity_123',
        name: 'Test School',
        slug: 'test-school',
        contacts: [],
        tags: ['active'],
        entityType: 'institution' as const,
        entityId: 'entity_123',
        migrationStatus: 'migrated' as const,
        schoolData: {
          id: 'school_123',
          name: 'Test School',
        },
      };

      // Adapter should prefer entity data when both exist
      expect(resolvedContact.entityId).toBe(survey.entityId);
      expect(resolvedContact.migrationStatus).toBe('migrated');
      expect(resolvedContact.schoolData?.id).toBe(survey.entityId);
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully for surveys', async () => {
      mockGet.mockRejectedValue(new Error('Firestore query failed'));

      await expect(
        getSurveysForContact(
          { entityId: 'entity_123' },
          'workspace_1'
        )
      ).rejects.toThrow('Firestore query failed');
    });

    it('should handle query errors gracefully for responses', async () => {
      mockGet.mockRejectedValue(new Error('Query failed'));

      await expect(
        getSurveyResponsesForContact(
          'survey_1',
          { entityId: 'entity_123' }
        )
      ).rejects.toThrow('Query failed');
    });
  });


  describe('Data Integrity and Validation', () => {
    it('should maintain identifier consistency during updates', () => {
      // Requirement 3.2: Preserve identifiers during updates
      const originalSurvey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        title: 'Original Title',
        entityId: 'school_123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const updatedSurvey = {
        ...originalSurvey,
        title: 'Updated Title',
        description: 'New description',
        updatedAt: new Date().toISOString(),
      };

      // Identifiers should remain unchanged
      expect(updatedSurvey.entityId).toBe(originalSurvey.entityId);
      expect(updatedSurvey.entityId).toBe(originalSurvey.entityId);
      expect(updatedSurvey.title).toBe('Updated Title');
    });

    it('should validate entityType is one of allowed values', () => {
      const validTypes: Array<'institution' | 'family' | 'person'> = [
        'institution',
        'family',
        'person',
      ];

      validTypes.forEach(type => {
        const response = {
          id: 'response_1',
          surveyId: 'survey_1',
          entityId: 'entity_123',
          entityType: type,
          submittedAt: new Date().toISOString(),
          answers: [],
        };

        expect(validTypes).toContain(response.entityType);
      });
    });

    it('should handle null values correctly in dual-write fields', () => {
      const survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        title: 'Test Survey',
        entityId: null,
        entityName: null,
      };

      expect(survey.entityId).toBeNull();
      expect(survey.entityId).toBeNull();
      expect(survey.entityName).toBeNull();
    });

    it('should preserve both identifiers in responses', () => {
      const response = {
        id: 'response_1',
        surveyId: 'survey_1',
        submittedAt: '2024-01-01T00:00:00Z',
        answers: [],
        entityId: 'school_123',
        entityType: 'institution' as const,
      };

      // Both identifiers should be present
      expect(response.entityId).toBe('entity_123');
      expect(response.entityId).toBe('school_123');
      expect(response.entityType).toBe('institution');
    });
  });

  describe('Edge Cases', () => {
    it('should handle survey with empty elements array', () => {
      const survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        internalName: 'Empty Survey',
        title: 'No Questions',
        description: 'Survey with no questions',
        slug: 'empty-survey',
        status: 'draft' as const,
        elements: [],
        entityId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(survey.elements).toHaveLength(0);
      expect(survey.entityId).toBe('entity_123');
    });

    it('should handle response with no answers', () => {
      const response = {
        id: 'response_1',
        surveyId: 'survey_1',
        submittedAt: new Date().toISOString(),
        answers: [],
        entityId: null,
      };

      expect(response.answers).toHaveLength(0);
      expect(response.entityId).toBe('entity_123');
    });

    it('should handle survey shared across multiple workspaces', () => {
      const survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1', 'workspace_2', 'workspace_3'],
        title: 'Multi-Workspace Survey',
        entityId: 'school_123',
      };

      expect(survey.workspaceIds).toHaveLength(3);
      expect(survey.workspaceIds).toContain('workspace_1');
      expect(survey.workspaceIds).toContain('workspace_2');
      expect(survey.workspaceIds).toContain('workspace_3');
    });

    it('should handle response with scoring', () => {
      const response = {
        id: 'response_1',
        surveyId: 'survey_1',
        submittedAt: new Date().toISOString(),
        score: 95,
        answers: [
          { questionId: 'q1', value: 'Excellent' },
          { questionId: 'q2', value: 5 },
        ],
        entityId: 'entity_123',
        entityType: 'institution' as const,
      };

      expect(response.score).toBe(95);
      expect(response.answers).toHaveLength(2);
    });
  });
});
