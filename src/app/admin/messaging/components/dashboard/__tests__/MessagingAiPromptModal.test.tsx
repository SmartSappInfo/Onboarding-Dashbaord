import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MessagingAiPromptModal } from '../MessagingAiPromptModal';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('MessagingAiPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with demarcated header, title, and tooltip when open', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
        entityTermSingular="School"
        entityTermPlural="Schools"
      />
    );

    expect(screen.getByText('SmartSapp AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What would you like to draft or analyze/i)).toBeInTheDocument();
    expect(screen.getByTestId('card-info-tooltip')).toBeInTheDocument();
  });

  it('populates prompt textarea when a curated starter pill is clicked', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
        entityTermSingular="School"
        entityTermPlural="Parents"
      />
    );

    const feeReminderButton = screen.getByText(/Draft a fee reminder message for Parents/i);
    fireEvent.click(feeReminderButton);

    const textarea = screen.getByPlaceholderText(/What would you like to draft or analyze/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Draft a fee reminder message for Parents');
  });

  it('toggles tone selection pills', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
      />
    );

    const formalButton = screen.getByRole('button', { name: /Formal/i });
    fireEvent.click(formalButton);
    expect(formalButton).toHaveAttribute('data-selected', 'true');

    const friendlyButton = screen.getByRole('button', { name: /Friendly/i });
    fireEvent.click(friendlyButton);
    expect(friendlyButton).toHaveAttribute('data-selected', 'true');
    expect(formalButton).toHaveAttribute('data-selected', 'false');
  });

  it('routes to composer with sanitized encoded prompt on primary CTA click', () => {
    const handleOpenChange = vi.fn();
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={handleOpenChange}
      />
    );

    const textarea = screen.getByPlaceholderText(/What would you like to draft or analyze/i);
    fireEvent.change(textarea, { target: { value: 'Announce science fair next Friday' } });

    const submitBtn = screen.getByRole('button', { name: /Open in Message Composer/i });
    fireEvent.click(submitBtn);

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/admin/messaging/composer?prompt=')
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('Announce science fair next Friday'))
    );
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('enforces 500-character maximum length bound on prompt input', () => {
    render(
      <MessagingAiPromptModal
        isOpen={true}
        onOpenChange={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/What would you like to draft or analyze/i) as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute('maxLength', '500');

    expect(screen.getByText('0/500 characters')).toBeInTheDocument();

    const longText = 'A'.repeat(600);
    fireEvent.change(textarea, { target: { value: longText } });

    expect(textarea.value.length).toBe(500);
    expect(screen.getByText('500/500 characters')).toBeInTheDocument();
  });
});
