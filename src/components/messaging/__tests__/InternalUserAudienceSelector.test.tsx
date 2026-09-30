import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { InternalUserAudienceSelector } from '../InternalUserAudienceSelector';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import type { UserProfile } from '@/lib/types';
import type { InternalUserRecipient } from '@/lib/types/composer-audience';

vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: vi.fn(),
}));

describe('InternalUserAudienceSelector', () => {
  const mockTeammates: UserProfile[] = [
    {
      id: 'u1',
      name: 'Sarah Connor',
      displayName: 'Sarah C.',
      email: 'sarah@example.com',
      phone: '+233241234567',
      role: 'Admin',
      department: 'Operations',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      photoURL: 'https://example.com/sarah.jpg',
    },
    {
      id: 'u2',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '', // No phone -> Ineligible for SMS/WhatsApp
      role: 'Agent',
      department: 'Support',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
    },
    {
      id: 'u3',
      name: 'Alex Smith',
      email: '', // No email -> Ineligible for Email
      phone: '+233209876543',
      roles: ['Manager'], // Uses roles array
      department: 'Sales',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
    },
    {
      id: 'u4',
      name: 'Kwame Mensah',
      email: 'kwame@example.com',
      phone: '+233501234567',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      // Missing role -> defaults to 'Member'
    },
  ];

  const defaultProps = {
    channel: 'email' as const,
    workspaceId: 'ws-1',
    selectedUsers: [] as InternalUserRecipient[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('renders skeleton loading state when workspace users are loading', () => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} />);

      expect(screen.getByTestId('internal-user-selector-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('Sarah C.')).not.toBeInTheDocument();
    });

    it('renders empty state card when workspace has no teammates', () => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} />);

      expect(
        screen.getByText(/no teammates found in this workspace/i)
      ).toBeInTheDocument();
    });

    it('renders empty state when workspaceId is not provided', () => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} workspaceId={null} />);

      expect(
        screen.getByText(/no teammates found in this workspace/i)
      ).toBeInTheDocument();
    });
  });

  describe('Teammate Normalization & Display', () => {
    beforeEach(() => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: mockTeammates,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);
    });

    it('renders normalized teammate details including displayName fallback, roles, and department', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      // Sarah C. uses displayName over name
      const sarahRow = screen.getByTestId('teammate-row-u1');
      expect(within(sarahRow).getByText('Sarah C.')).toBeInTheDocument();
      expect(within(sarahRow).getByText('Operations')).toBeInTheDocument();
      expect(within(sarahRow).getByText('Admin')).toBeInTheDocument();

      // Alex Smith uses roles[0] fallback
      const alexRow = screen.getByTestId('teammate-row-u3');
      expect(within(alexRow).getByText('Alex Smith')).toBeInTheDocument();
      expect(within(alexRow).getByText('Manager')).toBeInTheDocument();
      expect(within(alexRow).getByText('Sales')).toBeInTheDocument();

      // Kwame Mensah falls back to 'Member' role
      const kwameRow = screen.getByTestId('teammate-row-u4');
      expect(within(kwameRow).getByText('Kwame Mensah')).toBeInTheDocument();
      expect(within(kwameRow).getByText('Member')).toBeInTheDocument();
    });

    it('renders avatar image if photoURL exists, or initials fallback', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      // Sarah C. has photoURL
      const sarahImg = screen.getByAltText('Sarah C.');
      expect(sarahImg).toHaveAttribute('src', 'https://example.com/sarah.jpg');

      // John Doe has no photo, should display JD initials
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  describe('Channel Eligibility & Amber Warning Badges', () => {
    beforeEach(() => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: mockTeammates,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);
    });

    it('identifies missing email on email channel with amber warning badge', () => {
      render(<InternalUserAudienceSelector {...defaultProps} channel="email" />);

      // Alex Smith has no email
      expect(screen.getByText('Missing email')).toBeInTheDocument();

      // Alex Smith row checkbox should be disabled
      const alexRow = screen.getByTestId('teammate-row-u3');
      const alexCheckbox = within(alexRow).getByRole('checkbox');
      expect(alexCheckbox).toBeDisabled();
    });

    it('identifies missing phone on sms channel with amber warning badge', () => {
      render(<InternalUserAudienceSelector {...defaultProps} channel="sms" />);

      // John Doe has no phone
      expect(screen.getByText('Missing phone')).toBeInTheDocument();

      // John Doe row checkbox should be disabled
      const johnRow = screen.getByTestId('teammate-row-u2');
      const johnCheckbox = within(johnRow).getByRole('checkbox');
      expect(johnCheckbox).toBeDisabled();

      // Alex Smith has valid phone, so should be eligible on SMS
      const alexRow = screen.getByTestId('teammate-row-u3');
      const alexCheckbox = within(alexRow).getByRole('checkbox');
      expect(alexCheckbox).not.toBeDisabled();
    });

    it('identifies missing phone on whatsapp channel with amber warning badge', () => {
      render(<InternalUserAudienceSelector {...defaultProps} channel="whatsapp" />);

      // John Doe has no phone
      expect(screen.getByText('Missing phone')).toBeInTheDocument();
      const johnRow = screen.getByTestId('teammate-row-u2');
      const johnCheckbox = within(johnRow).getByRole('checkbox');
      expect(johnCheckbox).toBeDisabled();
    });
  });

  describe('Selection & Batch Actions', () => {
    beforeEach(() => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: mockTeammates,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);
    });

    it('displays counter badge with emerald accent', () => {
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          selectedUsers={[
            {
              userId: 'u1',
              name: 'Sarah C.',
              email: 'sarah@example.com',
              phone: '+233241234567',
              role: 'Admin',
              department: 'Operations',
              isEligibleForChannel: true,
            },
          ]}
        />
      );

      expect(screen.getByText(/selected 1 of 4 teammates/i)).toBeInTheDocument();
    });

    it('toggles selection when clicking an eligible teammate row', () => {
      const onChange = vi.fn();
      render(<InternalUserAudienceSelector {...defaultProps} onChange={onChange} />);

      const sarahRow = screen.getByTestId('teammate-row-u1');
      fireEvent.click(sarahRow);

      expect(onChange).toHaveBeenCalledTimes(1);
      const calledWith = onChange.mock.calls[0][0];
      expect(calledWith).toHaveLength(1);
      expect(calledWith[0].userId).toBe('u1');
      expect(calledWith[0].name).toBe('Sarah C.');
      expect(calledWith[0].email).toBe('sarah@example.com');
      expect(calledWith[0].isEligibleForChannel).toBe(true);
    });

    it('does not select an ineligible teammate when clicked', () => {
      const onChange = vi.fn();
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          channel="email"
          onChange={onChange}
        />
      );

      const alexRow = screen.getByTestId('teammate-row-u3'); // Missing email
      fireEvent.click(alexRow);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('toggles selection off when clicking an already-selected teammate', () => {
      const onChange = vi.fn();
      const selectedUser: InternalUserRecipient = {
        userId: 'u1',
        name: 'Sarah C.',
        email: 'sarah@example.com',
        phone: '+233241234567',
        role: 'Admin',
        department: 'Operations',
        isEligibleForChannel: true,
      };

      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          selectedUsers={[selectedUser]}
          onChange={onChange}
        />
      );

      const sarahRow = screen.getByTestId('teammate-row-u1');
      fireEvent.click(sarahRow);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('supports keyboard selection with Space and Enter on checkbox', () => {
      const onChange = vi.fn();
      render(<InternalUserAudienceSelector {...defaultProps} onChange={onChange} />);

      const sarahRow = screen.getByTestId('teammate-row-u1');
      const checkbox = within(sarahRow).getByRole('checkbox');

      fireEvent.keyDown(checkbox, { key: ' ' });
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(checkbox, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('selects all eligible visible teammates when "Select All Eligible" is clicked', () => {
      const onChange = vi.fn();
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          channel="email"
          onChange={onChange}
        />
      );

      const selectAllBtn = screen.getByRole('button', { name: /select all eligible/i });
      fireEvent.click(selectAllBtn);

      expect(onChange).toHaveBeenCalledTimes(1);
      const selected = onChange.mock.calls[0][0] as InternalUserRecipient[];
      // On email channel: u1, u2, u4 are eligible; u3 (Alex) has no email
      expect(selected).toHaveLength(3);
      expect(selected.map((u) => u.userId)).toEqual(['u1', 'u2', 'u4']);
    });

    it('clears selection when "Deselect All" is clicked', () => {
      const onChange = vi.fn();
      const selectedUser: InternalUserRecipient = {
        userId: 'u1',
        name: 'Sarah C.',
        email: 'sarah@example.com',
        isEligibleForChannel: true,
      };

      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          selectedUsers={[selectedUser]}
          onChange={onChange}
        />
      );

      const deselectBtn = screen.getByRole('button', { name: /deselect all/i });
      fireEvent.click(deselectBtn);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('disables "Select All Eligible" when all eligible teammates are already selected', () => {
      const allEligible: InternalUserRecipient[] = [
        {
          userId: 'u1',
          name: 'Sarah C.',
          email: 'sarah@example.com',
          isEligibleForChannel: true,
        },
        {
          userId: 'u2',
          name: 'John Doe',
          email: 'john@example.com',
          isEligibleForChannel: true,
        },
        {
          userId: 'u4',
          name: 'Kwame Mensah',
          email: 'kwame@example.com',
          isEligibleForChannel: true,
        },
      ];

      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          channel="email"
          selectedUsers={allEligible}
        />
      );

      const selectAllBtn = screen.getByRole('button', { name: /select all eligible/i });
      expect(selectAllBtn).toBeDisabled();
    });

    it('disables "Deselect All" when no teammates are selected', () => {
      render(<InternalUserAudienceSelector {...defaultProps} selectedUsers={[]} />);

      const deselectBtn = screen.getByRole('button', { name: /deselect all/i });
      expect(deselectBtn).toBeDisabled();
    });
  });

  describe('Search & Filter Functionality', () => {
    beforeEach(() => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: mockTeammates,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);
    });

    it('filters teammates by name query', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'kwame' } });

      expect(screen.getByText('Kwame Mensah')).toBeInTheDocument();
      expect(screen.queryByText('Sarah C.')).not.toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Alex Smith')).not.toBeInTheDocument();
    });

    it('filters teammates by department or role', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'operations' } });

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('clears search input when clear button is clicked', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'kwame' } });
      expect(screen.queryByText('Sarah C.')).not.toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearBtn);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
      expect(screen.getByText('Kwame Mensah')).toBeInTheDocument();
    });

    it('shows empty search state when query has no matches, with reset button', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'nonexistent-person' } });

      expect(screen.getByText(/no teammates match your search/i)).toBeInTheDocument();

      const resetBtn = screen.getByRole('button', { name: /reset filters/i });
      fireEvent.click(resetBtn);

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
    });

    it('renders dynamic role filter pills and filters teammates when clicked', () => {
      const onChange = vi.fn();
      render(<InternalUserAudienceSelector {...defaultProps} onChange={onChange} />);

      // Role filter pills: All, Admin, Agent, Manager, Member
      expect(screen.getByRole('button', { name: /^all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^admin/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^agent/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^manager/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^member/i })).toBeInTheDocument();

      // Click Admin pill
      fireEvent.click(screen.getByRole('button', { name: /^admin/i }));

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Kwame Mensah')).not.toBeInTheDocument();

      // "Select All Eligible" with filter active only selects Admin
      fireEvent.click(screen.getByRole('button', { name: /select all eligible/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const selected = onChange.mock.calls[0][0] as InternalUserRecipient[];
      expect(selected).toHaveLength(1);
      expect(selected[0].userId).toBe('u1');
    });
  });

  describe('Disabled State', () => {
    beforeEach(() => {
      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: mockTeammates,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);
    });

    it('disables search, role pills, batch buttons, and teammate rows when disabled prop is true', () => {
      const onChange = vi.fn();
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          disabled={true}
          onChange={onChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      expect(searchInput).toBeDisabled();

      const selectAllBtn = screen.getByRole('button', { name: /select all eligible/i });
      expect(selectAllBtn).toBeDisabled();

      const sarahRow = screen.getByTestId('teammate-row-u1');
      fireEvent.click(sarahRow);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
