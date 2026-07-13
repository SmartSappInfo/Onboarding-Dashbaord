import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { FloatingNotesProvider, useFloatingNotes } from '@/context/FloatingNotesContext';

// Simple Test component to inspect context values inside Provider
function ContextTestComponent() {
  const { isOpen, isMinimized, draftText, activeEntityId, open, close, minimize, restore, setDraftText } = useFloatingNotes();
  return (
    <div>
      <div data-testid="isOpen">{isOpen ? 'true' : 'false'}</div>
      <div data-testid="isMinimized">{isMinimized ? 'true' : 'false'}</div>
      <div data-testid="draftText">{draftText}</div>
      <div data-testid="activeEntityId">{activeEntityId || 'null'}</div>
      <button onClick={() => open('entity-xyz')} data-testid="btn-open">Open</button>
      <button onClick={close} data-testid="btn-close">Close</button>
      <button onClick={minimize} data-testid="btn-minimize">Minimize</button>
      <button onClick={restore} data-testid="btn-restore">Restore</button>
      <button onClick={() => setDraftText('new draft contents')} data-testid="btn-set-draft">Set Draft</button>
    </div>
  );
}

describe('FloatingNotesContext Provider & Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should render children and expose initial context states', () => {
    render(
      <FloatingNotesProvider>
        <ContextTestComponent />
      </FloatingNotesProvider>
    );

    expect(screen.getByTestId('isOpen').textContent).toBe('false');
    expect(screen.getByTestId('isMinimized').textContent).toBe('false');
    expect(screen.getByTestId('draftText').textContent).toBe('');
    expect(screen.getByTestId('activeEntityId').textContent).toBe('null');
  });

  it('should toggle open, close, minimize, and restore states', () => {
    render(
      <FloatingNotesProvider>
        <ContextTestComponent />
      </FloatingNotesProvider>
    );

    // Open panel with specific entity pre-selection
    fireEvent.click(screen.getByTestId('btn-open'));
    expect(screen.getByTestId('isOpen').textContent).toBe('true');
    expect(screen.getByTestId('activeEntityId').textContent).toBe('entity-xyz');

    // Minimize panel
    fireEvent.click(screen.getByTestId('btn-minimize'));
    expect(screen.getByTestId('isMinimized').textContent).toBe('true');

    // Restore panel
    fireEvent.click(screen.getByTestId('btn-restore'));
    expect(screen.getByTestId('isMinimized').textContent).toBe('false');

    // Close panel
    fireEvent.click(screen.getByTestId('btn-close'));
    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('should auto-save draft contents to LocalStorage and scope keys by tenant', () => {
    render(
      <FloatingNotesProvider>
        <ContextTestComponent />
      </FloatingNotesProvider>
    );

    // Set draft content
    fireEvent.click(screen.getByTestId('btn-set-draft'));
    expect(screen.getByTestId('draftText').textContent).toBe('new draft contents');

    // Check localStorage contains the key
    const keys = Object.keys(localStorage);
    const draftKey = keys.find(k => k.startsWith('smartsapp_floating_note_draft_'));
    expect(draftKey).toBeDefined();
    expect(localStorage.getItem(draftKey!)).toBe('new draft contents');
  });
});
