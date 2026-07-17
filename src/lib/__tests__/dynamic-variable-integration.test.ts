// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Integration tests for Task 13: Dynamic Variable Integration
 * Tests the integration of dynamic variables with forms and surveys
 */

// ---------------------------------------------------------------------------
// Mock firebase-admin
// ---------------------------------------------------------------------------

vi.mock('../firebase-admin', () => {
  const get = vi.fn();
  const limit = vi.fn(() => ({ get }));
  const where = vi.fn();
  where.mockReturnValue({ where, limit, get });
  const docGet = vi.fn();
  const update = vi.fn();
  const add = vi.fn();
  const set = vi.fn();
  const commit = vi.fn();
  const batch = vi.fn(() => ({ set, commit }));
  
  // Create a proper subcollection mock
  const subCollection = vi.fn(() => ({
    doc: vi.fn(() => ({ get: docGet })),
    where,
    get,
  }));
  
  const doc = vi.fn(() => ({ 
    get: docGet, 
    update, 
    collection: subCollection 
  }));
  
  const collection = vi.fn(() => ({ where, doc, add, get }));

  return {
    adminDb: { collection, batch },
    __mocks: { get, limit, where, doc, docGet, update, add, set, commit, batch, collection, subCollection },
  };
});

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock activity-logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

import * as firebaseAdmin from '../firebase-admin';
import { buildVariableMap } from '../template-resolver';

// Helper to access mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocks = () => (firebaseAdmin as any).__mocks as {
  get: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  doc: ReturnType<typeof vi.fn>;
  docGet: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  collection: ReturnType<typeof vi.fn>;
  subCollection: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Tests for Task 13.3: buildVariableMap fetches dynamic variables
// ---------------------------------------------------------------------------

describe('Task 13.3: buildVariableMap with dynamic form variables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
  });

  it('fetches dynamic form variables from template_variables collection', async () => {
    const formId = 'form-123';
    
    // Mock form document
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: 'Enrollment Form',
        publicUrl: 'https://example.com/forms/enrollment',
      }),
    });

    // Mock dynamic variables query
    mocks().get.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'form_123_field1',
          data: () => ({
            name: 'form_fields.student_name',
            label: 'Student Name',
            context: 'form',
            isDynamic: true,
            sourceFormId: formId,
            sourceFieldId: 'field1',
          }),
        },
        {
          id: 'form_123_field2',
          data: () => ({
            name: 'form_fields.grade_level',
            label: 'Grade Level',
            context: 'form',
            isDynamic: true,
            sourceFormId: formId,
            sourceFieldId: 'field2',
          }),
        },
      ],
    });

    const vars = await buildVariableMap('form', { formId });

    // Verify dynamic variables are initialized
    expect(vars).toHaveProperty('form_fields.student_name');
    expect(vars).toHaveProperty('form_fields.grade_level');
    expect(vars['form_name']).toBe('Enrollment Form');
    expect(vars['form_link']).toBe('https://example.com/forms/enrollment');
  });

  it('populates dynamic form variables from submission data', async () => {
    const formId = 'form-123';
    const submissionId = 'sub-456';
    
    // Mock form document (first call)
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: 'Enrollment Form',
      }),
    });

    // Mock dynamic variables query
    mocks().get.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'form_123_field1',
          data: () => ({
            name: 'form_fields.field1',
            label: 'Student Name',
            context: 'form',
            isDynamic: true,
          }),
        },
      ],
    });

    // Mock submission document (second call to docGet)
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        respondentName: 'John Doe',
        submittedAt: '2025-01-15T10:00:00Z',
        fields: {
          field1: 'Alice Smith',
          field2: 'Grade 5',
        },
      }),
    });

    const vars = await buildVariableMap('form', { formId, submissionId });

    // Verify submission data populates the variables
    expect(vars['form_fields.field1']).toBe('Alice Smith');
    expect(vars['form_fields.field2']).toBe('Grade 5');
    expect(vars['respondent_name']).toBe('John Doe');
  });

  it('handles missing dynamic variables gracefully', async () => {
    const formId = 'form-123';
    
    // Mock form document
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        name: 'Test Form',
      }),
    });

    // Mock empty dynamic variables query
    mocks().get.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const vars = await buildVariableMap('form', { formId });

    // Should still have static form variables
    expect(vars['form_name']).toBe('Test Form');
    expect(vars).toHaveProperty('current_date');
  });
});

