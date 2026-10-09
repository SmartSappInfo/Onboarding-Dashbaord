import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskChecklist } from '../TaskChecklist';
import type { TaskChecklistItem } from '@/lib/types';

describe('TaskChecklist (Roadmap §42, UI Spec §577-588)', () => {
  const sampleItems: TaskChecklistItem[] = [
    { id: '1', title: 'Confirm requirements', completed: true, completedAt: '2026-10-09T00:00:00.000Z' },
    { id: '2', title: 'Send proposal', completed: false },
  ];

  it('renders progress text and checklist items', () => {
    render(<TaskChecklist items={sampleItems} onChange={vi.fn()} />);
    expect(screen.getByText('1 of 2 complete')).toBeInTheDocument();
    expect(screen.getByText('Confirm requirements')).toBeInTheDocument();
    expect(screen.getByText('Send proposal')).toBeInTheDocument();
  });

  it('toggles item completion when checkbox is clicked', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} currentUserId="user-456" />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        id: '2',
        completed: true,
        completedBy: 'user-456',
      }),
    ]));
  });

  it('adds a new item via inline input with min-h-[44px] touch target', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add checklist item/i);
    expect(input.className).toMatch(/min-h-\[44px\]/);
    fireEvent.change(input, { target: { value: 'Schedule kickoff meeting' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ title: 'Schedule kickoff meeting', completed: false }),
    ]));
  });

  it('deletes an item when remove button is clicked', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} />);
    const deleteBtns = screen.getAllByRole('button', { name: /remove item/i });
    fireEvent.click(deleteBtns[0]);
    expect(onChange).toHaveBeenCalledWith([sampleItems[1]]);
  });

  it('enforces min-h-[44px] touch targets on delete and add buttons', () => {
    render(<TaskChecklist items={sampleItems} onChange={vi.fn()} />);
    const deleteBtns = screen.getAllByRole('button', { name: /remove item/i });
    expect(deleteBtns[0].className).toMatch(/min-h-\[44px\]/);
    const addBtn = screen.getByRole('button', { name: /add item/i });
    expect(addBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
