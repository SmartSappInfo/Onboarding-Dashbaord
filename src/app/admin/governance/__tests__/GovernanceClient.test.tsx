/**
 * @fileOverview Unit tests for GovernanceClient header title and info icon invariants
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GovernanceClient } from '../GovernanceClient';

// Mock dependencies
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('token') } }),
  useFirestore: () => ({ id: 'mock_firestore' }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'test-org',
    activeWorkspaceId: 'test-workspace',
    accessibleWorkspaces: [],
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/app/actions/governance-actions', () => ({
  listAccessReviewCampaignsAction: vi.fn().mockResolvedValue({ success: true, campaigns: [] }),
  listTemporaryAccessGrantsAction: vi.fn().mockResolvedValue({ success: true, grants: [] }),
  reapExpiredGrantsAction: vi.fn().mockResolvedValue({ success: true }),
  revokeTemporaryAccessAction: vi.fn().mockResolvedValue({ success: true }),
  listSoDRulesAction: vi.fn().mockResolvedValue({ success: true, rules: [], conflicts: [] }),
  scanSoDConflictsAction: vi.fn().mockResolvedValue({ success: true, conflicts: [] }),
  listSessionsAction: vi.fn().mockResolvedValue({ success: true, sessions: [] }),
  getSecurityPolicyAction: vi.fn().mockResolvedValue({ success: true, policy: null }),
  listSecurityAuditEventsAction: vi.fn().mockResolvedValue({ success: true, events: [] }),
}));

vi.mock('@/app/actions/authorization-actions', () => ({
  listRolesAction: vi.fn().mockResolvedValue({ success: true, roles: [] }),
}));

vi.mock('@/app/actions/identity-actions', () => ({
  getPeopleDirectoryAction: vi.fn().mockResolvedValue({ success: true, people: [] }),
}));

import { SoDRulesManager } from '../components/SoDRulesManager';
import { SessionControlsManager } from '../components/SessionControlsManager';
import { SecurityAuditStream } from '../components/SecurityAuditStream';

describe('GovernanceClient Title & Info Icon Invariants', () => {
  it('renders page title with CardInfoTooltip and no raw description paragraph', () => {
    const { container } = render(<GovernanceClient />);

    // Heading must be present
    const heading = screen.getByRole('heading', { level: 1, name: /Governance & Security Center/i });
    expect(heading).toBeInTheDocument();

    // Raw subtitle paragraph must NOT be rendered under the title
    expect(
      screen.queryByText(/Certify workforce permissions, issue time-bounded JIT access/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present next to the heading
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders SoDRulesManager with CardInfoTooltip and no raw description paragraph', () => {
    const { container } = render(<SoDRulesManager roles={[]} />);

    expect(screen.getByRole('heading', { level: 3, name: /Separation of Duties \(SoD\) Guardrails/i })).toBeInTheDocument();
    // Raw subtitle paragraph must NOT be rendered
    expect(screen.queryByText(/Prevent toxic role combinations/i)).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders SessionControlsManager with CardInfoTooltip and no raw descriptions', () => {
    const { container } = render(<SessionControlsManager />);

    expect(screen.getByText(/Organization Security Policies/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Device Sessions/i)).toBeInTheDocument();

    // Tooltip trigger buttons must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders SecurityAuditStream with CardInfoTooltip and no raw description', () => {
    const { container } = render(<SecurityAuditStream />);

    expect(screen.getByText(/Immutable Security Audit Log/i)).toBeInTheDocument();

    // Tooltip trigger button must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });
});

