/**
 * @fileOverview Unit & Contract Tests for Domain: crm_contacts (PR-12 / Wave B-2)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 12 (Risk Level), Rule 18 (TOCTOU),
 * Rule 23 (State Changed Invariant), Rule 31 (Output Schema Validation), and Rule 47 (Tenant Isolation).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { defineContractSuite } from '../contract/define-contract-suite';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import {
  entitySearchCapability,
  entityGetCapability,
  entityCreateCapability,
  entityUpdateCapability,
  workspaceEntityUpdateCapability,
  workspaceEntityArchiveCapability,
} from '../../domains/crm_contacts/contracts/entity-capabilities.contract';

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_entity_author',
  organizationId: 'org_entity_test',
  workspaceId: 'ws_entity_test',
  grantedScopes: [
    'operations:campuses:view',
    'operations:campuses:create',
    'operations:campuses:edit',
    'operations:campuses:delete',
    'app:contacts_view',
    'app:contacts_create',
    'app:contacts_edit',
    'app:contacts_delete',
    'crm:entities:read',
    'crm:entities:create',
    'crm:entities:edit',
    'crm:entities:delete',
  ],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_entity_unauth',
  organizationId: 'org_entity_test',
  workspaceId: 'ws_entity_test',
  grantedScopes: ['finance:invoices:view'],
  effectiveRole: 'viewer',
};

const foreignWorkspacePrincipal: AgentPrincipal = {
  ...authorizedPrincipal,
  workspaceId: 'ws_foreign_entity',
  organizationId: 'org_foreign_entity',
};

// 1. Contract Suite: crm.entity.search
defineContractSuite({
  capability: entitySearchCapability,
  validInput: { workspaceId: 'ws_entity_test', limit: 10 },
  invalidInput: { workspaceId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 2. Contract Suite: crm.entity.get
defineContractSuite({
  capability: entityGetCapability,
  validInput: { workspaceId: 'ws_entity_test', entityId: 'entity_sample_001' },
  invalidInput: { workspaceId: 'ws_entity_test', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 3. Contract Suite: crm.entity.create
defineContractSuite({
  capability: entityCreateCapability,
  validInput: {
    workspaceId: 'ws_entity_test',
    name: 'Acme Global Corp',
    type: 'company',
    status: 'active',
  },
  invalidInput: { workspaceId: '', name: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 4. Contract Suite: crm.entity.update
defineContractSuite({
  capability: entityUpdateCapability,
  validInput: {
    workspaceId: 'ws_entity_test',
    entityId: 'entity_sample_001',
    name: 'Acme International',
  },
  invalidInput: { workspaceId: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 5. Contract Suite: crm.workspace_entity.update
defineContractSuite({
  capability: workspaceEntityUpdateCapability,
  validInput: {
    workspaceId: 'ws_entity_test',
    entityId: 'entity_sample_001',
    notes: 'Key partner account',
  },
  invalidInput: { workspaceId: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 6. Contract Suite: crm.workspace_entity.archive
defineContractSuite({
  capability: workspaceEntityArchiveCapability,
  validInput: {
    workspaceId: 'ws_entity_test',
    entityId: 'entity_sample_001',
    reason: 'Account closed',
  },
  invalidInput: { workspaceId: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});
