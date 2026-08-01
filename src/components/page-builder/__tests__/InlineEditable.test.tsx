import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { InlineEditable } from '../InlineEditable';

describe('InlineEditable Component', () => {
  it('renders initial value', () => {
    const { getByText } = render(
      <InlineEditable value="Hello World" isEdit={true} onChange={() => {}} />
    );
    expect(getByText('Hello World')).toBeInTheDocument();
  });

  it('renders normal element in view mode', () => {
    const { getByText, container } = render(
      <InlineEditable value="Hello World" isEdit={false} tagName="h1" />
    );
    const element = getByText('Hello World');
    expect(element.tagName).toBe('H1');
    expect(element.getAttribute('contenteditable')).toBeNull();
  });

  it('renders contenteditable in edit mode', () => {
    const { getByText } = render(
      <InlineEditable value="Hello World" isEdit={true} tagName="h1" />
    );
    const element = getByText('Hello World');
    expect(element.tagName).toBe('H1');
    expect(element.getAttribute('contenteditable')).toBe('true');
  });

  it('calls onChange with new text on blur', () => {
    const handleChange = vi.fn();
    const { getByText } = render(
      <InlineEditable value="Hello" isEdit={true} onChange={handleChange} />
    );
    const element = getByText('Hello');
    element.focus();
    element.textContent = 'Hello Modified';
    fireEvent.blur(element);

    expect(handleChange).toHaveBeenCalledWith('Hello Modified');
  });

  it('does not overwrite user input when focused and parent state/props update', () => {
    const TestWrapper = () => {
      const [val, setVal] = useState('Initial');
      const [dummy, setDummy] = useState(0);

      return (
        <div>
          <button data-testid="trigger" onClick={() => setDummy(d => d + 1)}>Trigger Re-render</button>
          <InlineEditable
            data-testid="editable"
            value={val}
            onChange={setVal}
            isEdit={true}
          />
        </div>
      );
    };

    const { getByTestId } = render(<TestWrapper />);
    const editable = getByTestId('editable');

    // Simulate focusing and typing
    act(() => {
      editable.focus();
      editable.textContent = 'User Typing...';
      fireEvent.input(editable);
    });

    // Trigger a parent re-render (which passes the old 'Initial' state as value, because onChange wasn't called yet)
    const trigger = getByTestId('trigger');
    fireEvent.click(trigger);

    // Verify the typed content is NOT overwritten/reverted
    expect(editable.textContent).toBe('User Typing...');

    // Blur to save
    act(() => {
      fireEvent.blur(editable);
    });

    // Now it should be updated
    expect(editable.textContent).toBe('User Typing...');
  });

  it('enforces dir="ltr" attribute on contenteditable element', () => {
    const { getByTestId } = render(
      <InlineEditable data-testid="ltr-editable" value="Left to right" isEdit={true} />
    );
    const element = getByTestId('ltr-editable');
    expect(element.getAttribute('dir')).toBe('ltr');
  });

  it('types sequential characters in Left-to-Right order ("Who") without caret reversal ("ohW")', () => {
    const TypingWrapper = () => {
      const [val, setVal] = useState('');
      return (
        <InlineEditable
          data-testid="typing-target"
          value={val}
          onChange={setVal}
          isEdit={true}
        />
      );
    };

    const { getByTestId } = render(<TypingWrapper />);
    const target = getByTestId('typing-target');

    // Simulate user typing 'W'
    act(() => {
      target.focus();
      target.textContent = 'W';
      fireEvent.input(target);
    });

    // Simulate user appending 'h' -> 'Wh'
    act(() => {
      target.textContent = 'Wh';
      fireEvent.input(target);
    });

    // Simulate user appending 'o' -> 'Who'
    act(() => {
      target.textContent = 'Who';
      fireEvent.input(target);
    });

    // Verify text sequence assembled Left-to-Right
    expect(target.textContent).toBe('Who');
    expect(target.textContent).not.toBe('ohW');
  });
});
