/**
 * @fileOverview Unit & Contract Tests for Tags & Notes in Domain: crm_contacts (PR-11 / Wave B-1)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 12 (Risk Level),
 * Rule 23 (State Changed Invariant), Rule 31 (Output Schema Validation), and Rule 47 (Tenant Isolation).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { defineContractSuite } from '../contract/define-contract-suite';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import { addTagCapability } from '../../domains/crm_contacts/contracts/tag-capabilities.contract';
import { removeTagCapability } from '../../domains/crm_contacts/contracts/tag-capabilities.contract';
import { listTagsCapability } from '../../domains/crm_contacts/contracts/tag-capabilities.contract';
import { createActivityCapability } from '../../domains/crm_contacts/contracts/note-capabilities.contract';
import { createNoteCapability } from '../../domains/crm_contacts/contracts/note-capabilities.contract';
import { getTimelineCapability } from '../../domains/crm_contacts/contracts/note-capabilities.contract';

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_crm_author',
  organizationId: 'org_crm_test',
  workspaceId: 'ws_crm_test',
  grantedScopes: [
    'operations:campuses:view',
    'operations:campuses:edit',
    'app:contacts_view',
    'app:contacts_edit',
    'crm:tags:view',
    'crm:tags:edit',
    'crm:notes:create',
    'crm:activity:create',
    'crm:timeline:view',
  ],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_crm_unauth',
  organizationId: 'org_crm_test',
  workspaceId: 'ws_crm_test',
  grantedScopes: ['finance:invoices:view'],
  effectiveRole: 'viewer',
};

const foreignWorkspacePrincipal: AgentPrincipal = {
  ...authorizedPrincipal,
  workspaceId: 'ws_foreign_crm',
  organizationId: 'org_foreign_crm',
};

// 1. Contract Suite: crm.entity.add_tag
defineContractSuite({
  capability: addTagCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
    tagIds: ['tag_vip_client'],
  },
  invalidInput: { workspaceId: 'ws_crm_test', entityId: '', tagIds: [] },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 2. Contract Suite: crm.entity.remove_tag
defineContractSuite({
  capability: removeTagCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
    tagIds: ['tag_vip_client'],
  },
  invalidInput: { workspaceId: 'ws_crm_test', entityId: '', tagIds: [] },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 3. Contract Suite: crm.entity.list_tags
defineContractSuite({
  capability: listTagsCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
  },
  invalidInput: { workspaceId: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 4. Contract Suite: crm.activity.create
defineContractSuite({
  capability: createActivityCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
    type: 'call_logged',
    description: 'Outbound qualification call with client.',
  },
  invalidInput: { workspaceId: 'ws_crm_test', entityId: '', type: '', description: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 5. Contract Suite: crm.note.create
defineContractSuite({
  capability: createNoteCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
    content: 'Client requested follow-up proposal next Tuesday.',
  },
  invalidInput: { workspaceId: 'ws_crm_test', entityId: '', content: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 6. Contract Suite: crm.entity.get_timeline
defineContractSuite({
  capability: getTimelineCapability,
  validInput: {
    workspaceId: 'ws_crm_test',
    entityId: 'entity_sample_001',
    limit: 20,
  },
  invalidInput: { workspaceId: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});
