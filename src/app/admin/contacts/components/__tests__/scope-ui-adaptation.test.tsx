/**
 * Checkpoint Tests - UI Adapts to Workspace Scope (Task 19)
 * 
 * Validates that the UI correctly adapts based on workspace contactScope:
 * - Institution workspace: shows nominalRoll, subscriptionRate, billingAddress, modules
 * - Family workspace: shows guardians, children, admissions data
 * - Person workspace: shows company, jobTitle, leadSource
 * 
 * Tests cover:
 * 1. Form components show correct fields for each scope
 * 2. List columns adapt to workspace scope
 * 3. Detail pages show scope-appropriate sections
 * 4. Each scope hides fields irrelevant to that scope
 * 
 * Related Requirements: 14, 15, 16, 17, 25
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { InstitutionForm } from '../InstitutionForm';
import { FamilyForm } from '../FamilyForm';
import { PersonForm } from '../PersonForm';
import { ContactListColumns, ContactListHeaders } from '../ContactListColumns';
import { ContactDetailPage } from '../ContactDetailPage';
import type { Entity, WorkspaceEntity, ContactScope } from '@/lib/types';

// Mock dependencies
vi.mock('@/app/admin/entities/components/FocalPersonManager', () => ({
  FocalPersonManager: ({ value, onChange }: any) => (
    <div data-testid="focal-person-manager">
      Focal Person Manager: {value?.length || 0} persons
    </div>
  ),
}));

vi.mock('@/app/admin/components/NotesSection', () => ({
  default: ({ entityId }: any) => (
    <div data-testid="notes-section">Notes for {entityId}</div>
  ),
}));

vi.mock('@/app/admin/components/ActivityTimeline', () => ({
  default: ({ workspaceId, entityId }: any) => (
    <div data-testid="activity-timeline">
      Activity for {entityId} in {workspaceId}
    </div>
  ),
}));

describe('Task 19: Checkpoint - UI Adapts to Workspace Scope', () => {
  describe('Institution Scope - Form Fields', () => {
    it('should display institution-specific fields', () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test School',
        slug: 'test-school',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        institutionData: {
          nominalRoll: 500,
          subscriptionRate: 25.5,
          billingAddress: '123 School St',
          currency: 'GHS',
          implementationDate: '2024-01-15',
          referee: 'Jane Smith',
        },
      };

      const mockOnSubmit = vi.fn();

      render(<InstitutionForm entity={mockEntity} onSubmit={mockOnSubmit} />);

      // Verify institution-specific fields are present
      expect(screen.getByText(/Institution Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Nominal Roll/i)).toBeInTheDocument();
      expect(screen.getByText(/Implementation Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Billing Currency/i)).toBeInTheDocument();
      expect(screen.getByText(/Subscription Rate/i)).toBeInTheDocument();
      expect(screen.getByText(/Billing Address/i)).toBeInTheDocument();
      expect(screen.getByText(/Focal Persons/i)).toBeInTheDocument();
      expect(screen.getByText(/Referee/i)).toBeInTheDocument();
    });

    it('should NOT display family-specific fields in institution form', () => {
      const mockOnSubmit = vi.fn();

      render(<InstitutionForm onSubmit={mockOnSubmit} />);

      // Verify family-specific fields are NOT present
      expect(screen.queryByText(/Guardians/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Children/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Guardian/i)).not.toBeInTheDocument();
    });

    it('should NOT display person-specific fields in institution form', () => {
      const mockOnSubmit = vi.fn();

      render(<InstitutionForm onSubmit={mockOnSubmit} />);

      // Verify person-specific fields are NOT present
      expect(screen.queryByText(/First Name/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last Name/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Company/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Job Title/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Lead Source/i)).not.toBeInTheDocument();
    });
  });

  describe('Family Scope - Form Fields', () => {
    it('should display family-specific fields', () => {
      const mockEntity: Entity = {
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'family',
        name: 'The Smith Family',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        familyData: {
          guardians: [
            {
              name: 'John Smith',
              email: 'john@smith.com',
              phone: '+1234567890',
              relationship: 'Father',
              isPrimary: true,
            },
          ],
          children: [
            {
              firstName: 'Emma',
              lastName: 'Smith',
              dateOfBirth: '2015-05-10',
              gradeLevel: 'Grade 3',
              enrollmentStatus: 'Enrolled',
            },
          ],
        },
      };

      const mockOnSubmit = vi.fn();

      render(<FamilyForm entity={mockEntity} onSubmit={mockOnSubmit} showChildren={true} />);

      // Verify family-specific fields are present
      expect(screen.getByText(/Family Name/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Guardians/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Children/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Guardian 1/i)).toBeInTheDocument();
    });

    it('should hide children section when capabilities.children is false', () => {
      const mockOnSubmit = vi.fn();

      render(<FamilyForm onSubmit={mockOnSubmit} showChildren={false} />);

      // Verify children section is hidden
      expect(screen.queryByText(/Children/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Add Child/i)).not.toBeInTheDocument();
    });

    it('should NOT display institution-specific fields in family form', () => {
      const mockOnSubmit = vi.fn();

      render(<FamilyForm onSubmit={mockOnSubmit} />);

      // Verify institution-specific fields are NOT present
      expect(screen.queryByText(/Nominal Roll/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Subscription Rate/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Billing Address/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Implementation Date/i)).not.toBeInTheDocument();
    });

    it('should NOT display person-specific fields in family form', () => {
      const mockOnSubmit = vi.fn();

      render(<FamilyForm onSubmit={mockOnSubmit} />);

      // Verify person-specific fields are NOT present
      expect(screen.queryByText(/Company/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Job Title/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Lead Source/i)).not.toBeInTheDocument();
    });
  });

  describe('Person Scope - Form Fields', () => {
    it('should display person-specific fields', () => {
      const mockEntity: Entity = {
        id: 'entity_3',
        organizationId: 'org_1',
        entityType: 'person',
        name: 'Jane Doe',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        personData: {
          firstName: 'Jane',
          lastName: 'Doe',
          company: 'Acme Corp',
          jobTitle: 'Marketing Director',
          leadSource: 'Referral',
        },
      };

      const mockOnSubmit = vi.fn();

      render(<PersonForm entity={mockEntity} onSubmit={mockOnSubmit} />);

      // Verify person-specific fields are present
      expect(screen.getByText(/First Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Last Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByText(/Phone Number/i)).toBeInTheDocument();
      expect(screen.getByText(/Company/i)).toBeInTheDocument();
      expect(screen.getByText(/Job Title/i)).toBeInTheDocument();
      expect(screen.getByText(/Lead Source/i)).toBeInTheDocument();
    });

    it('should NOT display institution-specific fields in person form', () => {
      const mockOnSubmit = vi.fn();

      render(<PersonForm onSubmit={mockOnSubmit} />);

      // Verify institution-specific fields are NOT present
      expect(screen.queryByText(/Nominal Roll/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Subscription Rate/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Billing Address/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Focal Persons/i)).not.toBeInTheDocument();
    });

    it('should NOT display family-specific fields in person form', () => {
      const mockOnSubmit = vi.fn();

      render(<PersonForm onSubmit={mockOnSubmit} />);

      // Verify family-specific fields are NOT present
      expect(screen.queryByText(/Guardians/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Children/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Family Name/i)).not.toBeInTheDocument();
    });
  });

  describe('List Columns Adaptation', () => {
    it('should display institution-specific columns', () => {
      const mockContacts: any[] = [
        {
          id: 'we_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
          entityId: 'entity_1',
          entityType: 'institution',
          displayName: 'Test School',
          currentStageName: 'Onboarding',
          status: 'active',
          workspaceTags: [],
          pipelineId: 'pipeline_1',
          stageId: 'stage_1',
          addedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          assignedTo: { userId: 'user_1', name: 'John Doe', email: 'john@test.com' },
          entity: {
            id: 'entity_1',
            organizationId: 'org_1',
            entityType: 'institution',
            name: 'Test School',
            entityContacts: [],
            globalTags: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            institutionData: {
              nominalRoll: 500,
              subscriptionRate: 25.5,
              billingAddress: '123 School St',
              currency: 'GHS',
            },
          },
        },
      ];

      render(<ContactListColumns contactScope="institution" contacts={mockContacts} />);

      // Verify institution-specific data is displayed
      expect(screen.getByText('Test School')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument(); // Nominal roll
      expect(screen.getByText(/GHS 25.50/i)).toBeInTheDocument(); // Subscription rate
      expect(screen.getByText('Onboarding')).toBeInTheDocument(); // Stage
      expect(screen.getByText('John Doe')).toBeInTheDocument(); // Assigned to
    });

    it('should display family-specific columns', () => {
      const mockContacts: any[] = [
        {
          id: 'we_2',
          organizationId: 'org_1',
          workspaceId: 'ws_2',
          entityId: 'entity_2',
          entityType: 'family',
          displayName: 'The Smith Family',
          primaryEmail: 'smith@family.com',
          currentStageName: 'Application',
          status: 'active',
          workspaceTags: [],
          pipelineId: 'pipeline_2',
          stageId: 'stage_2',
          addedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          assignedTo: { userId: 'user_2', name: 'Jane Admin', email: 'jane@test.com' },
          entity: {
            id: 'entity_2',
            organizationId: 'org_1',
            entityType: 'family',
            name: 'The Smith Family',
            entityContacts: [],
            globalTags: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            familyData: {
              guardians: [
                { name: 'John Smith', email: 'john@smith.com', phone: '+1234567890', relationship: 'Father', isPrimary: true },
                { name: 'Mary Smith', email: 'mary@smith.com', phone: '+1234567891', relationship: 'Mother', isPrimary: false },
              ],
              children: [
                { firstName: 'Emma', lastName: 'Smith', dateOfBirth: '2015-05-10', gradeLevel: 'Grade 3' },
              ],
            },
          },
        },
      ];

      render(<ContactListColumns contactScope="family" contacts={mockContacts} />);

      // Verify family-specific data is displayed
      expect(screen.getByText('The Smith Family')).toBeInTheDocument();
      expect(screen.getByText(/2 Guardians/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Child/i)).toBeInTheDocument();
      expect(screen.getByText('Application')).toBeInTheDocument();
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    it('should display person-specific columns', () => {
      const mockContacts: any[] = [
        {
          id: 'we_3',
          organizationId: 'org_1',
          workspaceId: 'ws_3',
          entityId: 'entity_3',
          entityType: 'person',
          displayName: 'Jane Doe',
          primaryEmail: 'jane@example.com',
          currentStageName: 'Qualified',
          status: 'active',
          workspaceTags: [],
          pipelineId: 'pipeline_3',
          stageId: 'stage_3',
          addedAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          entity: {
            id: 'entity_3',
            organizationId: 'org_1',
            entityType: 'person',
            name: 'Jane Doe',
            entityContacts: [],
            globalTags: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            personData: {
              firstName: 'Jane',
              lastName: 'Doe',
              company: 'Acme Corp',
              jobTitle: 'Marketing Director',
              leadSource: 'Referral',
            },
          },
        },
      ];

      render(<ContactListColumns contactScope="person" contacts={mockContacts} />);

      // Verify person-specific data is displayed
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Marketing Director')).toBeInTheDocument();
      expect(screen.getByText('Referral')).toBeInTheDocument();
      expect(screen.getByText('Qualified')).toBeInTheDocument();
    });

    it('should display correct column headers for institution scope', () => {
      render(<ContactListHeaders contactScope="institution" />);

      expect(screen.getByText('Institution')).toBeInTheDocument();
      expect(screen.getByText('Nominal Roll')).toBeInTheDocument();
      expect(screen.getByText('Rate')).toBeInTheDocument();
      expect(screen.getByText('Stage')).toBeInTheDocument();
      expect(screen.getByText('Assigned To')).toBeInTheDocument();
    });

    it('should display correct column headers for family scope', () => {
      render(<ContactListHeaders contactScope="family" />);

      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.getByText('Guardians')).toBeInTheDocument();
      expect(screen.getByText('Children')).toBeInTheDocument();
      expect(screen.getByText('Stage')).toBeInTheDocument();
      expect(screen.getByText('Assigned To')).toBeInTheDocument();
    });

    it('should display correct column headers for person scope', () => {
      render(<ContactListHeaders contactScope="person" />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Job Title')).toBeInTheDocument();
      expect(screen.getByText('Lead Source')).toBeInTheDocument();
      expect(screen.getByText('Stage')).toBeInTheDocument();
    });
  });

  describe('Detail Page Adaptation', () => {
    it('should display institution-specific sections', () => {
      const mockEntity: Entity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Test School',
        slug: 'test-school',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        institutionData: {
          nominalRoll: 500,
          subscriptionRate: 25.5,
          billingAddress: '123 School St',
          currency: 'GHS',
          implementationDate: '2024-01-15',
          referee: 'Jane Smith',
        },
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        entityId: 'entity_1',
        entityType: 'institution',
        displayName: 'Test School',
        currentStageName: 'Onboarding',
        status: 'active',
        workspaceTags: [],
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        assignedTo: { userId: 'user_1', name: 'John Doe', email: 'john@test.com' },
        entityContacts: [],
      };

      render(<ContactDetailPage entity={mockEntity} workspaceEntity={mockWorkspaceEntity} />);

      // Verify institution-specific sections are present
      expect(screen.getByText('Test School')).toBeInTheDocument();
      expect(screen.getByText('School')).toBeInTheDocument(); // Entity type badge
      expect(screen.getByText('Institution Profile')).toBeInTheDocument();
      expect(screen.getByText('Financial Profile')).toBeInTheDocument();
      expect(screen.getByText('Focal Persons')).toBeInTheDocument();
      expect(screen.getByText(/500/)).toBeInTheDocument(); // Nominal roll
      expect(screen.getByText(/GHS 25.50/)).toBeInTheDocument(); // Subscription rate
    });

    it('should display family-specific sections', () => {
      const mockEntity: Entity = {
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'family',
        name: 'The Smith Family',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        familyData: {
          guardians: [
            {
              name: 'John Smith',
              email: 'john@smith.com',
              phone: '+1234567890',
              relationship: 'Father',
              isPrimary: true,
            },
          ],
          children: [
            {
              firstName: 'Emma',
              lastName: 'Smith',
              dateOfBirth: '2015-05-10',
              gradeLevel: 'Grade 3',
              enrollmentStatus: 'Enrolled',
            },
          ],
        },
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_2',
        organizationId: 'org_1',
        workspaceId: 'ws_2',
        entityId: 'entity_2',
        entityType: 'family',
        displayName: 'The Smith Family',
        currentStageName: 'Application',
        status: 'active',
        workspaceTags: [],
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      render(<ContactDetailPage entity={mockEntity} workspaceEntity={mockWorkspaceEntity} />);

      // Verify family-specific sections are present
      expect(screen.getByText('The Smith Family')).toBeInTheDocument();
      expect(screen.getByText('Family')).toBeInTheDocument(); // Entity type badge
      expect(screen.getByText('Guardians')).toBeInTheDocument();
      expect(screen.getByText('Children')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Emma Smith')).toBeInTheDocument();
      expect(screen.getByText('Admissions Pipeline')).toBeInTheDocument();
    });

    it('should display person-specific sections', () => {
      const mockEntity: Entity = {
        id: 'entity_3',
        organizationId: 'org_1',
        entityType: 'person',
        name: 'Jane Doe',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        personData: {
          firstName: 'Jane',
          lastName: 'Doe',
          company: 'Acme Corp',
          jobTitle: 'Marketing Director',
          leadSource: 'Referral',
        },
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_3',
        organizationId: 'org_1',
        workspaceId: 'ws_3',
        entityId: 'entity_3',
        entityType: 'person',
        displayName: 'Jane Doe',
        currentStageName: 'Qualified',
        status: 'active',
        workspaceTags: [],
        pipelineId: 'pipeline_3',
        stageId: 'stage_3',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      render(<ContactDetailPage entity={mockEntity} workspaceEntity={mockWorkspaceEntity} />);

      // Verify person-specific sections are present
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
      expect(screen.getByText('Person')).toBeInTheDocument(); // Entity type badge
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      expect(screen.getByText('Professional Information')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Marketing Director')).toBeInTheDocument();
      expect(screen.getByText('Referral')).toBeInTheDocument();
    });

    it('should NOT display institution fields in family detail page', () => {
      const mockEntity: Entity = {
        id: 'entity_2',
        organizationId: 'org_1',
        entityType: 'family',
        name: 'The Smith Family',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        familyData: {
          guardians: [],
          children: [],
        },
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_2',
        organizationId: 'org_1',
        workspaceId: 'ws_2',
        entityId: 'entity_2',
        entityType: 'family',
        displayName: 'The Smith Family',
        status: 'active',
        workspaceTags: [],
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      render(<ContactDetailPage entity={mockEntity} workspaceEntity={mockWorkspaceEntity} />);

      // Verify institution-specific sections are NOT present
      expect(screen.queryByText('Institution Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Financial Profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Nominal Roll')).not.toBeInTheDocument();
      expect(screen.queryByText('Subscription Rate')).not.toBeInTheDocument();
    });

    it('should NOT display family fields in person detail page', () => {
      const mockEntity: Entity = {
        id: 'entity_3',
        organizationId: 'org_1',
        entityType: 'person',
        name: 'Jane Doe',
        entityContacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        personData: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      };

      const mockWorkspaceEntity: WorkspaceEntity = {
        id: 'we_3',
        organizationId: 'org_1',
        workspaceId: 'ws_3',
        entityId: 'entity_3',
        entityType: 'person',
        displayName: 'Jane Doe',
        status: 'active',
        workspaceTags: [],
        pipelineId: 'pipeline_3',
        stageId: 'stage_3',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        entityContacts: [],
      };

      render(<ContactDetailPage entity={mockEntity} workspaceEntity={mockWorkspaceEntity} />);

      // Verify family-specific sections are NOT present
      expect(screen.queryByText('Guardians')).not.toBeInTheDocument();
      expect(screen.queryByText('Children')).not.toBeInTheDocument();
      expect(screen.queryByText('Admissions Pipeline')).not.toBeInTheDocument();
    });
  });
});
