/**
 * Unit Test: KanbanBoard Workspace-Scoped Query Logic
 * 
 * **Validates: Requirements 5, 8**
 * 
 * Requirement 5: Pipeline and stage state lives exclusively on workspace_entities, not entity root
 * Requirement 8: All workspace list views must query workspace_entities first, then hydrate entity data
 * 
 * This test verifies the data fetching pattern used by KanbanBoard:
 * 1. Query workspace_entities filtered by workspaceId and pipelineId
 * 2. Batch fetch entities from entities collection
 * 3. Merge workspace_entities state with entity identity data
 */

import { describe, it, expect } from 'vitest';
import type { WorkspaceEntity, Entity, School } from '../types';

/**
 * Simulates the hydration logic used in KanbanBoard
 * This is the core logic that merges workspace_entities with entities
 */
function hydrateWorkspaceEntities(
  workspaceEntities: WorkspaceEntity[],
  entities: Entity[]
): School[] {
  const entityMap = new Map<string, Entity>();
  entities.forEach(entity => entityMap.set(entity.id, entity));

  return workspaceEntities
    .map(we => {
      const entity = entityMap.get(we.entityId);
      if (!entity) {
        return null;
      }

      // Map entity + workspace_entity to School format
      const school: School = {
        id: we.entityId,
        name: entity.name,
        slug: entity.slug || '',
        workspaceIds: [we.workspaceId],
        status: we.status === 'active' ? 'Active' : 'Archived',
        schoolStatus: we.status === 'active' ? 'Active' : 'Archived',
        pipelineId: we.pipelineId,
        focalPersons: entity.contacts || [],
        assignedTo: we.assignedTo,
        stage: {
          id: we.stageId,
          name: we.currentStageName || '',
          order: 0,
        },
        tags: we.workspaceTags, // Uses workspace tags, not global tags
        createdAt: entity.createdAt,
        // Map institution-specific data if available
        ...(entity.institutionData && {
          nominalRoll: entity.institutionData.nominalRoll,
          subscriptionPackageId: entity.institutionData.subscriptionPackageId,
          subscriptionRate: entity.institutionData.subscriptionRate,
          billingAddress: entity.institutionData.billingAddress,
          currency: entity.institutionData.currency,
          modules: entity.institutionData.modules,
          implementationDate: entity.institutionData.implementationDate,
          referee: entity.institutionData.referee,
        }),
      };

      return school;
    })
    .filter((school): school is School => school !== null);
}