describe('Task 13.3: buildVariableMap with dynamic survey variables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
  });

  it('fetches dynamic survey variables from template_variables collection', async () => {
    const surveyId = 'survey-789';
    
    // Mock survey document
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        title: 'Satisfaction Survey',
        publicUrl: 'https://example.com/surveys/satisfaction',
      }),
    });

    // Mock dynamic variables query
    mocks().get.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'survey_789_q1',
          data: () => ({
            name: 'survey_fields.q1',
            label: 'Overall Satisfaction',
            context: 'survey',
            isDynamic: true,
            sourceFormId: surveyId,
            sourceFieldId: 'q1',
          }),
        },
        {
          id: 'survey_789_q2',
          data: () => ({
            name: 'survey_fields.q2',
            label: 'Recommendation Likelihood',
            context: 'survey',
            isDynamic: true,
            sourceFormId: surveyId,
            sourceFieldId: 'q2',
          }),
        },
      ],
    });

    const vars = await buildVariableMap('survey', { surveyId });

    // Verify dynamic variables are initialized
    expect(vars).toHaveProperty('survey_fields.q1');
    expect(vars).toHaveProperty('survey_fields.q2');
    expect(vars['survey_title']).toBe('Satisfaction Survey');
    expect(vars['survey_link']).toBe('https://example.com/surveys/satisfaction');
  });

  it('populates dynamic survey variables from response data', async () => {
    const surveyId = 'survey-789';
    const responseId = 'resp-101';
    
    // Mock survey document (first call)
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        title: 'Satisfaction Survey',
      }),
    });

    // Mock dynamic variables query
    mocks().get.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'survey_789_q1',
          data: () => ({
            name: 'survey_fields.q1',
            label: 'Overall Satisfaction',
            context: 'survey',
            isDynamic: true,
          }),
        },
      ],
    });

    // Mock response document (second call to docGet)
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        score: 85,
        resultMessage: 'Excellent!',
        submittedAt: '2025-01-15T10:00:00Z',
        status: 'completed',
        answers: {
          q1: 'Very Satisfied',
          q2: '9/10',
        },
      }),
    });

    const vars = await buildVariableMap('survey', { surveyId, responseId });

    // Verify response data populates the variables
    expect(vars['survey_fields.q1']).toBe('Very Satisfied');
    expect(vars['survey_fields.q2']).toBe('9/10');
    expect(vars['score']).toBe(85);
    expect(vars['result_message']).toBe('Excellent!');
  });

  it('handles query errors gracefully without blocking', async () => {
    const surveyId = 'survey-789';
    
    // Mock survey document
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        title: 'Test Survey',
      }),
    });

    // Mock query error
    mocks().get.mockRejectedValueOnce(new Error('Firestore query failed'));

    // Should not throw, should continue with static variables
    const vars = await buildVariableMap('survey', { surveyId });

    expect(vars['survey_title']).toBe('Test Survey');
    expect(vars).toHaveProperty('current_date');
  });
});

describe('respondent_name global fallback resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks().where.mockReturnValue({ where: mocks().where, limit: mocks().limit, get: mocks().get });
  });

  it('resolves respondent_name to contact_name as first fallback', async () => {
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'entity-123',
        name: 'Test Entity Name',
        entityContacts: [
          { id: 'contact-abc', name: 'John Doe', email: 'john@example.com', isPrimary: true }
        ]
      })
    });

    const vars = await buildVariableMap('general', { 
      entityId: 'entity-123', 
      recipientContact: 'john@example.com' 
    });

    expect(vars['respondent_name']).toBe('John Doe');
  });

  it('resolves respondent_name to entity_name if contact name is missing', async () => {
    mocks().docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'entity-123',
        name: 'Test Entity Name',
        entityContacts: []
      })
    });

    const vars = await buildVariableMap('general', { entityId: 'entity-123' });

    expect(vars['respondent_name']).toBe('Test Entity Name');
  });

  it('resolves respondent_name to "there" if both contact and entity names are missing', async () => {
    mocks().docGet.mockResolvedValueOnce({ exists: false });

    const vars = await buildVariableMap('general', {});

    expect(vars['respondent_name']).toBe('there');
  });
});
