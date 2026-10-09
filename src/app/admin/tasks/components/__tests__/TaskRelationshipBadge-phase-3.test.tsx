import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskRelationshipBadge } from '../primitives/TaskRelationshipBadge';

describe('TaskRelationshipBadge (Phase 3 - Roadmap §40-41, UI Spec §613-624)', () => {
  it('generates authoritative deep-link for Deal relationship', () => {
    render(
      <TaskRelationshipBadge
        dealId="deal-99"
        entityName="Acme Expansion"
        relatedEntityType="Deal"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/admin/deals?dealId=deal-99'));
  });

  it('generates authoritative deep-link for Contract Obligation', () => {
    render(
      <TaskRelationshipBadge
        entityName="Springfield Academy"
        relatedEntityType="School"
        relatedParentId="contract-12"
        relatedEntityId="obligation-34"
        obligationSyncStatus="synced"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/admin/finance/contracts'));
    expect(screen.getByText(/synced/i)).toBeInTheDocument();
  });

  it('generates authoritative deep-link for CRM Entity', () => {
    render(
      <TaskRelationshipBadge
        entityId="ent-77"
        entityName="Greenwood High"
        entityType="institution"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/admin/entities/ent-77'));
  });

  it('handles missing or unlinked relationships gracefully without broken links', () => {
    render(
      <TaskRelationshipBadge
        entityName={null}
        relatedEntityType={null}
      />
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
