import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlashAutocomplete } from '../use-slash-autocomplete';
import type { TemplateVariable } from '@/lib/types';

import { calculateDropdownCoords } from '@/components/messaging/SlashInput';

// Mock getComputedStyle and Range.prototype.getBoundingClientRect for jsdom caret coordinates measurement
beforeEach(() => {
  window.getComputedStyle = vi.fn().mockImplementation(() => ({
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '20px',
  } as unknown as CSSStyleDeclaration));

  Range.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100,
    bottom: 124,
    left: 200,
    right: 210,
    width: 10,
    height: 24,
  } as DOMRect);
});

const mockVariables: TemplateVariable[] = [
  {
    id: 'first_name',
    name: 'first_name',
    label: 'First Name',
    description: 'Contact first name',
    dataType: 'string',
    context: 'common',
    exampleValue: 'John',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'meeting_time',
    name: 'meeting_time',
    label: 'Meeting Time',
    description: 'Upcoming meeting schedule',
    dataType: 'date',
    context: 'meeting',
    exampleValue: '2026-06-01',
    isDynamic: false,
    isComputed: false,
  },
  {
    id: 'survey_score',
    name: 'survey_score',
    label: 'Survey Score',
    description: 'Score from survey response',
    dataType: 'number',
    context: 'survey_123' as any,
    exampleValue: '90',
    isDynamic: true,
    isComputed: false,
  }
];

