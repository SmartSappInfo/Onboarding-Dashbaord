import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickMessageComposerCard } from '../QuickMessageComposerCard';

describe('QuickMessageComposerCard', () => {
  it('renders input, channel selector, and character counter', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Enter recipient phone or email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 160/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeInTheDocument();
  });

  it('enforces Rule 19 single-target guard and blocks multiple recipients', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    const recipientInput = screen.getByPlaceholderText(/Enter recipient phone or email/i);
    fireEvent.change(recipientInput, { target: { value: '0244123456, 0201112222' } });
    expect(screen.getByText(/Quick compose supports 1-to-1 messages only/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeDisabled();
  });

  it('updates segment counter as character count increases', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(textarea, { target: { value: 'A'.repeat(165) } });
    expect(screen.getByText(/165 \/ 160/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Segments/i)).toBeInTheDocument();
  });

  it('switches channels when channel pills are clicked', () => {
    render(<QuickMessageComposerCard onMessageSent={vi.fn()} />);
    const waBtn = screen.getByRole('button', { name: 'WHATSAPP' });
    fireEvent.click(waBtn);
    expect(waBtn).toHaveClass('bg-primary');
  });
});
