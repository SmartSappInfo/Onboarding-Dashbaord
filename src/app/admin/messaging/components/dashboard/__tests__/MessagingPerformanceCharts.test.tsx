import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingPerformanceCharts } from '../MessagingPerformanceCharts';

describe('MessagingPerformanceCharts', () => {
  it('renders delivery SLA percentage, breakdown metrics, and handles time range toggle', () => {
    const handleTimeChange = vi.fn();
    render(
      <MessagingPerformanceCharts
        performance={{
          sentCount: 12482,
          deliveredCount: 12444,
          failedCount: 38,
          deliveryRatePercentage: 99.7,
          timeRangeLabel: 'Last 7 days',
        }}
        channelBreakdown={[
          { channel: 'sms', label: 'SMS', count: 6490, percentage: 52, color: '#3b82f6' },
          { channel: 'whatsapp', label: 'WhatsApp', count: 3495, percentage: 28, color: '#10b981' },
        ]}
        activeTimeRange="7d"
        onTimeRangeChange={handleTimeChange}
        isLoading={false}
      />
    );

    expect(screen.getByText(/99.7%/i)).toBeInTheDocument();
    expect(screen.getByText(/12,444 delivered/i)).toBeInTheDocument();
    expect(screen.getByText(/38 failed/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();

    const thirtyDayBtn = screen.getByRole('button', { name: /30d/i });
    fireEvent.click(thirtyDayBtn);
    expect(handleTimeChange).toHaveBeenCalledWith('30d');
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<MessagingPerformanceCharts isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText(/99.7%/i)).not.toBeInTheDocument();
  });
});
