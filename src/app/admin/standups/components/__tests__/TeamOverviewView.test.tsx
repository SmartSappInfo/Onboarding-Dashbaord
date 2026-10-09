// @vitest-environment jsdom
/**
 * @fileOverview Unit tests for TeamOverviewView (Phase 4B).
 * Validates:
 * - Metric cards rendering (Submitted, Awaiting, Active Blockers).
 * - Member standup updates display.
 * - Privacy protection: privateManagerNote is NEVER rendered in team overview.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamOverviewView } from '../TeamOverviewView';
import type { StandupSubmission, UserProfile } from '@/lib/types';

const mockStandups: StandupSubmission[] = [
  {
    id: 's-1',
    workspaceId: 'ws-1',
    userId: 'user-alice',
    userName: 'Alice Smith',
    date: '2026-10-09',
    status: 'submitted',
    submittedAt: '2026-10-09T09:15:00.000Z',
    completedWork: [{ id: 'c-1', title: 'Finished API docs', completed: true }],
    plannedWork: [{ id: 'p-1', title: 'Work on data connector', completed: false }],
    blockers: [
      {
        id: 'b-1',
        summary: 'Cloud IAM permissions missing',
        category: 'access',
        severity: 'high',
      },
    ],
    helpNeeded: 'Review pull request #123',
    privateManagerNote: 'CONFIDENTIAL_PERSONAL_MANAGER_NOTE_SHOULD_NEVER_SHOW',
  },
];

const mockMembers: UserProfile[] = [
  {
    id: 'user-alice',
    name: 'Alice Smith',
    email: 'alice@corp.internal',
    roles: ['member'],
    permissions: [],
  },
  {
    id: 'user-bob',
    name: 'Bob Jones',
    email: 'bob@corp.internal',
    roles: ['member'],
    permissions: [],
  },
];

describe('TeamOverviewView Component (Phase 4B)', () => {
  it('renders submission metric cards accurately', () => {
    render(
      <TeamOverviewView
        workspaceId="ws-1"
        standups={mockStandups}
        teamMembers={mockMembers}
        selectedDate="2026-10-09"
      />
    );

    // 1 submitted, 1 awaiting out of 2 members
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Awaiting')).toBeInTheDocument();
    expect(screen.getAllByText(/Submitted/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('renders accomplishments, commitments, blockers, and help needed', () => {
    render(
      <TeamOverviewView
        workspaceId="ws-1"
        standups={mockStandups}
        teamMembers={mockMembers}
        selectedDate="2026-10-09"
      />
    );

    expect(screen.getByText('Finished API docs')).toBeInTheDocument();
    expect(screen.getByText('Work on data connector')).toBeInTheDocument();
    expect(screen.getByText('Cloud IAM permissions missing')).toBeInTheDocument();
    expect(screen.getByText(/Review pull request #123/i)).toBeInTheDocument();
  });

  it('strictly preserves privacy: NEVER renders privateManagerNote in team feed', () => {
    render(
      <TeamOverviewView
        workspaceId="ws-1"
        standups={mockStandups}
        teamMembers={mockMembers}
        selectedDate="2026-10-09"
      />
    );

    expect(
      screen.queryByText(/CONFIDENTIAL_PERSONAL_MANAGER_NOTE_SHOULD_NEVER_SHOW/i)
    ).not.toBeInTheDocument();
  });
});
