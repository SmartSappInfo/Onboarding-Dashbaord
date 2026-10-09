import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileBottomNav } from '../MobileBottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
}));

describe('MobileBottomNav', () => {
  it('renders all 5 navigation items with touch targets', () => {
    const handleMore = vi.fn();
    render(<MobileBottomNav onOpenMore={handleMore} />);
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Messages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Campaigns/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Templates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(handleMore).toHaveBeenCalledTimes(1);
  });
});
