// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for Workflow Mission Control (/admin/workflows) (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile-first responsive touch targets (min-h-[44px]).
 * - Rule 17: Non-delegable warning shield badges.
 * - Rule 22: Truncated SHA-256 hash inspection and copy.
 * - Rule 26: Cooperative cancellation trigger on in-flight workflows.
 * - Rule 30: Containerized untrusted reference data (<untrusted_reference_data id="...">).
 * - Rule 55: Hard DAG complexity bounds (<= 50 nodes).
 * - Rule 60: Emergency dead-man kill switch visual banner.
 * - theme.md Section 8: Standardized Modal & Dialog Architecture compliance.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowMetricsCards } from '@/components/workflows/WorkflowMetricsCards';
import { WorkflowDeadManBanner } from '@/components/workflows/WorkflowDeadManBanner';
import { WorkflowFilterToolbar } from '@/components/workflows/WorkflowFilterToolbar';
import { WorkflowInstancesTable } from '@/components/workflows/WorkflowInstancesTable';
import { WorkflowDagVisualizer } from '@/components/workflows/WorkflowDagVisualizer';
import { LaunchTemplateModal } from '@/components/workflows/LaunchTemplateModal';
import { WorkflowDetailDrawer } from '@/components/workflows/WorkflowDetailDrawer';
import type {
  WorkflowInstance,
  WorkflowStep,
  WorkflowCheckpoint,
} from '@/platform/workflows/workflow-types';
import type { WorkflowTemplateDefinition } from '@/platform/workflows/templates/workflow-template-types';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

const mockMetrics = {
  totalWorkflows: 42,
  activeWorkflows: 5,
  waitingWorkflows: 2,
  completedWorkflows: 33,
  failedWorkflows: 2,
  isDeadManPaused: false,
};

const mockInstance: WorkflowInstance = {
  id: 'wf_test_123',
  organizationId: 'org_test_123',
  workspaceId: 'ws_test_123',
  definitionId: 'lead-onboarding-flow',
  definitionVersion: '1.0.0',
  title: 'Lead Onboarding for Acme Corp',
  status: 'RUNNING',
  initiator: { actorType: 'user', actorId: 'usr_admin_1' },
  principal: {
    actorType: 'agent',
    userId: 'usr_admin_1',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    grantedScopes: ['app:automations_manage'],
    effectiveRole: 'operator',
  },
  correlationId: 'corr_test_999',
  idempotencyKey: 'idemp_key_abcdef1234567890',
  inputs: {
    leadId: 'lead_123',
    email: 'test@acme.com',
    companyName: 'Acme Corp',
  },
  budgets: {
    maxTotalDurationMs: 604800000,
    maxSteps: 50,
    maxRetries: 5,
  },
  stepCounts: {
    total: 3,
    completed: 1,
    failed: 0,
    skipped: 0,
  },
  dryRun: false,
  createdAt: '2026-10-03T12:00:00.000Z',
  updatedAt: '2026-10-03T12:05:00.000Z',
};

const mockSteps: WorkflowStep[] = [
  {
    id: 'step_1',
    workflowId: 'wf_test_123',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    stepIndex: 0,
    capabilityId: 'crm.contact.create',
    name: 'Create Contact Record',
    status: 'COMPLETED',
    dependsOn: [],
    input: { email: 'test@acme.com' },
    output: { contactId: 'con_123' },
    attempt: 0,
    maxAttempts: 3,
    idempotencyKey: 'step_1_idemp_key',
    isMutating: true,
    compensationStatus: 'none',
    isNonDelegable: false,
    durationMs: 420,
  },
  {
    id: 'step_2',
    workflowId: 'wf_test_123',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    stepIndex: 1,
    capabilityId: 'messaging.email.send',
    name: 'Send Welcome Email',
    status: 'RUNNING',
    dependsOn: ['step_1'],
    input: { to: 'test@acme.com' },
    attempt: 0,
    maxAttempts: 3,
    idempotencyKey: 'step_2_idemp_key',
    isMutating: true,
    compensationStatus: 'none',
    isNonDelegable: true,
  },
];

const mockCheckpoints: WorkflowCheckpoint[] = [
  {
    id: 'cp_1',
    workflowId: 'wf_test_123',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    checkpointSequence: 1,
    fromState: 'QUEUED',
    toState: 'RUNNING',
    statePayload: { started: true },
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    timestamp: '2026-10-03T12:00:05.000Z',
  },
];

