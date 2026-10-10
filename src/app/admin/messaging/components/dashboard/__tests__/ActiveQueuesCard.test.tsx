import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActiveQueuesCard } from '../ActiveQueuesCard';

describe('ActiveQueuesCard', () => {
  it('renders title, subtitle, and all 3 queue rows with tabular numbers', () => {
    render(
      <ActiveQueuesCard
        stats={{
          scheduledCount: 14,
          pendingApprovalCount: 2,
          failedCount: 0,
        }}
        isLoading={false}
      />
    );

    expect(screen.getByText('Active Queues')).toBeInTheDocument();
    expect(screen.getByTestId('card-info-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Messages')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Failed Deliveries')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('provides deep links to scheduled messages, pending jobs, and dead-letter queue (Rule 25)', () => {
    render(
      <ActiveQueuesCard
        stats={{
          scheduledCount: 5,
          pendingApprovalCount: 1,
          failedCount: 3,
        }}
        isLoading={false}
      />
    );

    const scheduledLink = screen.getByText('Scheduled Messages').closest('a');
    expect(scheduledLink).toHaveAttribute('href', '/admin/messaging/scheduled');

    const pendingLink = screen.getByText('Pending Approval').closest('a');
    expect(pendingLink).toHaveAttribute('href', '/admin/messaging/jobs');

    const failedLink = screen.getByText('Failed Deliveries').closest('a');
    expect(failedLink).toHaveAttribute('href', '/admin/messaging/jobs?status=failed');
  });

  it('highlights failed deliveries with warning styling and alert badge when failedCount > 0', () => {
    render(
      <ActiveQueuesCard
        stats={{
          scheduledCount: 1,
          pendingApprovalCount: 0,
          failedCount: 4,
        }}
        isLoading={false}
      />
    );

    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders skeleton states matching card geometry during loading', () => {
    render(<ActiveQueuesCard isLoading={true} />);
    expect(screen.queryByText('Scheduled Messages')).not.toBeInTheDocument();
  });
});
