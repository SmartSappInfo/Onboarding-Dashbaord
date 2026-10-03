// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for Operator Capability Console & Mission Control (Phase 5 Milestone 4 Task 7)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 14 & 21: Tool fingerprint drift detection and operator approval.
 * - Rule 15 & 34: External server allowlisting and SSRF protection.
 * - Rule 17: Non-delegable action warning indicators.
 * - Rule 22: Cryptographic SHA-256 hash copy and inspection.
 * - Rule 30: Containerized untrusted reference data (<untrusted_reference_data id="...">).
 * - Rule 60: Emergency dead-man kill switch visual banner.
 * - Rule 62: Live SSE activity stream presentation.
 * - theme.md Section 8: Standardized Modal & Dialog Architecture compliance.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToolInspectorDrawer } from '@/components/mcp/ToolInspectorDrawer';
import { McpMetricsCards } from '@/components/mcp/McpMetricsCards';
import { McpDeadManBanner } from '@/components/mcp/McpDeadManBanner';
import { CapabilityCatalogTable } from '@/components/mcp/CapabilityCatalogTable';
import { ServerAllowlistTable } from '@/components/mcp/ServerAllowlistTable';
import { RegisterServerModal } from '@/components/mcp/RegisterServerModal';
import { McpActivityStream } from '@/components/mcp/McpActivityStream';
import type {
  McpCapabilitySummary,
  McpToolDetails,
  McpPlatformMetrics,
} from '@/app/actions/mcp-actions';
import type { McpServerRegistration } from '@/platform/mcp/security';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('tab=catalog'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    status: 'connected',
    lastActivity: null,
    error: null,
    reconnect: vi.fn(),
  }),
}));

// Mock test data
const mockToolDetails: McpToolDetails = {
  id: 'crm.contact.create',
  name: 'Create Contact',
  domain: 'crm_contacts',
  version: '1.0.0',
  description: 'Creates a contact record with custom attributes and verification tags.',
  riskLevel: 'L2_STATE_MUTATION',
  isNonDelegable: true,
  supportsDryRun: true,
  requiredScopes: ['app:crm_view', 'app:crm_manage'],
  inputSchema: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string' },
    },
    required: ['email', 'name'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
  },
  fingerprint: {
    toolId: 'crm.contact.create',
    version: '1.0.0',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    compositeHash: 'sha256_mock_composite_hash_abcdef1234567890abcdef1234567890',
    descriptionHash: 'sha256_mock_desc_hash_11111111111111111111111111111111',
    schemaHash: 'sha256_mock_schema_hash_22222222222222222222222222222222',
    permissionHash: 'sha256_mock_perm_hash_33333333333333333333333333333333',
    riskHash: 'sha256_mock_risk_hash_44444444444444444444444444444444',
    approvedBy: 'usr_admin_1',
    approvedAt: '2026-10-03T00:00:00.000Z',
  },
  driftReport: {
    toolId: 'crm.contact.create',
    version: '1.0.0',
    hasDrift: true,
    driftTypes: ['schema'],
    severity: 'critical',
    reason: 'Input schema modified without operator signature',
    details: {
      schemaChanged: true,
      currentCompositeHash: 'sha256_new_hash_99999999999999999999999999999999',
    },
  },
};

const mockCapabilities: McpCapabilitySummary[] = [
  {
    id: 'crm.contact.create',
    name: 'Create Contact',
    domain: 'crm_contacts',
    version: '1.0.0',
    description: 'Creates a contact record.',
    riskLevel: 'L2_STATE_MUTATION',
    isNonDelegable: true,
    supportsDryRun: true,
    fingerprintStatus: 'drift_detected',
    enabled: true,
  },
  {
    id: 'memory.semantic_search',
    name: 'Semantic Search',
    domain: 'knowledge',
    version: '1.0.0',
    description: 'Searches institutional memory vector index.',
    riskLevel: 'L0_READ',
    isNonDelegable: false,
    supportsDryRun: false,
    fingerprintStatus: 'verified',
    enabled: true,
  },
];

const mockServers: McpServerRegistration[] = [
  {
    serverId: 'srv_weather_1',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    serverUrl: 'https://api.weather-mcp.org/sse',
    transportType: 'http',
    status: 'discovered',
    allowedDomains: ['crm'],
    allowedTools: [],
    provenance: {
      vendor: 'Weather Gateway Inc',
    },
    healthStatus: 'healthy',
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
  },
];

const mockMetrics: McpPlatformMetrics = {
  totalCapabilities: 25,
  verifiedFingerprints: 24,
  driftedCapabilities: 1,
  externalServers: 3,
  invocations24h: 350,
  deadManPaused: false,
};

