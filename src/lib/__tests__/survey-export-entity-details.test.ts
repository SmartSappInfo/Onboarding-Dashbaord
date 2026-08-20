import { describe, it, expect, vi } from 'vitest';
import {
  extractResponseContactDetails,
  sanitizeForCsv,
} from '../survey-actions';
import { resolveMultipleContacts } from '../contact-adapter';
import type { SurveyResponse, ResolvedContact } from '../types';

// Mock Firebase Admin for resolveMultipleContacts / resolveContact
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (collName: string) => {
        if (collName === 'entities') {
          return {
            doc: (docId: string) => ({
              get: async () => {
                if (docId === 'entity_123') {
                  return {
                    exists: true,
                    id: 'entity_123',
                    data: () => ({
                      name: 'St. Peter International Academy',
                      entityContacts: [
                        {
                          id: 'c1',
                          name: 'Dr. Mensah Arthur',
                          email: 'principal@stpeter.edu',
                          phone: '+233241234567',
                          isPrimary: true,
                          typeLabel: 'Principal',
                        },
                      ],
                      primaryContactName: 'Dr. Mensah Arthur',
                      primaryContactEmail: 'principal@stpeter.edu',
                      primaryContactPhone: '+233241234567',
                      locationString: 'Airport Residential Area, Accra',
                      zoneName: 'Greater Accra Zone 1',
                      entityType: 'institution',
                    }),
                  };
                }
                if (docId === 'entity_456') {
                  return {
                    exists: true,
                    id: 'entity_456',
                    data: () => ({
                      name: 'Sunrise Montessori School',
                      entityContacts: [
                        {
                          id: 'c2',
                          name: 'Sarah Jenkins',
                          email: 's.jenkins@sunrisemontessori.org',
                          phone: '+233209876543',
                          isPrimary: true,
                        },
                      ],
                      primaryContactName: 'Sarah Jenkins',
                      primaryContactEmail: 's.jenkins@sunrisemontessori.org',
                      primaryContactPhone: '+233209876543',
                      entityType: 'institution',
                    }),
                  };
                }
                return { exists: false, id: docId, data: () => ({}) };
              },
            }),
          };
        }
        if (collName === 'workspace_entities') {
          return {
            where: () => ({
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: false,
                    docs: [{ id: 'we_1', data: () => ({ stageName: 'Prospect' }) }],
                  }),
                }),
              }),
            }),
          };
        }
        return {
          doc: () => ({ get: async () => ({ exists: false }) }),
        };
      },
    },
  };
});

