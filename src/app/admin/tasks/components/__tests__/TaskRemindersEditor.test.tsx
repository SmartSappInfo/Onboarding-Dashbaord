import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRemindersEditor } from '../TaskRemindersEditor';
import type { TaskReminder } from '@/lib/types';

describe('TaskRemindersEditor (Roadmap §37-39, UI Spec §599-612)', () => {
  const sampleReminders: TaskReminder[] = [
    {
      id: 'rem-1',
      reminderTime: '2026-10-10T09:00:00.000Z',
      channels: ['notification', 'email'],
      sent: false,
      status: 'scheduled',
    },
    {
      id: 'rem-2',
      reminderTime: '2026-10-09T08:00:00.000Z',
      channels: ['sms'],
      sent: false,
      status: 'failed',
      error: 'Invalid recipient phone',
    },
  ];

  it('renders list of reminders with plain-English channels and statuses', () => {
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={vi.fn()} />);
    expect(screen.getAllByText(/scheduled/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('toggles add reminder inline creator without large modal', () => {
    render(<TaskRemindersEditor reminders={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no reminders scheduled/i)).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /add reminder/i });
    fireEvent.click(addBtn);
    expect(screen.getByText(/when/i)).toBeInTheDocument();
    expect(screen.getByText(/channels/i)).toBeInTheDocument();
  });

  it('adds reminder with preset offset and channels', () => {
    const onChange = vi.fn();
    render(<TaskRemindersEditor reminders={[]} onChange={onChange} taskDueDate="2026-10-15T10:00:00.000Z" />);
    fireEvent.click(screen.getByRole('button', { name: /add reminder/i }));

    // Select channel (Email)
    const emailCheckbox = screen.getByRole('checkbox', { name: /email/i });
    fireEvent.click(emailCheckbox);

    // Click confirm add
    fireEvent.click(screen.getByRole('button', { name: /save reminder/i }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        channels: expect.arrayContaining(['email']),
        status: 'scheduled',
      }),
    ]));
  });

  it('calls onRetryReminder when retry button on failed reminder is clicked', () => {
    const onRetry = vi.fn();
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={vi.fn()} onRetryReminder={onRetry} />);
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith('rem-2');
  });

  it('updates reminder to scheduled status when retry button is clicked without onRetryReminder', () => {
    const onChange = vi.fn();
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={onChange} />);
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'rem-2', status: 'scheduled', error: null }),
    ]));
  });

  it('deletes reminder when remove button is clicked', () => {
    const onChange = vi.fn();
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={onChange} />);
    const deleteBtns = screen.getAllByRole('button', { name: /remove reminder/i });
    fireEvent.click(deleteBtns[0]);
    expect(onChange).toHaveBeenCalledWith([sampleReminders[1]]);
  });

  it('enforces min-h-[44px] touch target on all interactive buttons', () => {
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={vi.fn()} />);
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn.className).toMatch(/min-h-\[44px\]/);
    const deleteBtns = screen.getAllByRole('button', { name: /remove reminder/i });
    expect(deleteBtns[0].className).toMatch(/min-h-\[44px\]/);
  });
});
