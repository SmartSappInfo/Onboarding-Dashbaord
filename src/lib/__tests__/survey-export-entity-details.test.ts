import { describe, it, expect, vi } from 'vitest';
import {
  extractResponseContactDetails,
  sanitizeForCsv,
  isGenericChoiceValue,
} from '../survey-response-utils';
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
  describe('isGenericChoiceValue (Generic Choice & Rating Protection)', () => {
    it('identifies choice words, boolean strings, and rating tokens as generic', () => {
      expect(isGenericChoiceValue('Yes')).toBe(true);
      expect(isGenericChoiceValue('yes')).toBe(true);
      expect(isGenericChoiceValue('No')).toBe(true);
      expect(isGenericChoiceValue('Later')).toBe(true);
      expect(isGenericChoiceValue('Agree')).toBe(true);
      expect(isGenericChoiceValue('Disagree')).toBe(true);
      expect(isGenericChoiceValue('Strongly Agree')).toBe(true);
      expect(isGenericChoiceValue('true')).toBe(true);
      expect(isGenericChoiceValue(true)).toBe(true);
      expect(isGenericChoiceValue('false')).toBe(true);
      expect(isGenericChoiceValue(false)).toBe(true);
      expect(isGenericChoiceValue('Option 1')).toBe(true);
      expect(isGenericChoiceValue('option 2')).toBe(true);
      expect(isGenericChoiceValue('N/A')).toBe(true);
      expect(isGenericChoiceValue('none')).toBe(true);
      expect(isGenericChoiceValue('other')).toBe(true);
      expect(isGenericChoiceValue('__other__')).toBe(true);
      expect(isGenericChoiceValue('5/5')).toBe(true);
      expect(isGenericChoiceValue('10')).toBe(true);
      expect(isGenericChoiceValue('A')).toBe(true);
      expect(isGenericChoiceValue(null)).toBe(true);
      expect(isGenericChoiceValue(undefined)).toBe(true);
      expect(isGenericChoiceValue('')).toBe(true);
    });

    it('allows genuine entity names, school names, and person names', () => {
      expect(isGenericChoiceValue('Tulips Hill Academy')).toBe(false);
      expect(isGenericChoiceValue('Palace Royal International')).toBe(false);
      expect(isGenericChoiceValue('Edlys Montessori School')).toBe(false);
      expect(isGenericChoiceValue('Champions College')).toBe(false);
      expect(isGenericChoiceValue('Crystal Heights International')).toBe(false);
      expect(isGenericChoiceValue('Yeshiva University')).toBe(false);
      expect(isGenericChoiceValue('Agree School of Arts')).toBe(false);
      expect(isGenericChoiceValue('Dr. Mensah Arthur')).toBe(false);
    });
  });

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
      expect(sanitizeForCsv('\rmalicious_cr')).toBe("\"'\rmalicious_cr\"");
      expect(sanitizeForCsv('\nmalicious_nl')).toBe("\"'\nmalicious_nl\"");
    });

    it('handles null, undefined, numbers, and booleans safely', () => {
      expect(sanitizeForCsv(null)).toBe('');
      expect(sanitizeForCsv(undefined)).toBe('');
      expect(sanitizeForCsv('')).toBe('');
      expect(sanitizeForCsv(42)).toBe('42');
      expect(sanitizeForCsv(-5)).toBe("'-5");
      expect(sanitizeForCsv(true)).toBe('true');
    });

    it('escapes quotes and wraps cells containing commas or quotes in RFC 4180 format', () => {
      expect(sanitizeForCsv('Acme, Inc.')).toBe('"Acme, Inc."');
      expect(sanitizeForCsv('He said "Hello"')).toBe('"He said ""Hello"""');
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

    it('rejects generic choice values like "Yes", "No", "Agree" from entityName and contact identifiers', () => {
      const mockCorruptedResponse = {
        id: 'resp_corrupted_1',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        entityName: 'Yes',
        respondentName: 'Option 1',
        contactPhone: 'No',
        contactEmail: 'undefined',
        variables: {
          entity_name: 'Yes',
          school_name: 'Agree',
          contact_name: 'True',
        },
        answers: [
          { questionId: 'q_ready_to_join', value: 'Yes' },
        ],
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockCorruptedResponse, null);

      expect(details.entityName).toBe('');
      expect(details.primaryContactName).toBe('');
      expect(details.primaryContactPhone).toBe('');
      expect(details.primaryContactEmail).toBe('');
      expect(details.isLiveCrm).toBe(false);
    });

    it('preserves valid entity names like "Yeshiva Academy" that contain choice words within a multi-word phrase', () => {
      const mockResponse = {
        id: 'resp_yeshiva',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        entityName: 'Yeshiva International School',
        respondentName: 'Rabbi Cohen',
        contactEmail: 'cohen@yeshiva.edu',
        contactPhone: '+1234567890',
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null);

      expect(details.entityName).toBe('Yeshiva International School');
      expect(details.primaryContactName).toBe('Rabbi Cohen');
      expect(details.primaryContactEmail).toBe('cohen@yeshiva.edu');
      expect(details.primaryContactPhone).toBe('+1234567890');
    });

    it('does NOT guess entity or contact names from unmapped question answers (Zero-Guessing Invariant)', () => {
      const mockUnmappedResponse = {
        id: 'resp_unmapped_choice',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [
          { questionId: 'q_ready_school_program', value: 'Yes' },
          { questionId: 'q_favorite_subject', value: 'Mathematics' },
        ],
      } as unknown as SurveyResponse;

      const mockQuestions = [
        { id: 'q_ready_school_program', title: 'Ready to Join the School Visibility Program?', type: 'single_choice' },
        { id: 'q_favorite_subject', title: 'What subject does your institution focus on?', type: 'short_text' },
      ];

      const details = extractResponseContactDetails(mockUnmappedResponse, null, mockQuestions);

      // Strict Zero-Guessing: unmapped answers are NEVER stored or extracted as entity names
      expect(details.entityName).toBe('');
      expect(details.primaryContactName).toBe('');
      expect(details.isLiveCrm).toBe(false);
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

    it('resolves contact person name, email, phone, role, and entity name from non-linked survey questions', () => {
      const mockQuestions = [
        { id: 'q_name', title: 'Your Full Name', type: 'text' },
        { id: 'q_phone', title: 'Phone Number', type: 'phone' },
        { id: 'q_email', title: 'Email Address', type: 'email' },
        { id: 'q_role', title: 'Your Role / Designation', type: 'text' },
        { id: 'q_org', title: 'School / Institution Name', type: 'text' },
      ];

      const mockResponse = {
        id: 'resp_unlinked_complete',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [
          { questionId: 'q_name', value: 'Kofi Mensah' },
          { questionId: 'q_phone', value: '+233241234567' },
          { questionId: 'q_email', value: 'kofi@example.edu.gh' },
          { questionId: 'q_role', value: 'Headmaster' },
          { questionId: 'q_org', value: 'Achimota Basic School' },
        ],
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null, mockQuestions);

      expect(details.entityName).toBe('Achimota Basic School');
      expect(details.primaryContactName).toBe('Kofi Mensah');
      expect(details.primaryContactPhone).toBe('+233241234567');
      expect(details.primaryContactEmail).toBe('kofi@example.edu.gh');
      expect(details.roleOrTitle).toBe('Headmaster');
      expect(details.isLiveCrm).toBe(false);
    });

    it('resolves details using surveyEntityMapping when question IDs are explicitly mapped', () => {
      const mockEntityMapping = {
        entityNameFieldId: 'custom_field_institution',
        contactNameFieldId: 'custom_field_rep',
        contactPhoneFieldId: 'custom_field_contact_num',
        contactEmailFieldId: 'custom_field_inbox',
        additionalMappings: [
          { questionId: 'custom_field_job', targetField: 'role' },
        ],
      };

      const mockResponse = {
        id: 'resp_mapped_fields',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [
          { questionId: 'custom_field_institution', value: 'Beacon International School' },
          { questionId: 'custom_field_rep', value: 'Mrs. Sarah Owusu' },
          { questionId: 'custom_field_contact_num', value: '+233209876543' },
          { questionId: 'custom_field_inbox', value: 'sarah.owusu@beacon.edu' },
          { questionId: 'custom_field_job', value: 'Academic Director' },
        ],
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null, [], mockEntityMapping);

      expect(details.entityName).toBe('Beacon International School');
      expect(details.primaryContactName).toBe('Mrs. Sarah Owusu');
      expect(details.primaryContactPhone).toBe('+233209876543');
      expect(details.primaryContactEmail).toBe('sarah.owusu@beacon.edu');
      expect(details.roleOrTitle).toBe('Academic Director');
      expect(details.isLiveCrm).toBe(false);
    });

    it('strictly rejects choice/dropdown questions titled "School" or "Company" from being extracted as entity names', () => {
      const mockQuestions = [
        { id: 'q_school_category', title: 'School Category', type: 'dropdown' },
        { id: 'q_institution_type', title: 'Institution Type', type: 'single_choice' },
        { id: 'q_agree', title: 'I agree to the School Terms', type: 'checkboxes' },
      ];

      const mockResponse = {
        id: 'resp_choice_collision',
        surveyId: 'survey_100',
        submittedAt: '2026-08-20T10:00:00Z',
        answers: [
          { questionId: 'q_school_category', value: 'Private' },
          { questionId: 'q_institution_type', value: 'Tertiary' },
          { questionId: 'q_agree', value: 'true' },
        ],
      } as unknown as SurveyResponse;

      const details = extractResponseContactDetails(mockResponse, null, mockQuestions);

      // Invariant: Choice/dropdown option values like "Private" or "Tertiary" must NEVER become entityName
      expect(details.entityName).toBe('');
      expect(details.primaryContactName).toBe('');
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
