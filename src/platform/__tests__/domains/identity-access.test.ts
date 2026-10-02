/**
 * @fileOverview Unit & Contract Tests for Domain: identity_access (PR-10 / Wave A)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 16 (Least Privilege),
 * Rule 17 (Non-Delegable Privileges), Rule 23 (State-Changed Tri-State Invariant),
 * and Rule 47 (Explicit Workspace Scope).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { getCurrentActorCapability } from '../../domains/identity_access/contracts/get-current-actor.contract';
import { listAccessibleWorkspacesCapability } from '../../domains/identity_access/contracts/list-accessible-workspaces.contract';
import { getWorkspaceCapability } from '../../domains/identity_access/contracts/get-workspace.contract';
import { checkPermissionCapability } from '../../domains/identity_access/contracts/check-permission.contract';
import { listEffectivePermissionsCapability } from '../../domains/identity_access/contracts/list-effective-permissions.contract';

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_m3_test',
  organizationId: 'org_m3_test',
  workspaceId: 'ws_m3_test',
  grantedScopes: [
    'identity:read',
    'workspace:read',
    'identity:access:check',
    'identity:access:list',
  ],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_unauth',
  organizationId: 'org_m3_test',
  workspaceId: 'ws_m3_test',
  grantedScopes: ['crm:read'],
  effectiveRole: 'viewer',
};

const foreignWorkspacePrincipal: AgentPrincipal = {
  ...authorizedPrincipal,
  workspaceId: 'ws_foreign_test',
  organizationId: 'org_foreign_test',
};

const automatedAgentPrincipal: AgentPrincipal = {
  actorType: 'agent',
  userId: 'user_m3_test',
  agentId: 'agent_automation_001',
  organizationId: 'org_m3_test',
  workspaceId: 'ws_m3_test',
  grantedScopes: [
    'identity:read',
    'workspace:read',
    'identity:access:check',
    'identity:access:list',
  ],
  effectiveRole: 'admin',
};

// 1. Contract Suite: identity.actor.get_current
defineContractSuite({
  capability: getCurrentActorCapability,
  validInput: { workspaceId: 'ws_m3_test' },
  invalidInput: { workspaceId: 12345 }, // invalid type
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 2. Contract Suite: identity.workspace.list_accessible
defineContractSuite({
  capability: listAccessibleWorkspacesCapability,
  validInput: {},
  invalidInput: 'not-an-object',
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 3. Contract Suite: identity.workspace.get
defineContractSuite({
  capability: getWorkspaceCapability,
  validInput: { workspaceId: 'ws_m3_test' },
  invalidInput: { workspaceId: '' }, // min(1) violation
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 4. Contract Suite: identity.access.check_permission (Non-Delegable)
defineContractSuite({
  capability: checkPermissionCapability,
  validInput: { workspaceId: 'ws_m3_test', permission: 'identity:read' },
  invalidInput: { workspaceId: '', permission: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 5. Contract Suite: identity.access.list_effective_permissions (Non-Delegable)
defineContractSuite({
  capability: listEffectivePermissionsCapability,
  validInput: { workspaceId: 'ws_m3_test' },
  invalidInput: { workspaceId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

import { createServerActionInvocation } from '../../capabilities/execution/invocation';

describe('Domain: identity_access - Specialized Security & Non-Delegable Tests', () => {
  it('blocks automated agent from executing check-permission due to nonDelegable: true (Rule 17)', async () => {
    const invocation = createServerActionInvocation({
      capabilityId: checkPermissionCapability.id,
      input: { workspaceId: 'ws_m3_test', permission: 'identity:read' },
      principal: automatedAgentPrincipal,
    });

    const result = await executeCapability(invocation, {
      registryLookup: (id: string) =>
        id === checkPermissionCapability.id ? (checkPermissionCapability as AnyCapabilityDefinition) : undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTHORIZATION_DENIED');
      expect(result.error.stateChanged).toBe('no');
    }
  });

  it('blocks automated agent from executing list-effective-permissions due to nonDelegable: true (Rule 17)', async () => {
    const invocation = createServerActionInvocation({
      capabilityId: listEffectivePermissionsCapability.id,
      input: { workspaceId: 'ws_m3_test' },
      principal: automatedAgentPrincipal,
    });

    const result = await executeCapability(invocation, {
      registryLookup: (id: string) =>
        id === listEffectivePermissionsCapability.id ? (listEffectivePermissionsCapability as AnyCapabilityDefinition) : undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('AUTHORIZATION_DENIED');
      expect(result.error.stateChanged).toBe('no');
    }
  });
});
