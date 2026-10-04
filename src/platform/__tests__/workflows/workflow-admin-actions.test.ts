/**
 * @fileOverview Unit & Integration Tests for Workflow Admin Server Actions (Phase 7 Milestone 5)
 *
 * Verifies:
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR tenant perimeter validation
 * - Rule 51: Next.js Server Actions session authentication
 * - Rule 60: Emergency Dead-Man Switch evaluation
 * - Operations: listWorkflows, getWorkflowDetails, cancelWorkflow, instantiateTemplate, getPlatformMetrics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listWorkflowsAction,
  getWorkflowDetailsAction,
  cancelWorkflowInstanceAction,
  instantiateWorkflowTemplateAction,
  getWorkflowPlatformMetricsAction,
  listWorkflowTemplatesAction,
} from '@/app/actions/workflow-admin-actions';
import {
  createMemoryWorkflowStore,
  setWorkflowStoreForTests,
} from '@/platform/workflows/workflow-store';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { getWorkflowTemplateRegistry } from '@/platform/workflows/templates/workflow-template-registry';
import { LeadOnboardingWorkflow } from '@/platform/workflows/templates/lead-onboarding-template';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    uid: 'usr_operator_01',
    profile: {
      organizationId: 'org_admin_test',
      workspaceIds: ['ws_admin_test'],
    },
  }),
}));

describe('Workflow Admin Server Actions (Phase 7 Milestone 5)', () => {
  const tenant = {
    organizationId: 'org_admin_test',
    workspaceId: 'ws_admin_test',
  };

  let store: ReturnType<typeof createMemoryWorkflowStore>;

  beforeEach(() => {
    store = createMemoryWorkflowStore();
    setWorkflowStoreForTests(store);
    setGovernanceDeadManStateForTests(false);

    const registry = getWorkflowTemplateRegistry();
    registry.registerTemplate(LeadOnboardingWorkflow);
  });

  describe('1. Operator Listing & Details Actions', () => {
    it('lists workflow instances scoped to authenticated tenant', async () => {
      // Seed 2 instances
      await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'lead_onboarding_v1',
        title: 'Lead Flow 1',
        initiator: { actorType: 'user', actorId: 'usr_operator_01' },
        principal: {
          actorType: 'agent',
          userId: 'usr_operator_01',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          grantedScopes: [],
          effectiveRole: 'operator',
        },
      });

      const res = await listWorkflowsAction({
        workspaceId: tenant.workspaceId,
      });

      expect(res.success).toBe(true);
      expect(res.data?.total).toBe(1);
      expect(res.data?.items[0].title).toBe('Lead Flow 1');
    });

    it('rejects cross-tenant listing attempts with IDOR_VIOLATION (Rule 47)', async () => {
      const res = await listWorkflowsAction({
        organizationId: 'org_foreign_attacker',
        workspaceId: 'ws_foreign',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
    });

    it('retrieves detailed workflow instance including steps and checkpoints', async () => {
      const instance = await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'lead_onboarding_v1',
        title: 'Detailed Flow',
        initiator: { actorType: 'user', actorId: 'usr_operator_01' },
        principal: {
          actorType: 'agent',
          userId: 'usr_operator_01',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          grantedScopes: [],
          effectiveRole: 'operator',
        },
      });

      const step = await store.createStep({
        workflowId: instance.id,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        stepIndex: 0,
        capabilityId: 'crm.create_contact',
        name: 'Create Contact',
      });

      const detailsRes = await getWorkflowDetailsAction({
        workflowId: instance.id,
        workspaceId: tenant.workspaceId,
      });

      expect(detailsRes.success).toBe(true);
      expect(detailsRes.data?.instance.id).toBe(instance.id);
      expect(detailsRes.data?.steps.length).toBe(1);
      expect(detailsRes.data?.steps[0].id).toBe(step.id);
    });
  });

  describe('2. Operator Mutation & Cancellation Actions', () => {
    it('cancels a running workflow instance and records state change', async () => {
      const instance = await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'lead_onboarding_v1',
        title: 'Cancellable Flow',
        initiator: { actorType: 'user', actorId: 'usr_operator_01' },
        principal: {
          actorType: 'agent',
          userId: 'usr_operator_01',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          grantedScopes: [],
          effectiveRole: 'operator',
        },
      });

      const cancelRes = await cancelWorkflowInstanceAction({
        workflowId: instance.id,
        workspaceId: tenant.workspaceId,
        reason: 'Operator manual halt',
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.data?.status).toBe('CANCELLED');

      const updated = await store.getInstance(instance.id, tenant);
      expect(updated?.status).toBe('CANCELLED');
    });

    it('instantiates a registered workflow template manually from admin console', async () => {
      const launchRes = await instantiateWorkflowTemplateAction({
        templateId: 'lead_onboarding_v1',
        workspaceId: tenant.workspaceId,
        inputs: {
          email: 'operator_launch@domain.com',
          fullName: 'Operator Lead',
        },
        title: 'Manual Launch Flow',
      });

      expect(launchRes.success).toBe(true);
      expect(launchRes.data?.workflowId).toMatch(/^wf_/);
      expect(launchRes.data?.status).toBe('QUEUED');
    });

    it('blocks template launch when Rule 60 emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      const launchRes = await instantiateWorkflowTemplateAction({
        templateId: 'lead_onboarding_v1',
        workspaceId: tenant.workspaceId,
        inputs: { email: 'deadman@domain.com' },
      });

      expect(launchRes.success).toBe(false);
      expect(launchRes.code).toBe('DEAD_MAN_PAUSED');
    });
  });

  describe('3. Platform Metrics & Catalog Actions', () => {
    it('aggregates platform metrics across states for mission control header', async () => {
      await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'lead_onboarding_v1',
        title: 'Metrics Flow',
        initiator: { actorType: 'user', actorId: 'usr_operator_01' },
        principal: {
          actorType: 'agent',
          userId: 'usr_operator_01',
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          grantedScopes: [],
          effectiveRole: 'operator',
        },
      });

      const metricsRes = await getWorkflowPlatformMetricsAction({
        workspaceId: tenant.workspaceId,
      });

      expect(metricsRes.success).toBe(true);
      expect(metricsRes.data?.totalWorkflows).toBe(1);
      expect(metricsRes.data?.isDeadManPaused).toBe(false);
    });

    it('lists available pre-built workflow templates', async () => {
      const tmplRes = await listWorkflowTemplatesAction();

      expect(tmplRes.success).toBe(true);
      expect(tmplRes.data?.length).toBeGreaterThanOrEqual(1);
      expect(tmplRes.data?.some((t) => t.id === 'lead_onboarding_v1')).toBe(true);
    });
  });
});
