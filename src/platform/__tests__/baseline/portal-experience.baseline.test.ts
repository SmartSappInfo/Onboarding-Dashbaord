/**
 * @fileOverview Experience Platform & Portal Baseline Regression Test (Phase 0)
 *
 * Validates the baseline behavior of Experience Portal schemas,
 * membership entitlements, course progress event generation, and non-delegable guards.
 */

import { describe, it, expect } from 'vitest';
import { MembershipPlanSchema } from '@/lib/types/membership';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { evaluatePrincipalAuthority } from '@/platform/capabilities/policy/principal-evaluator';
import type { CapabilityDefinition, AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { z } from 'zod/v4';
import portalFixture from './fixtures/portal-experience.fixture.json';

describe('Experience Platform & Portals Behavioral Baseline', () => {
  it('loads and validates frozen baseline snapshot fixture', () => {
    expect(portalFixture.version).toBe('1.0.0');
    expect(portalFixture.membershipPlan.id).toBe('plan_frozen_001');
    expect(portalFixture.portalMembership.role).toBe('student');
    expect(portalFixture.portalEvents).toContain('portal.course.completed');
  });

  it('validates frozen membership plan against strict MembershipPlanSchema', () => {
    const parsed = MembershipPlanSchema.safeParse(portalFixture.membershipPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Full Access Scholar');
      expect(parsed.data.price).toBe(450);
      expect(parsed.data.currency).toBe('GHS');
      expect(parsed.data.interval).toBe('monthly');
      expect(parsed.data.status).toBe('active');
    }
  });

  it('generates a strictly validated DomainEvent for course completion', () => {
    const event = createDomainEvent({
      type: 'portal.course.completed',
      organizationId: 'org-smartsapp',
      workspaceId: 'ws-edu-1',
      actor: {
        type: 'user',
        id: 'student-99',
      },
      entity: {
        type: 'course',
        id: 'course-physics-101',
      },
      payload: {
        score: 98,
        lessonsCompleted: 12,
        certificateEligible: true,
      },
      correlationId: 'trace-corr-123',
      source: 'experience_portal',
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe('portal.course.completed');
    expect(event.payload.certificateEligible).toBe(true);
    expect(event.version).toBe('1.0.0');
  });

  it('strictly blocks an agent from executing non-delegable admin permissions (Rule 17)', () => {
    const deleteOrgCapability: CapabilityDefinition<{ orgId: string }, { success: boolean }> = {
      id: 'organization.delete',
      version: '1.0.0',
      name: 'Delete Organization',
      description: 'Hard deletion of an organization tenant',
      domain: 'identity_access',
      operation: 'delete',
      inputSchema: z.object({ orgId: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
      permissions: ['organization.delete'],
      workspaceScoped: false,
      tenantScoped: true,
      risk: {
        level: 'L4_PRIVILEGED_DESTRUCTIVE',
        destructive: true,
        idempotent: false,
        openWorld: false,
        requiresHumanApproval: true,
        nonDelegable: true,
      },
      execution: {
        synchronous: true,
        maxDurationMs: 5000,
        supportsDryRun: false,
        supportsCancellation: false,
        supportsCompensation: false,
        maxPayloadSizeBytes: 1024,
      },
      policies: {
        requiresIdempotencyKey: true,
        requiresExpectedVersion: true,
        auditRequired: true,
      },
      handler: async () => ({
        success: true,
        data: { success: true },
        executionId: '1',
        emittedEvents: [],
        durationMs: 5,
      }),
    };

    const automatedAgentPrincipal: AgentPrincipal = {
      actorType: 'agent',
      userId: 'admin-user',
      organizationId: 'org-smartsapp',
      workspaceId: 'ws-1',
      agentId: 'sdr-agent-1', // Operating as automated agent
      grantedScopes: ['*'], // Even with wildcard scope!
      effectiveRole: 'superadmin',
    };

    const evaluation = evaluatePrincipalAuthority(automatedAgentPrincipal, deleteOrgCapability, { organizationId: 'org-smartsapp', workspaceId: 'ws-1' });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toContain('Non-Delegable');
  });
});
