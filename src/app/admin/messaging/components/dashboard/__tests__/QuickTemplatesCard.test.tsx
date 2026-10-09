import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickTemplatesCard } from '../QuickTemplatesCard';

describe('QuickTemplatesCard', () => {
  it('renders 4 starter templates and handles selection', () => {
    const handleSelect = vi.fn();
    render(<QuickTemplatesCard onSelectTemplate={handleSelect} />);
    expect(screen.getByText(/Quick Templates/i)).toBeInTheDocument();
    expect(screen.getByText(/Welcome Message/i)).toBeInTheDocument();
    expect(screen.getByText(/Fee Reminder/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Welcome Message/i));
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Welcome Message' }));
  });
});
