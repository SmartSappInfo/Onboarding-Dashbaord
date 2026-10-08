/**
 * @fileOverview Test Suite: Registry Operator UI Surfaces (Phase 15 Milestone 4 Task 6)
 *
 * Implements theme.md §8, Rule 4 (Strict typing), Rule 7 (Mobile touch targets),
 * Rule 14 (Schema verification), Rule 22 (Strategic Tool & Agent Registries).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapabilityRegistryClient } from '@/app/admin/settings/ai/capabilities/CapabilityRegistryClient';
import { AgentRegistryClient } from '@/app/admin/settings/ai/agents/AgentRegistryClient';
import type {
  CapabilityCatalogItem,
  AgentPersonaSummary,
} from '@/platform/registry/contracts/registry-types';

// Mock server actions called from UI
vi.mock('@/app/actions/registry-actions', () => ({
  generatePlatformDocsAction: vi.fn(async ({ format }: { format: string }) => ({
    success: true,
    data: {
      format,
      content: '{"openapi": "3.1.0", "info": {"title": "SmartSapp MCP API"}}',
    },
  })),
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('Phase 15 Milestone 4 - Registry Operator UI Surfaces', () => {
  const sampleCapabilities: CapabilityCatalogItem[] = [
    {
      id: 'crm.contact.get',
      domain: 'crm_contacts',
      version: '1.0.0',
      description: 'Fetches contact details by ID',
      riskLevel: 'L0_READ',
      requiresApproval: false,
      permissions: ['workspace:read'],
      isDelegable: true,
      driftStatus: 'APPROVED',
      lastVerifiedAt: '2026-10-08T00:00:00.000Z',
      schema: {
        input: { type: 'object', properties: { contactId: { type: 'string' } } },
        output: { type: 'object', properties: { contact: { type: 'object' } } },
      },
      policies: {
        auditRequired: false,
        requiresIdempotencyKey: false,
      },
    },
    {
      id: 'finance.payment.reconcile',
      domain: 'finance_billing',
      version: '1.0.0',
      description: 'Mutates ledger record to reconcile payment batch',
      riskLevel: 'L2_STATE_MUTATION',
      requiresApproval: true,
      permissions: ['finance:reconcile'],
      isDelegable: false,
      driftStatus: 'DRIFT_DETECTED',
      lastVerifiedAt: '2026-10-08T00:00:00.000Z',
      schema: {
        input: { type: 'object', properties: { batchId: { type: 'string' } } },
      },
      policies: {
        auditRequired: true,
        requiresIdempotencyKey: true,
      },
    },
  ];

  const samplePersonas: AgentPersonaSummary[] = [
    {
      id: 'crm_researcher',
      name: 'CRM Researcher Agent',
      version: '1.0.0',
      role: 'Account Intelligence Specialist',
      description: 'Deep customer intelligence and timeline aggregation agent',
      maxAutonomousRiskLevel: 'L0_READ',
      allowedDomains: ['crm_contacts', 'knowledge_memory'],
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      isConfigurable: false,
    },
    {
      id: 'collections_agent',
      name: 'Collections & Dunning Specialist',
      version: '1.0.0',
      role: 'Receivables Recovery Agent',
      description: 'Autonomous payment plan formulation and dunning negotiator',
      maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
      allowedDomains: ['finance_billing'],
      maxDurationMs: 180000,
      maxTokens: 40000,
      maxToolCalls: 12,
      isConfigurable: false,
    },
  ];

  it('renders Capability Registry with Zone 1 KPI cards and table rows', () => {
    render(<CapabilityRegistryClient initialCapabilities={sampleCapabilities} />);

    expect(screen.getByText('Capabilities Registry')).toBeDefined();
    expect(screen.getByText('crm.contact.get')).toBeDefined();
    expect(screen.getByText('finance.payment.reconcile')).toBeDefined();
    expect(screen.getByText('Total Capabilities')).toBeDefined();
    expect(screen.getByText('Read-Only Tools')).toBeDefined();
    expect(screen.getByText('Mutating Tools')).toBeDefined();
  });

  it('filters capabilities based on text search query', async () => {
    render(<CapabilityRegistryClient initialCapabilities={sampleCapabilities} />);

    const searchInput = screen.getByPlaceholderText(/Search capabilities/i);
    fireEvent.change(searchInput, { target: { value: 'reconcile' } });

    // Wait for 300ms debounce
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(screen.getByText('finance.payment.reconcile')).toBeDefined();
  });

  it('opens CapabilityDetailModal adhering to theme.md §8 on Inspect click', () => {
    render(<CapabilityRegistryClient initialCapabilities={sampleCapabilities} />);

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);

    // Dialog Title should contain capability ID
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getAllByText('crm.contact.get').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Required RBAC Permissions/i)).toBeDefined();
  });

  it('renders Agent Persona Registry with Zone 1 KPI cards and personas', () => {
    render(<AgentRegistryClient initialPersonas={samplePersonas} />);

    expect(screen.getByText('Agent Persona Registry')).toBeDefined();
    expect(screen.getByText('CRM Researcher Agent')).toBeDefined();
    expect(screen.getByText('Collections & Dunning Specialist')).toBeDefined();
    expect(screen.getByText('Canonical Personas')).toBeDefined();
  });

  it('opens AgentPersonaDetailModal adhering to theme.md §8 on Inspect click', () => {
    render(<AgentRegistryClient initialPersonas={samplePersonas} />);

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBeGreaterThan(0);
    fireEvent.click(inspectButtons[0]);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Autonomous Resource Budgets (Rule 23)')).toBeDefined();
    expect(screen.getByText(/Non-Delegable Governance Boundary/i)).toBeDefined();
  });
});
