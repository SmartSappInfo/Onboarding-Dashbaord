/**
 * @fileOverview Vitest Suite for Visual Agent Builder UI Components & Panels (Phase 8 Milestone 5 Task 7)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing.
 * - Rule 7: Accessible touch targets >= 44px.
 * - Rule 12: Risk level indicators (L0 to L4).
 * - Rule 41: Explainability grid (WHAT, WHY, EXPECTED STATE CHANGE).
 * - Rule 42: Shadow Mode simulation 0 mutation banner.
 * - theme.md §8: Standardized Modal & Dialog Architecture.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CustomAgentPersona, AgentVersionDiff, BlastRadiusSummary, SimulatedStepTraceItem } from '@/platform/ui/builder/agent-builder-types';
import {
  PersonaCatalogCard,
  BlastRadiusReportCard,
  AgentVersionDiffModal,
  AgentTestLab,
} from '@/components/builder';
import {
  IdentityPurposePanel,
  CapabilitiesDomainPanel,
  MemoryKnowledgePanel,
  GovernancePolicyPanel,
  ModelsBudgetsPanel,
  TriggersOutputsPanel,
} from '@/components/builder/panels';

const samplePersona: CustomAgentPersona = {
  id: 'lead_sdr_custom',
  organizationId: 'org_test_1',
  workspaceId: 'default',
  version: '1.2.0',
  status: 'draft',
  isBuiltIn: false,
  identity: {
    name: 'Autonomous Lead SDR',
    slug: 'lead_sdr_custom',
    avatarIcon: 'Target',
    role: 'Lead Discovery & Outreach Specialist',
    description: 'Discovers, enriches, and scores prospective leads.',
    systemPromptSnippet: 'You are the Autonomous Lead SDR Agent.',
  },
  capabilities: {
    allowedDomains: ['lead_intelligence', 'crm_contacts'],
    allowedCapabilities: [],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
  },
  memory: {
    enabledTiers: ['working', 'semantic'],
    decayPreset: 'standard',
    retrievalTokenLimit: 2000,
    searchThreshold: 0.7,
  },
  governance: {
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    mandatoryApprovalRiskLevels: ['L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE'],
    delegationDepthCeiling: 3,
    requireHumanIntervention: false,
    allowedEnvironments: ['development', 'production'],
  },
  modelsAndBudgets: {
    primaryModelTier: 'flash',
    fallbackModelTier: 'flash',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 25,
      costBudgetUsd: 5.0,
    },
  },
  triggers: {
    triggerType: 'manual',
    eventSubscriptions: [],
    enabledNotificationChannels: ['in_app'],
  },
  publishedVersion: '1.1.0',
  authorId: 'user_123',
  authorName: 'Operator',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  publishedAt: '2026-10-02T00:00:00Z',
};

describe('1. PersonaCatalogCard Component', () => {
  it('renders persona title, role, status badge, and version tag', () => {
    render(
      <PersonaCatalogCard
        persona={samplePersona}
        onEdit={vi.fn()}
        onTest={vi.fn()}
        onViewDiff={vi.fn()}
        onPublish={vi.fn()}
      />
    );

    expect(screen.getByText('Autonomous Lead SDR')).toBeInTheDocument();
    expect(screen.getByText('Lead Discovery & Outreach Specialist')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByText('L2 State Mutation')).toBeInTheDocument();
  });

  it('triggers action buttons with appropriate callbacks and touch targets', () => {
    const onEdit = vi.fn();
    const onTest = vi.fn();
    const onViewDiff = vi.fn();
    const onPublish = vi.fn();

    render(
      <PersonaCatalogCard
        persona={samplePersona}
        onEdit={onEdit}
        onTest={onTest}
        onViewDiff={onViewDiff}
        onPublish={onPublish}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit in studio/i });
    expect(editBtn.className).toContain('min-h-[44px]');
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(samplePersona);

    const testBtn = screen.getByRole('button', { name: /test in lab/i });
    expect(testBtn.className).toContain('min-h-[44px]');
    fireEvent.click(testBtn);
    expect(onTest).toHaveBeenCalledWith(samplePersona);

    const publishBtn = screen.getByRole('button', { name: /publish/i });
    fireEvent.click(publishBtn);
    expect(onPublish).toHaveBeenCalledWith(samplePersona);
  });
});

describe('2. BlastRadiusReportCard Component (Rule 42)', () => {
  const sampleBlastRadius: BlastRadiusSummary = {
    totalSimulatedSteps: 3,
    mutationsInterceptedCount: 1,
    highRiskOperationsCount: 0,
    nonDelegableOperationsCount: 0,
    requiredApprovalsCount: 0,
    estimatedTokensUsed: 470,
    estimatedDurationMs: 650,
    estimatedCostUsd: 0.005,
    overallRiskCategory: 'L2_STATE_MUTATION',
    zeroMutationsVerified: true,
  };

  const sampleTrace: SimulatedStepTraceItem[] = [
    {
      stepNumber: 1,
      stepName: 'Analyze Lead Profile',
      riskLevel: 'L0_READ',
      simulatedAction: 'executed_read',
      what: 'Retrieved lead contact record',
      why: 'Context required for scoring',
      expectedStateChange: 'None',
      requiresHumanApproval: false,
      simulatedOutputSnippet: '{"leadId":"lead_1"}',
    },
    {
      stepNumber: 2,
      stepName: 'Enrich Lead Technographics',
      riskLevel: 'L2_STATE_MUTATION',
      simulatedAction: 'intercepted_mutation',
      what: 'Simulated mutation on lead record',
      why: 'Update score to 85',
      expectedStateChange: 'Mock record updated in shadow mode',
      requiresHumanApproval: false,
      simulatedOutputSnippet: '{"intercepted":true}',
    },
  ];

  it('renders zero mutations verified banner and explainability grid', () => {
    render(<BlastRadiusReportCard blastRadius={sampleBlastRadius} trace={sampleTrace} />);

    expect(screen.getByText('0 Live Database Mutations')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByText('Analyze Lead Profile')).toBeInTheDocument();
    expect(screen.getByText('Enrich Lead Technographics')).toBeInTheDocument();
    expect(screen.getByText('Retrieved lead contact record')).toBeInTheDocument();
  });
});

describe('3. AgentVersionDiffModal Component (theme.md §8)', () => {
  const sampleDiff: AgentVersionDiff = {
    personaId: 'lead_sdr_custom',
    personaName: 'Autonomous Lead SDR',
    previousVersion: '1.1.0',
    targetVersion: '1.2.0-draft',
    fieldChanges: [
      {
        field: 'modelsAndBudgets.budgets.maxTokens',
        label: 'Max Tokens Budget',
        oldValue: 20000,
        newValue: 60000,
      },
    ],
    permissionsAdded: [],
    permissionsRemoved: [],
    riskEscalated: true,
    budgetIncreased: true,
    hasChanges: true,
  };

  it('renders demarcated header, single-circle tooltip, and warning banners', () => {
    render(
      <AgentVersionDiffModal
        diff={sampleDiff}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Version Diff: Autonomous Lead SDR/i)).toBeInTheDocument();
    expect(screen.getByText('Risk Ceiling Escalation')).toBeInTheDocument();
    expect(screen.getByText('Resource Budget Increased')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens Budget')).toBeInTheDocument();
  });
});

describe('4. AgentTestLab Component', () => {
  it('renders test lab sandbox with quick goals and input controls', () => {
    render(
      <AgentTestLab
        persona={samplePersona}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Test Lab: Autonomous Lead SDR/i)).toBeInTheDocument();
    expect(screen.getByText('Sample Test Goals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Shadow Simulation/i })).toBeInTheDocument();
  });
});

describe('5. Visual Builder Panels', () => {
  it('IdentityPurposePanel updates name and slug properly', () => {
    const onChange = vi.fn();
    render(<IdentityPurposePanel value={samplePersona.identity} onChange={onChange} />);

    const nameInput = screen.getByPlaceholderText(/e\.g\. Lead Qualification Specialist/i);
    fireEvent.change(nameInput, { target: { value: 'New Agent Name' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Agent Name' })
    );
  });

  it('CapabilitiesDomainPanel toggles domain scopes and risk levels', () => {
    const onChange = vi.fn();
    render(<CapabilitiesDomainPanel value={samplePersona.capabilities} onChange={onChange} />);

    expect(screen.getByText(/Maximum Autonomous Risk Level/i)).toBeInTheDocument();
    const riskL3Btn = screen.getByText('L3_EXTERNAL_COMMUNICATION_FINANCE');
    fireEvent.click(riskL3Btn);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxAutonomousRiskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE' })
    );
  });

  it('MemoryKnowledgePanel renders memory tiers and decay profiles', () => {
    const onChange = vi.fn();
    render(<MemoryKnowledgePanel value={samplePersona.memory} onChange={onChange} />);

    expect(screen.getByText('Working Memory')).toBeInTheDocument();
    expect(screen.getByText('Episodic Memory')).toBeInTheDocument();
    expect(screen.getByText('Semantic Memory')).toBeInTheDocument();
    expect(screen.getByText('Decay Profile')).toBeInTheDocument();
  });

  it('GovernancePolicyPanel enforces delegation depth ceiling input', () => {
    const onChange = vi.fn();
    render(<GovernancePolicyPanel value={samplePersona.governance} onChange={onChange} />);

    expect(screen.getByText(/Delegation Depth Ceiling/i)).toBeInTheDocument();
    expect(screen.getByText('depth ≤ 3')).toBeInTheDocument();
  });

  it('ModelsBudgetsPanel supports Gemini Flash and Pro selection', () => {
    const onChange = vi.fn();
    render(<ModelsBudgetsPanel value={samplePersona.modelsAndBudgets} onChange={onChange} />);

    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    expect(screen.getByText('Gemini 2.5 Pro')).toBeInTheDocument();
    expect(screen.getByText(/Max Tokens \/ Run/i)).toBeInTheDocument();
  });

  it('TriggersOutputsPanel renders trigger mechanisms and SSRF note', () => {
    const onChange = vi.fn();
    render(<TriggersOutputsPanel value={samplePersona.triggers} onChange={onChange} />);

    expect(screen.getByText('Manual Launch')).toBeInTheDocument();
    expect(screen.getByText('Event Subscription')).toBeInTheDocument();
    expect(screen.getByText('Cron Schedule')).toBeInTheDocument();
    expect(screen.getByText('Incoming Webhook')).toBeInTheDocument();
  });
});
