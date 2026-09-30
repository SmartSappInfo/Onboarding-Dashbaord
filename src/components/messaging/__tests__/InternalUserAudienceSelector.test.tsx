import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { InternalUserAudienceSelector } from '../InternalUserAudienceSelector';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { useWorkspaceRoles } from '@/hooks/use-workspace-roles';
import type { UserProfile, Role } from '@/lib/types';
import type { InternalUserRecipient } from '@/lib/types/composer-audience';

vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: vi.fn(),
}));

vi.mock('@/hooks/use-workspace-roles', () => ({
  useWorkspaceRoles: vi.fn(() => ({
    roles: [],
    roleMap: new Map(),
    isLoading: false,
    error: null,
  })),
  useRoleLookup: vi.fn((roles: Role[] | null | undefined) => {
    const map = new Map<string, Role>();
    if (roles) {
      for (const r of roles) {
        if (r && r.id) map.set(r.id, r);
      }
    }
    return map;
  }),
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
      createdAt: '2026-01-01T00:00:00Z',
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
      createdAt: '2026-01-01T00:00:00Z',
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
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'u4',
      name: 'Kwame Mensah',
      email: 'kwame@example.com',
      phone: '+233501234567',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
      // Missing role -> defaults to 'Member'
      createdAt: '2026-01-01T00:00:00Z',
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
    vi.mocked(useWorkspaceRoles).mockReturnValue({
      roles: [],
      roleMap: new Map(),
      isLoading: false,
      error: null,
    });
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

    it('renders normalized teammate details including displayName fallback, roles as subtitle, and omitting department', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      // Sarah C. uses displayName over name
      const sarahRow = screen.getByTestId('teammate-row-u1');
      expect(within(sarahRow).getByText('Sarah C.')).toBeInTheDocument();
      expect(within(sarahRow).queryByText('Operations')).toBeNull();
      expect(within(sarahRow).getByText('Admin')).toBeInTheDocument();

      // Alex Smith uses roles[0] fallback
      const alexRow = screen.getByTestId('teammate-row-u3');
      expect(within(alexRow).getByText('Alex Smith')).toBeInTheDocument();
      expect(within(alexRow).getByText('Manager')).toBeInTheDocument();
      expect(within(alexRow).queryByText('Sales')).toBeNull();

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

  describe('Role ID Resolution & Technical Code Humanizing', () => {
    it('resolves raw Firestore role IDs to human role names using roleMap', () => {
      const usersWithRoleIds: UserProfile[] = [
        {
          id: 'u-godwin',
          name: 'Godwin Mawudzro',
          email: 'godwin@example.com',
          phone: '+233557099205',
          role: 'aP8rWeyeU2uYleUj4VjX', // Raw Firestore document ID
          department: 'Agency Operations & Traffic',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const customRoles: Role[] = [
        {
          id: 'aP8rWeyeU2uYleUj4VjX',
          name: 'Operations Specialist',
          description: 'Custom operations role',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          permissions: [],
          color: '#3b82f6',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: usersWithRoleIds,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      const roleMap = new Map<string, Role>();
      roleMap.set('aP8rWeyeU2uYleUj4VjX', customRoles[0]);

      vi.mocked(useWorkspaceRoles).mockReturnValue({
        roles: customRoles,
        roleMap,
        isLoading: false,
        error: null,
      });

      render(<InternalUserAudienceSelector {...defaultProps} />);

      const godwinRow = screen.getByTestId('teammate-row-u-godwin');
      expect(within(godwinRow).getByText('Operations Specialist')).toBeInTheDocument();
      expect(within(godwinRow).queryByText('aP8rWeyeU2uYleUj4VjX')).not.toBeInTheDocument();

      // Dynamic role filter pill displays resolved human name
      expect(screen.getByRole('button', { name: /^operations specialist/i })).toBeInTheDocument();
    });

    it('masks unmapped raw Firestore role IDs to "Member" so ugly hashes never leak', () => {
      const usersWithUnmappedId: UserProfile[] = [
        {
          id: 'u-reginald',
          name: 'Reginald Abdallah',
          email: 'reginald@example.com',
          phone: '+233551718489',
          role: 'aP8rWeyeU2uYleUj4VjX', // Orphaned or unmapped ID
          department: 'Sales and Marketing',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: usersWithUnmappedId,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      vi.mocked(useWorkspaceRoles).mockReturnValue({
        roles: [],
        roleMap: new Map(),
        isLoading: false,
        error: null,
      });

      render(<InternalUserAudienceSelector {...defaultProps} />);

      const reginaldRow = screen.getByTestId('teammate-row-u-reginald');
      expect(within(reginaldRow).getByText('Member')).toBeInTheDocument();
      expect(within(reginaldRow).queryByText('aP8rWeyeU2uYleUj4VjX')).not.toBeInTheDocument();
    });

    it('humanizes snake_case, lowercase, and acronym-containing technical role codes', () => {
      const usersWithTechnicalRoles: UserProfile[] = [
        {
          id: 'u-cse',
          name: 'Rita Ocloo',
          email: 'rita@example.com',
          phone: '+233240001111',
          role: 'customer_success_(cse)',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-finance',
          name: 'Finance User',
          email: 'finance@example.com',
          phone: '+233240002222',
          role: 'finance_officer',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-trainer',
          name: 'Noah Owusu',
          email: 'noah@example.com',
          phone: '+233240003333',
          role: 'trainer',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-user',
          name: 'Evans Kenney',
          email: 'evans@example.com',
          phone: '+233240004444',
          role: 'user',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: usersWithTechnicalRoles,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} />);

      // customer_success_(cse) -> Customer Success (CSE)
      const ritaRow = screen.getByTestId('teammate-row-u-cse');
      expect(within(ritaRow).getByText('Customer Success (CSE)')).toBeInTheDocument();

      // finance_officer -> Finance Officer
      const financeRow = screen.getByTestId('teammate-row-u-finance');
      expect(within(financeRow).getByText('Finance Officer')).toBeInTheDocument();

      // trainer -> Trainer
      const noahRow = screen.getByTestId('teammate-row-u-trainer');
      expect(within(noahRow).getByText('Trainer')).toBeInTheDocument();

      // user -> Member
      const evansRow = screen.getByTestId('teammate-row-u-user');
      expect(within(evansRow).getByText('Member')).toBeInTheDocument();
    });
  });

  describe('Card Content Distribution & Layout', () => {
    it('distributes name and role as subtext on left, omitting department, and contact info on right', () => {
      const teammatesForLayout: UserProfile[] = [
        {
          id: 'u-full',
          name: 'Godwin Mawudzro',
          email: 'gkwame.gk17@gmail.com',
          phone: '+233557099205',
          role: 'Admin',
          department: 'Agency Operations & Traffic',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: teammatesForLayout,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} channel="sms" />);

      const card = screen.getByTestId('teammate-row-u-full');
      expect(within(card).getByText('Godwin Mawudzro')).toBeInTheDocument();
      expect(within(card).getByText('Admin')).toBeInTheDocument();
      expect(within(card).queryByText('Agency Operations & Traffic')).toBeNull();
      expect(within(card).getByText('gkwame.gk17@gmail.com')).toBeInTheDocument();
      expect(within(card).getByText('+233557099205')).toBeInTheDocument();
    });

    it('positions channel warning badge on the right side for ineligible teammates', () => {
      const teammatesWithWarning: UserProfile[] = [
        {
          id: 'u-warn',
          name: 'Rita Ocloo',
          email: 'rita@example.com',
          phone: '', // Missing phone
          role: 'Member',
          department: 'Customer Success',
          organizationId: 'org-1',
          workspaceIds: ['ws-1'],
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(useWorkspaceUsers).mockReturnValue({
        data: teammatesWithWarning,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useWorkspaceUsers>);

      render(<InternalUserAudienceSelector {...defaultProps} channel="sms" />);

      const card = screen.getByTestId('teammate-row-u-warn');
      expect(within(card).getByText('Missing phone')).toBeInTheDocument();
      expect(within(card).getByRole('checkbox')).toBeDisabled();
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
      const sarahCheckbox = within(sarahRow).getByRole('checkbox');

      fireEvent.keyDown(sarahCheckbox, { key: ' ' });
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(sarahCheckbox, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('selects all eligible visible teammates when "Select All Eligible" is clicked', () => {
      const onChange = vi.fn();
      render(<InternalUserAudienceSelector {...defaultProps} channel="email" onChange={onChange} />);

      const selectAllBtn = screen.getByRole('button', { name: /select all eligible/i });
      fireEvent.click(selectAllBtn);

      expect(onChange).toHaveBeenCalledTimes(1);
      const selected = onChange.mock.calls[0][0] as InternalUserRecipient[];
      // Sarah (u1), John (u2), and Kwame (u4) have emails; Alex (u3) does not
      expect(selected).toHaveLength(3);
      expect(selected.map((u) => u.userId)).toEqual(['u1', 'u2', 'u4']);
    });

    it('clears selection when "Deselect All" is clicked', () => {
      const onChange = vi.fn();
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          selectedUsers={[
            {
              userId: 'u1',
              name: 'Sarah C.',
              email: 'sarah@example.com',
              isEligibleForChannel: true,
            },
          ]}
          onChange={onChange}
        />
      );

      const deselectAllBtn = screen.getByRole('button', { name: /deselect all/i });
      fireEvent.click(deselectAllBtn);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('disables "Select All Eligible" when all eligible teammates are already selected', () => {
      render(
        <InternalUserAudienceSelector
          {...defaultProps}
          channel="email"
          selectedUsers={[
            { userId: 'u1', name: 'Sarah', email: 's@e.com', isEligibleForChannel: true },
            { userId: 'u2', name: 'John', email: 'j@e.com', isEligibleForChannel: true },
            { userId: 'u4', name: 'Kwame', email: 'k@e.com', isEligibleForChannel: true },
          ]}
        />
      );

      const selectAllBtn = screen.getByRole('button', { name: /select all eligible/i });
      expect(selectAllBtn).toBeDisabled();
    });

    it('disables "Deselect All" when no teammates are selected', () => {
      render(<InternalUserAudienceSelector {...defaultProps} selectedUsers={[]} />);

      const deselectAllBtn = screen.getByRole('button', { name: /deselect all/i });
      expect(deselectAllBtn).toBeDisabled();
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
      fireEvent.change(searchInput, { target: { value: 'sarah' } });

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Alex Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('Kwame Mensah')).not.toBeInTheDocument();
    });

    it('filters teammates by department or role', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'Support' } });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Sarah C.')).not.toBeInTheDocument();
    });

    it('clears search input when clear button is clicked', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'sarah' } });

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();

      const clearBtn = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearBtn);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows empty search state when query has no matches, with reset button', () => {
      render(<InternalUserAudienceSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search teammates/i);
      fireEvent.change(searchInput, { target: { value: 'nonexistent user 12345' } });

      expect(screen.getByText(/no teammates match your search/i)).toBeInTheDocument();

      const resetBtn = screen.getByRole('button', { name: /reset filters/i });
      fireEvent.click(resetBtn);

      expect(screen.getByText('Sarah C.')).toBeInTheDocument();
    });

    it('renders dynamic role filter pills and filters teammates when clicked', () => {
      const onChange = vi.fn();
      render(<InternalUserAudienceSelector {...defaultProps} onChange={onChange} />);

      // Role pills exist
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
