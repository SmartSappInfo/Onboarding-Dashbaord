import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecentCampaignsCard } from '../RecentCampaignsCard';

describe('RecentCampaignsCard', () => {
  it('renders campaign rows and AI promo banner', () => {
    const handleOpenAi = vi.fn();
    render(
      <RecentCampaignsCard
        campaigns={[
          {
            id: 'c1',
            name: 'Mid-Term Fee Notice',
            status: 'active',
            recipientCount: 1250,
            sentAt: '2026-10-09T08:00:00Z',
            deliveryRate: 99.2,
            clickRate: 45.6,
          },
        ]}
        isLoading={false}
        onOpenAiModal={handleOpenAi}
      />
    );
    expect(screen.getByText(/Mid-Term Fee Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Let AI do the heavy lifting/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try AI Assistant/i }));
    expect(handleOpenAi).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<RecentCampaignsCard isLoading={true} />);
    expect(screen.queryByText(/Mid-Term Fee Notice/i)).not.toBeInTheDocument();
  });

  it('renders empty state when campaigns array is empty', () => {
    render(<RecentCampaignsCard campaigns={[]} isLoading={false} />);
    expect(screen.getByText(/No campaigns found in this workspace/i)).toBeInTheDocument();
  });
});
