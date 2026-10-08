/**
 * @fileOverview Unit & Integration Tests for DelegationTreeModal (Phase 13 Milestone 5 Task 2)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 * - Demarcated header: <DialogHeader demarcated> (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20)
 * - Single-circle info tooltip: <CardInfoTooltip text="..." /> at z-[10050]
 * - Zero raw descriptions: <DialogDescription className="sr-only">
 * - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5
 * - Tactile action buttons: min-h-[44px] rounded-xl active:scale-[0.97]
 * - Rules 4, 7, 8, 9, 16, 17, 18, 22, 23, 40, 48, 60, 61.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DelegationTreeModal } from '@/components/supervisor/DelegationTreeModal';
import type { DelegationToken } from '@/platform/identity/delegation/delegation-types';

const MOCK_TOKENS: DelegationToken[] = [
  {
    tokenId: 'del_root_supervisor_01',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_456',
    userId: 'user_root_operator',
    supervisorAgentId: 'supervisor_root',
    subAgentId: 'billing_analyst',
    delegationChain: ['supervisor_root', 'billing_analyst'],
    depth: 1,
    allowedScopes: ['rbac:finance.invoices.view', 'rbac:finance.invoices.manage'],
    allowedCapabilities: ['invoice.search', 'invoice.reconcile'],
    tokenBudget: 4000,
    timeoutMs: 120000,
    policyVersion: '1.0.0',
    issuedAt: new Date(Date.now() - 600000).toISOString(),
    expiresAt: new Date(Date.now() + 3000000).toISOString(),
    tokenSignature: '112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00',
    status: 'active',
  },
  {
    tokenId: 'del_sub_specialist_02',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_456',
    userId: 'user_root_operator',
    supervisorAgentId: 'billing_analyst',
    subAgentId: 'collections_agent',
    parentDelegationId: 'del_root_supervisor_01',
    delegationChain: ['supervisor_root', 'billing_analyst', 'collections_agent'],
    depth: 2,
    allowedScopes: ['rbac:finance.invoices.view'],
    allowedCapabilities: ['collections.draft_outreach'],
    tokenBudget: 3000,
    timeoutMs: 60000,
    policyVersion: '1.0.0',
    issuedAt: new Date(Date.now() - 300000).toISOString(),
    expiresAt: new Date(Date.now() + 2700000).toISOString(),
    tokenSignature: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
    status: 'active',
  },
];

// Mock revoke action
vi.mock('@/app/actions/delegation-actions', () => ({
  revokeDelegationTokenAction: vi.fn(async (_input: { tokenId: string; reason: string }) => ({
    success: true,
    data: { revokedCount: 1 },
  })),
}));

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('DelegationTreeModal (theme.md §8 & Governance Compliance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with demarcated header, title, and single-circle tooltip', () => {
    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
      />
    );

    expect(screen.getByText('Delegation Tree & Scoped Authority')).toBeDefined();
    const tooltipTrigger = screen.getByRole('button', { name: /more information/i });
    expect(tooltipTrigger).toBeDefined();
  });

  it('hides long description clutter behind screen-reader only class (theme.md §8.2)', () => {
    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
      />
    );

    const srOnlyDesc = document.querySelector('.sr-only');
    expect(srOnlyDesc).toBeDefined();
    expect(srOnlyDesc?.textContent).toContain('Hierarchical delegation tree');
  });

  it('renders visual tree hierarchy with depth badges and scoped authority pills', () => {
    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
      />
    );

    // Personas in chain
    expect(screen.getAllByText('billing_analyst').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('collections_agent')).toBeDefined();

    // Depth badges (depth <= 3)
    expect(screen.getByText('Depth 1 / 3')).toBeDefined();
    expect(screen.getByText('Depth 2 / 3')).toBeDefined();

    // Scoped permissions pills
    expect(screen.getByText('rbac:finance.invoices.manage')).toBeDefined();

    // Non-delegable security lock badges (Rule 17)
    const lockBadges = screen.getAllByText(/non-delegable locked/i);
    expect(lockBadges.length).toBeGreaterThan(0);
  });

  it('renders truncated SHA-256 token signatures with copy button', () => {
    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
      />
    );

    // Truncated signature 11223344...eeff00
    expect(screen.getByText(/11223344...eeff00/i)).toBeDefined();
  });

  it('enforces mandatory >= 5 character audit justification before revoking token (Rule 61)', async () => {
    const { revokeDelegationTokenAction } = await import('@/app/actions/delegation-actions');
    const onRevokedMock = vi.fn();

    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
        onTokenRevoked={onRevokedMock}
      />
    );

    // Click revoke button on first token
    const revokeButtons = screen.getAllByRole('button', { name: /revoke token/i });
    fireEvent.click(revokeButtons[0]);

    // Justification dialog/input appears
    const reasonInput = screen.getByPlaceholderText(/reason for revocation/i);
    const confirmRevokeBtn = screen.getByRole('button', { name: /confirm revocation/i });

    expect(confirmRevokeBtn.hasAttribute('disabled')).toBe(true);

    // Type 4 characters (< 5)
    fireEvent.change(reasonInput, { target: { value: 'Test' } });
    expect(confirmRevokeBtn.hasAttribute('disabled')).toBe(true);

    // Type valid >= 5 characters
    fireEvent.change(reasonInput, {
      target: { value: 'Task completed successfully; releasing grant.' },
    });
    expect(confirmRevokeBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(revokeDelegationTokenAction).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'del_root_supervisor_01',
          reason: 'Task completed successfully; releasing grant.',
        })
      );
      expect(onRevokedMock).toHaveBeenCalledWith('del_root_supervisor_01');
    });
  });

  it('renders tactile footer with rounded-xl active:scale-[0.97] close button', () => {
    render(
      <DelegationTreeModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        tokens={MOCK_TOKENS}
      />
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const footerCloseBtn = closeButtons.find((btn) => btn.textContent === 'Close') ?? closeButtons[0];
    expect(footerCloseBtn.className).toContain('active:scale-[0.97]');
    expect(footerCloseBtn.className).toContain('min-h-[44px]');
  });
});
