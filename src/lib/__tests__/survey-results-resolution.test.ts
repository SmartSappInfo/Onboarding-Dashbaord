// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock firebase-admin with path-aware mock registry
vi.mock('../firebase-admin', () => {
  const docRegistry = new Map();
  const queryRegistry = new Map();

  const collectionMock = vi.fn((colName) => {
    return createQueryMock(colName);
  });

  function createQueryMock(colName) {
    const q = {
      where: vi.fn().mockImplementation(() => q),
      orderBy: vi.fn().mockImplementation(() => q),
      limit: vi.fn().mockImplementation(() => q),
      get: vi.fn(() => {
        if (queryRegistry.has(colName)) {
          const val = queryRegistry.get(colName);
          if (typeof val === 'function') return val();
          return Promise.resolve(val);
        }
        return Promise.resolve({ empty: true, docs: [] });
      }),
      doc: vi.fn((docId) => {
        return createDocMock(colName, docId);
      }),
    };
    return q;
  }

  function createDocMock(colName, docId) {
    const d = {
      get: vi.fn(() => {
        const key = `${colName}/${docId}`;
        if (docRegistry.has(key)) {
          const val = docRegistry.get(key);
          if (typeof val === 'function') return val();
          return Promise.resolve(val);
        }
        return Promise.resolve({ exists: false, data: () => ({}) });
      }),
      collection: vi.fn((subColName) => {
        return createQueryMock(`${colName}/${docId}/${subColName}`);
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    return d;
  }

  return {
    adminDb: {
      collection: collectionMock,
    },
    __mocks: {
      docRegistry,
      queryRegistry,
      collection: collectionMock,
    },
  };
});

// Mock url-helpers getBaseUrl
vi.mock('../utils/url-helpers', () => ({
  getBaseUrl: vi.fn(() => 'https://go.smartsapp.com'),
}));

// Mock contact-type-actions
vi.mock('../contact-type-actions', () => ({
  getEffectiveContactTypes: vi.fn(() => Promise.resolve([])),
}));

// Mock messaging-actions resolveTagVariables
vi.mock('../messaging-actions', () => ({
  resolveTagVariables: vi.fn(() => Promise.resolve({})),
  getBaseUrl: () => 'https://go.smartsapp.com',
}));

import { FieldsVariablesService } from '../services/fields-variables-service-impl';
import * as firebaseAdmin from '../firebase-admin';

const dbMocks = () => (firebaseAdmin as any).__mocks;

describe('Survey Results Variable Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks().docRegistry.clear();
    dbMocks().queryRegistry.clear();
  });

  it('resolves results variables directly when responseId is provided', async () => {
    // 1. Workspace mock
    dbMocks().docRegistry.set('workspaces/ws-123', {
      exists: true,
      data: () => ({ name: 'Default Workspace', organizationId: 'org-123' }),
    });

    // 2. Survey mock
    dbMocks().docRegistry.set('surveys/survey-123', {
      exists: true,
      data: () => ({ title: 'Satisfaction Survey', slug: 'sat-survey', maxScore: 100 }),
    });

    // 3. Response mock
    dbMocks().docRegistry.set('surveys/survey-123/responses/resp-123', {
      exists: true,
      data: () => ({
        score: 95,
        maxScore: 100,
        outcome: 'Excellent',
        submittedAt: '2026-06-01T12:00:00Z',
        status: 'Completed',
        answers: [
          { questionId: 'q1', value: 'Highly Satisfied' }
        ],
        leadDetails: {
          email: 'test@example.com'
        }
      }),
    });

    const ctx = {
      workspaceId: 'ws-123',
      surveyId: 'survey-123',
      responseId: 'resp-123',
    };

    const vars = await FieldsVariablesService.getVariableValuesMap(ctx);

    expect(vars.get('survey_title')).toBe('Satisfaction Survey');
    expect(vars.get('score')).toBe(95);
    expect(vars.get('survey_score')).toBe(95);
    expect(vars.get('max_score')).toBe(100);
    expect(vars.get('outcome_label')).toBe('Excellent');
    expect(vars.get('result_url')).toBe('https://go.smartsapp.com/surveys/sat-survey/result/resp-123');
    expect(vars.get('survey_results_link')).toBe('https://go.smartsapp.com/surveys/sat-survey/result/resp-123');
    expect(vars.get('q1')).toBe('Highly Satisfied');
  });

  it('resolves results variables by querying entityId when responseId is omitted', async () => {
    // 1. Workspace mock
    dbMocks().docRegistry.set('workspaces/ws-123', {
      exists: true,
      data: () => ({ name: 'Default Workspace', organizationId: 'org-123' }),
    });

    // 2. Survey mock
    dbMocks().docRegistry.set('surveys/survey-123', {
      exists: true,
      data: () => ({ title: 'Satisfaction Survey', slug: 'sat-survey', maxScore: 100 }),
    });

    // 3. Responses query mock
    const mockResponses = [
      {
        id: 'resp-latest',
        data: () => ({
          score: 88,
          maxScore: 100,
          outcome: 'Good',
          submittedAt: '2026-06-02T12:00:00Z',
          status: 'Completed',
          entityId: 'entity-123',
          answers: [{ questionId: 'q1', value: 'Satisfied' }]
        })
      }
    ];

    dbMocks().queryRegistry.set('surveys/survey-123/responses', {
      empty: false,
      docs: mockResponses,
    });

    const ctx = {
      workspaceId: 'ws-123',
      surveyId: 'survey-123',
      entityId: 'entity-123',
    };

    const vars = await FieldsVariablesService.getVariableValuesMap(ctx);

    expect(vars.get('score')).toBe(88);
    expect(vars.get('survey_score')).toBe(88);
    expect(vars.get('outcome_label')).toBe('Good');
    expect(vars.get('result_url')).toBe('https://go.smartsapp.com/surveys/sat-survey/result/resp-latest');
  });

  it('falls back to in-memory sort if compound query fails due to missing index', async () => {
    // 1. Workspace mock
    dbMocks().docRegistry.set('workspaces/ws-123', {
      exists: true,
      data: () => ({ name: 'Default Workspace', organizationId: 'org-123' }),
    });

    // 2. Survey mock
    dbMocks().docRegistry.set('surveys/survey-123', {
      exists: true,
      data: () => ({ title: 'Satisfaction Survey', slug: 'sat-survey', maxScore: 100 }),
    });

    // Mock query get to fail the first time (compound query) and succeed the second time (fallback query)
    const mockResponses = [
      {
        id: 'resp-old',
        data: () => ({
          score: 70,
          submittedAt: '2026-06-01T12:00:00Z',
          entityId: 'entity-123',
        })
      },
      {
        id: 'resp-newest',
        data: () => ({
          score: 92,
          submittedAt: '2026-06-03T12:00:00Z',
          entityId: 'entity-123',
        })
      }
    ];

    let callCount = 0;
    dbMocks().queryRegistry.set('surveys/survey-123/responses', () => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Query requires compound index'));
      }
      return Promise.resolve({
        empty: false,
        docs: mockResponses,
      });
    });

    const ctx = {
      workspaceId: 'ws-123',
      surveyId: 'survey-123',
      entityId: 'entity-123',
    };

    const vars = await FieldsVariablesService.getVariableValuesMap(ctx);

    expect(vars.get('score')).toBe(92);
    expect(vars.get('survey_score')).toBe(92);
    expect(vars.get('result_url')).toBe('https://go.smartsapp.com/surveys/sat-survey/result/resp-newest');
  });

  it('falls back to public survey link when no response exists', async () => {
    // 1. Workspace mock
    dbMocks().docRegistry.set('workspaces/ws-123', {
      exists: true,
      data: () => ({ name: 'Default Workspace', organizationId: 'org-123' }),
    });

    // 2. Survey mock
    dbMocks().docRegistry.set('surveys/survey-123', {
      exists: true,
      data: () => ({ title: 'Satisfaction Survey', slug: 'sat-survey', publicUrl: 'https://public.smartsapp.com/sat-survey', maxScore: 100 }),
    });

    // Mock query responses to return empty
    dbMocks().queryRegistry.set('surveys/survey-123/responses', {
      empty: true,
      docs: [],
    });

    const ctx = {
      workspaceId: 'ws-123',
      surveyId: 'survey-123',
      entityId: 'entity-123',
    };

    const vars = await FieldsVariablesService.getVariableValuesMap(ctx);

    expect(vars.get('result_url')).toBe('https://public.smartsapp.com/sat-survey');
    expect(vars.get('survey_results_link')).toBe('https://public.smartsapp.com/sat-survey');
    expect(vars.get('score')).toBe(0);
    expect(vars.get('completion_status')).toBe('Pending');
  });

  it('correctly resolves respondent_name and survey_results_link when using submissionId instead of responseId', async () => {
    // 1. Workspace mock
    dbMocks().docRegistry.set('workspaces/ws-123', {
      exists: true,
      data: () => ({ name: 'Default Workspace', organizationId: 'org-123' }),
    });

    // 2. Survey mock
    dbMocks().docRegistry.set('surveys/survey-123', {
      exists: true,
      data: () => ({ title: 'Satisfaction Survey', slug: 'sat-survey', maxScore: 100 }),
    });

    // 3. Response mock
    dbMocks().docRegistry.set('surveys/survey-123/responses/resp-999', {
      exists: true,
      data: () => ({
        respondentName: 'Test Respondent',
        submittedAt: '2026-07-15T00:00:00Z',
        score: 85,
        maxScore: 100,
        status: 'Completed',
        answers: [],
      }),
    });

    const ctx = {
      workspaceId: 'ws-123',
      surveyId: 'survey-123',
      submissionId: 'resp-999',
    };

    const vars = await FieldsVariablesService.getVariableValuesMap(ctx);

    expect(vars.get('respondent_name')).toBe('Test Respondent');
    expect(vars.get('survey_results_link')).toContain('/surveys/sat-survey/result/resp-999');
    expect(vars.get('score')).toBe(85);
  });
});
