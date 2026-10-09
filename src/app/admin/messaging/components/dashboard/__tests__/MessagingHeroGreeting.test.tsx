import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MessagingHeroGreeting } from '../MessagingHeroGreeting';

// Mock auth hook
vi.mock('@/firebase', () => ({
  useUser: () => ({
    user: { displayName: 'Sarah Mensah', email: 'sarah@example.com' },
    isUserLoading: false,
  }),
}));

// Mock terminology hook
vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'School',
    plural: 'Schools',
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('MessagingHeroGreeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders time-of-day greeting with extracted first name', () => {
    render(<MessagingHeroGreeting />);
    expect(screen.getByText(/Sarah 👋/i)).toBeInTheDocument();
  });

  it('renders dynamic subtitle using active terminology', () => {
    render(<MessagingHeroGreeting />);
    expect(
      screen.getByText(/Your AI-powered messaging hub for stronger school communities and better engagement\./i)
    ).toBeInTheDocument();
  });

  it('renders interactive AI prompt pill with tactile attributes', () => {
    render(<MessagingHeroGreeting />);
    const promptPill = screen.getByRole('button', { name: /Ask AI to draft/i });
    expect(promptPill).toBeInTheDocument();
    expect(promptPill).toHaveClass('active:scale-[0.98]');
  });

  it('opens AI prompt modal when the interactive prompt pill is clicked', () => {
    render(<MessagingHeroGreeting />);
    const promptPill = screen.getByRole('button', { name: /Ask AI to draft/i });
    fireEvent.click(promptPill);

    expect(screen.getByText('SmartSapp AI Assistant')).toBeInTheDocument();
  });

  it('allows overriding user display name via props for SSR or custom previews', () => {
    render(<MessagingHeroGreeting userDisplayName="Kwame Asante" />);
    expect(screen.getByText(/Kwame 👋/i)).toBeInTheDocument();
  });
});
