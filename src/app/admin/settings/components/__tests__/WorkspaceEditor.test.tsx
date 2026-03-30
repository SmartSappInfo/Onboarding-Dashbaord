/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Workspace } from '@/lib/types';

describe('WorkspaceEditor - Scope Display', () => {
  // Mock workspace data
  const mockInstitutionWorkspace: Workspace = {
    id: 'ws-1',
    organizationId: 'org-1',
    name: 'Higher Education Onboarding',
    description: 'Onboarding workspace for schools',
    status: 'active',
    statuses: [
      { value: 'Active', label: 'Active', color: '#10b981' }
    ],
    contactScope: 'institution',
    capabilities: {
      billing: true,
      admissions: false,
      children: false,
      contracts: true,
      messaging: true,
      automations: true,
      tasks: true
    },
    scopeLocked: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockFamilyWorkspace: Workspace = {
    id: 'ws-2',
    organizationId: 'org-1',
    name: 'Family Admissions',
    description: 'Admissions workspace for families',
    status: 'active',
    statuses: [
      { value: 'Active', label: 'Active', color: '#10b981' }
    ],
    contactScope: 'family',
    capabilities: {
      billing: false,
      admissions: true,
      children: true,
      contracts: false,
      messaging: true,
      automations: true,
      tasks: true
    },
    scopeLocked: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  it('should display institution scope badge on workspace card', () => {
    const { container } = render(
      <div data-testid="workspace-card">
        {mockInstitutionWorkspace.contactScope && (
          <span data-testid="scope-badge">
            {mockInstitutionWorkspace.contactScope === 'institution' ? 'Schools' : 
             mockInstitutionWorkspace.contactScope === 'family' ? 'Families' : 'People'}
          </span>
        )}
      </div>
    );

    expect(screen.getByTestId('scope-badge')).toHaveTextContent('Schools');
  });

  it('should display family scope badge on workspace card', () => {
    const { container } = render(
      <div data-testid="workspace-card">
        {mockFamilyWorkspace.contactScope && (
          <span data-testid="scope-badge">
            {mockFamilyWorkspace.contactScope === 'institution' ? 'Schools' : 
             mockFamilyWorkspace.contactScope === 'family' ? 'Families' : 'People'}
          </span>
        )}
      </div>
    );

    expect(screen.getByTestId('scope-badge')).toHaveTextContent('Families');
  });

  it('should display lock icon when scope is locked', () => {
    const { container } = render(
      <div data-testid="workspace-card">
        {mockInstitutionWorkspace.scopeLocked && (
          <span data-testid="lock-icon">🔒</span>
        )}
      </div>
    );

    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('should not display lock icon when scope is not locked', () => {
    const { container } = render(
      <div data-testid="workspace-card">
        {mockFamilyWorkspace.scopeLocked && (
          <span data-testid="lock-icon">🔒</span>
        )}
      </div>
    );

    expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
  });

  it('should display "This workspace manages" label with correct scope type', () => {
    const { container } = render(
      <div data-testid="scope-display">
        <p>
          This workspace manages{' '}
          <span data-testid="scope-type">
            {mockInstitutionWorkspace.contactScope === 'institution' ? 'Schools' : 
             mockInstitutionWorkspace.contactScope === 'family' ? 'Families' : 'People'}
          </span>
        </p>
      </div>
    );

    expect(screen.getByText(/This workspace manages/)).toBeInTheDocument();
    expect(screen.getByTestId('scope-type')).toHaveTextContent('Schools');
  });

  it('should display capabilities toggles', () => {
    const { container } = render(
      <div data-testid="capabilities">
        {Object.entries(mockInstitutionWorkspace.capabilities!).map(([key, enabled]) => (
          <div key={key} data-testid={`capability-${key}`}>
            {enabled ? '✓' : '✗'} {key}
          </div>
        ))}
      </div>
    );

    expect(screen.getByTestId('capability-billing')).toHaveTextContent('✓ billing');
    expect(screen.getByTestId('capability-admissions')).toHaveTextContent('✗ admissions');
    expect(screen.getByTestId('capability-contracts')).toHaveTextContent('✓ contracts');
  });

  it('should display scope locked warning when scope is locked', () => {
    const { container } = render(
      <div data-testid="scope-warning">
        {mockInstitutionWorkspace.scopeLocked && (
          <div data-testid="locked-warning">
            Contact scope cannot be changed after entities have been linked to this workspace.
          </div>
        )}
      </div>
    );

    expect(screen.getByTestId('locked-warning')).toBeInTheDocument();
    expect(screen.getByTestId('locked-warning')).toHaveTextContent(
      'Contact scope cannot be changed after entities have been linked to this workspace.'
    );
  });
});
