/**
 * @fileOverview Unit tests for AcceptInvitationClient.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcceptInvitationClient } from '../AcceptInvitationClient';

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams('token=valid-test-token');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock firebase
vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: null,
    isUserLoading: false,
    userError: null,
  }),
}));

// Mock actions
const mockValidateAction = vi.fn();
const mockAcceptAction = vi.fn();
const mockDeclineAction = vi.fn();

vi.mock('@/app/actions/invitation-crypto-actions', () => ({
  validateEncryptedInvitationAction: (args: unknown) => mockValidateAction(args),
  acceptInvitationLandingAction: (args: unknown) => mockAcceptAction(args),
  declineInvitationLandingAction: (args: unknown) => mockDeclineAction(args),
}));

describe('AcceptInvitationClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('token=valid-test-token');
  });

  it('renders loading state initially while validating token', () => {
    mockValidateAction.mockReturnValue(new Promise(() => {})); // pending
    render(<AcceptInvitationClient />);

    expect(screen.getByText(/Checking your invitation.../i)).toBeInTheDocument();
  });

  it('renders valid invitation with badges, details, and action buttons', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'valid',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
        fullName: 'Alex Rivera',
        roleNames: ['Account Executive', 'Team Lead'],
        expiresAt: '2026-12-31T00:00:00.000Z',
      },
    });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByText('Sales & Growth')).toBeInTheDocument();
      expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
      expect(screen.getByText('alex.rivera@example.com')).toBeInTheDocument();
      expect(screen.getByText('Account Executive')).toBeInTheDocument();
      expect(screen.getByText('Accept Invitation')).toBeInTheDocument();
      expect(screen.getByText('Decline')).toBeInTheDocument();
    });
  });

  it('opens inline decline confirmation when Decline button is clicked', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'valid',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
        fullName: 'Alex Rivera',
      },
    });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText('Decline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Decline'));

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to decline\?/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. Received by mistake/i)).toBeInTheDocument();
      expect(screen.getByText('Confirm & Decline')).toBeInTheDocument();
      expect(screen.getByText('Keep Invitation')).toBeInTheDocument();
    });

    // Clicking "Keep Invitation" closes the confirmation
    fireEvent.click(screen.getByText('Keep Invitation'));

    await waitFor(() => {
      expect(screen.queryByText(/Are you sure you want to decline\?/i)).not.toBeInTheDocument();
      expect(screen.getByText('Accept Invitation')).toBeInTheDocument();
    });
  });

  it('submits decline with reason and updates state to declined', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'valid',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
      },
    });
    mockDeclineAction.mockResolvedValue({ success: true });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText('Decline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Decline'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Received by mistake/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Received by mistake/i), {
      target: { value: 'Wrong department' },
    });

    fireEvent.click(screen.getByText('Confirm & Decline'));

    await waitFor(() => {
      expect(mockDeclineAction).toHaveBeenCalledWith({
        token: 'valid-test-token',
        reason: 'Wrong department',
      });
      expect(screen.getByText('Invitation Declined')).toBeInTheDocument();
    });
  });

  it('submits acceptance and transitions to mobile sign in', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'valid',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
      },
    });
    mockAcceptAction.mockResolvedValue({ success: true });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText('Accept Invitation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Accept Invitation'));

    await waitFor(() => {
      expect(mockAcceptAction).toHaveBeenCalledWith({
        token: 'valid-test-token',
      });
      expect(screen.getByText(/Welcome to Acme Corporation!/i)).toBeInTheDocument();
      expect(screen.getByText('Continue to Sign In')).toBeInTheDocument();
    });
  });

  it('renders fast-path when onboarding is already completed', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'already_completed',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
      },
    });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText(/You're already set up!/i)).toBeInTheDocument();
      expect(screen.getByText(/Go to Dashboard Now/i)).toBeInTheDocument();
    });
  });

  it('renders expired state when invitation has expired', async () => {
    mockValidateAction.mockResolvedValue({
      success: true,
      state: 'expired',
      invitation: {
        invitationId: 'inv-123',
        organizationId: 'org-smartsapp',
        organizationName: 'Acme Corporation',
        departmentId: 'dept-sales',
        departmentName: 'Sales & Growth',
        email: 'alex.rivera@example.com',
      },
    });

    render(<AcceptInvitationClient />);

    await waitFor(() => {
      expect(screen.getByText(/This Invitation Has Expired/i)).toBeInTheDocument();
      expect(screen.getByText('Return to Login')).toBeInTheDocument();
    });
  });
});
