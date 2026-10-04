/**
 * @fileOverview Unit & Integration Tests for Legacy Workflow Bridge (Strangler Fig Pattern, Rule 69)
 *
 * Verifies:
 * - Translates legacy automation jobs/definitions into durable workflow executions
 * - Safe fallback to legacy engine when feature flag is disabled
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Multi-tenant boundary preservation
 * - Rule 60: Emergency Dead-Man Switch evaluation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LegacyWorkflowBridge,
  type LegacyAutomationRecord,
} from '@/platform/workflows/bridge/legacy-workflow-bridge';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { WorkflowTemplateRegistry } from '@/platform/workflows/templates/workflow-template-registry';
import type { TenantBoundary } from '@/platform/workflows/workflow-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('Legacy Workflow Bridge (Strangler Fig Pattern, Rule 69)', () => {
  const tenant: TenantBoundary = {
    organizationId: 'org_legacy_test',
    workspaceId: 'ws_legacy_test',
  };

  const sampleLegacyAutomation: LegacyAutomationRecord = {
    id: 'legacy_auto_42',
    name: 'Legacy Welcome Flow',
    trigger: 'contact.created',
    status: 'active',
    actions: [
      {
        id: 'act_1',
        type: 'send_email',
        config: { template: 'welcome_v1' },
      },
      {
        id: 'act_2',
        type: 'add_tag',
        config: { tag: 'onboarded' },
      },
    ],
  };

  let store: ReturnType<typeof createMemoryWorkflowStore>;
  let templateRegistry: WorkflowTemplateRegistry;
  let bridge: LegacyWorkflowBridge;

  beforeEach(() => {
    store = createMemoryWorkflowStore();
    setGovernanceDeadManStateForTests(false);

    templateRegistry = new WorkflowTemplateRegistry({
      store,
    });

    bridge = new LegacyWorkflowBridge({
      store,
      templateRegistry,
      enableDurableWorkflows: true,
    });
  });

  describe('1. Legacy Automation Conversion & Execution', () => {
    it('converts legacy automation into a durable workflow instance and executes steps', async () => {
      const result = await bridge.executeLegacyAutomation({
        automation: sampleLegacyAutomation,
        payload: { contactId: 'cnt_999', email: 'test@legacy.com' },
        tenant,
        actorId: 'usr_legacy_operator',
      });

      expect(result.mode).toBe('durable_workflow');
      expect(result.workflowId).toBeDefined();
      expect(result.workflowId).toMatch(/^wf_/);
      expect(result.status).toBe('QUEUED');
      expect(result.stepCount).toBe(2);

      // Verify recorded in store
      const instance = await store.getInstance(result.workflowId!, tenant);
      expect(instance).not.toBeNull();
      expect(instance?.title).toBe('Legacy Welcome Flow');
    });

    it('falls back to legacy runner when enableDurableWorkflows is false', async () => {
      const mockLegacyRunner = vi.fn().mockResolvedValue({
        success: true,
        executionId: 'exec_legacy_001',
      });

      const fallbackBridge = new LegacyWorkflowBridge({
        store,
        templateRegistry,
        enableDurableWorkflows: false,
        legacyRunner: mockLegacyRunner,
      });

      const result = await fallbackBridge.executeLegacyAutomation({
        automation: sampleLegacyAutomation,
        payload: { contactId: 'cnt_999' },
        tenant,
        actorId: 'usr_legacy_operator',
      });

      expect(result.mode).toBe('legacy_engine');
      expect(mockLegacyRunner).toHaveBeenCalledWith(
        sampleLegacyAutomation.id,
        { contactId: 'cnt_999' },
        expect.anything()
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('enforces Rule 60: halts durable execution when emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        bridge.executeLegacyAutomation({
          automation: sampleLegacyAutomation,
          payload: { contactId: 'cnt_999' },
          tenant,
          actorId: 'usr_legacy_operator',
        })
      ).rejects.toThrowError(/DEAD_MAN_PAUSED/);
    });
  });
});
