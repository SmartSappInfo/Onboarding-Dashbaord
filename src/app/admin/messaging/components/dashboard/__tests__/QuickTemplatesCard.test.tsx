import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickTemplatesCard } from '../QuickTemplatesCard';

describe('QuickTemplatesCard', () => {
  it('renders title, info tooltip, and all starter templates', () => {
    render(<QuickTemplatesCard />);
    expect(screen.getByText('Quick Templates')).toBeInTheDocument();
    expect(screen.getByTestId('card-info-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    expect(screen.getByText('Fee Reminder')).toBeInTheDocument();
    expect(screen.getByText('Event Invite')).toBeInTheDocument();
    expect(screen.getByText('General Announcement')).toBeInTheDocument();
  });

  it('renders "All templates →" link routing to /admin/messaging/templates', () => {
    render(<QuickTemplatesCard />);
    const link = screen.getByRole('link', { name: /All templates/i });
    expect(link).toHaveAttribute('href', '/admin/messaging/templates');
  });

  it('invokes onSelectTemplate with complete template item including channel and subject', () => {
    const handleSelect = vi.fn();
    render(<QuickTemplatesCard onSelectTemplate={handleSelect} />);

    const feeReminderBtn = screen.getByText('Fee Reminder').closest('button');
    expect(feeReminderBtn).toBeInTheDocument();
    fireEvent.click(feeReminderBtn!);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tpl_fee',
        name: 'Fee Reminder',
        category: 'Finance',
        defaultChannel: 'sms',
      })
    );

    // Click Event Invite (Email channel)
    const eventInviteBtn = screen.getByText('Event Invite').closest('button');
    fireEvent.click(eventInviteBtn!);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tpl_event',
        name: 'Event Invite',
        category: 'Events',
        defaultChannel: 'email',
        subject: expect.stringContaining('School Open Day'),
      })
    );
  });

  it('filters displayed templates when allowedTemplateIds is provided', () => {
    render(<QuickTemplatesCard allowedTemplateIds={['tpl_welcome', 'tpl_fee']} />);

    expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    expect(screen.getByText('Fee Reminder')).toBeInTheDocument();
    expect(screen.queryByText('Event Invite')).not.toBeInTheDocument();
    expect(screen.queryByText('General Announcement')).not.toBeInTheDocument();
  });
});