describe('Operator Capability Console UI Components (Phase 5 Milestone 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ToolInspectorDrawer (theme.md §8 & Rule 30)', () => {
    it('renders tool overview and containerizes untrusted descriptions (Rule 30)', () => {
      render(
        <ToolInspectorDrawer
          tool={mockToolDetails}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      // Verify title & version
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();

      // Verify Rule 30 Containerization
      const container = screen.getByTestId('untrusted-reference-container');
      expect(container).toBeInTheDocument();
      expect(container.textContent).toContain('<untrusted_reference_data id="crm.contact.create">');
      expect(container.textContent).toContain('Creates a contact record');
      expect(container.textContent).toContain('</untrusted_reference_data>');

      // Verify Non-Delegable Warning (Rule 17)
      expect(screen.getByText(/Non-Delegable Action \(Rule 17\)/i)).toBeInTheDocument();

      // Verify Drift Alert (Rule 14)
      expect(screen.getByText(/Cryptographic Schema Drift Detected \(Rule 14\)/i)).toBeInTheDocument();
    });

    it('renders tabs and displays cryptographic hash breakdown (Rule 22)', async () => {
      const { rerender } = render(
        <ToolInspectorDrawer
          tool={mockToolDetails}
          open={true}
          onOpenChange={vi.fn()}
          initialTab="fingerprint"
        />
      );

      // Verify composite hash and sub-hashes on Fingerprint tab
      expect(screen.getByText(/Canonical Composite Hash/i)).toBeInTheDocument();
      expect(screen.getByText(/sha256_mock_composite_hash/)).toBeInTheDocument();
      expect(screen.getByText('Schema Hash')).toBeInTheDocument();
      expect(screen.getByText('Risk Hash')).toBeInTheDocument();

      // Rerender on Schemas tab
      rerender(
        <ToolInspectorDrawer
          tool={mockToolDetails}
          open={true}
          onOpenChange={vi.fn()}
          initialTab="schema"
        />
      );
      expect(screen.getByText(/Input JSON Schema/i)).toBeInTheDocument();

      // Rerender on Permissions tab
      rerender(
        <ToolInspectorDrawer
          tool={mockToolDetails}
          open={true}
          onOpenChange={vi.fn()}
          initialTab="permissions"
        />
      );
      expect(screen.getByText('app:crm_view')).toBeInTheDocument();
      expect(screen.getByText('app:crm_manage')).toBeInTheDocument();
    });
  });

  describe('CapabilityCatalogTable', () => {
    it('filters capabilities by search query and renders drift indicators', () => {
      const onInspect = vi.fn();
      render(
        <CapabilityCatalogTable
          capabilities={mockCapabilities}
          onInspect={onInspect}
        />
      );

      expect(screen.getByText('Create Contact')).toBeInTheDocument();
      expect(screen.getByText('Semantic Search')).toBeInTheDocument();

      // Search for "Semantic"
      const searchInput = screen.getByPlaceholderText(/Search capabilities/i);
      fireEvent.change(searchInput, { target: { value: 'Semantic' } });

      expect(screen.queryByText('Create Contact')).not.toBeInTheDocument();
      expect(screen.getByText('Semantic Search')).toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('Create Contact')).toBeInTheDocument();

      // Verify Drift Detected badge
      expect(screen.getByText('Drift Detected')).toBeInTheDocument();

      // Click Inspect
      const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
      fireEvent.click(inspectButtons[0]);
      expect(onInspect).toHaveBeenCalledWith('crm.contact.create');
    });
  });

  describe('ServerAllowlistTable & RegisterServerModal', () => {
    it('renders allowlisted servers with 8-stage lifecycle pills and SSRF verification', () => {
      const onRegisterNew = vi.fn();
      render(
        <ServerAllowlistTable
          servers={mockServers}
          onRegisterNew={onRegisterNew}
        />
      );

      expect(screen.getByText('Weather Gateway Inc')).toBeInTheDocument();
      expect(screen.getByText('Discovered')).toBeInTheDocument();
      expect(screen.getByText('Rule 34 Verified')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();

      // Trigger Register Server button
      const regBtn = screen.getByRole('button', { name: /Register Server/i });
      fireEvent.click(regBtn);
      expect(onRegisterNew).toHaveBeenCalled();
    });

    it('submits valid server registration form in RegisterServerModal', async () => {
      const onRegister = vi.fn().mockResolvedValue(undefined);
      const onOpenChange = vi.fn();

      render(
        <RegisterServerModal
          open={true}
          onOpenChange={onOpenChange}
          onRegister={onRegister}
        />
      );

      expect(screen.getByText('Register External MCP Server')).toBeInTheDocument();

      // Fill in fields
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Weather Service Gateway/i), {
        target: { value: 'New Test Gateway' },
      });
      fireEvent.change(screen.getByPlaceholderText(/https:\/\/api\.external-mcp\.org\/sse/i), {
        target: { value: 'https://api.test-gateway.com/sse' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Describe the capabilities/i), {
        target: { value: 'Provides external test capabilities.' },
      });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Register Server/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onRegister).toHaveBeenCalledWith({
          serverName: 'New Test Gateway',
          serverUrl: 'https://api.test-gateway.com/sse',
          description: 'Provides external test capabilities.',
        });
      });
    });
  });

  describe('McpMetricsCards & McpDeadManBanner', () => {
    it('renders 4 platform metric cards accurately', () => {
      render(<McpMetricsCards metrics={mockMetrics} />);

      expect(screen.getByText('Platform Tools')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();

      expect(screen.getByText('Verified Schemas')).toBeInTheDocument();
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(screen.getByText('(96%)')).toBeInTheDocument();

      expect(screen.getByText('Schema Drift')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      expect(screen.getByText('External Servers')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays emergency dead-man banner when active (Rule 60)', () => {
      const { rerender } = render(<McpDeadManBanner active={false} />);
      expect(screen.queryByText(/EMERGENCY DEAD-MAN PAUSE ACTIVE/i)).not.toBeInTheDocument();

      rerender(<McpDeadManBanner active={true} />);
      expect(screen.getByText(/EMERGENCY DEAD-MAN PAUSE ACTIVE \(Rule 60\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Autonomous agent dispatch/i)).toBeInTheDocument();
    });
  });

  describe('McpActivityStream', () => {
    it('renders live activity events with correlation ID copy targets (Rule 62)', () => {
      render(<McpActivityStream workspaceId="ws_test_123" />);

      expect(screen.getByText('Live MCP Activity Stream')).toBeInTheDocument();
      expect(screen.getByText(/Connected/i)).toBeInTheDocument();

      // Check initial event entries
      expect(screen.getByText(/crm\.activity\.create executed successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/Fingerprint approved for capability/i)).toBeInTheDocument();
    });
  });
});
