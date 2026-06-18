import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScriptBodyDisplay } from '../ScriptBodyDisplay';

describe('ScriptBodyDisplay', () => {
  it('preserves author formatting (bold, colour, lists)', () => {
    const { container } = render(
      <ScriptBodyDisplay text='<b>Hi</b> <span style="color: rgb(220, 38, 38)">red</span><ul><li>one</li></ul>' />,
    );
    expect(container.querySelector('b')).not.toBeNull();
    expect(container.querySelector('li')?.textContent).toBe('one');
    const span = container.querySelector('span') as HTMLElement | null;
    expect(span?.style.color).toBeTruthy();
  });

  it('strips dangerous markup but keeps the safe formatting around it', () => {
    const { container } = render(
      <ScriptBodyDisplay text='<b>hi</b><img src=x onerror="alert(1)">' />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')?.textContent).toBe('hi');
  });

  it('removes event-handler attributes and javascript: links', () => {
    const { container } = render(
      <ScriptBodyDisplay text='<b onclick="evil()">hi</b><p><a href="javascript:alert(1)">x</a></p>' />,
    );
    expect(container.querySelector('b')?.getAttribute('onclick')).toBeNull();
    const href = container.querySelector('a')?.getAttribute('href');
    expect(!href || !href.toLowerCase().includes('javascript:')).toBe(true);
  });

  it('sanitizes markup injected through resolved variable values', () => {
    const { container } = render(
      <ScriptBodyDisplay
        text="<b>{{NAME}}</b>"
        resolveText={(t) => t.replace('{{NAME}}', '<img src=x onerror="alert(1)">')}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('substitutes variables via resolveText without rendering pills', () => {
    const { container } = render(
      <ScriptBodyDisplay text="Hello {{ENTITY_NAME}}" resolveText={(t) => t.replace('{{ENTITY_NAME}}', 'Ada')} />,
    );
    expect(container.textContent).toContain('Hello Ada');
    expect(container.querySelector('span')).toBeNull();
  });

  it('renders variable pills when highlightVariables is set and no resolver is given', () => {
    const { container } = render(
      <ScriptBodyDisplay text="Hello {{ENTITY_NAME}}" highlightVariables />,
    );
    const pill = container.querySelector('span');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('ENTITY_NAME');
  });

  it('applies a zoom transform to the body wrapper', () => {
    render(<ScriptBodyDisplay text="hello" zoom={1.5} />);
    const body = screen.getByTestId('script-body');
    expect(body.style.transform).toContain('scale(1.5)');
  });

  it('renders the empty fallback when there is no text', () => {
    render(<ScriptBodyDisplay text="" emptyFallback={<span>nothing here</span>} />);
    expect(screen.getByText('nothing here')).toBeInTheDocument();
  });
});
