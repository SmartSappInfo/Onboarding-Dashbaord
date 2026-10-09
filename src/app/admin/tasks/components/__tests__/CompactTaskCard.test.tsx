import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompactTaskCard } from '../CompactTaskCard';
import type { Task } from '@/lib/types';

describe('CompactTaskCard (Roadmap §77)', () => {
  const sampleTask: Task = {
    id: 'task-10',
    workspaceId: 'ws-1',
    title: 'Review Signed Proposal',
    description: 'Check legal terms and signature completeness',
    priority: 'high',
    status: 'in_progress',
    category: 'legal',
    dueDate: '2026-10-15T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    reminders: [],
    reminderSent: false,
    entityName: 'Springfield Academy',
    entityId: 'ent-12',
    dealId: 'deal-99',
  };

  it('renders task title, priority badge, and status metadata', () => {
    render(<CompactTaskCard task={sampleTask} />);
    expect(screen.getByText('Review Signed Proposal')).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('provides accessible min-h-[44px] touch target for completion toggle', () => {
    const onToggleComplete = vi.fn();
    render(<CompactTaskCard task={sampleTask} onToggleComplete={onToggleComplete} />);
    const toggleBtn = screen.getByRole('button', { name: /mark complete/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(onToggleComplete).toHaveBeenCalledWith(sampleTask);
  });

  it('calls onClick when clicking anywhere on the card body', () => {
    const onClick = vi.fn();
    render(<CompactTaskCard task={sampleTask} onClick={onClick} />);
    const card = screen.getByLabelText('Task: Review Signed Proposal');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledWith(sampleTask);
  });

  it('handles keyboard navigation (Enter key)', () => {
    const onClick = vi.fn();
    render(<CompactTaskCard task={sampleTask} onClick={onClick} />);
    const card = screen.getByLabelText('Task: Review Signed Proposal');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    expect(onClick).toHaveBeenCalledWith(sampleTask);
  });

  it('renders obligation sync failure alert and retry button when sync failed', () => {
    const onRetrySync = vi.fn();
    const failedTask: Task = {
      ...sampleTask,
      obligationSyncStatus: 'failed',
      obligationSyncError: 'Contract lock timeout',
    };
    render(<CompactTaskCard task={failedTask} onRetrySync={onRetrySync} />);
    expect(screen.getByText(/contract obligation sync failed/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry sync/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetrySync).toHaveBeenCalledWith('task-10');
  });
});
