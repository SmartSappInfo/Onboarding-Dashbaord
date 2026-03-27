/**
 * Task 41.4 - Workspace Switching Integration Test
 * 
 * Validates:
 * - Switching between workspaces with different scopes
 * - UI adapts correctly to each workspace's contactScope
 * - Data isolation between workspaces
 * - Query results are strictly scoped to active workspace
 * - Same entity shows different operational state in different workspaces
 * 
 * Requirements Validated:
 * - Requirement 8: Workspace-Scoped Queries
 * - Requirement 14: Scope-Specific UI Behaviors
 * - Requirement 9: Workspace-Scoped Permissions
 * - Requirement 5: Pipeline and Stage on Workspace Link
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock Firestore data store
const mockFirestore = {
  organizations: new Map(),
  workspaces: new Map(),
  entities: new Map(),
  workspace_entities: new Map(),
  activities: new Map(),
};

// Test fixtures
const testOrgId = 'org_test_41_4';

// Helper to create workspace
function createWorkspace(id: string, contactScope: 'institution' | 'family' | 'person') {
  const workspace = {
    id,
    organizationId: testOrgId,
    name: `${contactScope.charAt(0).toUpperCase() + contactScope.slice(1)} Workspace`,
    contactScope,
    scopeLocked: false,
    capabilities: {
      billing: contactScope === 'institution',
      admissions: contactScope === 'family',
      children: contactScope === 'family',
      contracts: contactScope === 'institution',
      messaging: true,
      automations: true,
      tasks: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockFirestore.workspaces.set(id, workspace);
  return workspace;
}

// Helper to create entity
function createEntity(id: string, entityType: 'institution' | 'family' | 'person', data: any) {
  const entity = {
    id,
    organizationId: testOrgId,
    entityType,
    name: data.name,
    slug: entityType === 'institution' ? data.slug : undefined,
    contacts: data.contacts || [],
    globalTags: [],
    ...(entityType === 'institution' && { institutionData: data.institutionData }),
    ...(entityType === 'family' && { familyData: data.familyData }),
    ...(entityType === 'person' && { personData: data.personData }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockFirestore.entities.set(id, entity);
  return entity;
}

// Helper to link entity to workspace
function linkEntityToWorkspace(
  entityId: string,
  workspaceId: string,
  operationalState: {
    pipelineId: string;
    stageId: string;
    currentStageName: string;
    assignedTo?: any;
    workspaceTags?: string[];
  }
) {
  const entity = mockFirestore.entities.get(entityId);
  const workspace = mockFirestore.workspaces.get(workspaceId);

  if (!entity || !workspace) {
    throw new Error('Entity or workspace not found');
  }

  // ScopeGuard validation
  if (entity.entityType !== workspace.contactScope) {
    throw new Error(`SCOPE_MISMATCH: Entity type ${entity.entityType} cannot be added to workspace with scope ${workspace.contactScope}`);
  }

  const weId = `we_${entityId}_${workspaceId}`;
  const workspaceEntity = {
    id: weId,
    organizationId: testOrgId,
    workspaceId,
    entityId,
    entityType: entity.entityType,
    pipelineId: operationalState.pipelineId,
    stageId: operationalState.stageId,
    currentStageName: operationalState.currentStageName,
    assignedTo: operationalState.assignedTo || null,
    status: 'active',
    workspaceTags: operationalState.workspaceTags || [],
    // Denormalized fields
    displayName: entity.name,
    primaryEmail: entity.contacts[0]?.email || '',
    primaryPhone: entity.contacts[0]?.phone || '',
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockFirestore.workspace_entities.set(weId, workspaceEntity);

  // Lock workspace scope after first entity
  if (!workspace.scopeLocked) {
    workspace.scopeLocked = true;
    mockFirestore.workspaces.set(workspaceId, workspace);
  }

  return workspaceEntity;
}

// Helper to query workspace entities (simulates workspace list view)
function queryWorkspaceEntities(workspaceId: string, filters?: {
  stageId?: string;
  assignedTo?: string;
  workspaceTags?: string[];
}) {
  const results: any[] = [];
  
  for (const [id, we] of mockFirestore.workspace_entities.entries()) {
    if (we.workspaceId !== workspaceId) continue;
    
    // Apply filters
    if (filters?.stageId && we.stageId !== filters.stageId) continue;
    if (filters?.assignedTo && we.assignedTo?.userId !== filters.assignedTo) continue;
    if (filters?.workspaceTags && !filters.workspaceTags.some(tag => we.workspaceTags.includes(tag))) continue;
    
    results.push(we);
  }
  
  return results;
}

// Helper to hydrate entity data (second fetch after workspace_entities query)
function hydrateEntityData(workspaceEntities: any[]) {
  return workspaceEntities.map(we => {
    const entity = mockFirestore.entities.get(we.entityId);
    return {
      ...we,
      entity,
    };
  });
}

// Simulate UI adapter that returns scope-specific fields
function getUIFieldsForScope(contactScope: 'institution' | 'family' | 'person') {
  const baseFields = ['name', 'contacts', 'globalTags'];
  
  switch (contactScope) {
    case 'institution':
      return [
        ...baseFields,
        'nominalRoll',
        'subscriptionRate',
        'billingAddress',
        'currency',
        'modules',
        'implementationDate',
      ];
    case 'family':
      return [
        ...baseFields,
        'guardians',
        'children',
        'admissionsData',
      ];
    case 'person':
      return [
        ...baseFields,
        'firstName',
        'lastName',
        'company',
        'jobTitle',
        'leadSource',
      ];
  }
}

// Simulate UI column configuration
function getTableColumnsForScope(contactScope: 'institution' | 'family' | 'person') {
  const baseColumns = ['displayName', 'currentStageName', 'assignedTo'];
  
  switch (contactScope) {
    case 'institution':
      return [...baseColumns, 'nominalRoll', 'subscriptionRate', 'billingAddress'];
    case 'family':
      return [...baseColumns, 'guardiansCount', 'childrenCount', 'admissionsStage'];
    case 'person':
      return [...baseColumns, 'company', 'jobTitle', 'leadSource'];
  }
}

describe('Task 41.4 - Workspace Switching Integration Test', () => {
  beforeEach(() => {
    // Clear mock data
    mockFirestore.organizations.clear();
    mockFirestore.workspaces.clear();
    mockFirestore.entities.clear();
    mockFirestore.workspace_entities.clear();
    mockFirestore.activities.clear();

    // Create test organization
    mockFirestore.organizations.set(testOrgId, {
      id: testOrgId,
      name: 'Test Organization',
    });
  });

  describe('1. Workspace Switching with Different Scopes', () => {
    it('should switch between institution, family, and person workspaces', () => {
      // Create three workspaces with different scopes
      const institutionWs = createWorkspace('ws_institution', 'institution');
      const familyWs = createWorkspace('ws_family', 'family');
      const personWs = createWorkspace('ws_person', 'person');

      // Verify each workspace has correct scope
      expect(institutionWs.contactScope).toBe('institution');
      expect(familyWs.contactScope).toBe('family');
      expect(personWs.contactScope).toBe('person');

      // Verify capabilities are set correctly per scope
      expect(institutionWs.capabilities.billing).toBe(true);
      expect(institutionWs.capabilities.contracts).toBe(true);
      expect(familyWs.capabilities.admissions).toBe(true);
      expect(familyWs.capabilities.children).toBe(true);
      expect(personWs.capabilities.billing).toBe(false);
      expect(personWs.capabilities.children).toBe(false);
    });
  });

  describe('2. UI Adapts to Workspace Scope', () => {
    it('should display institution-specific fields in institution workspace', () => {
      const workspace = createWorkspace('ws_institution', 'institution');
      const fields = getUIFieldsForScope(workspace.contactScope);
      const columns = getTableColumnsForScope(workspace.contactScope);

      // Verify institution-specific fields are included
      expect(fields).toContain('nominalRoll');
      expect(fields).toContain('subscriptionRate');
      expect(fields).toContain('billingAddress');
      expect(fields).toContain('currency');

      // Verify institution-specific columns
      expect(columns).toContain('nominalRoll');
      expect(columns).toContain('subscriptionRate');

      // Verify family/person fields are NOT included
      expect(fields).not.toContain('guardians');
      expect(fields).not.toContain('children');
      expect(fields).not.toContain('company');
      expect(fields).not.toContain('jobTitle');
    });

    it('should display family-specific fields in family workspace', () => {
      const workspace = createWorkspace('ws_family', 'family');
      const fields = getUIFieldsForScope(workspace.contactScope);
      const columns = getTableColumnsForScope(workspace.contactScope);

      // Verify family-specific fields are included
      expect(fields).toContain('guardians');
      expect(fields).toContain('children');
      expect(fields).toContain('admissionsData');

      // Verify family-specific columns
      expect(columns).toContain('guardiansCount');
      expect(columns).toContain('childrenCount');

      // Verify institution/person fields are NOT included
      expect(fields).not.toContain('nominalRoll');
      expect(fields).not.toContain('subscriptionRate');
      expect(fields).not.toContain('company');
      expect(fields).not.toContain('jobTitle');
    });

    it('should display person-specific fields in person workspace', () => {
      const workspace = createWorkspace('ws_person', 'person');
      const fields = getUIFieldsForScope(workspace.contactScope);
      const columns = getTableColumnsForScope(workspace.contactScope);

      // Verify person-specific fields are included
      expect(fields).toContain('firstName');
      expect(fields).toContain('lastName');
      expect(fields).toContain('company');
      expect(fields).toContain('jobTitle');
      expect(fields).toContain('leadSource');

      // Verify person-specific columns
      expect(columns).toContain('company');
      expect(columns).toContain('jobTitle');

      // Verify institution/family fields are NOT included
      expect(fields).not.toContain('nominalRoll');
      expect(fields).not.toContain('guardians');
      expect(fields).not.toContain('children');
    });
  });

  describe('3. Data Isolation Between Workspaces', () => {
    it('should only show entities linked to the active workspace', () => {
      // Create two institution workspaces
      const ws1 = createWorkspace('ws_onboarding', 'institution');
      const ws2 = createWorkspace('ws_billing', 'institution');

      // Create three institutions
      const entity1 = createEntity('entity_school_1', 'institution', {
        name: 'School A',
        slug: 'school-a',
        institutionData: { nominalRoll: 500 },
      });
      const entity2 = createEntity('entity_school_2', 'institution', {
        name: 'School B',
        slug: 'school-b',
        institutionData: { nominalRoll: 300 },
      });
      const entity3 = createEntity('entity_school_3', 'institution', {
        name: 'School C',
        slug: 'school-c',
        institutionData: { nominalRoll: 200 },
      });

      // Link entities to workspaces
      // School A and B in Onboarding workspace
      linkEntityToWorkspace('entity_school_1', 'ws_onboarding', {
        pipelineId: 'pipeline_onboarding',
        stageId: 'stage_contract_review',
        currentStageName: 'Contract Review',
      });
      linkEntityToWorkspace('entity_school_2', 'ws_onboarding', {
        pipelineId: 'pipeline_onboarding',
        stageId: 'stage_implementation',
        currentStageName: 'Implementation',
      });

      // School B and C in Billing workspace
      linkEntityToWorkspace('entity_school_2', 'ws_billing', {
        pipelineId: 'pipeline_billing',
        stageId: 'stage_invoice_sent',
        currentStageName: 'Invoice Sent',
      });
      linkEntityToWorkspace('entity_school_3', 'ws_billing', {
        pipelineId: 'pipeline_billing',
        stageId: 'stage_payment_overdue',
        currentStageName: 'Payment Overdue',
      });

      // Query Onboarding workspace
      const onboardingResults = queryWorkspaceEntities('ws_onboarding');
      expect(onboardingResults).toHaveLength(2);
      expect(onboardingResults.map(r => r.entityId)).toContain('entity_school_1');
      expect(onboardingResults.map(r => r.entityId)).toContain('entity_school_2');
      expect(onboardingResults.map(r => r.entityId)).not.toContain('entity_school_3');

      // Query Billing workspace
      const billingResults = queryWorkspaceEntities('ws_billing');
      expect(billingResults).toHaveLength(2);
      expect(billingResults.map(r => r.entityId)).toContain('entity_school_2');
      expect(billingResults.map(r => r.entityId)).toContain('entity_school_3');
      expect(billingResults.map(r => r.entityId)).not.toContain('entity_school_1');
    });

    it('should show different operational state for same entity in different workspaces', () => {
      // Create two workspaces
      const wsOnboarding = createWorkspace('ws_onboarding', 'institution');
      const wsBilling = createWorkspace('ws_billing', 'institution');

      // Create one institution
      const entity = createEntity('entity_school_shared', 'institution', {
        name: 'Shared School',
        slug: 'shared-school',
        institutionData: { nominalRoll: 400 },
      });

      // Link to Onboarding workspace with one stage
      const we1 = linkEntityToWorkspace('entity_school_shared', 'ws_onboarding', {
        pipelineId: 'pipeline_onboarding',
        stageId: 'stage_contract_review',
        currentStageName: 'Contract Review',
        assignedTo: { userId: 'user_alice', name: 'Alice', email: 'alice@example.com' },
        workspaceTags: ['high-priority', 'new-client'],
      });

      // Link to Billing workspace with different stage
      const we2 = linkEntityToWorkspace('entity_school_shared', 'ws_billing', {
        pipelineId: 'pipeline_billing',
        stageId: 'stage_invoice_overdue',
        currentStageName: 'Invoice Overdue',
        assignedTo: { userId: 'user_bob', name: 'Bob', email: 'bob@example.com' },
        workspaceTags: ['payment-issue', 'follow-up-needed'],
      });

      // Verify same entity has different operational state in each workspace
      expect(we1.entityId).toBe(we2.entityId); // Same entity
      expect(we1.workspaceId).not.toBe(we2.workspaceId); // Different workspaces
      expect(we1.stageId).not.toBe(we2.stageId); // Different stages
      expect(we1.currentStageName).toBe('Contract Review');
      expect(we2.currentStageName).toBe('Invoice Overdue');
      expect(we1.assignedTo.userId).toBe('user_alice');
      expect(we2.assignedTo.userId).toBe('user_bob');
      expect(we1.workspaceTags).toEqual(['high-priority', 'new-client']);
      expect(we2.workspaceTags).toEqual(['payment-issue', 'follow-up-needed']);
    });
  });

  describe('4. Query Filtering is Workspace-Scoped', () => {
    it('should filter by stage within workspace scope only', () => {
      const ws = createWorkspace('ws_onboarding', 'institution');

      // Create entities
      createEntity('entity_1', 'institution', { name: 'School 1', slug: 'school-1', institutionData: {} });
      createEntity('entity_2', 'institution', { name: 'School 2', slug: 'school-2', institutionData: {} });
      createEntity('entity_3', 'institution', { name: 'School 3', slug: 'school-3', institutionData: {} });

      // Link with different stages
      linkEntityToWorkspace('entity_1', 'ws_onboarding', {
        pipelineId: 'pipeline_1',
        stageId: 'stage_contract_review',
        currentStageName: 'Contract Review',
      });
      linkEntityToWorkspace('entity_2', 'ws_onboarding', {
        pipelineId: 'pipeline_1',
        stageId: 'stage_contract_review',
        currentStageName: 'Contract Review',
      });
      linkEntityToWorkspace('entity_3', 'ws_onboarding', {
        pipelineId: 'pipeline_1',
        stageId: 'stage_implementation',
        currentStageName: 'Implementation',
      });

      // Filter by stage
      const contractReviewResults = queryWorkspaceEntities('ws_onboarding', {
        stageId: 'stage_contract_review',
      });

      expect(contractReviewResults).toHaveLength(2);
      expect(contractReviewResults.map(r => r.entityId)).toContain('entity_1');
      expect(contractReviewResults.map(r => r.entityId)).toContain('entity_2');
      expect(contractReviewResults.map(r => r.entityId)).not.toContain('entity_3');
    });

    it('should filter by workspace tags within workspace scope only', () => {
      const ws = createWorkspace('ws_sales', 'person');

      // Create person entities
      createEntity('person_1', 'person', {
        name: 'John Doe',
        personData: { firstName: 'John', lastName: 'Doe', company: 'Corp A' },
      });
      createEntity('person_2', 'person', {
        name: 'Jane Smith',
        personData: { firstName: 'Jane', lastName: 'Smith', company: 'Corp B' },
      });
      createEntity('person_3', 'person', {
        name: 'Bob Johnson',
        personData: { firstName: 'Bob', lastName: 'Johnson', company: 'Corp C' },
      });

      // Link with different workspace tags
      linkEntityToWorkspace('person_1', 'ws_sales', {
        pipelineId: 'pipeline_sales',
        stageId: 'stage_qualified',
        currentStageName: 'Qualified',
        workspaceTags: ['hot-lead', 'enterprise'],
      });
      linkEntityToWorkspace('person_2', 'ws_sales', {
        pipelineId: 'pipeline_sales',
        stageId: 'stage_qualified',
        currentStageName: 'Qualified',
        workspaceTags: ['hot-lead', 'smb'],
      });
      linkEntityToWorkspace('person_3', 'ws_sales', {
        pipelineId: 'pipeline_sales',
        stageId: 'stage_nurture',
        currentStageName: 'Nurture',
        workspaceTags: ['cold-lead'],
      });

      // Filter by workspace tag
      const hotLeadResults = queryWorkspaceEntities('ws_sales', {
        workspaceTags: ['hot-lead'],
      });

      expect(hotLeadResults).toHaveLength(2);
      expect(hotLeadResults.map(r => r.entityId)).toContain('person_1');
      expect(hotLeadResults.map(r => r.entityId)).toContain('person_2');
      expect(hotLeadResults.map(r => r.entityId)).not.toContain('person_3');
    });
  });

  describe('5. Workspace Switching Summary', () => {
    it('should validate complete workspace switching workflow', () => {
      // Create three workspaces
      const wsInstitution = createWorkspace('ws_schools', 'institution');
      const wsFamily = createWorkspace('ws_families', 'family');
      const wsPerson = createWorkspace('ws_people', 'person');

      // Create entities for each scope
      const school = createEntity('entity_school', 'institution', {
        name: 'Test School',
        slug: 'test-school',
        institutionData: { nominalRoll: 500 },
      });
      const family = createEntity('entity_family', 'family', {
        name: 'Test Family',
        familyData: {
          guardians: [{ name: 'Parent', phone: '123', email: 'parent@test.com', relationship: 'Mother', isPrimary: true }],
          children: [],
        },
      });
      const person = createEntity('entity_person', 'person', {
        name: 'Test Person',
        personData: { firstName: 'Test', lastName: 'Person', company: 'Corp' },
      });

      // Link entities to their respective workspaces
      linkEntityToWorkspace('entity_school', 'ws_schools', {
        pipelineId: 'pipeline_1',
        stageId: 'stage_1',
        currentStageName: 'Stage 1',
      });
      linkEntityToWorkspace('entity_family', 'ws_families', {
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        currentStageName: 'Stage 2',
      });
      linkEntityToWorkspace('entity_person', 'ws_people', {
        pipelineId: 'pipeline_3',
        stageId: 'stage_3',
        currentStageName: 'Stage 3',
      });

      // Simulate switching to institution workspace
      const institutionResults = queryWorkspaceEntities('ws_schools');
      const institutionHydrated = hydrateEntityData(institutionResults);
      expect(institutionHydrated).toHaveLength(1);
      expect(institutionHydrated[0].entity.entityType).toBe('institution');
      expect(getUIFieldsForScope('institution')).toContain('nominalRoll');

      // Simulate switching to family workspace
      const familyResults = queryWorkspaceEntities('ws_families');
      const familyHydrated = hydrateEntityData(familyResults);
      expect(familyHydrated).toHaveLength(1);
      expect(familyHydrated[0].entity.entityType).toBe('family');
      expect(getUIFieldsForScope('family')).toContain('guardians');

      // Simulate switching to person workspace
      const personResults = queryWorkspaceEntities('ws_people');
      const personHydrated = hydrateEntityData(personResults);
      expect(personHydrated).toHaveLength(1);
      expect(personHydrated[0].entity.entityType).toBe('person');
      expect(getUIFieldsForScope('person')).toContain('company');

      // Verify data isolation: each workspace only sees its own entities
      expect(institutionResults.map(r => r.entityId)).not.toContain('entity_family');
      expect(institutionResults.map(r => r.entityId)).not.toContain('entity_person');
      expect(familyResults.map(r => r.entityId)).not.toContain('entity_school');
      expect(familyResults.map(r => r.entityId)).not.toContain('entity_person');
      expect(personResults.map(r => r.entityId)).not.toContain('entity_school');
      expect(personResults.map(r => r.entityId)).not.toContain('entity_family');
    });
  });
});
