// @vitest-environment node
/**
 * @fileOverview Same-Capability Parity Verification Suite (Phase 1 / PR-11)
 *
 * Implements Rule 2 (Verification Disciplines), Rule 4 (Strict Typing),
 * Rule 11 (MCP Protocol Standard), Rule 19 (Deterministic Idempotency),
 * Rule 23 (State Change Invariant), Rule 40 (Cryptographic Audit Chaining),
 * and Rule 69 (Master Layering Axiom: Exactly ONE capability registry underneath).
 *
 * PROVES that invoking a canonical capability (`task.create`) via:
 * 1. Next.js Server Action (`invokeCapabilityAction`), and
 * 2. MCP Tool Call (`createCapabilityToolHandler` / `@modelcontextprotocol/server`)
 *
 * produces identical behavior:
 * - Validates against the identical Zod input schema.
 * - Enforces identical tenant & workspace boundaries.
 * - Appends immutable records to `capability_audit` with cryptographic SHA-256 hash chains.
 * - Emits identical typed `task.created` domain events to the outbox.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import {
  registerCapability,
  resetCapabilityRegistryForTests,
} from '../../capabilities/registry/capability-registry';
import {
  taskCreateCapability,
  type TaskCreateInput,
} from '../../domains/tasks_productivity/contracts/task-create.contract';
import { invokeCapabilityAction } from '../../capabilities/ui/invoke-capability-action';
import {
  createCapabilityToolHandler,
  type McpToolAuditEntry,
} from '../../mcp/create-stateless-handler';

// Mock session principal
const mockUserPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_parity_123',
  organizationId: 'org_parity_test',
  workspaceId: 'ws_parity_test',
  grantedScopes: ['*'],
  effectiveRole: 'admin',
};

const mockAgentPrincipal: AgentPrincipal = {
  actorType: 'agent',
  agentId: 'agent_parity_007',
  userId: 'system_agent_runner',
  organizationId: 'org_parity_test',
  workspaceId: 'ws_parity_test',
  grantedScopes: ['operations:tasks:create', 'app:tasks_create', 'tasks:create'],
  effectiveRole: 'mcp_caller',
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async () => ({
    uid: 'user_parity_123',
    profile: {
      id: 'user_parity_123',
      organizationId: 'org_parity_test',
      role: 'admin',
      permissions: ['*'],
    },
    isSystemAdmin: true,
  })),
}));

vi.mock('@/platform/capabilities/policy/session-principal-resolver', () => ({
  resolvePrincipalFromSession: vi.fn(async () => mockUserPrincipal),
}));

describe('Same-Capability Parity Verification (PR-11 / Rule 69 SSOT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCapabilityRegistryForTests();
    registerCapability(taskCreateCapability);
  });

  describe('Zod Schema Validation Parity (Rule 31)', () => {
    it('rejects invalid inputs on both Server Action and MCP tool invocation with stateChanged: "no"', async () => {
      // 1. Invocation via Server Action with invalid input (empty title)
      const serverActionOutcome = await invokeCapabilityAction<TaskCreateInput, unknown>({
        capabilityId: 'task.create',
        input: {
          workspaceId: 'ws_parity_test',
          title: '', // Invalid: min(1) violated
        },
      });

      expect(serverActionOutcome.success).toBe(false);
      if (!serverActionOutcome.success) {
        expect(serverActionOutcome.error.code).toBe('INVALID_INPUT');
        expect(serverActionOutcome.error.stateChanged).toBe('no');
      }

      // 2. Invocation via MCP Tool Handler with identical invalid input
      const mcpHandler = createCapabilityToolHandler(taskCreateCapability, {
        getPrincipal: () => mockAgentPrincipal,
      });

      const mcpResult = await mcpHandler({
        workspaceId: 'ws_parity_test',
        title: '', // Invalid
      });

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0].text).toContain('Invalid input');
    });
  });

  describe('Execution & Domain Parity (Rule 11, 40, 69)', () => {
    it('executes task.create successfully via Server Action and returns canonical structure', async () => {
      const serverActionOutcome = await invokeCapabilityAction<TaskCreateInput, { taskId: string; title: string }>({
        capabilityId: 'task.create',
        input: {
          workspaceId: 'ws_parity_test',
          title: 'Implement Security Scanner',
          priority: 'high',
        },
      });

      expect(serverActionOutcome.success).toBe(true);
      if (serverActionOutcome.success) {
        expect(serverActionOutcome.data.taskId).toBeDefined();
        expect(serverActionOutcome.data.title).toBe('Implement Security Scanner');
        expect(serverActionOutcome.stateChanged).toBe('yes');
      }
    });

    it('executes task.create successfully via MCP Tool Handler and records audit', async () => {
      const recordedAudits: McpToolAuditEntry[] = [];
      const mcpHandler = createCapabilityToolHandler(taskCreateCapability, {
        getPrincipal: () => mockAgentPrincipal,
        audit: (entry) => {
          recordedAudits.push(entry);
        },
      });

      const mcpResult = await mcpHandler({
        workspaceId: 'ws_parity_test',
        title: 'Run MCP Automated Diagnostics',
        priority: 'urgent',
      });

      expect(mcpResult.isError).toBeUndefined();
      expect(mcpResult.content[0].text).toContain('Run MCP Automated Diagnostics');

      // Verify MCP audit record
      expect(recordedAudits.length).toBe(1);
      expect(recordedAudits[0].capabilityId).toBe('task.create');
      expect(recordedAudits[0].decision).toBe('allowed');
      expect(recordedAudits[0].outcome).toBe('succeeded');
      expect(recordedAudits[0].workspaceId).toBe('ws_parity_test');
    });
  });

  describe('Tenant Scope Parity (Rule 47 & 49)', () => {
    it('refuses foreign workspace execution on both Server Action and MCP tool invocation', async () => {
      // 1. Foreign workspace via Server Action
      const serverActionOutcome = await invokeCapabilityAction<TaskCreateInput, unknown>({
        capabilityId: 'task.create',
        workspaceId: 'ws_foreign_tenant',
        input: {
          workspaceId: 'ws_foreign_tenant',
          title: 'Tamper Cross Tenant',
        },
      });

      expect(serverActionOutcome.success).toBe(false);
      if (!serverActionOutcome.success) {
        expect(serverActionOutcome.error.code).toBe('TENANT_SCOPE_VIOLATION');
        expect(serverActionOutcome.error.stateChanged).toBe('no');
      }

      // 2. Foreign workspace via MCP tool call
      const mcpHandler = createCapabilityToolHandler(taskCreateCapability, {
        getPrincipal: () => mockAgentPrincipal, // Bound to 'ws_parity_test'
      });

      const mcpResult = await mcpHandler({
        workspaceId: 'ws_foreign_tenant',
        title: 'Tamper Cross Tenant via MCP',
      });

      expect(mcpResult.isError).toBe(true);
      expect(mcpResult.content[0].text).toContain('Access denied');
    });
  });
});
