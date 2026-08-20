import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  parseAndDistributeSurveyMappings, 
  extractFileNameFromStorageUrl,
  syncSurveyUploadedFilesToMedia
} from '../survey-actions';

// Mock Firebase Admin
const mockMediaAdd = vi.fn();
const mockMediaWhere = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'media') {
        return {
          where: mockMediaWhere,
          add: mockMediaAdd,
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      };
    }),
  },
}));

describe('Survey File Upload & Target Field Mapping Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMediaWhere.mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    });
  });

  describe('extractFileNameFromStorageUrl', () => {
    it('extracts clean filename without timestamp prefix from Firebase Storage URL', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/survey-uploads%2Fsurv_123%2F1723456789-Staff_Data_2026.xlsx?alt=media&token=abc';
      expect(extractFileNameFromStorageUrl(url)).toBe('Staff_Data_2026.xlsx');
    });

    it('extracts clean filename when no timestamp delimiter is present', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/survey-uploads%2Fsurv_123%2FStudents_List.csv?alt=media';
      expect(extractFileNameFromStorageUrl(url)).toBe('Students_List.csv');
    });

    it('falls back gracefully on invalid URL', () => {
      expect(extractFileNameFromStorageUrl('not-a-url')).toBe('uploaded-file');
    });
  });

  describe('parseAndDistributeSurveyMappings', () => {
    it('correctly maps Online Presence fields (Website, Facebook, Instagram, etc.)', () => {
      const mappings = [
        { questionId: 'q_web', targetField: 'Website' },
        { questionId: 'q_fb', targetField: 'Facebook' },
        { questionId: 'q_ig', targetField: 'onlinePresence.instagram' },
        { questionId: 'q_addr', targetField: 'Digital Address' },
      ];

      const answers = [
        { questionId: 'q_web', value: 'https://myschool.edu.gh' },
        { questionId: 'q_fb', value: 'https://facebook.com/myschool' },
        { questionId: 'q_ig', value: '@myschool_gh' },
        { questionId: 'q_addr', value: 'GA-123-4567' },
      ];

      const result = parseAndDistributeSurveyMappings(mappings, answers, 'SchoolEnrollment');

      expect(result.mappedOnlinePresence.website).toBe('https://myschool.edu.gh');
      expect(result.mappedOnlinePresence.facebook).toBe('https://facebook.com/myschool');
      expect(result.mappedOnlinePresence.instagram).toBe('@myschool_gh');
      expect(result.mappedOnlinePresence.digitalAddress).toBe('GA-123-4567');
      expect(result.mappedLocation.locationString).toBe('GA-123-4567');
    });

    it('safely routes dynamic non-schema institutionData fields (staff_data, parent_and_student_data) to customData', () => {
      const mappings = [
        { questionId: 'q_staff', targetField: 'institutionData.staff_data' },
        { questionId: 'q_parents', targetField: 'institutionData.parent_and_student_data' },
        { questionId: 'q_year', targetField: 'institutionData.academicYear' },
        { questionId: 'q_cap', targetField: 'institutionData.capacity' },
      ];

      const answers = [
        { questionId: 'q_staff', value: 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fstaff.xlsx' },
        { questionId: 'q_parents', value: 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fparents.pdf' },
        { questionId: 'q_year', value: '2026/2027' },
        { questionId: 'q_cap', value: '500' },
      ];

      const result = parseAndDistributeSurveyMappings(mappings, answers, 'SchoolEnrollment');

      // Schema fields are placed in mappedInstitutionData
      expect(result.mappedInstitutionData.academicYear).toBe('2026/2027');
      expect(result.mappedInstitutionData.capacity).toBe(500);

      // Custom file fields are preserved in customData to prevent schema stripping
      expect(result.mappedCustomData.staff_data).toBe('https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fstaff.xlsx');
      expect(result.mappedCustomData.parent_and_student_data).toBe('https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fparents.pdf');
    });

    it('routes explicit customData mappings cleanly to customData', () => {
      const mappings = [
        { questionId: 'q_custom', targetField: 'customData.preferred_schedule' },
      ];

      const answers = [
        { questionId: 'q_custom', value: 'Morning Shift' },
      ];

      const result = parseAndDistributeSurveyMappings(mappings, answers, 'SchoolEnrollment');
      expect(result.mappedCustomData.preferred_schedule).toBe('Morning Shift');
    });

    it('extracts entity identity and contact overrides', () => {
      const mappings = [
        { questionId: 'q_name', targetField: 'entity.name' },
        { questionId: 'q_cname', targetField: 'contacts.name' },
        { questionId: 'q_email', targetField: 'contacts.email' },
        { questionId: 'q_phone', targetField: 'contacts.phone' },
        { questionId: 'q_slogan', targetField: 'Slogan' },
      ];

      const answers = [
        { questionId: 'q_name', value: 'St. Peter International Academy' },
        { questionId: 'q_cname', value: 'Mr. David Mensah' },
        { questionId: 'q_email', value: 'david@stpeter.edu.gh' },
        { questionId: 'q_phone', value: '+233240000000' },
        { questionId: 'q_slogan', value: 'Excellence in Leadership' },
      ];

      const result = parseAndDistributeSurveyMappings(mappings, answers, 'SchoolEnrollment');
      expect(result.overriddenEntityName).toBe('St. Peter International Academy');
      expect(result.overriddenContactName).toBe('Mr. David Mensah');
      expect(result.overriddenContactEmail).toBe('david@stpeter.edu.gh');
      expect(result.overriddenContactPhone).toBe('+233240000000');
      expect(result.slogan).toBe('Excellence in Leadership');
    });
  });

  describe('syncSurveyUploadedFilesToMedia', () => {
    it('registers uploaded files into the workspace media collection with document category', async () => {
      const answers = [
        { questionId: 'q_text', value: 'Some normal text answer' },
        { 
          questionId: 'q_staff', 
          value: 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fsurv_1%2F1723456789-Staff_Schedule.xlsx?alt=media' 
        },
        { 
          questionId: 'q_pdf', 
          value: 'https://firebasestorage.googleapis.com/v0/b/app/o/survey-uploads%2Fsurv_1%2F1723456789-School_Prospectus.pdf?alt=media' 
        },
      ];

      const registered = await syncSurveyUploadedFilesToMedia(
        'ws_test_123',
        answers,
        'Schools Setup Data',
        'entity_456'
      );

      expect(registered).toHaveLength(2);
      expect(mockMediaAdd).toHaveBeenCalledTimes(2);

      // Verify Excel file media record
      expect(mockMediaAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Staff_Schedule.xlsx',
          category: 'documents',
          type: 'document',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          workspaceIds: ['ws_test_123'],
          relatedEntityId: 'entity_456',
          uploadedBy: 'survey-submission',
        })
      );

      // Verify PDF file media record
      expect(mockMediaAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'School_Prospectus.pdf',
          category: 'documents',
          type: 'document',
          mimeType: 'application/pdf',
          workspaceIds: ['ws_test_123'],
          relatedEntityId: 'entity_456',
          uploadedBy: 'survey-submission',
        })
      );
    });
  });
});