describe('Survey Entity & Contact Export / Resolution', () => {
  describe('sanitizeForCsv (OWASP CSV Formula Injection Protection)', () => {
    it('leaves standard text, names, and emails unchanged', () => {
      expect(sanitizeForCsv('St. Peter International')).toBe('St. Peter International');
      expect(sanitizeForCsv('principal@stpeter.edu')).toBe('principal@stpeter.edu');
      expect(sanitizeForCsv('+233241234567')).toBe("'+233241234567"); // + is sanitized to prevent formula execution
      expect(sanitizeForCsv('John Doe')).toBe('John Doe');
    });

    it('prepends single quote to cells starting with formula trigger characters', () => {
      expect(sanitizeForCsv('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeForCsv('=cmd|’ /C calc’!A0')).toBe("'=cmd|’ /C calc’!A0");
      expect(sanitizeForCsv('-2+3+cmd|')).toBe("'-2+3+cmd|");
      expect(sanitizeForCsv('@calc')).toBe("'@calc");
      expect(sanitizeForCsv('\tmalicious_tab')).toBe("'\tmalicious_tab");
      expect(sanitizeForCsv('\rmalicious_cr')).toBe("'\rmalicious_cr");
      expect(sanitizeForCsv('\nmalicious_nl')).toBe("'\nmalicious_nl");
    });

    it('handles null, undefined, numbers, and booleans safely', () => {
      expect(sanitizeForCsv(null)).toBe('');
      expect(sanitizeForCsv(undefined)).toBe('');
      expect(sanitizeForCsv('')).toBe('');
      expect(sanitizeForCsv(42)).toBe('42');
      expect(sanitizeForCsv(-5)).toBe("'-5");
      expect(sanitizeForCsv(true)).toBe('true');
    });
  });

  describe('extractResponseContactDetails', () => {
    it('resolves primary contact fields directly from CRM ResolvedContact when present', () => {
      const mockResponse: SurveyResponse = {
        id: 'resp_1',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [],
        entityId: 'entity_123',
        entityName: 'Old Cached Name',
      };

      const mockContact: ResolvedContact = {
        id: 'entity_123',
        name: 'St. Peter International Academy',
        entityContacts: [
          {
            id: 'c1',
            name: 'Dr. Mensah Arthur',
            email: 'principal@stpeter.edu',
            phone: '+233241234567',
            isPrimary: true,
            typeLabel: 'Principal',
            typeKey: 'principal',
            isSignatory: true,
            order: 0,
          },
        ],
        primaryContactName: 'Dr. Mensah Arthur',
        primaryContactEmail: 'principal@stpeter.edu',
        primaryContactPhone: '+233241234567',
        locationString: 'Accra',
        zoneName: 'Zone 1',
        migrationStatus: 'migrated',
      };

      const details = extractResponseContactDetails(mockResponse, mockContact);

      expect(details.entityName).toBe('St. Peter International Academy');
      expect(details.primaryContactName).toBe('Dr. Mensah Arthur');
      expect(details.primaryContactEmail).toBe('principal@stpeter.edu');
      expect(details.primaryContactPhone).toBe('+233241234567');
      expect(details.roleOrTitle).toBe('Principal');
      expect(details.locationString).toBe('Accra');
      expect(details.zoneName).toBe('Zone 1');
      expect(details.isLiveCrm).toBe(true);
      expect(details.entityId).toBe('entity_123');
    });

    it('falls back to top-level snapshot fields if contact is not loaded', () => {
      const mockResponse: SurveyResponse = {
        id: 'resp_2',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [],
        entityName: 'Snapshot School Name',
        respondentName: 'Jane Smith',
        contactEmail: 'jane@example.com',
      };

      const details = extractResponseContactDetails(mockResponse, null);

      expect(details.entityName).toBe('Snapshot School Name');
      expect(details.primaryContactName).toBe('Jane Smith');
      expect(details.primaryContactEmail).toBe('jane@example.com');
      expect(details.isLiveCrm).toBe(false);
      expect(details.entityId).toBeNull();
    });

    it('falls back to variables map if top-level fields are missing', () => {
      const mockResponse = {
        id: 'resp_3',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [],
        variables: {
          school_name: 'Variables Montessori',
          contact_name: 'Kwame Mensah',
          contact_email: 'kwame@montessori.edu',
          contact_phone: '0240001122',
          role: 'Head of Admissions',
        },
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null);

      expect(details.entityName).toBe('Variables Montessori');
      expect(details.primaryContactName).toBe('Kwame Mensah');
      expect(details.primaryContactEmail).toBe('kwame@montessori.edu');
      expect(details.primaryContactPhone).toBe('0240001122');
      expect(details.roleOrTitle).toBe('Head of Admissions');
    });

    it('falls back to leadDetails if top-level fields and contact are missing', () => {
      const mockResponse = {
        id: 'resp_lead_1',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [],
        leadDetails: {
          company: 'Faith Baptist Academy',
          name: 'Emmanuel Osei',
          email: 'emmanuel@faithbaptist.edu',
          phone: '+233244112233',
          role: 'Administrator',
        },
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null);

      expect(details.entityName).toBe('Faith Baptist Academy');
      expect(details.primaryContactName).toBe('Emmanuel Osei');
      expect(details.primaryContactEmail).toBe('emmanuel@faithbaptist.edu');
      expect(details.primaryContactPhone).toBe('+233244112233');
      expect(details.roleOrTitle).toBe('Administrator');
      expect(details.isLiveCrm).toBe(false);
    });

    it('falls back to scanning response.answers when questions match entity or contact keywords', () => {
      const mockResponse = {
        id: 'resp_unmapped_1',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [
          { questionId: 'q_school_name', value: 'Great Minds International' },
          { questionId: 'q_contact_person', value: 'Abena Mensah' },
          { questionId: 'q_contact_phone', value: '0201112233' },
          { questionId: 'q_contact_email', value: 'abena@greatminds.edu' },
        ],
      } as unknown as SurveyResponse;

      const mockQuestions = [
        { id: 'q_school_name', title: 'What is the name of your school / institution?', type: 'short-text' },
        { id: 'q_contact_person', title: 'Your Full Name / Contact Person', type: 'short-text' },
        { id: 'q_contact_phone', title: 'Phone Number', type: 'phone' },
        { id: 'q_contact_email', title: 'Email Address', type: 'email' },
      ];

      const details = extractResponseContactDetails(mockResponse, null, mockQuestions);

      expect(details.entityName).toBe('Great Minds International');
      expect(details.primaryContactName).toBe('Abena Mensah');
      expect(details.primaryContactPhone).toBe('0201112233');
      expect(details.primaryContactEmail).toBe('abena@greatminds.edu');
    });

    it('handles completely empty response records without error', () => {
      const emptyResponse = {
        id: 'resp_empty',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [],
      } as SurveyResponse;

      const details = extractResponseContactDetails(emptyResponse, null);

      expect(details.entityName).toBe('');
      expect(details.primaryContactName).toBe('');
      expect(details.primaryContactEmail).toBe('');
      expect(details.primaryContactPhone).toBe('');
      expect(details.isLiveCrm).toBe(false);
    });
  });

  describe('resolveMultipleContacts', () => {
    it('deduplicates entity IDs and resolves in parallel batches', async () => {
      const entityIds = ['entity_123', 'entity_456', 'entity_123', 'non_existent'];
      const map = await resolveMultipleContacts(entityIds, 'ws_test');

      expect(map['entity_123']).toBeDefined();
      expect(map['entity_123'].name).toBe('St. Peter International Academy');
      expect(map['entity_456']).toBeDefined();
      expect(map['entity_456'].name).toBe('Sunrise Montessori School');
      expect(map['non_existent']).toBeUndefined();
    });

    it('returns an empty object when entityIds array is empty', async () => {
      const map = await resolveMultipleContacts([], 'ws_test');
      expect(map).toEqual({});
    });
  });
});
