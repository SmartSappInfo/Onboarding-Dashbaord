import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskChecklistProgress } from '../primitives/TaskChecklistProgress';

describe('TaskChecklistProgress (Phase 3 - Roadmap §42, UI Spec §577-588)', () => {
  it('renders fractional progress badge with CheckSquare icon', () => {
    render(<TaskChecklistProgress completedCount={3} totalCount={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders complete styling when all items are done', () => {
    const { container } = render(<TaskChecklistProgress completedCount={5} totalCount={5} />);
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('text-emerald-700');
  });

  it('renders nothing when totalCount is 0', () => {
    const { container } = render(<TaskChecklistProgress completedCount={0} totalCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders subtle progress percentage in tooltip or aria-label', () => {
    render(<TaskChecklistProgress completedCount={2} totalCount={4} />);
    const badge = screen.getByLabelText(/checklist progress: 2 of 4 items completed \(50%\)/i);
    expect(badge).toBeInTheDocument();
  });
});