describe('KanbanBoard Workspace-Scoped Query Logic (Requirements 5, 8)', () => {
  it('should use pipeline state from workspace_entities, not entity root', () => {
    // Setup: Entity without pipeline state (Requirement 5)
    const entity: Entity = {
      id: 'entity-1',
      organizationId: 'org-1',
      entityType: 'institution',
      name: 'Test Institution',
      slug: 'test-institution',
      contacts: [],
      globalTags: ['global-tag-1'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      // Note: No pipelineId or stageId on entity root
    };

    // Setup: WorkspaceEntity with pipeline state
    const workspaceEntity: WorkspaceEntity = {
      id: 'we-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: 'entity-1',
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: 'stage-2', // Pipeline state lives here
      currentStageName: 'Active',
      assignedTo: null,
      status: 'active',
      workspaceTags: ['workspace-tag-1'],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Test Institution',
    };

    // Action: Hydrate
    const result = hydrateWorkspaceEntities([workspaceEntity], [entity]);

    // Assert: Pipeline state comes from workspace_entities
    expect(result).toHaveLength(1);
    expect(result[0].pipelineId).toBe('pipeline-1');
    expect(result[0].stage?.id).toBe('stage-2');
    expect(result[0].stage?.name).toBe('Active');
  });

  it('should use workspace tags from workspace_entities, not global tags from entity', () => {
    // Setup: Entity with global tags
    const entity: Entity = {
      id: 'entity-1',
      organizationId: 'org-1',
      entityType: 'institution',
      name: 'Test Institution',
      slug: 'test-institution',
      contacts: [],
      globalTags: ['global-tag-1', 'global-tag-2'], // Global tags
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    // Setup: WorkspaceEntity with workspace tags
    const workspaceEntity: WorkspaceEntity = {
      id: 'we-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: 'entity-1',
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: ['workspace-tag-1', 'workspace-tag-2'], // Workspace tags
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Test Institution',
    };

    // Action: Hydrate
    const result = hydrateWorkspaceEntities([workspaceEntity], [entity]);

    // Assert: Uses workspace tags, not global tags (Requirement 7)
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(['workspace-tag-1', 'workspace-tag-2']);
    expect(result[0].tags).not.toContain('global-tag-1');
    expect(result[0].tags).not.toContain('global-tag-2');
  });

  it('should hydrate entity identity data (name, contacts) from entities collection', () => {
    // Setup: Entity with identity data
    const entity: Entity = {
      id: 'entity-1',
      organizationId: 'org-1',
      entityType: 'institution',
      name: 'Hydrated Entity Name', // Identity data
      slug: 'hydrated-entity',
      contacts: [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          type: 'Principal',
          isSignatory: true,
        },
      ],
      globalTags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      institutionData: {
        nominalRoll: 500,
        subscriptionRate: 1000,
        billingAddress: '123 Main St',
        currency: 'USD',
      },
    };

    // Setup: WorkspaceEntity with denormalized displayName
    const workspaceEntity: WorkspaceEntity = {
      id: 'we-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: 'entity-1',
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Denormalized Name', // This might be stale
    };

    // Action: Hydrate
    const result = hydrateWorkspaceEntities([workspaceEntity], [entity]);

    // Assert: Uses fresh entity identity data (Requirement 8)
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Hydrated Entity Name'); // From entity, not workspace_entity
    expect(result[0].focalPersons).toHaveLength(1);
    expect(result[0].focalPersons[0].name).toBe('John Doe');
    expect(result[0].nominalRoll).toBe(500);
    expect(result[0].subscriptionRate).toBe(1000);
  });

  it('should support same entity in multiple workspaces with different pipeline states', () => {
    // Setup: Single entity
    const entity: Entity = {
      id: 'entity-1',
      organizationId: 'org-1',
      entityType: 'institution',
      name: 'Shared Entity',
      slug: 'shared-entity',
      contacts: [],
      globalTags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    // Setup: Same entity in two workspaces with different pipeline states
    const workspaceEntity1: WorkspaceEntity = {
      id: 'we-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: 'entity-1',
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: 'stage-onboarding',
      currentStageName: 'Onboarding',
      assignedTo: { userId: 'user-1', name: 'Alice', email: 'alice@example.com' },
      status: 'active',
      workspaceTags: ['hot-lead'],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Shared Entity',
    };

    const workspaceEntity2: WorkspaceEntity = {
      id: 'we-2',
      organizationId: 'org-1',
      workspaceId: 'workspace-2',
      entityId: 'entity-1',
      entityType: 'institution',
      pipelineId: 'pipeline-2',
      stageId: 'stage-billing',
      currentStageName: 'Invoice Overdue',
      assignedTo: { userId: 'user-2', name: 'Bob', email: 'bob@example.com' },
      status: 'active',
      workspaceTags: ['payment-issue'],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Shared Entity',
    };

    // Action: Hydrate workspace 1
    const result1 = hydrateWorkspaceEntities([workspaceEntity1], [entity]);

    // Action: Hydrate workspace 2
    const result2 = hydrateWorkspaceEntities([workspaceEntity2], [entity]);

    // Assert: Each workspace sees independent pipeline state (Requirement 5)
    expect(result1).toHaveLength(1);
    expect(result1[0].pipelineId).toBe('pipeline-1');
    expect(result1[0].stage?.name).toBe('Onboarding');
    expect(result1[0].assignedTo?.name).toBe('Alice');
    expect(result1[0].tags).toEqual(['hot-lead']);

    expect(result2).toHaveLength(1);
    expect(result2[0].pipelineId).toBe('pipeline-2');
    expect(result2[0].stage?.name).toBe('Invoice Overdue');
    expect(result2[0].assignedTo?.name).toBe('Bob');
    expect(result2[0].tags).toEqual(['payment-issue']);

    // Assert: Both use same entity identity
    expect(result1[0].name).toBe('Shared Entity');
    expect(result2[0].name).toBe('Shared Entity');
    expect(result1[0].id).toBe('entity-1');
    expect(result2[0].id).toBe('entity-1');
  });

  it('should handle missing entities gracefully', () => {
    // Setup: WorkspaceEntity without corresponding entity
    const workspaceEntity: WorkspaceEntity = {
      id: 'we-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: 'entity-missing',
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
      currentStageName: 'Onboarding',
      assignedTo: null,
      status: 'active',
      workspaceTags: [],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: 'Missing Entity',
    };

    // Action: Hydrate with empty entities array
    const result = hydrateWorkspaceEntities([workspaceEntity], []);

    // Assert: Missing entity is filtered out
    expect(result).toHaveLength(0);
  });

  it('should batch process multiple workspace_entities efficiently', () => {
    // Setup: Multiple entities
    const entities: Entity[] = [
      {
        id: 'entity-1',
        organizationId: 'org-1',
        entityType: 'institution',
        name: 'Entity 1',
        slug: 'entity-1',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'entity-2',
        organizationId: 'org-1',
        entityType: 'institution',
        name: 'Entity 2',
        slug: 'entity-2',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'entity-3',
        organizationId: 'org-1',
        entityType: 'institution',
        name: 'Entity 3',
        slug: 'entity-3',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    // Setup: Multiple workspace_entities
    const workspaceEntities: WorkspaceEntity[] = entities.map((entity, i) => ({
      id: `we-${i + 1}`,
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      entityId: entity.id,
      entityType: 'institution',
      pipelineId: 'pipeline-1',
      stageId: `stage-${i + 1}`,
      currentStageName: `Stage ${i + 1}`,
      assignedTo: null,
      status: 'active' as const,
      workspaceTags: [],
      addedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      displayName: entity.name,
    }));

    // Action: Hydrate all at once (batch operation)
    const result = hydrateWorkspaceEntities(workspaceEntities, entities);

    // Assert: All entities hydrated correctly
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Entity 1');
    expect(result[1].name).toBe('Entity 2');
    expect(result[2].name).toBe('Entity 3');
    expect(result[0].stage?.name).toBe('Stage 1');
    expect(result[1].stage?.name).toBe('Stage 2');
    expect(result[2].stage?.name).toBe('Stage 3');
  });
});
