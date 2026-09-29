/**
 * @fileOverview CRM capability authorization checks (Phase 0)
 *
 * Evaluator behaviour for a CRM-shaped capability (tenant/workspace isolation, scopes).
 * The behavioural baseline of the EXISTING CRM code lives in the suites listed under `crm` in
 * `baseline-manifest.json` (contact adapter, workspace entity actions, pipeline isolation, tags…),
 * which `pnpm test:agentic:baseline` runs alongside this file.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { evaluatePrincipalAuthority } from '@/platform/capabilities/policy/principal-evaluator';
import type { CapabilityDefinition, AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';

describe('CRM capability authorization', () => {
  const contactUpdateCapability: CapabilityDefinition<{ id: string; name: string }, { success: boolean }> = {
    id: 'crm.contact.update',
    version: '1.0.0',
    name: 'Update Contact',
    description: 'Updates contact details with TOCTOU lock',
    domain: 'crm_contacts',
    operation: 'update',
    inputSchema: z.object({ id: z.string(), name: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
    permissions: ['contacts.update'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: true,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: true,
      auditRequired: true,
    },
    handler: async (input, ctx) => {
      // Simulate TOCTOU optimistic lock verification (Rule 18)
      if (ctx.expectedVersion !== undefined && ctx.expectedVersion !== 1) {
        return {
          success: false,
          error: {
            code: 'VERSION_CONFLICT',
            message: `Resource version conflict: expected ${ctx.expectedVersion}, actual 1`,
            retryable: true,
          },
          executionId: 'exec-err',
        };
      }
      return {
        success: true,
        data: { success: true },
        executionId: 'exec-1',
        emittedEvents: [],
        durationMs: 10,
      };
    },
  };

  it('allows authorized principal in the same workspace', () => {
    const principal: AgentPrincipal = {
      actorType: 'user',
      userId: 'user-1',
      organizationId: 'org-smartsapp-baseline',
      workspaceId: 'ws-baseline-crm',
      grantedScopes: ['contacts.update'],
      effectiveRole: 'workspace_admin',
    };

    const evaluation = evaluatePrincipalAuthority(principal, contactUpdateCapability, { organizationId: 'org-smartsapp-baseline', workspaceId: 'ws-baseline-crm' });
    expect(evaluation.allowed).toBe(true);
    expect(evaluation.violations).toEqual([]);
  });

  it('strictly blocks principal when target workspace mismatches (Tenant Boundary)', () => {
    const principal: AgentPrincipal = {
      actorType: 'user',
      userId: 'user-1',
      organizationId: 'org-smartsapp-baseline',
      workspaceId: 'ws-baseline-crm',
      grantedScopes: ['contacts.update'],
      effectiveRole: 'workspace_admin',
    };

    const evaluation = evaluatePrincipalAuthority(principal, contactUpdateCapability, { organizationId: 'org-smartsapp-baseline', workspaceId: 'ws-other-crm' });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('Tenant Isolation Violation');
  });

  it('strictly blocks principal when target organization mismatches (Tenant Isolation)', () => {
    const principal: AgentPrincipal = {
      actorType: 'user',
      userId: 'user-1',
      organizationId: 'org-smartsapp-baseline',
      workspaceId: 'ws-baseline-crm',
      grantedScopes: ['contacts.update'],
      effectiveRole: 'workspace_admin',
    };

    const evaluation = evaluatePrincipalAuthority(
      principal,
      contactUpdateCapability,
      { organizationId: 'org-other', workspaceId: 'ws-baseline-crm' }
    );
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('Tenant Isolation Violation');
  });

  it('strictly blocks principal when missing required permission scope', () => {
    const principal: AgentPrincipal = {
      actorType: 'user',
      userId: 'user-1',
      organizationId: 'org-smartsapp-baseline',
      workspaceId: 'ws-baseline-crm',
      grantedScopes: ['contacts.read'], // Missing contacts.update
      effectiveRole: 'viewer',
    };

    const evaluation = evaluatePrincipalAuthority(principal, contactUpdateCapability, { organizationId: 'org-smartsapp-baseline', workspaceId: 'ws-baseline-crm' });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('Insufficient Scope');
  });
});
