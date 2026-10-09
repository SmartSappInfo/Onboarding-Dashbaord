import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StandupSubmission, UserProfile } from '@/lib/types';
import { TeamOverviewView } from '../TeamOverviewView';

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('TeamOverviewView Privacy & Confidentiality Audit (STN-04 / Rule 8)', () => {
  const sampleTeamMembers: UserProfile[] = [
    {
      id: 'user-alice',
      organizationId: 'org-test',
      workspaceIds: ['ws-team'],
      name: 'Alice Engineer',
      email: 'alice@example.com',
      role: 'member',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'user-bob',
      organizationId: 'org-test',
      workspaceIds: ['ws-team'],
      name: 'Bob Designer',
      email: 'bob@example.com',
      role: 'member',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const sampleStandups: StandupSubmission[] = [
    {
      id: 'std-bob-1',
      workspaceId: 'ws-team',
      userId: 'user-bob',
      userName: 'Bob Designer',
      date: '2026-10-09',
      status: 'submitted',
      completedWork: [{ id: 'w1', title: 'Shipped design system Figma components', type: 'task' }],
      plannedWork: [{ id: 'w2', title: 'Review accessibility contrast tokens', type: 'task' }],
      blockers: [
        {
          id: 'blk-1',
          summary: 'Waiting on client brand guidelines',
          severity: 'medium',
          category: 'external_dependency',
          neededAction: 'Escalate to account manager',
        },
      ],
      helpNeeded: 'Need assistance with SVGs',
      // Simulating a malformed or leaked object that retained privateManagerNote
      privateManagerNote: 'SUPER_CONFIDENTIAL_MEDICAL_RECORD_SHOULD_NEVER_RENDER',
      submittedAt: '2026-10-09T08:00:00Z',
      updatedAt: '2026-10-09T08:00:00Z',
    },
  ];

  it('strictly excludes privateManagerNote from rendering in the team view', () => {
    render(
      <TeamOverviewView
        workspaceId="ws-team"
        standups={sampleStandups}
        teamMembers={sampleTeamMembers}
        selectedDate="2026-10-09"
      />
    );

    // Verify legitimate public standup items are rendered
    expect(screen.getByText('Bob Designer')).toBeDefined();
    expect(screen.getByText('Shipped design system Figma components')).toBeDefined();
    expect(screen.getByText('Review accessibility contrast tokens')).toBeDefined();
    expect(screen.getByText('Waiting on client brand guidelines')).toBeDefined();
    expect(screen.getByText('Need assistance with SVGs')).toBeDefined();

    // Verify STRICT privacy enforcement: privateManagerNote is NEVER visible
    expect(
      screen.queryByText(/SUPER_CONFIDENTIAL_MEDICAL_RECORD_SHOULD_NEVER_RENDER/i)
    ).toBeNull();
    expect(screen.queryByText(/private/i)).toBeNull();
  });

  it('renders summary metrics accurately without leaking private information', () => {
    render(
      <TeamOverviewView
        workspaceId="ws-team"
        standups={sampleStandups}
        teamMembers={sampleTeamMembers}
        selectedDate="2026-10-09"
      />
    );

    // 1 submitted, 1 awaiting, 1 blocker
    expect(screen.getAllByText('1').length).toBe(3);
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Awaiting')).toBeDefined();
    expect(screen.getByText('Active Blockers')).toBeDefined();
  });
});