describe('useSlashAutocomplete Hook', () => {
  it('should initialize with autocomplete hidden', () => {
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '',
        onChange: vi.fn(),
      })
    );

    expect(result.current.showAutocomplete).toBe(false);
    expect(result.current.filteredVars).toEqual(mockVariables);
  });

  it('should trigger autocomplete when / is typed at start of textarea', () => {
    const onChangeMock = vi.fn();
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '/',
        onChange: onChangeMock,
      })
    );

    // Create a mock textarea element
    const textarea = document.createElement('textarea');
    textarea.value = '/';
    textarea.selectionEnd = 1;

    act(() => {
      result.current.handleInputChange({ target: textarea } as any);
    });

    expect(result.current.showAutocomplete).toBe(true);
    expect(result.current.filteredVars).toEqual(mockVariables);
  });

  it('should close autocomplete when space is typed after /', () => {
    const onChangeMock = vi.fn();
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '/ ',
        onChange: onChangeMock,
      })
    );

    const textarea = document.createElement('textarea');
    textarea.value = '/ ';
    textarea.selectionEnd = 2;

    // First trigger it
    act(() => {
      textarea.value = '/';
      textarea.selectionEnd = 1;
      result.current.handleInputChange({ target: textarea } as any);
    });
    expect(result.current.showAutocomplete).toBe(true);

    // Type space
    act(() => {
      textarea.value = '/ ';
      textarea.selectionEnd = 2;
      result.current.handleInputChange({ target: textarea } as any);
    });
    expect(result.current.showAutocomplete).toBe(false);
  });

  it('should filter variables based on typed text after /', () => {
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '/meet',
        onChange: vi.fn(),
      })
    );

    const textarea = document.createElement('textarea');
    textarea.value = '/meet';
    textarea.selectionEnd = 5;

    act(() => {
      result.current.handleInputChange({ target: textarea } as any);
    });

    expect(result.current.showAutocomplete).toBe(true);
    expect(result.current.filteredVars).toHaveLength(1);
    expect(result.current.filteredVars[0].name).toBe('meeting_time');
  });

  it('should navigate matching variables using ArrowDown and ArrowUp keys', () => {
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '/',
        onChange: vi.fn(),
      })
    );

    const textarea = document.createElement('textarea');
    textarea.value = '/';
    textarea.selectionEnd = 1;

    act(() => {
      result.current.handleInputChange({ target: textarea } as any);
    });

    expect(result.current.autocompleteIndex).toBe(0);

    // Move Down
    act(() => {
      const e = { key: 'ArrowDown', preventDefault: vi.fn() } as any;
      result.current.handleKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });
    expect(result.current.autocompleteIndex).toBe(1);

    // Move Down again
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
    });
    expect(result.current.autocompleteIndex).toBe(2);

    // Wrap around to start
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as any);
    });
    expect(result.current.autocompleteIndex).toBe(0);

    // Move Up wraps to end
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as any);
    });
    expect(result.current.autocompleteIndex).toBe(2);
  });

  it('should insert token and close menu when Enter is pressed', () => {
    const onChangeMock = vi.fn();
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: 'Hello /',
        onChange: onChangeMock,
      })
    );

    const textarea = document.createElement('textarea');
    textarea.value = 'Hello /';
    textarea.selectionEnd = 7;

    act(() => {
      result.current.handleInputChange({ target: textarea } as any);
    });

    // Press Enter to select index 0 ('first_name')
    act(() => {
      const e = { key: 'Enter', preventDefault: vi.fn(), currentTarget: textarea } as any;
      result.current.handleKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    expect(onChangeMock).toHaveBeenCalledWith('Hello {{first_name}}');
    expect(result.current.showAutocomplete).toBe(false);
  });

  it('should close autocomplete menu when Escape is pressed', () => {
    const { result } = renderHook(() =>
      useSlashAutocomplete({
        variables: mockVariables,
        value: '/',
        onChange: vi.fn(),
      })
    );

    const textarea = document.createElement('textarea');
    textarea.value = '/';
    textarea.selectionEnd = 1;

    act(() => {
      result.current.handleInputChange({ target: textarea } as any);
    });
    expect(result.current.showAutocomplete).toBe(true);

    act(() => {
      const e = { key: 'Escape', preventDefault: vi.fn() } as any;
      result.current.handleKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    expect(result.current.showAutocomplete).toBe(false);
  });

  describe('Caret-Anchored Slash Command Autocomplete Positioning', () => {
    it('should position dropdown immediately below the slash caret line', () => {
      const mockCaretRect = {
        top: 120,
        bottom: 144,
        left: 280,
        right: 290,
        width: 10,
        height: 24,
      } as DOMRect;

      const coords = calculateDropdownCoords(mockCaretRect, null);
      // Immediately below row: caretRect.bottom + scrollY + 4 = 144 + 0 + 4 = 148
      expect(coords.top).toBe(148);
      // Aligned with slash character: caretRect.left = 280
      expect(coords.left).toBe(280);
      expect(coords.width).toBeGreaterThanOrEqual(280);
      expect(coords.width).toBeLessThanOrEqual(360);
    });

    it('should flip dropdown cleanly above the row when near the bottom of viewport', () => {
      // caretRect positioned at bottom of 768px viewport
      const mockCaretRect = {
        top: 680,
        bottom: 704,
        left: 280,
        right: 290,
        width: 10,
        height: 24,
      } as DOMRect;

      const coords = calculateDropdownCoords(mockCaretRect, null);
      // Flips above row: caretRect.top + scrollY - 260 - 4 = 680 - 264 = 416
      expect(coords.top).toBe(416);
      expect(coords.left).toBe(280);
    });

    it('should clamp dropdown horizontally so it never overflows viewport right edge', () => {
      const mockCaretRect = {
        top: 100,
        bottom: 124,
        left: 980,
        right: 990,
        width: 10,
        height: 24,
      } as DOMRect;

      const coords = calculateDropdownCoords(mockCaretRect, null);
      // Screen width is default 1024. Right margin is 16px.
      // Maximum allowed left is 1024 - width - 16
      expect(coords.left + coords.width).toBeLessThanOrEqual(1024 - 16);
    });

    it('should clamp dropdown horizontally so it never overflows viewport left edge', () => {
      const mockCaretRect = {
        top: 100,
        bottom: 124,
        left: 4,
        right: 14,
        width: 10,
        height: 24,
      } as DOMRect;

      const coords = calculateDropdownCoords(mockCaretRect, null);
      // Minimum left is 16px margin
      expect(coords.left).toBeGreaterThanOrEqual(16);
    });

    it('should fall back safely to container bounds if caretRect cannot be measured', () => {
      const containerDiv = document.createElement('div');
      containerDiv.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 200,
        bottom: 250,
        left: 100,
        right: 500,
        width: 400,
        height: 50,
      } as DOMRect);

      const coords = calculateDropdownCoords(null, containerDiv);
      expect(coords.top).toBe(254);
      expect(coords.left).toBe(100);
    });

    it('should measure caret in contentEditable div via getSlashCaretRect', () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        useSlashAutocomplete({
          variables: mockVariables,
          value: '',
          onChange: onChangeMock,
        })
      );

      const editor = document.createElement('div');
      editor.contentEditable = 'true';
      const textNode = document.createTextNode('Hello /');
      editor.appendChild(textNode);
      document.body.appendChild(editor);

      // Create a Selection
      const range = document.createRange();
      range.setStart(textNode, 7);
      range.setEnd(textNode, 7);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      act(() => {
        result.current.handleInputChange({ target: editor } as unknown as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.showAutocomplete).toBe(true);

      const caretRect = result.current.getSlashCaretRect(editor);
      // JSDOM ranges return DOMRect objects
      expect(caretRect).toBeDefined();

      document.body.removeChild(editor);
    });
  });
});
