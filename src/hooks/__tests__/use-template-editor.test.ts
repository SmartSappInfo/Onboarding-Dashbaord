import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTemplateEditor, parseTemplateText } from '../use-template-editor';

describe('useTemplateEditor', () => {
  it('initializes with empty value by default', () => {
    const { result } = renderHook(() => useTemplateEditor());
    expect(result.current.value).toBe('');
  });

  it('initializes with provided initial value', () => {
    const { result } = renderHook(() => useTemplateEditor('Hello {{name}}'));
    expect(result.current.value).toBe('Hello {{name}}');
  });

  it('updates value when setValue is called', () => {
    const { result } = renderHook(() => useTemplateEditor());

    act(() => {
      result.current.setValue('New value');
    });

    expect(result.current.value).toBe('New value');
  });

  it('extracts variables from template text', () => {
    const { result } = renderHook(() =>
      useTemplateEditor('Hello {{name}}, your meeting is at {{meeting_time}}')
    );

    expect(result.current.variables).toEqual(['name', 'meeting_time']);
  });

  it('returns empty array when no variables present', () => {
    const { result } = renderHook(() => useTemplateEditor('Hello world'));

    expect(result.current.variables).toEqual([]);
  });

  it('handles multiple occurrences of the same variable', () => {
    const { result } = renderHook(() =>
      useTemplateEditor('{{name}} and {{name}} are invited to {{meeting_title}}')
    );

    expect(result.current.variables).toEqual(['name', 'name', 'meeting_title']);
  });

  it('updates variables when value changes', () => {
    const { result } = renderHook(() => useTemplateEditor('Hello {{name}}'));

    expect(result.current.variables).toEqual(['name']);

    act(() => {
      result.current.setValue('Hello {{name}}, meeting at {{time}}');
    });

    expect(result.current.variables).toEqual(['name', 'time']);
  });
});

describe('parseTemplateText', () => {
  it('parses text with no variables', () => {
    const segments = parseTemplateText('Hello world');

    expect(segments).toEqual([
      {
        text: 'Hello world',
        isVariable: false,
      },
    ]);
  });

  it('parses text with single variable', () => {
    const segments = parseTemplateText('Hello {{name}}');

    expect(segments).toEqual([
      {
        text: 'Hello ',
        isVariable: false,
      },
      {
        text: '{{name}}',
        isVariable: true,
        variableName: 'name',
      },
    ]);
  });

  it('parses text with multiple variables', () => {
    const segments = parseTemplateText('Hello {{name}}, your meeting is at {{time}}');

    expect(segments).toEqual([
      {
        text: 'Hello ',
        isVariable: false,
      },
      {
        text: '{{name}}',
        isVariable: true,
        variableName: 'name',
      },
      {
        text: ', your meeting is at ',
        isVariable: false,
      },
      {
        text: '{{time}}',
        isVariable: true,
        variableName: 'time',
      },
    ]);
  });

  it('parses text starting with variable', () => {
    const segments = parseTemplateText('{{name}} is invited');

    expect(segments).toEqual([
      {
        text: '{{name}}',
        isVariable: true,
        variableName: 'name',
      },
      {
        text: ' is invited',
        isVariable: false,
      },
    ]);
  });

  it('parses text ending with variable', () => {
    const segments = parseTemplateText('Hello {{name}}');

    expect(segments).toEqual([
      {
        text: 'Hello ',
        isVariable: false,
      },
      {
        text: '{{name}}',
        isVariable: true,
        variableName: 'name',
      },
    ]);
  });

  it('parses text with only variables', () => {
    const segments = parseTemplateText('{{name}}{{time}}');

    expect(segments).toEqual([
      {
        text: '{{name}}',
        isVariable: true,
        variableName: 'name',
      },
      {
        text: '{{time}}',
        isVariable: true,
        variableName: 'time',
      },
    ]);
  });

  it('handles variables with underscores and dots', () => {
    const segments = parseTemplateText('{{contact_name}} and {{form_fields.student_name}}');

    expect(segments).toEqual([
      {
        text: '{{contact_name}}',
        isVariable: true,
        variableName: 'contact_name',
      },
      {
        text: ' and ',
        isVariable: false,
      },
      {
        text: '{{form_fields.student_name}}',
        isVariable: true,
        variableName: 'form_fields.student_name',
      },
    ]);
  });

  it('handles empty string', () => {
    const segments = parseTemplateText('');

    expect(segments).toEqual([]);
  });

  it('handles malformed variables (unclosed braces)', () => {
    const segments = parseTemplateText('Hello {{name');

    expect(segments).toEqual([
      {
        text: 'Hello {{name',
        isVariable: false,
      },
    ]);
  });

  it('handles nested braces correctly', () => {
    const segments = parseTemplateText('{{outer}}');

    expect(segments).toEqual([
      {
        text: '{{outer}}',
        isVariable: true,
        variableName: 'outer',
      },
    ]);
  });
});
