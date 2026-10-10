import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KanbanTerminalDropBar } from '../KanbanTerminalDropBar';

// Mock dnd-kit useDroppable
vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(({ id }: { id: string }) => ({
    setNodeRef: vi.fn(),
    isOver: id === 'won-drop-zone' ? false : false,
  })),
}));

describe('KanbanTerminalDropBar Component', () => {
  it('renders both Won and Lost terminal drop zones', () => {
    render(<KanbanTerminalDropBar isVisible={true} draggedDealName="Acme Enterprise Deal" />);

    expect(screen.getByTestId('won-drop-zone')).toBeDefined();
    expect(screen.getByTestId('lost-drop-zone')).toBeDefined();
    expect(screen.getByText('Drop to Won')).toBeDefined();
    expect(screen.getByText('Drop to Lost')).toBeDefined();
  });

  it('hides the bar when isVisible is false', () => {
    const { container } = render(<KanbanTerminalDropBar isVisible={false} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(bar.className).toContain('opacity-0');
    expect(bar.className).toContain('pointer-events-none');
  });

  it('shows the bar when isVisible is true', () => {
    const { container } = render(<KanbanTerminalDropBar isVisible={true} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.getAttribute('aria-hidden')).toBe('false');
    expect(bar.className).toContain('opacity-100');
    expect(bar.className).toContain('pointer-events-auto');
  });
});
