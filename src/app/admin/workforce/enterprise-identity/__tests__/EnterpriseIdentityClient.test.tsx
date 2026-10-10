/**
 * @fileOverview Unit tests for Enterprise Identity & Federation header title and info tooltip invariants
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnterpriseIdentityClient } from '../EnterpriseIdentityClient';
import { SessionPolicyTab } from '../components/SessionPolicyTab';
import { IdpConfigurationTab } from '../components/IdpConfigurationTab';
import { MfaPolicyTab } from '../components/MfaPolicyTab';
import { DirectorySyncTab } from '../components/DirectorySyncTab';

// Mock dependencies
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('token') } }),
  useFirestore: () => ({ id: 'mock_firestore' }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'test-org',
    activeWorkspaceId: 'test-workspace',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/app/actions/enterprise-identity-actions', () => ({
  getEnterpriseIdpConfigAction: vi.fn().mockResolvedValue({ success: true, config: null }),
  saveEnterpriseIdpConfigAction: vi.fn().mockResolvedValue({ success: true }),
  getMfaPolicyAction: vi.fn().mockResolvedValue({
    success: true,
    policy: {
      organizationId: 'test-org',
      enforceMfa: false,
      allowedFactors: ['totp', 'passkey'],
      enforceForRoles: [],
      gracePeriodDays: 7,
      requirePasskeysForAdmin: false,
      updatedAt: new Date().toISOString(),
    },
  }),
  saveMfaPolicyAction: vi.fn().mockResolvedValue({ success: true }),
  getDirectorySyncConfigAction: vi.fn().mockResolvedValue({
    success: true,
    config: {
      organizationId: 'test-org',
      provider: 'okta',
      scimBaseUrl: '',
      bearerTokenMasked: '',
      syncEnabled: false,
      autoDeactivateOnDelete: true,
      defaultRoleId: 'member',
      totalUsersSynced: 0,
      totalGroupsSynced: 0,
    },
  }),
  saveDirectorySyncConfigAction: vi.fn().mockResolvedValue({ success: true }),
  listDirectorySyncLogsAction: vi.fn().mockResolvedValue({ success: true, logs: [] }),
  getEnterpriseSessionConfigAction: vi.fn().mockResolvedValue({
    success: true,
    config: {
      organizationId: 'test-org',
      idleTimeoutMinutes: 30,
      maxSessionDurationHours: 12,
      concurrentSessionLimit: 3,
      forceReauthOnSensitiveActions: true,
      updatedAt: new Date().toISOString(),
    },
  }),
  saveEnterpriseSessionConfigAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Enterprise Identity Title & Info Icon Invariants', () => {
  it('renders page title with CardInfoTooltip and no raw description paragraph', () => {
    const { container } = render(<EnterpriseIdentityClient />);

    // Page Heading must be present
    const heading = screen.getByRole('heading', { level: 1, name: /Enterprise Identity & Federation/i });
    expect(heading).toBeInTheDocument();

    // Raw subtitle paragraph must NOT be rendered under the title
    expect(
      screen.queryByText(/Single Sign-On \(SAML\/OIDC\), WebAuthn Passkeys/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present next to the heading
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders SessionPolicyTab with CardInfoTooltip and no raw description', () => {
    const mockConfig = {
      organizationId: 'test-org',
      idleTimeoutMinutes: 30,
      maxSessionDurationHours: 12,
      concurrentSessionLimit: 3,
      forceReauthOnSensitiveActions: true,
      updatedAt: new Date().toISOString(),
    };

    const { container } = render(
      <SessionPolicyTab config={mockConfig} onSave={vi.fn()} isSaving={false} />
    );

    expect(screen.getByText(/Session Governance & Lifetime Policies/i)).toBeInTheDocument();

    // Raw description text must NOT be present as plain text
    expect(
      screen.queryByText(/Configure browser session expiration, idle lockouts, and step-up security/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders IdpConfigurationTab with CardInfoTooltip and no raw description', () => {
    const { container } = render(
      <IdpConfigurationTab config={null} onSave={vi.fn()} isSaving={false} />
    );

    expect(screen.getByText(/Single Sign-On \(SSO\) Provider/i)).toBeInTheDocument();

    // Raw description text must NOT be present as plain text
    expect(
      screen.queryByText(/Federate authentication via enterprise SAML 2.0 or OpenID Connect/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders MfaPolicyTab with CardInfoTooltip and no raw description', () => {
    const mockPolicy = {
      organizationId: 'test-org',
      enforceMfa: false,
      allowedFactors: ['totp' as const, 'passkey' as const],
      enforceForRoles: [],
      gracePeriodDays: 7,
      requirePasskeysForAdmin: false,
      updatedAt: new Date().toISOString(),
    };

    const { container } = render(
      <MfaPolicyTab policy={mockPolicy} onSave={vi.fn()} isSaving={false} />
    );

    expect(screen.getByText(/MFA & Passkeys Policy/i)).toBeInTheDocument();

    // Raw description text must NOT be present as plain text
    expect(
      screen.queryByText(/Enforce strong second-factor authentication and hardware-bound passkeys/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders DirectorySyncTab with CardInfoTooltip and no raw descriptions on both cards', () => {
    const mockConfig = {
      organizationId: 'test-org',
      provider: 'okta' as const,
      scimBaseUrl: '',
      bearerTokenMasked: '',
      syncEnabled: false,
      autoDeactivateOnDelete: true,
      defaultRoleId: 'member',
      totalUsersSynced: 0,
      totalGroupsSynced: 0,
    };

    const { container } = render(
      <DirectorySyncTab config={mockConfig} logs={[]} onSave={vi.fn()} isSaving={false} />
    );

    expect(screen.getByText(/SCIM 2.0 Directory Synchronization/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent SCIM Synchronization Events/i)).toBeInTheDocument();

    // Raw description texts must NOT be present as plain text
    expect(
      screen.queryByText(/Automate user onboarding, role assignments, and safe de-provisioning/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Real-time audit log of inbound user provisioning/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger buttons must be present for both cards
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(2);
  });
});
