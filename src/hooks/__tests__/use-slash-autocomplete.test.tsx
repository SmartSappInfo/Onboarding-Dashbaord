import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlashAutocomplete } from '../use-slash-autocomplete';
import type { TemplateVariable } from '@/lib/types';

// Mock getComputedStyle for jsdom caret coordinates measurement
beforeEach(() => {
  window.getComputedStyle = vi.fn().mockImplementation(() => ({
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '20px',
  } as any));
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
});
