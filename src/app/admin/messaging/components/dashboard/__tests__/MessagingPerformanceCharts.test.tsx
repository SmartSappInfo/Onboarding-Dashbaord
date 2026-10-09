import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingPerformanceCharts } from '../MessagingPerformanceCharts';

describe('MessagingPerformanceCharts', () => {
  it('renders delivery rate percentage and channel breakdown items', () => {
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
        isLoading={false}
      />
    );
    expect(screen.getByText(/99.7%/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS/i)).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Performance/i)).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<MessagingPerformanceCharts isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
