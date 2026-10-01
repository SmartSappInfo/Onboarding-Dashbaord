import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { AiMarkdownRenderer } from '../AiMarkdownRenderer';

describe('AiMarkdownRenderer Component', () => {
  it('renders plain text and user messages cleanly', () => {
    render(<AiMarkdownRenderer content="Hello from user" isUser={true} />);
    expect(screen.getByText('Hello from user')).toBeDefined();
  });

  it('renders markdown headings, bold text, and bulleted lists', () => {
    const markdown = `
### 🚀 Result Page Update
I have updated your post-submission experience.

**Changes Applied:**
- Replaced the generic Thank You page with structured content
- Converted areas and goals into Title Case headings
- Extracted all bulleted points into dedicated list blocks
    `;

    render(<AiMarkdownRenderer content={markdown} isUser={false} />);

    expect(screen.getByText(/Result Page Update/)).toBeDefined();
    expect(screen.getByText(/Changes Applied:/)).toBeDefined();
    expect(screen.getByText(/Replaced the generic Thank You page with structured content/)).toBeDefined();
    expect(screen.getByText(/Converted areas and goals into Title Case headings/)).toBeDefined();
  });

  it('renders numbered lists with numerical badge counters', () => {
    const markdown = `
1. Make the process easier
2. Make the next step clear
3. Provide help where stuck
    `;

    render(<AiMarkdownRenderer content={markdown} isUser={false} />);

    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('Make the process easier')).toBeDefined();
    expect(screen.getByText('Make the next step clear')).toBeDefined();
  });

  it('renders interactive canvas action buttons and triggers callbacks', () => {
    const handleApply = vi.fn();
    const handleUndo = vi.fn();

    const { rerender } = render(
      <AiMarkdownRenderer
        content="I have generated the new blocks for your canvas."
        isUser={false}
        interactiveAction={{
          type: 'replace_or_append_canvas',
          title: 'Update Canvas Options',
          message: 'Would you like to replace the existing canvas or append below?',
          targetArea: 'result_page_blocks',
        }}
        onApplyAction={handleApply}
        onUndoAction={handleUndo}
      />
    );

    expect(screen.getByText('Update Canvas Options')).toBeDefined();
    const replaceBtn = screen.getByRole('button', { name: /Replace Canvas/i });
    const appendBtn = screen.getByRole('button', { name: /Append Below/i });

    expect(replaceBtn).toBeDefined();
    expect(appendBtn).toBeDefined();

    fireEvent.click(replaceBtn);
    expect(handleApply).toHaveBeenCalledWith('replace');

    fireEvent.click(appendBtn);
    expect(handleApply).toHaveBeenCalledWith('append');

    // Rerender with applied status
    rerender(
      <AiMarkdownRenderer
        content="I have generated the new blocks for your canvas."
        isUser={false}
        interactiveAction={{
          type: 'replace_or_append_canvas',
          title: 'Update Canvas Options',
          targetArea: 'full_survey',
        }}
        appliedActionStatus="replaced"
        canUndo={true}
        onApplyAction={handleApply}
        onUndoAction={handleUndo}
      />
    );

    expect(screen.getByText('Canvas Replaced')).toBeDefined();
    const undoBtn = screen.getByRole('button', { name: /Undo/i });
    fireEvent.click(undoBtn);
    expect(handleUndo).toHaveBeenCalled();
  });
});
