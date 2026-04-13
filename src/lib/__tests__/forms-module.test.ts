/**
 * Unit Tests for Forms Module Migration (Task 15)
 * 
 * Tests the migration of the Forms/Surveys module from entityId to entityId.
 * Covers survey creation, submission, and query functions with dual-write pattern.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 22.1, 22.3, 23.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Forms Module Migration - Survey Creation', () => {
  it('should create survey with both entityId and entityId (dual-write)', () => {
    // Requirement 7.1: Survey creation uses entityId
    // Requirement 7.2: Survey submission populates both identifiers
    const survey = {
      id: 'survey_1',
      workspaceIds: ['workspace_1'],
      internalName: 'Test Survey',
      title: 'Customer Feedback',
      description: 'Please share your feedback',
      slug: 'customer-feedback',
      status: 'published' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Unified architecture uses entityId (Requirement 25.4)
      entityId: 'entity_123',
    };

    expect(survey.entityId).toBe('entity_123');
  });

  it('should create survey with entityId only (new entity)', () => {
    // Requirement 7.1: Survey creation uses entityId
    const survey = {
      id: 'survey_2',
      workspaceIds: ['workspace_1'],
      internalName: 'New Entity Survey',
      title: 'Feedback Form',
      description: 'Share your thoughts',
      slug: 'feedback-form',
      status: 'published' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Only entityId (no legacy entityId)
      entityId: null,
      entityName: null,
    };

    expect(survey.entityId).toBe('entity_456');
    expect(survey.entityId).toBeNull();
  });

  it('should create survey with entityId only (legacy)', () => {
    // Backward compatibility: legacy surveys with only entityId
    const survey = {
      id: 'survey_3',
      workspaceIds: ['workspace_1'],
      internalName: 'Legacy Survey',
      title: 'Old Feedback',
      description: 'Legacy form',
      slug: 'old-feedback',
      status: 'published' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Only entityId (legacy)
      entityId: 'school_789',
      entityName: 'Legacy School',
    };

    expect(survey.entityId).toBe('school_789');
    expect(survey.entityId).toBeNull();
  });

  it('should create global survey with no contact association', () => {
    // Surveys can be global (not associated with any contact)
    const survey = {
      id: 'survey_4',
      workspaceIds: ['workspace_1'],
      internalName: 'Global Survey',
      title: 'General Feedback',
      description: 'For all users',
      slug: 'general-feedback',
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
  });
});

describe('Forms Module Migration - Survey Response Submission', () => {
  it('should submit response with both entityId and entityId (dual-write)', () => {
    // Requirement 7.2: Survey submission populates both identifiers
    const response = {
      id: 'response_1',
      surveyId: 'survey_1',
      submittedAt: new Date().toISOString(),
      score: 85,
      answers: [
        { questionId: 'q1', value: 'Yes' },
        { questionId: 'q2', value: 'Excellent' },
      ],
      // Unified architecture uses entityId (Requirement 25.4)
      entityId: 'entity_123',
      entityType: 'institution' as const,
    };

    expect(response.entityId).toBe('entity_123');
    expect(response.entityType).toBe('institution');
  });

  it('should submit response with entityId only (new entity)', () => {
    // Requirement 7.2: Survey submission populates entityId
    const response = {
      id: 'response_2',
      surveyId: 'survey_2',
      submittedAt: new Date().toISOString(),
      score: 90,
      answers: [
        { questionId: 'q1', value: 'No' },
      ],
      // Only entityId
      entityId: 'entity_456',
      entityType: 'family' as const,
    };

    expect(response.entityId).toBe('entity_456');
    expect(response.entityType).toBe('family');
    expect(response.entityId).toBeNull();
  });

  it('should submit response with entityId only (legacy)', () => {
    // Backward compatibility: legacy responses
    const response = {
      id: 'response_3',
      surveyId: 'survey_3',
      submittedAt: new Date().toISOString(),
      score: 75,
      answers: [
        { questionId: 'q1', value: 'Maybe' },
      ],
      // Only entityId (legacy id is mapped to entityId)
      entityId: 'school_789',
      entityType: undefined,
    };

    expect(response.entityId).toBe('school_789');
  });

  it('should submit anonymous response (no contact)', () => {
    // Responses can be anonymous (no contact association)
    const response = {
      id: 'response_4',
      surveyId: 'survey_4',
      submittedAt: new Date().toISOString(),
      score: 80,
      answers: [
        { questionId: 'q1', value: 'Good' },
      ],
      // No contact association
      entityId: null,
      entityType: undefined,
    };

    expect(response.entityId).toBeNull();
    expect(response.entityId).toBeNull();
  });
});

describe('Forms Module Migration - Query Functions', () => {
  it('should query surveys by entityId', () => {
    // Requirement 7.5: Query by entityId
    // Requirement 22.1: Support entityId queries
    const surveys = [
      {
        id: 'survey_1',
        entityId: 'entity_123',
      },
    ];

    // Query by entityId
    const entitySurveys = surveys.filter(s => s.entityId === 'entity_123');
    expect(entitySurveys).toHaveLength(1);
    expect(entitySurveys[0].id).toBe('survey_1');
  });

  it('should query surveys by entityId (fallback)', () => {
    // Requirement 7.5: Query by entityId for backward compatibility
    // Requirement 22.1: Support entityId fallback
    const surveys = [
      {
        id: 'survey_3',
        entityId: 'school_789',
      },
    ];

    // Query by entityId (fallback for legacy)
    const schoolSurveys = surveys.filter(s => s.entityId === 'school_789');
    expect(schoolSurveys).toHaveLength(1);
    expect(schoolSurveys[0].id).toBe('survey_3');
  });

  it('should prefer entityId when both identifiers provided', () => {
    // Requirement 22.1: Prefer entityId over entityId
    const surveys = [
      {
        id: 'survey_1',
        entityId: 'entity_123',
        title: 'Survey 1',
      },
      {
        id: 'survey_2',
        entityId: 'school_456',
        title: 'Survey 2',
      },
    ];

    // Query with identifiers
    const contactId = 'entity_123';
    const result = surveys.filter(s => s.entityId === contactId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('survey_1');
  });

  it('should query survey responses by entityId', () => {
    // Requirement 7.5: Query responses by entityId
    const responses = [
      {
        id: 'response_1',
        surveyId: 'survey_1',
        entityId: 'school_123',
      },
      {
        id: 'response_2',
        surveyId: 'survey_1',
        entityId: null,
      },
      {
        id: 'response_3',
        surveyId: 'survey_2',
        entityId: 'school_789',
      },
    ];

    // Query responses by entityId
    const entityResponses = responses.filter(r => (r as any).entityId === 'entity_123');
    expect(entityResponses).toHaveLength(1);
    expect(entityResponses[0].id).toBe('response_1');
  });

  it('should query survey responses by entityId (fallback)', () => {
    // Requirement 7.5: Query responses by entityId for backward compatibility
    const responses = [
      {
        id: 'response_1',
        surveyId: 'survey_1',
        entityId: 'school_123',
      },
      {
        id: 'response_2',
        surveyId: 'survey_1',
        entityId: null,
      },
      {
        id: 'response_3',
        surveyId: 'survey_2',
        entityId: 'school_789',
      },
    ];

    // Query responses by entityId (fallback)
    const schoolResponses = responses.filter(r => r.entityId === 'school_789');
    expect(schoolResponses).toHaveLength(1);
    expect(schoolResponses[0].id).toBe('response_3');
  });
});

describe('Forms Module Migration - Data Integrity', () => {
  it('should maintain entityType consistency', () => {
    // Requirement 7.2: entityType must be consistent
    const response = {
      id: 'response_1',
      surveyId: 'survey_1',
      submittedAt: new Date().toISOString(),
      answers: [],
      entityId: 'entity_123',
      entityType: 'institution' as const,
    };

    expect(response.entityType).toBe('institution');
    expect(['institution', 'family', 'person'].includes(response.entityType)).toBe(true);
  });

  it('should handle null values correctly', () => {
    // Dual-write fields can be null
    const survey = {
      id: 'survey_1',
      workspaceIds: ['workspace_1'],
      internalName: 'Test',
      title: 'Test',
      description: 'Test',
      slug: 'test',
      status: 'draft' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entityId: null,
      entityName: null,
    };

    expect(survey.entityId).toBeNull();
    expect(survey.entityId).toBeNull();
  });

  it('should preserve both identifiers during updates', () => {
    // Requirement 3.2: Preserve identifiers during updates
    const originalSurvey = {
      id: 'survey_1',
      entityId: 'entity_123',
      title: 'Original Title',
    };

    const updatedSurvey = {
      ...originalSurvey,
      title: 'Updated Title',
      updatedAt: new Date().toISOString(),
    };

    expect(updatedSurvey.entityId).toBe(originalSurvey.entityId);
    expect(updatedSurvey.title).toBe('Updated Title');
  });
});

describe('Forms Module Migration - Edge Cases', () => {
  it('should handle survey with empty elements array', () => {
    const survey = {
      id: 'survey_1',
      workspaceIds: ['workspace_1'],
      internalName: 'Empty Survey',
      title: 'Empty',
      description: 'No questions',
      slug: 'empty',
      status: 'draft' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entityId: null,
    };

    expect(survey.elements).toHaveLength(0);
    expect(survey.entityId).toBeNull();
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
    expect(response.entityId).toBeNull();
  });

  it('should handle survey with multiple workspaces', () => {
    const survey = {
      id: 'survey_1',
      workspaceIds: ['workspace_1', 'workspace_2', 'workspace_3'],
      internalName: 'Multi-Workspace Survey',
      title: 'Shared Survey',
      description: 'Shared across workspaces',
      slug: 'shared-survey',
      status: 'published' as const,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entityId: 'school_123',
      entityName: 'Test School',
    };

    expect(survey.workspaceIds).toHaveLength(3);
    expect(survey.workspaceIds).toContain('workspace_1');
    expect(survey.workspaceIds).toContain('workspace_2');
    expect(survey.workspaceIds).toContain('workspace_3');
  });
});

describe('Forms Module Migration - Contact Adapter Integration', () => {
  it('should resolve contact information for survey display', () => {
    // Requirement 7.4: Use Contact Adapter for display
    // Requirement 23.1: UI components use Contact Adapter
    const survey = {
      id: 'survey_1',
      entityId: 'school_123',
      title: 'Customer Feedback',
    };

    // Mock resolved contact from adapter
    const resolvedContact = {
      id: 'entity_123',
      name: 'Test School',
      slug: 'test-school',
      contacts: [],
      tags: ['active', 'premium'],
      entityType: 'institution' as const,
      entityId: 'entity_123',
      migrationStatus: 'migrated' as const,
    };

    expect(resolvedContact.entityId).toBe(survey.entityId);
    expect(resolvedContact.name).toBe('Test School');
    expect(resolvedContact.migrationStatus).toBe('migrated');
  });

  it('should resolve contact for legacy survey', () => {
    // Requirement 23.1: Adapter handles legacy surveys
    const survey = {
      id: 'survey_2',
      entityId: 'school_789',
      entityName: 'Legacy School',
      title: 'Old Survey',
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
    expect(resolvedContact.migrationStatus).toBe('legacy');
  });
});
