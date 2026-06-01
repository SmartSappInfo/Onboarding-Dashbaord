// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock firebase-admin with chainable/fluent interface
vi.mock('../firebase-admin', () => {
  const queryMock = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn(),
  };

  // Fluent chaining
  queryMock.where.mockReturnValue(queryMock);
  queryMock.orderBy.mockReturnValue(queryMock);
  queryMock.limit.mockReturnValue(queryMock);

  const docMock = {
    get: vi.fn(),
    collection: vi.fn(),
    update: vi.fn(),
  };
  docMock.collection.mockReturnValue(queryMock);

  queryMock.doc = vi.fn().mockReturnValue(docMock);

  const collectionMock = vi.fn().mockReturnValue(queryMock);

  return {
    adminDb: {
      collection: collectionMock,
    },
    __mocks: {
      query: queryMock,
      doc: docMock,
      collection: collectionMock,
    },
  };
});

// 2. Mock contact-adapter resolveContact
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

// 3. Mock url-helpers getBaseUrl
vi.mock('../utils/url-helpers', () => ({
  getBaseUrl: vi.fn(() => 'https://go.smartsapp.com'),
}));

import { getSimulationVariablesAction } from '../messaging-actions';
import { resolveContact } from '../contact-adapter';
import * as firebaseAdmin from '../firebase-admin';

// Helper to access firebase mocks
const dbMocks = () => (firebaseAdmin as any).__mocks;

