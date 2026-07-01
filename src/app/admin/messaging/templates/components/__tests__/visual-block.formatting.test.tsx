import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderHtmlWithVariablePills } from '../visual-block';
import { render } from '@testing-library/react';

// Setup helper to render ReactNode in a container to verify HTML output
function renderNode(node: React.ReactNode): HTMLElement {
  const { container } = render(React.createElement('div', null, node));
  return container;
}

import { convertToVisualHtml, convertToCleanHtml } from '@/components/messaging/SlashInput';

describe('renderHtmlWithVariablePills', () => {
  it('renders raw text correctly', () => {
    const node = renderHtmlWithVariablePills('Hello World');
    const container = renderNode(node);
    expect(container.textContent).toBe('Hello World');
  });

  it('parses basic formatting tags', () => {
    const node = renderHtmlWithVariablePills('Hello <strong>Ada</strong>!');
    const container = renderNode(node);
    const strongEl = container.querySelector('strong');
    expect(strongEl).not.toBeNull();
    expect(strongEl?.textContent).toBe('Ada');
  });

  it('parses text colors in spans', () => {
    const node = renderHtmlWithVariablePills('Colored <span style="color: rgb(239, 68, 68)">Text</span>');
    const container = renderNode(node);
    const spanEl = container.querySelector('span');
    expect(spanEl).not.toBeNull();
    expect(spanEl?.style.color).toBe('rgb(239, 68, 68)');
    expect(spanEl?.textContent).toBe('Text');
  });

  it('recursively parses variable pills inside formatting tags', () => {
    const node = renderHtmlWithVariablePills('Welcome <strong>{{first_name}}</strong>!');
    const container = renderNode(node);
    const strongEl = container.querySelector('strong');
    expect(strongEl).not.toBeNull();
    
    // Check if the variable name is displayed inside the strong wrapper
    expect(strongEl?.textContent).toBe('first_name');
    
    // Check if the variable pill style classes are applied
    const pill = container.querySelector('.font-mono');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('first_name');
  });

  it('safely drops non-whitelisted dangerous tags like script', () => {
    const node = renderHtmlWithVariablePills('Safe <strong>Text</strong><script>alert("hack")</script>');
    const container = renderNode(node);
    const strongEl = container.querySelector('strong');
    const scriptEl = container.querySelector('script');
    
    expect(strongEl).not.toBeNull();
    expect(scriptEl).toBeNull();
    expect(container.textContent).not.toContain('alert');
  });
});

describe('SlashInput HTML Converters', () => {
  it('converts plain variables to visual spans', () => {
    const text = 'Hello {{first_name}}!';
    const html = convertToVisualHtml(text);
    expect(html).toContain('data-variable="first_name"');
    expect(html).toContain('first_name</span>');
  });

  it('serializes visual spans back to variable tokens', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Hi <strong><span data-variable="last_name">last_name</span></strong>!';
    const cleaned = convertToCleanHtml(div);
    expect(cleaned).toBe('Hi <strong>{{last_name}}</strong>!');
  });
});
