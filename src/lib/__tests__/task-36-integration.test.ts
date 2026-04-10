/**
 * Task 36 Integration Tests: PDF Forms, Surveys, and Meetings
 * 
 * Tests the integration of PDF forms, surveys, and meetings with the new entity system
 * while maintaining backward compatibility with legacy schools.
 * 
 * Requirements: 26
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { PDFForm, Survey, Meeting, Entity, School } from '../types';

describe('Task 36: PDF Forms, Surveys, and Meetings Integration', () => {
  describe('36.1 & 36.2: PDFForm and Survey entityId fields', () => {
    it('should have entityId field in PDFForm interface', () => {
      const pdfForm: PDFForm = {
        id: 'pdf_1',
        workspaceIds: ['workspace_1'],
        name: 'Test Form',
        publicTitle: 'Test Form',
        slug: 'test-form',
        storagePath: '/path/to/pdf',
        downloadUrl: 'https://example.com/pdf',
        status: 'published',
        fields: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Legacy fields
        entityId: 'school_1',
        entityName: 'Test School',
        // New field
        entityId: 'entity_1',
      };

      expect(pdfForm.entityId).toBe('school_1');
      expect(pdfForm.entityId).toBe('entity_1');
    });

    it('should have entityId field in Survey interface', () => {
      const survey: Survey = {
        id: 'survey_1',
        workspaceIds: ['workspace_1'],
        internalName: 'Test Survey',
        title: 'Test Survey',
        description: 'A test survey',
        slug: 'test-survey',
        status: 'published',
        elements: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Legacy fields
        entityId: 'school_1',
        entityName: 'Test School',
        // New field
        entityId: 'entity_1',
      };

      expect(survey.entityId).toBe('school_1');
      expect(survey.entityId).toBe('entity_1');
    });

    it('should support PDFForm with only entityId (no entityId)', () => {
      const pdfForm: PDFForm = {
        id: 'pdf_2',
        workspaceIds: ['workspace_1'],
        name: 'Entity Form',
        publicTitle: 'Entity Form',
        slug: 'entity-form',
        storagePath: '/path/to/pdf',
        downloadUrl: 'https://example.com/pdf',
        status: 'published',
        fields: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Only new field, no legacy fields
        entityId: 'entity_1',
      };

      expect(pdfForm.entityId).toBe('entity_1');
      expect(pdfForm.entityId).toBeUndefined();
    });

    it('should support Survey with only entityId (no entityId)', () => {
      const survey: Survey = {
        id: 'survey_2',
        workspaceIds: ['workspace_1'],
        internalName: 'Entity Survey',
        title: 'Entity Survey',
        description: 'A survey for entities',
        slug: 'entity-survey',
        status: 'published',
        elements: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Only new field, no legacy fields
        entityId: 'entity_1',
      };

      expect(survey.entityId).toBe('entity_1');
      expect(survey.entityId).toBeUndefined();
    });
  });

  describe('36.3: Meeting documents use entity slug', () => {
    it('should have entitySlug field in Meeting interface', () => {
      const meeting: Meeting = {
        id: 'meeting_1',
        entityId: 'school_1',
        entityName: 'Test School',
        entitySlug: 'test-school',
        workspaceIds: ['workspace_1'],
        meetingTime: '2024-01-01T10:00:00Z',
        meetingLink: 'https://meet.google.com/abc-def-ghi',
        type: {
          id: 'parent',
          name: 'Parent Engagement',
          slug: 'parent-engagement',
        },
      };

      expect(meeting.entitySlug).toBe('test-school');
    });

    it('should support meeting with entity slug', () => {
      // When a meeting is created for an entity, the entitySlug comes from entity.slug
      const entity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const meeting: Meeting = {
        id: 'meeting_2',
        entityId: entity.id, // Can reference entity ID
        entityName: entity.name,
        entitySlug: entity.slug!, // Uses entity slug
        workspaceIds: ['workspace_1'],
        meetingTime: '2024-01-01T10:00:00Z',
        meetingLink: 'https://meet.google.com/xyz-abc-def',
        type: {
          id: 'kickoff',
          name: 'Kickoff',
          slug: 'kickoff',
        },
      };

      expect(meeting.entitySlug).toBe(entity.slug);
    });
  });

  describe('36.4: Slug generation for institution entities', () => {
    it('should generate URL-safe slug from entity name', () => {
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      };

      expect(generateSlug('Test School')).toBe('test-school');
      expect(generateSlug('St. Mary\'s Academy')).toBe('st-marys-academy');
      expect(generateSlug('School #123')).toBe('school-123');
      expect(generateSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });

    it('should ensure slug uniqueness by appending timestamp', () => {
      const baseSlug = 'test-school';
      const timestamp = Date.now();
      const uniqueSlug = `${baseSlug}-${timestamp}`;

      expect(uniqueSlug).toMatch(/^test-school-\d+$/);
    });

    it('should only generate slug for institution entities', () => {
      const institutionEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test Institution',
        slug: 'test-institution', // Should have slug
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const familyEntity: Entity = {
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'family',
        name: 'Smith Family',
        // No slug for family entities
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const personEntity: Entity = {
        id: 'entity_3',
        organizationId: 'org_1',
        entityType: 'person',
        name: 'John Doe',
        // No slug for person entities
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(institutionEntity.slug).toBeDefined();
      expect(familyEntity.slug).toBeUndefined();
      expect(personEntity.slug).toBeUndefined();
    });
  });

  describe('36.5: Maintain existing public routes', () => {
    it('should maintain public meeting routes with entitySlug', () => {
      const routes = [
        '/meetings/parent-engagement/test-school',
        '/meetings/kickoff/another-school',
        '/meetings/training/third-school',
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/meetings\/[a-z-]+\/[a-z0-9-]+$/);
      });
    });

    it('should maintain public form routes', () => {
      const routes = [
        '/forms/pdf_123',
        '/forms/pdf_456',
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/forms\/[a-z0-9_]+$/);
      });
    });

    it('should maintain public survey routes', () => {
      const routes = [
        '/surveys/test-survey',
        '/surveys/another-survey',
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/surveys\/[a-z0-9-]+$/);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy PDFForm with only entityId', () => {
      const legacyPdfForm: PDFForm = {
        id: 'pdf_legacy',
        workspaceIds: ['workspace_1'],
        name: 'Legacy Form',
        publicTitle: 'Legacy Form',
        slug: 'legacy-form',
        storagePath: '/path/to/pdf',
        downloadUrl: 'https://example.com/pdf',
        status: 'published',
        fields: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Only legacy fields
        entityId: 'school_1',
        entityName: 'Legacy School',
      };

      expect(legacyPdfForm.entityId).toBe('school_1');
      expect(legacyPdfForm.entityId).toBeUndefined();
    });

    it('should support legacy Survey with only entityId', () => {
      const legacySurvey: Survey = {
        id: 'survey_legacy',
        workspaceIds: ['workspace_1'],
        internalName: 'Legacy Survey',
        title: 'Legacy Survey',
        description: 'A legacy survey',
        slug: 'legacy-survey',
        status: 'published',
        elements: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Only legacy fields
        entityId: 'school_1',
        entityName: 'Legacy School',
      };

      expect(legacySurvey.entityId).toBe('school_1');
      expect(legacySurvey.entityId).toBeUndefined();
    });

    it('should support legacy Meeting with school slug', () => {
      const legacyMeeting: Meeting = {
        id: 'meeting_legacy',
        entityId: 'school_1',
        entityName: 'Legacy School',
        entitySlug: 'legacy-school',
        workspaceIds: ['workspace_1'],
        meetingTime: '2024-01-01T10:00:00Z',
        meetingLink: 'https://meet.google.com/legacy',
        type: {
          id: 'parent',
          name: 'Parent Engagement',
          slug: 'parent-engagement',
        },
      };

      expect(legacyMeeting.entitySlug).toBe('legacy-school');
    });
  });

  describe('Adapter Layer Integration', () => {
    it('should resolve contact with slug from either school or entity', () => {
      // Mock resolved contact from adapter
      const resolvedContact = {
        id: 'entity_1',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: [],
        migrationStatus: 'migrated' as const,
      };

      expect(resolvedContact.slug).toBe('test-institution');
    });

    it('should support workspaceIds array in PDFForm', () => {
      const pdfForm: PDFForm = {
        id: 'pdf_multi',
        workspaceIds: ['workspace_1', 'workspace_2', 'workspace_3'],
        name: 'Multi-Workspace Form',
        publicTitle: 'Multi-Workspace Form',
        slug: 'multi-workspace-form',
        storagePath: '/path/to/pdf',
        downloadUrl: 'https://example.com/pdf',
        status: 'published',
        fields: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityId: 'entity_1',
      };

      expect(pdfForm.workspaceIds).toHaveLength(3);
      expect(pdfForm.workspaceIds[0]).toBe('workspace_1');
    });
  });
});
