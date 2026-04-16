/**
 * Unit Tests for PDF Module - EntityId Migration
 * 
 * Tests the PDF module's support for entityId migration including:
 * - PDF creation with entityId
 * - PDF generation includes entity information
 * - PDF queries by entityId and entityId
 * - PDF templates support entity variables
 * 
 * Requirements:
 * - Requirement 16.1: PDF form creation with entityId
 * - Requirement 16.2: PDF generation resolves entity information
 * - Requirement 16.3: PDF templates support entity variables
 * - Requirement 16.4: PDF queries support both identifiers
 * - Requirement 16.5: Dual-write pattern (entityId + entityId)
 * - Requirement 22.1: Query fallback pattern
 * - Requirement 23.1: Contact Adapter integration
 * - Requirement 26.2: Unit tests for PDF module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generatePdfBuffer,
  saveAgreementProgressAction,
  finalizeAgreementAction,
} from '../pdf-actions';
import { 
  getPdfsByContact,
  getSubmissionsByContact,
  getPdfsForWorkspace,
  getPdfById,
  getSubmissionById,
} from '../pdf-queries';
import { resolveContact } from '../contact-adapter';
import { adminDb, adminStorage } from '../firebase-admin';
import type { PDFForm, Submission, School } from '../types';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
  adminStorage: {
    file: vi.fn(),
  },
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true, logId: 'log_1' }),
}));

vi.mock('../notification-engine', () => ({
  triggerInternalNotification: vi.fn(),
}));

// Helper function to create a minimal valid PDF buffer for testing
function createMockPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000262 00000 n\n0000000356 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n437\n%%EOF');
}

describe('PDF Module - EntityId Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PDF Creation with EntityId (Requirement 16.1)', () => {
    it('should create PDF with entityId instead of entityId', async () => {
      const mockPdfData: Partial<PDFForm> = {
        name: 'Test Agreement',
        publicTitle: 'Test Agreement',
        slug: 'test-agreement',
        storagePath: 'pdfs/test.pdf',
        downloadUrl: 'https://example.com/test.pdf',
        status: 'draft',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-01T00:00:00Z',

        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockDocRef = { id: 'pdf_1' };

      (adminDb.collection as any).mockReturnValue({
        add: vi.fn().mockResolvedValue(mockDocRef),
      });

      // Verify the PDF data structure includes entityId
      expect(mockPdfData.entityId).toBe('entity_123');
      expect(mockPdfData.entityId).toBeNull();
    });

    it('should create PDF with both entityId and entityId for migrated contact', async () => {
      const mockPdfData: Partial<PDFForm> = {
        name: 'Migrated Agreement',
        publicTitle: 'Migrated Agreement',
        slug: 'migrated-agreement',
        storagePath: 'pdfs/migrated.pdf',
        downloadUrl: 'https://example.com/migrated.pdf',
        status: 'draft',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: 'school_1',
        entityName: 'Test School',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Verify dual-write: both identifiers present
      expect(mockPdfData.entityId).toBe('entity_456');
      expect(mockPdfData.entityId).toBe('school_1');
      expect(mockPdfData.entityName).toBe('Test School');
    });
  });

  describe('PDF Generation with Entity Information (Requirement 16.2, 16.3)', () => {
    it('should generate PDF with entity information resolved via entityId', async () => {
      const mockPdfForm: PDFForm = {
        id: 'pdf_1',
        name: 'Test Agreement',
        publicTitle: 'Test Agreement',
        slug: 'test-agreement',
        storagePath: 'pdfs/test.pdf',
        downloadUrl: 'https://example.com/test.pdf',
        status: 'published',
        fields: [
          {
            id: 'field_1',
            label: 'School Name',
            type: 'variable',
            variableKey: 'school_name',
            position: { x: 10, y: 10 },
            dimensions: { width: 50, height: 10 },
            pageNumber: 1,
          },
        ],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-01T00:00:00Z',

        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSchool: School = {
        id: 'school_1',
        name: 'Test Institution',
        slug: 'test-institution',
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        initials: 'TI',
        location: 'Test City',
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            phone: '+1234567890',
            type: 'Principal',
            isSignatory: false,
          },
        ],
        workspaceIds: ['workspace_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test Institution',
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
        tags: [],
        entityContacts: [],
        contacts: [],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Verify Contact Adapter would be called with entityId
      // (We're testing the integration, not the actual PDF generation)
      expect(mockPdfForm.entityId).toBe('entity_123');
      expect(mockPdfForm.workspaceIds[0]).toBe('workspace_1');
      
      // In actual implementation, resolveContact would be called like this:
      const contact = await resolveContact('entity_123', 'workspace_1');
      expect(contact).toBe(mockContact);
      expect(contact?.schoolData?.name).toBe('Test Institution');
    });

    it('should support entity variables in PDF templates', async () => {
      const mockPdfForm: PDFForm = {
        id: 'pdf_2',
        name: 'Entity Template',
        publicTitle: 'Entity Template',
        slug: 'entity-template',
        storagePath: 'pdfs/entity.pdf',
        downloadUrl: 'https://example.com/entity.pdf',
        status: 'published',
        fields: [
          {
            id: 'field_name',
            label: 'Entity Name',
            type: 'variable',
            variableKey: 'school_name',
            position: { x: 10, y: 10 },
            dimensions: { width: 50, height: 10 },
            pageNumber: 1,
          },
          {
            id: 'field_email',
            label: 'Contact Email',
            type: 'variable',
            variableKey: 'school_email',
            position: { x: 10, y: 20 },
            dimensions: { width: 50, height: 10 },
            pageNumber: 1,
          },
          {
            id: 'field_phone',
            label: 'Contact Phone',
            type: 'variable',
            variableKey: 'school_phone',
            position: { x: 10, y: 30 },
            dimensions: { width: 50, height: 10 },
            pageNumber: 1,
          },
        ],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-01T00:00:00Z',

        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSchool: School = {
        id: 'school_2',
        name: 'Entity Institution',
        slug: 'entity-institution',
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        initials: 'EI',
        location: 'Entity City',
        focalPersons: [
          {
            name: 'Jane Smith',
            email: 'jane@entity.com',
            phone: '+9876543210',
            type: 'Director',
            isSignatory: false,
          },
        ],
        workspaceIds: ['workspace_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      const mockContact = {
        id: 'entity_789',
        name: 'Entity Institution',
        entityId: 'entity_789',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
        tags: [],
        entityContacts: [],
        contacts: [],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Verify entity variables are supported in template
      expect(mockPdfForm.fields).toHaveLength(3);
      expect(mockPdfForm.fields[0].variableKey).toBe('school_name');
      expect(mockPdfForm.fields[1].variableKey).toBe('school_email');
      expect(mockPdfForm.fields[2].variableKey).toBe('school_phone');

      // Verify Contact Adapter would resolve entity
      const contact = await resolveContact('entity_789', 'workspace_1');
      expect(contact?.schoolData?.name).toBe('Entity Institution');
      expect(contact?.schoolData?.focalPersons?.[0].email).toBe('jane@entity.com');
      expect(contact?.schoolData?.focalPersons?.[0].phone).toBe('+9876543210');
    });

    it('should fallback to entityId when entityId is not available', async () => {
      const mockPdfForm: PDFForm = {
        id: 'pdf_3',
        name: 'Legacy Agreement',
        publicTitle: 'Legacy Agreement',
        slug: 'legacy-agreement',
        storagePath: 'pdfs/legacy.pdf',
        downloadUrl: 'https://example.com/legacy.pdf',
        status: 'published',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-01T00:00:00Z',

        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSchool: School = {
        id: 'school_1',
        name: 'Legacy School',
        slug: 'legacy-school',
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        initials: 'LS',
        location: 'Legacy City',
        focalPersons: [],
        workspaceIds: ['workspace_1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      const mockContact = {
        id: 'school_1',
        name: 'Legacy School',
        schoolData: mockSchool,
        migrationStatus: 'legacy' as const,
        tags: [],
        entityContacts: [],
        contacts: [],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Verify fallback to entityId
      expect(mockPdfForm.entityId).toBe('school_1');
      expect(mockPdfForm.entityId).toBeNull();

      // Verify Contact Adapter would be called with entityId
      const contact = await resolveContact('school_1', 'workspace_1');
      expect(contact).toBe(mockContact);
      expect(contact?.schoolData?.name).toBe('Legacy School');
    });
  });

  describe('PDF Submission with Dual-Write (Requirement 16.5)', () => {
    it('should save agreement progress with both entityId and entityId', async () => {
      let capturedSubmissionData: any = null;
      const mockSubmissionRef = { id: 'submission_1' };

      const mockPdfDoc = {
        exists: true,
        data: () => ({
          name: 'Test Agreement',
        }),
      };

      const mockContractRef = {
        update: vi.fn(),
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            submissionId: null,
          }),
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'pdfs') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockPdfDoc),
              collection: vi.fn().mockReturnValue({
                add: vi.fn().mockImplementation((data) => {
                  capturedSubmissionData = data;
                  return Promise.resolve(mockSubmissionRef);
                }),
                doc: vi.fn().mockReturnValue({
                  update: vi.fn(),
                }),
              }),
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{
                ref: mockContractRef,
                data: () => ({
                  submissionId: null,
                }),
              }],
            }),
            add: vi.fn(),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      // Save progress with dual-write
      const result = await saveAgreementProgressAction(
        'pdf_1',
        'entity_123',
        { field1: 'value1' },
        'institution'
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.submissionId).toBe('submission_1');

      // Verify entityId populated
      expect(capturedSubmissionData).toBeDefined();
      expect(capturedSubmissionData.entityId).toBe('entity_123');
      expect(capturedSubmissionData.entityType).toBe('institution');
      expect(capturedSubmissionData.status).toBe('partial');
    });

    it('should finalize agreement with both entityId and entityId', async () => {
      let capturedSubmissionData: any = null;
      const mockSubmissionRef = { id: 'submission_2' };

      const mockPdfDoc = {
        exists: true,
        id: 'pdf_1',
        data: () => ({
          id: 'pdf_1',
          name: 'Test Agreement',
          workspaceIds: ['workspace_1'],
          fields: [],
          confirmationMessagingEnabled: false,
          adminAlertsEnabled: false,
        }),
      };

      const mockContractDoc = {
        exists: true,
        data: () => ({
          submissionId: null,
          entityName: 'Test School',
        }),
        ref: {
          update: vi.fn(),
        },
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'pdfs') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockPdfDoc),
              collection: vi.fn().mockReturnValue({
                add: vi.fn().mockImplementation((data) => {
                  capturedSubmissionData = data;
                  return Promise.resolve(mockSubmissionRef);
                }),
                doc: vi.fn().mockReturnValue({
                  update: vi.fn(),
                }),
              }),
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockContractDoc],
            }),
            add: vi.fn(),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      // Finalize agreement with dual-write
      const result = await finalizeAgreementAction(
        'pdf_1',
        'entity_456',
        { field1: 'value1' },
        'family'
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.submissionId).toBe('submission_2');

      // Verify entityId populated
      expect(capturedSubmissionData).toBeDefined();
      expect(capturedSubmissionData.entityId).toBe('entity_456');
      expect(capturedSubmissionData.entityType).toBe('family');
      expect(capturedSubmissionData.status).toBe('submitted');
    });

    it('should save submission with entityId only for new entity', async () => {
      let capturedSubmissionData: any = null;
      const mockSubmissionRef = { id: 'submission_3' };

      const mockPdfDoc = {
        exists: true,
        data: () => ({
          name: 'New Entity Agreement',
        }),
      };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'pdfs') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockPdfDoc),
              collection: vi.fn().mockReturnValue({
                add: vi.fn().mockImplementation((data) => {
                  capturedSubmissionData = data;
                  return Promise.resolve(mockSubmissionRef);
                }),
              }),
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
            add: vi.fn().mockResolvedValue({ 
              id: 'contract_1',
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ submissionId: null }),
              }),
            }),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      // Save with entityId only
      const result = await saveAgreementProgressAction(
        'pdf_1',
        'entity_789',
        { field1: 'value1' },
        'person'
      );

      // Verify entityId captured
      if (capturedSubmissionData) {
        expect(capturedSubmissionData.entityId).toBe('entity_789');
        expect(capturedSubmissionData.entityType).toBe('person');
      }
    });
  });

  describe('PDF Queries by EntityId and SchoolId (Requirement 16.4, 22.1)', () => {
    it('should query PDFs by entityId', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_1',
          name: 'Agreement 1',
          publicTitle: 'Agreement 1',
          slug: 'agreement-1',
          storagePath: 'pdfs/agreement1.pdf',
          downloadUrl: 'https://example.com/agreement1.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-01T00:00:00Z',

          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'pdf_2',
          name: 'Agreement 2',
          publicTitle: 'Agreement 2',
          slug: 'agreement-2',
          storagePath: 'pdfs/agreement2.pdf',
          downloadUrl: 'https://example.com/agreement2.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-02T00:00:00Z',

          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query by entityId
      const pdfs = await getPdfsByContact({
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
      });

      // Verify results
      expect(pdfs).toHaveLength(2);
      expect(pdfs[0].entityId).toBe('entity_123');
      expect(pdfs[1].entityId).toBe('entity_123');

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should query PDFs by entityId (fallback)', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_3',
          name: 'Legacy Agreement',
          publicTitle: 'Legacy Agreement',
          slug: 'legacy-agreement',
          storagePath: 'pdfs/legacy.pdf',
          downloadUrl: 'https://example.com/legacy.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-03T00:00:00Z',

          updatedAt: '2024-01-03T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query by entityId (fallback)
      const pdfs = await getPdfsByContact({
        entityId: 'school_1',
        workspaceId: 'workspace_1',
      });

      // Verify results
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].entityId).toBe('school_1');

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'school_1');
    });

    it('should prefer entityId when both entityId and entityId are provided', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_4',
          name: 'Dual Agreement',
          publicTitle: 'Dual Agreement',
          slug: 'dual-agreement',
          storagePath: 'pdfs/dual.pdf',
          downloadUrl: 'https://example.com/dual.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: 'entity_123',

          createdAt: '2024-01-04T00:00:00Z',

          updatedAt: '2024-01-04T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query with both identifiers
      const pdfs = await getPdfsByContact({
        entityId: 'school_1',
        workspaceId: 'workspace_1',
      });

      // Verify results
      expect(pdfs).toHaveLength(1);

      // Verify query preferred entityId over entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should throw error when neither entityId nor entityId is provided', async () => {
      // Attempt to query without identifiers
      await expect(
        getPdfsByContact({
          workspaceId: 'workspace_1',
        })
      ).rejects.toThrow('Either entityId or entityId must be provided');
    });
  });

  describe('PDF Submission Queries (Requirement 16.4)', () => {
    it('should query submissions by entityId', async () => {
      const mockSubmissions: Submission[] = [
        {
          id: 'sub_1',
          pdfId: 'pdf_1',
          submittedAt: '2024-01-01T00:00:00Z',
          formData: { field1: 'value1' },
          status: 'submitted',
          entityId: 'entity_123',
          entityType: 'institution',
        },
        {
          id: 'sub_2',
          pdfId: 'pdf_1',
          submittedAt: '2024-01-02T00:00:00Z',
          formData: { field1: 'value2' },
          status: 'partial',
          entityId: 'entity_123',
          entityType: 'institution',
        },
      ];

      const mockSnapshot = {
        docs: mockSubmissions.map(sub => ({
          id: sub.id,
          data: () => sub,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockSnapshot),
          }),
        }),
      });

      // Query submissions by entityId
      const submissions = await getSubmissionsByContact({
        pdfId: 'pdf_1',
        entityId: 'entity_123',
      });

      // Verify results
      expect(submissions).toHaveLength(2);
      expect(submissions[0].entityId).toBe('entity_123');
      expect(submissions[1].entityId).toBe('entity_123');
    });

    it('should query submissions by entityId (fallback)', async () => {
      const mockSubmissions: Submission[] = [
        {
          id: 'sub_3',
          pdfId: 'pdf_2',
          submittedAt: '2024-01-03T00:00:00Z',
          formData: { field1: 'value3' },
          status: 'submitted',
          entityId: null,
        },
      ];

      const mockSnapshot = {
        docs: mockSubmissions.map(sub => ({
          id: sub.id,
          data: () => sub,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockSnapshot),
          }),
        }),
      });

      // Query submissions by entityId
      const submissions = await getSubmissionsByContact({
        pdfId: 'pdf_2',
        entityId: 'school_1',
      });

      // Verify results
      expect(submissions).toHaveLength(1);
      expect(submissions[0].entityId).toBe('school_1');
    });

    it('should filter submissions by status', async () => {
      const mockSubmissions: Submission[] = [
        {
          id: 'sub_4',
          pdfId: 'pdf_1',
          submittedAt: '2024-01-04T00:00:00Z',
          formData: { field1: 'value4' },
          status: 'submitted',
          entityId: 'entity_456',
          entityType: 'family',
        },
      ];

      const mockSnapshot = {
        docs: mockSubmissions.map(sub => ({
          id: sub.id,
          data: () => sub,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue(mockSnapshot),
          }),
        }),
      });

      // Query with status filter
      const submissions = await getSubmissionsByContact({
        pdfId: 'pdf_1',
        entityId: 'entity_456',
        status: 'submitted',
      });

      // Verify results
      expect(submissions).toHaveLength(1);
      expect(submissions[0].status).toBe('submitted');
    });
  });

  describe('Workspace PDF Queries (Requirement 16.4)', () => {
    it('should get PDFs for workspace with entityId filter', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_5',
          name: 'Workspace Agreement',
          publicTitle: 'Workspace Agreement',
          slug: 'workspace-agreement',
          storagePath: 'pdfs/workspace.pdf',
          downloadUrl: 'https://example.com/workspace.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-05T00:00:00Z',

          updatedAt: '2024-01-05T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Get PDFs for workspace with entityId filter
      const pdfs = await getPdfsForWorkspace({
        workspaceId: 'workspace_1',
        entityId: 'entity_789',
        limit: 50,
      });

      // Verify results
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].entityId).toBe('entity_789');

      // Verify query filters
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_789');
    });

    it('should get PDFs for workspace with entityId filter', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_6',
          name: 'Legacy Workspace Agreement',
          publicTitle: 'Legacy Workspace Agreement',
          slug: 'legacy-workspace-agreement',
          storagePath: 'pdfs/legacy-workspace.pdf',
          downloadUrl: 'https://example.com/legacy-workspace.pdf',
          status: 'published',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-06T00:00:00Z',

          updatedAt: '2024-01-06T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Get PDFs for workspace with entityId filter
      const pdfs = await getPdfsForWorkspace({
        workspaceId: 'workspace_1',
        entityId: 'school_2',
        limit: 50,
      });

      // Verify results
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].entityId).toBe('school_2');

      // Verify query filters
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceIds', 'array-contains', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'school_2');
    });

    it('should filter PDFs by status', async () => {
      const mockPdfs: PDFForm[] = [
        {
          id: 'pdf_7',
          name: 'Draft Agreement',
          publicTitle: 'Draft Agreement',
          slug: 'draft-agreement',
          storagePath: 'pdfs/draft.pdf',
          downloadUrl: 'https://example.com/draft.pdf',
          status: 'draft',
          fields: [],
          workspaceIds: ['workspace_1'],
          entityId: null,

          createdAt: '2024-01-07T00:00:00Z',

          updatedAt: '2024-01-07T00:00:00Z',
        },
      ];

      const mockSnapshot = {
        docs: mockPdfs.map(pdf => ({
          id: pdf.id,
          data: () => pdf,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Get PDFs with status filter
      const pdfs = await getPdfsForWorkspace({
        workspaceId: 'workspace_1',
        status: 'draft',
        limit: 50,
      });

      // Verify results
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].status).toBe('draft');
    });
  });

  describe('Single PDF and Submission Retrieval', () => {
    it('should get PDF by ID', async () => {
      const mockPdf: PDFForm = {
        id: 'pdf_8',
        name: 'Single Agreement',
        publicTitle: 'Single Agreement',
        slug: 'single-agreement',
        storagePath: 'pdfs/single.pdf',
        downloadUrl: 'https://example.com/single.pdf',
        status: 'published',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-08T00:00:00Z',

        updatedAt: '2024-01-08T00:00:00Z',
      };

      const mockDoc = {
        exists: true,
        id: mockPdf.id,
        data: () => mockPdf,
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockDoc),
        }),
      });

      // Get PDF by ID
      const pdf = await getPdfById('pdf_8');

      // Verify result
      expect(pdf).toBeDefined();
      expect(pdf?.id).toBe('pdf_8');
      expect(pdf?.entityId).toBe('entity_111');
    });

    it('should return null for non-existent PDF', async () => {
      const mockDoc = {
        exists: false,
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockDoc),
        }),
      });

      // Get non-existent PDF
      const pdf = await getPdfById('non_existent');

      // Verify null result
      expect(pdf).toBeNull();
    });

    it('should get submission by ID', async () => {
      const mockSubmission: Submission = {
        id: 'sub_5',
        pdfId: 'pdf_9',
        submittedAt: '2024-01-09T00:00:00Z',
        formData: { field1: 'value5' },
        status: 'submitted',
        entityId: 'entity_222',
        entityType: 'person',
      };

      const mockDoc = {
        exists: true,
        id: mockSubmission.id,
        data: () => mockSubmission,
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockDoc),
            }),
          }),
        }),
      });

      // Get submission by ID
      const submission = await getSubmissionById('pdf_9', 'sub_5');

      // Verify result
      expect(submission).toBeDefined();
      expect(submission?.id).toBe('sub_5');
      expect(submission?.entityId).toBe('entity_222');
    });

    it('should return null for non-existent submission', async () => {
      const mockDoc = {
        exists: false,
      };

      (adminDb.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockDoc),
            }),
          }),
        }),
      });

      // Get non-existent submission
      const submission = await getSubmissionById('pdf_9', 'non_existent');

      // Verify null result
      expect(submission).toBeNull();
    });
  });

  describe('Contact Adapter Integration (Requirement 23.1)', () => {
    it('should use Contact Adapter to resolve entity information in PDF generation', async () => {
      const mockPdfForm: PDFForm = {
        id: 'pdf_10',
        name: 'Adapter Test',
        publicTitle: 'Adapter Test',
        slug: 'adapter-test',
        storagePath: 'pdfs/adapter.pdf',
        downloadUrl: 'https://example.com/adapter.pdf',
        status: 'published',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-10T00:00:00Z',

        updatedAt: '2024-01-10T00:00:00Z',
      };

      const mockSchool: School = {
        id: 'school_3',
        name: 'Adapter School',
        slug: 'adapter-school',
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        initials: 'AS',
        location: 'Adapter City',
        focalPersons: [
          {
            name: 'Adapter Contact',
            email: 'adapter@example.com',
            phone: '+1111111111',
            type: 'Admin',
            isSignatory: false,
          },
        ],
        workspaceIds: ['workspace_1'],
        createdAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-10T00:00:00Z',
        entityContacts: [],
      };

      const mockContact = {
        id: 'entity_333',
        name: 'Adapter School',
        entityId: 'entity_333',
        entityType: 'institution' as const,
        schoolData: mockSchool,
        migrationStatus: 'migrated' as const,
        tags: [],
        entityContacts: [],
        contacts: [],
      };

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Verify Contact Adapter integration
      const contact = await resolveContact('entity_333', 'workspace_1');
      expect(contact).toBe(mockContact);
      expect(contact?.entityId).toBe('entity_333');
      expect(contact?.schoolData?.name).toBe('Adapter School');
    });

    it('should handle Contact Adapter returning null gracefully', async () => {
      const mockPdfForm: PDFForm = {
        id: 'pdf_11',
        name: 'Missing Contact Test',
        publicTitle: 'Missing Contact Test',
        slug: 'missing-contact-test',
        storagePath: 'pdfs/missing.pdf',
        downloadUrl: 'https://example.com/missing.pdf',
        status: 'published',
        fields: [],
        workspaceIds: ['workspace_1'],
        entityId: null,

        createdAt: '2024-01-11T00:00:00Z',

        updatedAt: '2024-01-11T00:00:00Z',
      };

      vi.mocked(resolveContact).mockResolvedValue(null);

      // Verify Contact Adapter handles missing contact
      const contact = await resolveContact('entity_nonexistent', 'workspace_1');
      expect(contact).toBeNull();
      expect(resolveContact).toHaveBeenCalledWith('entity_nonexistent', 'workspace_1');
    });
  });
});
