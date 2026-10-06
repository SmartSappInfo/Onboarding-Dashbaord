/**
 * @fileOverview Unit & Contract Tests for Domain: deals_revenue (PR-12 / Wave B-2)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 12 (Risk Level), Rule 18 (TOCTOU),
 * Rule 23 (State Changed Invariant), Rule 31 (Output Schema Validation), and Rule 47 (Tenant Isolation).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

// deal.get / deal.advance_stage fail closed (M2 · T4.3): they need a real deal in this workspace.
const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/crm/deal-core', () => ({
  createDealCore: vi.fn(async () => ({ id: 'deal_new_001' })),
  updateDealStageCore: vi.fn(async () => ({ success: true })),
  updateDealOwnerCore: vi.fn(async () => ({ success: true })),
  updateDealValueCore: vi.fn(async () => ({ success: true })),
}));
const fakeDb = new FakeFirestore();
fakeDb.write('deals/deal_sample_001', { workspaceId: 'ws_deal_test', name: 'Sample', entityId: 'entity_sample_001', stageId: 'stage_discovery', value: 1000, status: 'open', createdAt: '2026-10-01T00:00:00.000Z' });
h.db = fakeDb.asFirestore();

import { defineContractSuite } from '../contract/define-contract-suite';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  dealSearchCapability,
  dealGetCapability,
  dealCreateCapability,
  dealUpdateCapability,
  dealAdvanceStageCapability,
  dealAssignOwnerCapability,
} from '../../domains/deals_revenue/contracts/deal-capabilities.contract';
import {
  pipelineListCapability,
  pipelineGetCapability,
} from '../../domains/deals_revenue/contracts/pipeline-capabilities.contract';

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_deal_author',
  organizationId: 'org_deal_test',
  workspaceId: 'ws_deal_test',
  grantedScopes: [
    'sales:pipeline:view',
    'sales:pipeline:create',
    'sales:pipeline:edit',
    'app:deals_view',
    'app:deals_create',
    'app:deals_edit',
    'deal:read',
    'deal:create',
    'deal:edit',
    'deal:stage_update',
    'deal:assign',
    'pipeline:read',
  ],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_deal_unauth',
  organizationId: 'org_deal_test',
  workspaceId: 'ws_deal_test',
  grantedScopes: ['finance:invoices:view'],
  effectiveRole: 'viewer',
};

const foreignWorkspacePrincipal: AgentPrincipal = {
  ...authorizedPrincipal,
  workspaceId: 'ws_foreign_deal',
  organizationId: 'org_foreign_deal',
};

// 1. Contract Suite: deal.search
defineContractSuite({
  capability: dealSearchCapability,
  validInput: { workspaceId: 'ws_deal_test', limit: 10 },
  invalidInput: { workspaceId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 2. Contract Suite: deal.get
defineContractSuite({
  capability: dealGetCapability,
  validInput: { workspaceId: 'ws_deal_test', dealId: 'deal_sample_001' },
  invalidInput: { workspaceId: 'ws_deal_test', dealId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 3. Contract Suite: deal.create
defineContractSuite({
  capability: dealCreateCapability,
  validInput: {
    workspaceId: 'ws_deal_test',
    name: 'Enterprise Contract 2026',
    entityId: 'entity_sample_001',
    value: 50000,
  },
  invalidInput: { workspaceId: '', name: '', entityId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 4. Contract Suite: deal.update
defineContractSuite({
  capability: dealUpdateCapability,
  validInput: {
    workspaceId: 'ws_deal_test',
    dealId: 'deal_sample_001',
    value: 65000,
  },
  invalidInput: { workspaceId: '', dealId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 5. Contract Suite: deal.advance_stage
defineContractSuite({
  capability: dealAdvanceStageCapability,
  validInput: {
    workspaceId: 'ws_deal_test',
    dealId: 'deal_sample_001',
    stageId: 'stage_negotiation',
    bypassValidation: true,
  },
  invalidInput: { workspaceId: '', dealId: '', stageId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 6. Contract Suite: deal.assign_owner
defineContractSuite({
  capability: dealAssignOwnerCapability,
  validInput: {
    workspaceId: 'ws_deal_test',
    dealId: 'deal_sample_001',
    userId: 'user_sales_rep_01',
  },
  invalidInput: { workspaceId: '', dealId: '', userId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 7. Contract Suite: pipeline.list
defineContractSuite({
  capability: pipelineListCapability,
  validInput: { workspaceId: 'ws_deal_test', limit: 5 },
  invalidInput: { workspaceId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 8. Contract Suite: pipeline.get
defineContractSuite({
  capability: pipelineGetCapability,
  validInput: { workspaceId: 'ws_deal_test', pipelineId: 'pipeline_sales_001' },
  invalidInput: { workspaceId: '', pipelineId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

describe('deal.get fails closed (Phase 11 M2 · T4.3)', () => {
  it('a missing deal is NOT_FOUND, never an invented deal', async () => {
    const { executeCapability } = await import('../../capabilities/execution/execute-capability');
    const res = await executeCapability(
      { capabilityId: 'deal.get', surface: 'agent', input: { workspaceId: 'ws_deal_test', dealId: 'deal_missing' }, correlationId: 'c-get', principal: authorizedPrincipal },
      { registryLookup: (id) => (id === 'deal.get' ? (dealGetCapability as AnyCapabilityDefinition) : undefined), auditSink: () => undefined, outboxSink: () => undefined }
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND');
  });
});
