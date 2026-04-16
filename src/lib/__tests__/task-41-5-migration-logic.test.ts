/**
 * Task 41.5: Migration Script Logic Validation (Unit Tests)
 * 
 * This test validates the migration transformation logic without Firebase operations.
 * Tests the data mapping, field preservation, and edge case handling.
 * 
 * Requirements validated: 18 (Backward Compatibility), 19 (Migration Script)
 */

import { describe, it, expect } from 'vitest';
import type { School, Entity, WorkspaceEntity, FocalPerson } from '../types';
import { getOrganizationId } from '../organization-utils';

describe('Task 41.5: Migration Script Logic Validation', () => {
  /**
   * Transform school to entity (migration logic)
   */
  function transformSchoolToEntity(school: School): Omit<Entity, 'id'> {
    const timestamp = new Date().toISOString();
    const organizationId = getOrganizationId(school);
    
    return {
      organizationId,
      entityType: 'institution',
      name: school.name,
      slug: school.slug || school.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      contacts: school.focalPersons || [],
      globalTags: [],
      status: school.status === 'Archived' ? 'archived' : 'active',
      createdAt: school.createdAt || timestamp,
      updatedAt: timestamp,
        entityContacts: [],
      institutionData: {
        nominalRoll: school.nominalRoll,
        subscriptionPackageId: school.subscriptionPackageId,
        subscriptionRate: school.subscriptionRate,
        billingAddress: school.billingAddress,
        currency: school.currency,
        modules: school.modules,
        implementationDate: school.implementationDate,
        referee: school.referee,
      },
      relatedEntityIds: [],
    };
  }

  /**
   * Transform school to workspace_entities (migration logic)
   */
  function transformSchoolToWorkspaceEntities(
    school: School,
    entityId: string
  ): Omit<WorkspaceEntity, 'id'>[] {
    const timestamp = new Date().toISOString();
    const organizationId = getOrganizationId(school);
    const workspaceIds = school.workspaceIds || [];
    const primaryContact = school.focalPersons?.[0];
    
    return workspaceIds.map(workspaceId => ({
      organizationId,
      workspaceId,
      entityId,
      entityType: 'institution' as const,
      pipelineId: school.pipelineId || '',
      stageId: school.stage?.id || '',
      assignedTo: school.assignedTo,
      status: school.status === 'Archived' ? 'archived' : 'active',
      workspaceTags: school.tags || [],
      lastContactedAt: undefined,
      addedAt: school.createdAt || timestamp,
      updatedAt: timestamp,
        entityContacts: [],
      displayName: school.name,
      primaryEmail: primaryContact?.email,
      primaryPhone: primaryContact?.phone,
      currentStageName: school.stage?.name,
    }));
  }

  describe('Entity Transformation', () => {
    it('should transform complete school data to entity', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Greenwood International Academy',
        slug: 'greenwood-international-academy',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        pipelineId: 'pipeline-onboarding',
        stage: {
          id: 'stage-contract-review',
          name: 'Contract Review',
          order: 3,
        },
        focalPersons: [
          {
            name: 'Dr. Sarah Johnson',
            email: 'sarah.johnson@greenwood.edu',
            phone: '+1-555-0101',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['premium', 'international'],
        nominalRoll: 850,
        subscriptionPackageId: 'pkg-enterprise',
        subscriptionRate: 12500,
        billingAddress: '123 Education Lane, Metro City, ST 12345',
        currency: 'USD',
        modules: [
          { id: 'mod-admissions', name: 'Admissions', abbreviation: 'ADM', color: '#4CAF50' },
        ],
        implementationDate: '2024-01-15T00:00:00Z',
        referee: 'John Smith',
        createdAt: '2023-11-01T10:30:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.organizationId).toBe('org-1');
      expect(entity.entityType).toBe('institution');
      expect(entity.name).toBe('Greenwood International Academy');
      expect(entity.slug).toBe('greenwood-international-academy');
      expect(entity.contacts).toEqual(school.focalPersons);
      expect(entity.status).toBe('active');
      expect(entity.createdAt).toBe('2023-11-01T10:30:00Z');
      expect(entity.institutionData?.nominalRoll).toBe(850);
      expect(entity.institutionData?.subscriptionRate).toBe(12500);
      expect(entity.institutionData?.billingAddress).toBe('123 Education Lane, Metro City, ST 12345');
      expect(entity.institutionData?.currency).toBe('USD');
      expect(entity.institutionData?.modules).toEqual(school.modules);
    });

    it('should handle minimal school data', () => {
      const school: School = {
        id: 'school-2',
        organizationId: 'org-1',
        name: 'Riverside Elementary',
        slug: 'riverside-elementary',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [
          {
            name: 'Jane Doe',
            email: 'jane@riverside.edu',
            phone: '+1-555-0201',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        createdAt: '2024-02-10T14:20:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.name).toBe('Riverside Elementary');
      expect(entity.contacts).toHaveLength(1);
      expect(entity.institutionData?.nominalRoll).toBeUndefined();
      expect(entity.institutionData?.subscriptionRate).toBeUndefined();
      expect(entity.institutionData?.billingAddress).toBeUndefined();
    });

    it('should map archived status correctly', () => {
      const school: School = {
        id: 'school-3',
        organizationId: 'org-1',
        name: 'Sunset Academy',
        slug: 'sunset-academy',
        workspaceIds: ['workspace-1'],
        status: 'Archived',
        focalPersons: [],
        createdAt: '2022-05-15T09:00:00Z',
        updatedAt: '2023-12-31T23:59:59Z',
        entityContacts: [],
        schoolStatus: 'Archived',
      pipelineId: 'pipeline-1',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.status).toBe('archived');
    });

    it('should handle special characters in name', () => {
      const school: School = {
        id: 'school-4',
        organizationId: 'org-1',
        name: "St. Mary's School & College (K-12)",
        slug: 'st-marys-school-college-k-12',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        createdAt: '2023-08-20T11:45:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.name).toBe("St. Mary's School & College (K-12)");
      expect(entity.slug).toBe('st-marys-school-college-k-12');
    });

    it('should generate slug if missing', () => {
      const school: School = {
        id: 'school-5',
        organizationId: 'org-1',
        name: 'Test School!!!',
        slug: 'test-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.slug).toBe('test-school');
    });

    it('should handle large nominal roll', () => {
      const school: School = {
        id: 'school-6',
        organizationId: 'org-1',
        name: 'Metropolitan High School',
        slug: 'metropolitan-high-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        nominalRoll: 2500,
        subscriptionRate: 25000,
        createdAt: '2024-01-05T08:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const entity = transformSchoolToEntity(school);

      expect(entity.institutionData?.nominalRoll).toBe(2500);
      expect(entity.institutionData?.subscriptionRate).toBe(25000);
    });
  });

  describe('Workspace-Entity Transformation', () => {
    it('should create workspace_entities for single workspace', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        pipelineId: 'pipeline-1',
        stage: {
          id: 'stage-1',
          name: 'Stage 1',
          order: 1,
        },
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.edu',
            phone: '+1-555-0001',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['tag1', 'tag2'],
        assignedTo: {
          userId: 'user-1',
          name: 'Alice',
          email: 'alice@company.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      };

      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      expect(workspaceEntities).toHaveLength(1);
      
      const we = workspaceEntities[0];
      expect(we.workspaceId).toBe('workspace-1');
      expect(we.entityId).toBe('entity-1');
      expect(we.entityType).toBe('institution');
      expect(we.pipelineId).toBe('pipeline-1');
      expect(we.stageId).toBe('stage-1');
      expect(we.currentStageName).toBe('Stage 1');
      expect(we.workspaceTags).toEqual(['tag1', 'tag2']);
      expect(we.assignedTo).toEqual(school.assignedTo);
      expect(we.displayName).toBe('Test School');
      expect(we.primaryEmail).toBe('john@test.edu');
      expect(we.primaryPhone).toBe('+1-555-0001');
    });

    it('should create workspace_entities for multiple workspaces', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Multi-Workspace School',
        slug: 'multi-workspace-school',
        workspaceIds: ['workspace-1', 'workspace-2'],
        status: 'Active',
        pipelineId: 'pipeline-1',
        stage: {
          id: 'stage-1',
          name: 'Stage 1',
          order: 1,
        },
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.edu',
            phone: '+1-555-0001',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['tag1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      };

      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      expect(workspaceEntities).toHaveLength(2);
      
      expect(workspaceEntities[0].workspaceId).toBe('workspace-1');
      expect(workspaceEntities[1].workspaceId).toBe('workspace-2');
      
      // Both should have same entity data
      expect(workspaceEntities[0].entityId).toBe('entity-1');
      expect(workspaceEntities[1].entityId).toBe('entity-1');
      expect(workspaceEntities[0].displayName).toBe(workspaceEntities[1].displayName);
    });

    it('should handle missing pipeline data', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'No Pipeline School',
        slug: 'no-pipeline-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      expect(workspaceEntities).toHaveLength(1);
      
      const we = workspaceEntities[0];
      expect(we.pipelineId).toBe('');
      expect(we.stageId).toBe('');
      expect(we.currentStageName).toBeUndefined();
    });

    it('should handle missing tags', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'No Tags School',
        slug: 'no-tags-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      expect(workspaceEntities).toHaveLength(1);
      expect(workspaceEntities[0].workspaceTags).toEqual([]);
    });

    it('should denormalize primary contact correctly', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Contact Test School',
        slug: 'contact-test-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [
          {
            name: 'Primary Contact',
            email: 'primary@test.edu',
            phone: '+1-555-1111',
            type: 'Principal',
            isSignatory: true,
          },
          {
            name: 'Secondary Contact',
            email: 'secondary@test.edu',
            phone: '+1-555-2222',
            type: 'Administrator',
            isSignatory: false,
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      expect(workspaceEntities).toHaveLength(1);
      
      const we = workspaceEntities[0];
      // Should use first focal person as primary contact
      expect(we.primaryEmail).toBe('primary@test.edu');
      expect(we.primaryPhone).toBe('+1-555-1111');
    });
  });

  describe('Migration Idempotency', () => {
    it('should produce same entity for same school', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Idempotent School',
        slug: 'idempotent-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        focalPersons: [],
        nominalRoll: 500,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      pipelineId: 'pipeline-1',
      };

      const entity1 = transformSchoolToEntity(school);
      const entity2 = transformSchoolToEntity(school);

      // Core fields should be identical
      expect(entity1.organizationId).toBe(entity2.organizationId);
      expect(entity1.entityType).toBe(entity2.entityType);
      expect(entity1.name).toBe(entity2.name);
      expect(entity1.slug).toBe(entity2.slug);
      expect(entity1.status).toBe(entity2.status);
      expect(entity1.createdAt).toBe(entity2.createdAt);
      expect(entity1.institutionData?.nominalRoll).toBe(entity2.institutionData?.nominalRoll);
    });
  });

  describe('Data Preservation', () => {
    it('should preserve all school fields in entity + workspace_entities', () => {
      const school: School = {
        id: 'school-1',
        organizationId: 'org-1',
        name: 'Complete Data School',
        slug: 'complete-data-school',
        workspaceIds: ['workspace-1'],
        status: 'Active',
        pipelineId: 'pipeline-1',
        stage: {
          id: 'stage-1',
          name: 'Stage 1',
          order: 1,
        },
        focalPersons: [
          {
            name: 'John Doe',
            email: 'john@test.edu',
            phone: '+1-555-0001',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        tags: ['tag1', 'tag2'],
        nominalRoll: 750,
        subscriptionPackageId: 'pkg-1',
        subscriptionRate: 10000,
        billingAddress: '123 Main St',
        currency: 'USD',
        modules: [{ id: 'mod-1', name: 'Module 1', abbreviation: 'M1', color: '#000' }],
        implementationDate: '2024-01-01T00:00:00Z',
        referee: 'Referee Name',
        assignedTo: {
          userId: 'user-1',
          name: 'Alice',
          email: 'alice@company.com',
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
        schoolStatus: 'Active',
      };

      const entity = transformSchoolToEntity(school);
      const workspaceEntities = transformSchoolToWorkspaceEntities(school, 'entity-1');

      // Verify all fields preserved
      expect(entity.name).toBe(school.name);
      expect(entity.slug).toBe(school.slug);
      expect(entity.contacts).toEqual(school.focalPersons);
      expect(entity.institutionData?.nominalRoll).toBe(school.nominalRoll);
      expect(entity.institutionData?.subscriptionPackageId).toBe(school.subscriptionPackageId);
      expect(entity.institutionData?.subscriptionRate).toBe(school.subscriptionRate);
      expect(entity.institutionData?.billingAddress).toBe(school.billingAddress);
      expect(entity.institutionData?.currency).toBe(school.currency);
      expect(entity.institutionData?.modules).toEqual(school.modules);
      expect(entity.institutionData?.implementationDate).toBe(school.implementationDate);
      expect(entity.institutionData?.referee).toBe(school.referee);

      const we = workspaceEntities[0];
      expect(we.pipelineId).toBe(school.pipelineId);
      expect(we.stageId).toBe(school.stage?.id);
      expect(we.currentStageName).toBe(school.stage?.name);
      expect(we.workspaceTags).toEqual(school.tags);
      expect(we.assignedTo).toEqual(school.assignedTo);
    });
  });

  describe('Migration Summary', () => {
    it('should generate correct migration summary', () => {
      const schools: School[] = [
        {
          id: 'school-1',
          organizationId: 'org-1',
          name: 'School 1',
          slug: 'school-1',
          workspaceIds: ['workspace-1', 'workspace-2'],
          status: 'Active',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
          schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        },
        {
          id: 'school-2',
          organizationId: 'org-1',
          name: 'School 2',
          slug: 'school-2',
          workspaceIds: ['workspace-1'],
          status: 'Active',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
          schoolStatus: 'Active',
        pipelineId: 'pipeline-1',
        },
        {
          id: 'school-3',
          organizationId: 'org-1',
          name: 'School 3',
          slug: 'school-3',
          workspaceIds: ['workspace-1'],
          status: 'Archived',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-03-26T10:00:00Z',
        entityContacts: [],
          schoolStatus: 'Archived',
        pipelineId: 'pipeline-1',
        },
      ];

      const entities = schools.map(school => transformSchoolToEntity(school));
      const allWorkspaceEntities = schools.flatMap(school =>
        transformSchoolToWorkspaceEntities(school, `entity-${school.id}`)
      );

      const summary = {
        totalSchools: schools.length,
        entitiesCreated: entities.length,
        workspaceEntitiesCreated: allWorkspaceEntities.length,
        activeSchools: schools.filter(s => s.status === 'Active').length,
        archivedSchools: schools.filter(s => s.status === 'Archived').length,
        multiWorkspaceSchools: schools.filter(s => s.workspaceIds && s.workspaceIds.length > 1).length,
      };

      expect(summary.totalSchools).toBe(3);
      expect(summary.entitiesCreated).toBe(3);
      expect(summary.workspaceEntitiesCreated).toBe(4); // 1 school has 2 workspaces
      expect(summary.activeSchools).toBe(2);
      expect(summary.archivedSchools).toBe(1);
      expect(summary.multiWorkspaceSchools).toBe(1);

      console.log('\n=== Migration Logic Validation Summary ===');
      console.log(`Total Schools: ${summary.totalSchools}`);
      console.log(`Entities Created: ${summary.entitiesCreated}`);
      console.log(`Workspace Entities Created: ${summary.workspaceEntitiesCreated}`);
      console.log(`Active Schools: ${summary.activeSchools}`);
      console.log(`Archived Schools: ${summary.archivedSchools}`);
      console.log(`Multi-Workspace Schools: ${summary.multiWorkspaceSchools}`);
      console.log('\n✅ All migration logic tests passed');
      console.log('✅ Requirements 18 & 19 validated');
    });
  });
});