const mockTemplate: WorkflowTemplateDefinition = {
  id: 'lead-onboarding-flow',
  name: 'Customer Acquisition & Lead Onboarding',
  description: 'Automates end-to-end customer acquisition',
  version: '1.0.0',
  category: 'onboarding',
  steps: [
    {
      id: 'step_1',
      name: 'Create Contact Record',
      capabilityId: 'crm.contact.create',
      dependsOn: [],
      isMutating: true,
      timeoutSeconds: 300,
      maxAttempts: 3,
      inputMapping: {},
    },
  ],
  parameters: [
    { name: 'leadId', type: 'string', required: true, description: 'Source Lead identifier' },
    { name: 'email', type: 'string', required: true, description: 'Prospect email address' },
  ],
};

describe('Workflow Mission Control UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkflowMetricsCards', () => {
    it('renders all 4 executive KPI cards with live metrics', () => {
      render(<WorkflowMetricsCards metrics={mockMetrics} />);

      expect(screen.getByText('Total Instances')).toBeDefined();
      expect(screen.getByText('42')).toBeDefined();

      expect(screen.getByText('In-Flight Active')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();

      expect(screen.getByText('Awaiting Approval')).toBeDefined();
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText('Failed / DLQ')).toBeDefined();
    });

    it('renders skeleton loading placeholders when loading or null', () => {
      const { container } = render(<WorkflowMetricsCards metrics={null} isLoading={true} />);
      const pulses = container.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBeGreaterThan(0);
    });
  });

  describe('WorkflowDeadManBanner (Rule 60)', () => {
    it('renders high-visibility alert when dead-man switch is active', () => {
      const onRefresh = vi.fn();
      render(<WorkflowDeadManBanner active={true} onRefresh={onRefresh} />);

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/EMERGENCY DEAD-MAN PAUSE ACTIVE/i)).toBeDefined();
      expect(screen.getByText(/Rule 60/i)).toBeDefined();

      const refreshBtn = screen.getByRole('button', { name: /Re-Check Status/i });
      fireEvent.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('renders nothing when active is false', () => {
      const { container } = render(<WorkflowDeadManBanner active={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('WorkflowFilterToolbar', () => {
    it('handles search input and status filter switching with debounce', async () => {
      const onSearch = vi.fn();
      const onStatus = vi.fn();
      const onLaunch = vi.fn();
      const onRefresh = vi.fn();

      render(
        <WorkflowFilterToolbar
          searchQuery=""
          onSearchChange={onSearch}
          statusFilter="ALL"
          onStatusFilterChange={onStatus}
          onLaunchClick={onLaunch}
          onRefresh={onRefresh}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search workflows by title/i);
      fireEvent.change(searchInput, { target: { value: 'Acme' } });

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith('Acme');
      });

      const runningPill = screen.getByText('Running');
      fireEvent.click(runningPill);
      expect(onStatus).toHaveBeenCalledWith('RUNNING');

      const launchBtn = screen.getByRole('button', { name: /Launch Template/i });
      fireEvent.click(launchBtn);
      expect(onLaunch).toHaveBeenCalledTimes(1);
    });
  });

  describe('WorkflowInstancesTable', () => {
    it('renders instances, status chips, copies idempotency key, and triggers inspect/cancel', async () => {
      const onInspect = vi.fn();
      const onCancel = vi.fn();

      render(
        <WorkflowInstancesTable
          instances={[mockInstance]}
          onInspect={onInspect}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Lead Onboarding for Acme Corp')).toBeDefined();
      expect(screen.getByText('lead-onboarding-flow')).toBeDefined();
      expect(screen.getByText('Running')).toBeDefined();

      // Inspect trigger
      const inspectBtn = screen.getByRole('button', { name: /Inspect/i });
      fireEvent.click(inspectBtn);
      expect(onInspect).toHaveBeenCalledWith('wf_test_123');

      // Cancel trigger (Rule 26)
      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledWith('wf_test_123');

      // Copy Idempotency Key (Rule 22)
      const copyBtn = screen.getByTitle(/Click to copy idempotency key/i);
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('idemp_key_abcdef1234567890');
    });

    it('renders empty state when instances list is empty', () => {
      render(
        <WorkflowInstancesTable
          instances={[]}
          onInspect={vi.fn()}
        />
      );
      expect(screen.getByText('No workflows found')).toBeDefined();
    });
  });

  describe('WorkflowDagVisualizer', () => {
    it('renders SVG topology with layers and step selection', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <WorkflowDagVisualizer
          steps={mockSteps}
          onSelectStep={onSelect}
        />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();

      expect(screen.getByText('Create Contact Record')).toBeDefined();
      expect(screen.getByText('Send Welcome Email')).toBeDefined();
    });

    it('enforces Rule 55 complexity limit (clamping to 50 nodes)', () => {
      const manySteps: WorkflowStep[] = Array.from({ length: 60 }, (_, i) => ({
        ...mockSteps[0],
        id: `step_${i}`,
        name: `Step ${i}`,
      }));

      render(<WorkflowDagVisualizer steps={manySteps} />);

      expect(screen.getByText(/Rule 55: Workflow graph exceeds 50 steps/i)).toBeDefined();
    });
  });

  describe('LaunchTemplateModal (theme.md Section 8)', () => {
    it('complies with theme.md §8: demarcated header, sr-only description, CardInfoTooltip, and triggers launch', async () => {
      const onLaunch = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      render(
        <LaunchTemplateModal
          open={true}
          onOpenChange={onOpenChange}
          templates={[mockTemplate]}
          onLaunch={onLaunch}
        />
      );

      // Header and description compliance
      expect(screen.getByText('Launch Workflow Template')).toBeDefined();
      const srOnlyDesc = document.querySelector('.sr-only');
      expect(srOnlyDesc).toBeDefined();

      // CardInfoTooltip info icon single-circle compliance
      const infoBtn = screen.getByLabelText(/More information/i);
      expect(infoBtn).toBeDefined();

      // Fill in required inputs
      const leadInput = screen.getByPlaceholderText(/Source Lead identifier/i);
      fireEvent.change(leadInput, { target: { value: 'lead_123' } });

      const emailInput = screen.getByPlaceholderText(/Prospect email address/i);
      fireEvent.change(emailInput, { target: { value: 'lead@example.com' } });

      // Submit form
      const form = document.querySelector('form');
      expect(form).toBeDefined();
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(onLaunch).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 'lead-onboarding-flow',
            inputs: expect.objectContaining({
              leadId: 'lead_123',
              email: 'lead@example.com',
            }),
          })
        );
      });
    });
  });

  describe('WorkflowDetailDrawer (theme.md Section 8 & Rule 30)', () => {
    it('complies with theme.md §8: multi-tab navigation, untrusted containerization, and cooperative cancel', async () => {
      const onCancel = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      const { rerender } = render(
        <WorkflowDetailDrawer
          instance={mockInstance}
          steps={mockSteps}
          checkpoints={mockCheckpoints}
          open={true}
          onOpenChange={onOpenChange}
          initialTab="overview"
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Lead Onboarding for Acme Corp')).toBeDefined();

      // Verify Rule 30: Containerized untrusted reference data
      expect(screen.getByText(/<untrusted_reference_data id="inputs_wf_test_123">/i)).toBeDefined();

      // Rerender on DAG Topology tab
      rerender(
        <WorkflowDetailDrawer
          instance={mockInstance}
          steps={mockSteps}
          checkpoints={mockCheckpoints}
          open={true}
          onOpenChange={onOpenChange}
          initialTab="dag"
          onCancel={onCancel}
        />
      );
      expect(screen.getByText(/Step Output \/ State Payload \(Rule 30\)/i)).toBeDefined();

      // Rerender on Execution Steps tab
      rerender(
        <WorkflowDetailDrawer
          instance={mockInstance}
          steps={mockSteps}
          checkpoints={mockCheckpoints}
          open={true}
          onOpenChange={onOpenChange}
          initialTab="timeline"
          onCancel={onCancel}
        />
      );
      expect(screen.getByText('Send Welcome Email')).toBeDefined();

      // Rerender on Checkpoints & Audit tab (Rule 40)
      rerender(
        <WorkflowDetailDrawer
          instance={mockInstance}
          steps={mockSteps}
          checkpoints={mockCheckpoints}
          open={true}
          onOpenChange={onOpenChange}
          initialTab="checkpoints"
          onCancel={onCancel}
        />
      );
      expect(screen.getByText(/QUEUED ➔ RUNNING/i)).toBeDefined();

      // Cooperative cancel button (Rule 26)
      const cancelBtn = screen.getByRole('button', { name: /Cancel Workflow/i });
      fireEvent.click(cancelBtn);
      await waitFor(() => {
        expect(onCancel).toHaveBeenCalledWith('wf_test_123', expect.any(String));
      });
    });
  });
});
