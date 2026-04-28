// @ts-nocheck
/**
 * Unit Tests for School Enrollment Industry Server Actions
 * 
 * Test Coverage:
 * - Each action rejects non-SchoolEnrollment workspaces (Requirements 4.7–4.10)
 * - createApplication links application to entity applicationIds
 * - All CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createApplication,
  updateApplicationStatus,
  getApplicationsForEntity,
  createEnrollment,
  updateEnrollmentStatus,
  getEnrollmentsForEntity,
  createSchoolVisit,
  updateVisitStatus,
  getSchoolVisitsForEntity,
} from '../school-enrollment-actions';
import type { Workspace, Entity, Application, Enrollment, SchoolVisit } from '../types';

// Mock Firebase
vi.mock('@/firebase/config', () => ({
  firestore: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: {},
  arrayUnion: vi.fn((value) => value),
}));

// Import mocked functions
import { getDoc, addDoc, updateDoc, getDocs } from 'firebase/firestore';

describe('School Enrollment Actions - Workspace Industry Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createApplication', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createApplication({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'John Doe',
          gradeApplying: '9',
        })
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });

    it('should create application for SchoolEnrollment workspace and update entity applicationIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test School',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'SchoolEnrollment',
          
          gradeOfferings: ['9', '10', '11', '12'],
          academicYear: '2024-2025',
          applicationIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating applicationIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'application_123',
      } as any);

      const result = await createApplication({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'John Doe',
        gradeApplying: '9',
      });

      expect(result.id).toBe('application_123');
      expect(result.studentName).toBe('John Doe');
      expect(result.gradeApplying).toBe('9');
      expect(result.applicationStatus).toBe('submitted');
      expect(updateDoc).toHaveBeenCalled(); // Entity applicationIds updated
    });
  });

  describe('updateApplicationStatus', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockApplication: Application = {
        id: 'application_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'John Doe',
        gradeApplying: '9',
        applicationStatus: 'submitted',
        submittedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Marketing', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'application_123',
          data: () => mockApplication,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateApplicationStatus('application_123', 'accepted')
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });
  });

  describe('createEnrollment', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Law', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createEnrollment({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'Jane Smith',
          grade: '10',
          academicYear: '2024-2025',
        })
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });
  });

  describe('updateEnrollmentStatus', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockEnrollment: Enrollment = {
        id: 'enrollment_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'Jane Smith',
        grade: '10',
        academicYear: '2024-2025',
        enrollmentStatus: 'enrolled',
        enrollmentDate: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'RealEstate', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'enrollment_123',
          data: () => mockEnrollment,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateEnrollmentStatus('enrollment_123', 'withdrawn')
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });
  });

  describe('createSchoolVisit', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'Consultancy', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'ws_123',
        data: () => mockWorkspace,
      } as any);

      await expect(
        createSchoolVisit({
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          visitDate: '2024-02-15T10:00:00Z',
          visitType: 'tour',
        })
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });
  });

  describe('updateVisitStatus', () => {
    it('should reject non-SchoolEnrollment workspace', async () => {
      const mockVisit: SchoolVisit = {
        id: 'visit_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        visitDate: '2024-02-15T10:00:00Z',
        visitType: 'tour',
        status: 'scheduled',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SaaS', // Not SchoolEnrollment
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'visit_123',
          data: () => mockVisit,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await expect(
        updateVisitStatus('visit_123', 'completed')
      ).rejects.toThrow('This action is only available for SchoolEnrollment workspaces');
    });
  });
});

describe('School Enrollment Actions - Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateApplicationStatus', () => {
    it('should set reviewedAt timestamp when status changes to accepted', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockApplication: Application = {
        id: 'application_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'John Doe',
        gradeApplying: '9',
        applicationStatus: 'under_review',
        submittedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'application_123',
          data: () => mockApplication,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateApplicationStatus('application_123', 'accepted');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        applicationStatus: 'accepted',
        reviewedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should set reviewedAt timestamp when status changes to rejected', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockApplication: Application = {
        id: 'application_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'John Doe',
        gradeApplying: '9',
        applicationStatus: 'under_review',
        submittedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'application_123',
          data: () => mockApplication,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateApplicationStatus('application_123', 'rejected');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        applicationStatus: 'rejected',
        reviewedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should set reviewedAt timestamp when status changes to waitlisted', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockApplication: Application = {
        id: 'application_123',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'John Doe',
        gradeApplying: '9',
        applicationStatus: 'under_review',
        submittedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'application_123',
          data: () => mockApplication,
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any);

      await updateApplicationStatus('application_123', 'waitlisted');

      // Check that updateDoc was called with the correct updates
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toMatchObject({
        applicationStatus: 'waitlisted',
        reviewedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('getApplicationsForEntity', () => {
    it('should return all applications for an entity ordered by submission date', async () => {
      const mockApplications: Application[] = [
        {
          id: 'application_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'Jane Smith',
          gradeApplying: '10',
          applicationStatus: 'submitted',
          submittedAt: '2024-02-01T00:00:00Z',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
        {
          id: 'application_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'John Doe',
          gradeApplying: '9',
          applicationStatus: 'accepted',
          submittedAt: '2024-01-01T00:00:00Z',
          reviewedAt: '2024-01-15T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockApplications.map((application) => ({
          id: application.id,
          data: () => application,
        })),
      } as any);

      const result = await getApplicationsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('application_2'); // Most recent first
      expect(result[1].id).toBe('application_1');
    });
  });

  describe('getEnrollmentsForEntity', () => {
    it('should return all enrollments for an entity ordered by enrollment date', async () => {
      const mockEnrollments: Enrollment[] = [
        {
          id: 'enrollment_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'Jane Smith',
          grade: '10',
          academicYear: '2024-2025',
          enrollmentStatus: 'enrolled',
          enrollmentDate: '2024-08-15T00:00:00Z',
          createdAt: '2024-08-15T00:00:00Z',
          updatedAt: '2024-08-15T00:00:00Z',
        },
        {
          id: 'enrollment_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          studentName: 'John Doe',
          grade: '9',
          academicYear: '2023-2024',
          enrollmentStatus: 'graduated',
          enrollmentDate: '2023-08-15T00:00:00Z',
          createdAt: '2023-08-15T00:00:00Z',
          updatedAt: '2024-06-15T00:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockEnrollments.map((enrollment) => ({
          id: enrollment.id,
          data: () => enrollment,
        })),
      } as any);

      const result = await getEnrollmentsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('enrollment_2'); // Most recent first
      expect(result[1].id).toBe('enrollment_1');
    });
  });

  describe('getSchoolVisitsForEntity', () => {
    it('should return all school visits for an entity ordered by visit date', async () => {
      const mockVisits: SchoolVisit[] = [
        {
          id: 'visit_2',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          visitDate: '2024-03-15T10:00:00Z',
          visitType: 'open_house',
          status: 'scheduled',
          attendees: ['Parent 1', 'Parent 2'],
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-01T00:00:00Z',
        },
        {
          id: 'visit_1',
          organizationId: 'org_123',
          workspaceId: 'ws_123',
          entityId: 'entity_123',
          visitDate: '2024-02-15T10:00:00Z',
          visitType: 'tour',
          status: 'completed',
          attendees: ['Parent 1'],
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-02-15T11:00:00Z',
        },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: mockVisits.map((visit) => ({
          id: visit.id,
          data: () => visit,
        })),
      } as any);

      const result = await getSchoolVisitsForEntity('entity_123', 'ws_123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('visit_2'); // Most recent first
      expect(result[1].id).toBe('visit_1');
    });
  });

  describe('createEnrollment', () => {
    it('should create enrollment with default status and update entity enrollmentIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test School',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'SchoolEnrollment',
          
          gradeOfferings: ['9', '10', '11', '12'],
          academicYear: '2024-2025',
          enrollmentIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating enrollmentIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'enrollment_123',
      } as any);

      const result = await createEnrollment({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        studentName: 'Jane Smith',
        grade: '10',
        academicYear: '2024-2025',
      });

      expect(result.id).toBe('enrollment_123');
      expect(result.studentName).toBe('Jane Smith');
      expect(result.grade).toBe('10');
      expect(result.enrollmentStatus).toBe('enrolled');
      expect(updateDoc).toHaveBeenCalled(); // Entity enrollmentIds updated
    });
  });

  describe('createSchoolVisit', () => {
    it('should create school visit with default status and update entity schoolVisitIds', async () => {
      const mockWorkspace: Workspace = {
        id: 'ws_123',
        organizationId: 'org_123',
        name: 'Test Workspace',
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
        status: 'active',
        statuses: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity: Entity = {
        id: 'entity_123',
        organizationId: 'org_123',
        
        name: 'Test School',
        entityContacts: [],
        entityType: 'institution',
    entityContacts: [],
    globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        industryData: {
          industry: 'SchoolEnrollment',
          
          gradeOfferings: ['9', '10', '11', '12'],
          academicYear: '2024-2025',
          schoolVisitIds: [],
        },
      };

      // Mock workspace validation
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws_123',
          data: () => mockWorkspace,
        } as any)
        // Mock entity fetch for updating schoolVisitIds
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'entity_123',
          data: () => mockEntity,
        } as any);

      vi.mocked(addDoc).mockResolvedValueOnce({
        id: 'visit_123',
      } as any);

      const result = await createSchoolVisit({
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        entityId: 'entity_123',
        visitDate: '2024-02-15T10:00:00Z',
        visitType: 'tour',
        attendees: ['Parent 1', 'Parent 2'],
      });

      expect(result.id).toBe('visit_123');
      expect(result.visitType).toBe('tour');
      expect(result.status).toBe('scheduled');
      expect(result.attendees).toEqual(['Parent 1', 'Parent 2']);
      expect(updateDoc).toHaveBeenCalled(); // Entity schoolVisitIds updated
    });
  });
});