describe('getSimulationVariablesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire chains
    dbMocks().query.where.mockReturnValue(dbMocks().query);
    dbMocks().query.orderBy.mockReturnValue(dbMocks().query);
    dbMocks().query.limit.mockReturnValue(dbMocks().query);
    dbMocks().query.doc.mockReturnValue(dbMocks().doc);
    dbMocks().doc.collection.mockReturnValue(dbMocks().query);
    dbMocks().collection.mockReturnValue(dbMocks().query);
  });

  it('resolves system constants by default', async () => {
    // Mock workspace & org doc lookup to return empty/missing
    dbMocks().doc.get.mockResolvedValue({ exists: false, data: () => ({}) });
    // Mock app_fields snapshot
    dbMocks().query.get.mockResolvedValue({
      empty: true,
      docs: [],
      forEach: (cb) => {},
    });

    const res = await getSimulationVariablesAction({ workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables).toHaveProperty('current_date');
    expect(res.variables).toHaveProperty('current_time');
    expect(res.variables).toHaveProperty('current_year');
    expect(res.variables.unsubscribe_link).toBe('https://go.smartsapp.com/unsubscribe/sample');
  });

  it('resolves organization branding details when workspace and organization exist', async () => {
    // Mock workspaces doc get and organization doc get
    dbMocks().doc.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'Test Workspace', organizationId: 'org-123' })
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: 'Acme Corp',
          logoUrl: 'https://acme.org/logo.png',
          email: 'info@acme.org',
          phone: '+123456',
          address: '123 Acme St',
          website: 'https://acme.org',
          settings: { defaultTimezone: 'Africa/Accra' }
        })
      });

    // Mock app_fields snapshot
    dbMocks().query.get.mockResolvedValue({
      empty: true,
      docs: [],
      forEach: (cb) => {},
    });

    const res = await getSimulationVariablesAction({ workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.workspace_name).toBe('Test Workspace');
    expect(res.variables.org_name).toBe('Acme Corp');
    expect(res.variables.org_logo_url).toBe('https://acme.org/logo.png');
    expect(res.variables.org_email).toBe('info@acme.org');
    expect(res.variables.org_phone).toBe('+123456');
    expect(res.variables.org_address).toBe('123 Acme St');
    expect(res.variables.org_website).toBe('https://acme.org');
    expect(res.variables.meeting_timezone).toBe('Africa/Accra');
  });

  it('loads and maps workspace custom fields (app_fields) defaults', async () => {
    dbMocks().doc.get.mockResolvedValue({ exists: false, data: () => ({}) });

    // Mock active workspace custom fields snapshot
    const mockFields = [
      { id: 'f1', variableName: 'grade_level', defaultValue: 'Grade 5' },
      { id: 'f2', variableName: 'enrollment_date', defaultValue: '2026-09-01' }
    ];
    dbMocks().query.get.mockResolvedValue({
      empty: false,
      docs: mockFields.map(f => ({ id: f.id, data: () => f })),
      forEach: (callback: any) => mockFields.forEach(f => callback({ id: f.id, data: () => f }))
    });

    const res = await getSimulationVariablesAction({ workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.grade_level).toBe('Grade 5');
    expect(res.variables.enrollment_date).toBe('2026-09-01');
  });

  it('resolves entity contact variables when entityId is provided', async () => {
    dbMocks().doc.get.mockResolvedValue({ exists: false, data: () => ({}) });
    dbMocks().query.get.mockResolvedValue({
      empty: true,
      docs: [],
      forEach: () => {},
    });

    // Mock contact-adapter resolveContact
    resolveContact.mockResolvedValue({
      id: 'entity-1',
      name: 'Central Academy',
      initials: 'CA',
      referee: 'Mr. John',
      locationString: 'Accra, Ghana',
      zoneName: 'South Zone',
      entityContacts: [
        { name: 'Alice Smith', email: 'alice@central.edu', phone: '020111222', isPrimary: true, typeLabel: 'Administrator' }
      ],
      customData: {
        admission_fee: '$500'
      }
    });

    const res = await getSimulationVariablesAction({ entityId: 'entity-1', workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.school_name).toBe('Central Academy');
    expect(res.variables.entity_name).toBe('Central Academy');
    expect(res.variables.id).toBe('entity-1');
    expect(res.variables.initials).toBe('CA');
    expect(res.variables.referee).toBe('Mr. John');
    expect(res.variables.location_string).toBe('Accra, Ghana');
    expect(res.variables.zone_name).toBe('South Zone');
    expect(res.variables.contact_name).toBe('Alice Smith');
    expect(res.variables.contact_email).toBe('alice@central.edu');
    expect(res.variables.contact_phone).toBe('020111222');
    expect(res.variables.admission_fee).toBe('$500');
  });

  it('resolves meeting variables when meetingId is provided', async () => {
    // 1st doc get is for workspace info
    dbMocks().doc.get.mockResolvedValueOnce({ exists: false, data: () => ({}) });

    // 2nd doc get is for meeting
    dbMocks().doc.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'mtg-123',
        heroTitle: 'Enrollment Interview',
        meetingTime: '2026-06-15T10:00:00Z',
        meetingLink: 'https://zoom.us/j/123456',
        facilitators: [
          { name: 'Sarah Connor', email: 'sarah@smartsapp.com' }
        ]
      })
    });

    dbMocks().query.get.mockResolvedValue({
      empty: true,
      docs: [],
      forEach: () => {},
    });

    const res = await getSimulationVariablesAction({ meetingId: 'mtg-123', workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.meeting_title).toBe('Enrollment Interview');
    expect(res.variables.meeting_link).toBe('https://zoom.us/j/123456');
    expect(res.variables.facilitator_name).toBe('Sarah Connor');
    expect(res.variables.facilitator_email).toBe('sarah@smartsapp.com');
  });

  it('resolves survey variables when surveyId is provided', async () => {
    dbMocks().doc.get.mockResolvedValue({ exists: false, data: () => ({}) }); // Workspace lookup

    // Mock survey responses query (get latest response)
    const mockResponse = {
      score: 85,
      maxScore: 100,
      outcome: 'Eligible',
      submittedAt: '2026-05-24T18:00:00Z',
      answers: [
        { questionId: 'q_parent_name', value: 'Donald Duck' },
        { questionId: 'q_num_students', value: 2 }
      ]
    };
    dbMocks().query.get.mockResolvedValue({
      empty: false,
      docs: [{ data: () => mockResponse }],
      forEach: (cb) => {}
    });

    const res = await getSimulationVariablesAction({ surveyId: 'survey-123', workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.survey_score).toBe(85);
    expect(res.variables.max_score).toBe(100);
    expect(res.variables.outcome_label).toBe('Eligible');
    expect(res.variables.q_parent_name).toBe('Donald Duck');
    expect(res.variables.q_num_students).toBe('2');
  });

  it('resolves pdf submission variables when pdfId is provided', async () => {
    dbMocks().doc.get.mockResolvedValue({ exists: false, data: () => ({}) }); // Workspace lookup

    // Mock pdf submissions query (get latest submission)
    const mockSubmission = {
      submittedAt: '2026-05-24T18:00:00Z',
      formData: {
        billing_name: 'Mickey Mouse',
        vat_number: 'VAT-456'
      }
    };
    dbMocks().query.get.mockResolvedValue({
      empty: false,
      docs: [{ data: () => mockSubmission }],
      forEach: (cb) => {}
    });

    const res = await getSimulationVariablesAction({ pdfId: 'pdf-123', workspaceId: 'onboarding' });
    expect(res.success).toBe(true);
    expect(res.variables.billing_name).toBe('Mickey Mouse');
    expect(res.variables.vat_number).toBe('VAT-456');
  });
});
