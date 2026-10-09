import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActiveQueuesCard } from '../ActiveQueuesCard';

describe('ActiveQueuesCard', () => {
  it('renders scheduled, pending, and failed queue counts with tabular nums', () => {
    render(
      <ActiveQueuesCard
        stats={{ scheduledCount: 24, pendingApprovalCount: 3, failedCount: 2 }}
        isLoading={false}
      />
    );
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Scheduled Messages/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Approval/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed Deliveries/i)).toBeInTheDocument();
  });

  it('renders skeleton loading state when isLoading is true', () => {
    const { container } = render(<ActiveQueuesCard isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
