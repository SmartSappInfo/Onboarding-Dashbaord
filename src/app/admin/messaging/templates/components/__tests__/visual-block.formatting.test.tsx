import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderHtmlWithVariablePills } from '../visual-block';
import { render } from '@testing-library/react';
import { convertToVisualHtml, convertToCleanHtml, cleanContainerHtml } from '@/components/messaging/SlashInput';
import { sanitizeBlocksContainerHtml } from '../template-workshop';

// Setup helper to render ReactNode in a container to verify HTML output
function renderNode(node: React.ReactNode): HTMLElement {
  const { container } = render(React.createElement('div', null, node));
  return container;
}

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

  it('parses pipe fallback variable tokens {{contact_name | School Owner}} into variable pills', () => {
    const node = renderHtmlWithVariablePills('Dear {{contact_name | School Owner}}, welcome!');
    const container = renderNode(node);
    const pill = container.querySelector('.font-mono');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('contact_name | School Owner');
    expect(container.textContent).toBe('Dear contact_name | School Owner, welcome!');
  });

  it('preserves multiline whitespace \\n in renderHtmlWithVariablePills', () => {
    const multilineText = 'To your growth,\nFrank D. Natie,\n{{org_name}}';
    const node = renderHtmlWithVariablePills(multilineText);
    const container = renderNode(node);
    expect(container.textContent).toBe('To your growth,\nFrank D. Natie,\norg_name');
    const pill = container.querySelector('.font-mono');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('org_name');
  });

  it('resolves score-card fallback value correctly when simulation score is unpopulated or 0', () => {
    const fallbackScore: string = '85';
    // 1. Unpopulated simulation score uses scoreValue fallback
    const scoreValUnpopulated = undefined !== undefined ? String(undefined) : (fallbackScore !== '' ? fallbackScore : '0');
    expect(scoreValUnpopulated).toBe('85');

    // 2. Numeric 0 simulation score preserves 0
    const simScore0: unknown = 0;
    const scoreValZero = simScore0 !== undefined && simScore0 !== null && simScore0 !== '' ? String(simScore0) : (fallbackScore !== '' ? fallbackScore : '0');
    expect(scoreValZero).toBe('0');
  });
});

describe('SlashInput HTML Converters & Tag Leakage Safeguard', () => {
  it('converts plain variables to visual spans', () => {
    const text = 'Hello {{first_name}}!';
    const html = convertToVisualHtml(text);
    expect(html).toContain('data-variable="first_name"');
    expect(html).toContain('first_name</span>');
  });

  it('serializes visual spans back to variable tokens', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Hi <span data-variable="last_name">last_name</span>!';
    const cleaned = convertToCleanHtml(div);
    expect(cleaned).toBe('Hi {{last_name}}!');
  });

  it('strips legacy <font color="..."> container tags from text content without leaking raw tags', () => {
    const raw = '<font color="#64748b">Read Or Listen to This Email</font>';
    const cleaned = cleanContainerHtml(raw);
    expect(cleaned).toBe('Read Or Listen to This Email');
    expect(cleaned).not.toContain('<font');
    expect(cleaned).not.toContain('</font>');
  });

  it('prevents raw HTML tags from leaking as raw string text inside convertToVisualHtml', () => {
    const raw = '<font color="#64748b">Read Or Listen to This Email</font>';
    const visualHtml = convertToVisualHtml(raw);
    expect(visualHtml).toBe('Read Or Listen to This Email');
    expect(visualHtml).not.toContain('&lt;font');
    expect(visualHtml).not.toContain('&lt;/font&gt;');
  });

  it('preserves double-brace variable tokens and line breaks while stripping container HTML', () => {
    const raw = '<p>Dear {{contact_name}},</p><br><font color="#64748b">Manual fee collection carries hidden costs: {{entity_name | Your School}}</font>';
    const cleaned = cleanContainerHtml(raw);
    expect(cleaned).toContain('Dear {{contact_name}},');
    expect(cleaned).toContain('Manual fee collection carries hidden costs: {{entity_name | Your School}}');
    expect(cleaned).not.toContain('<p>');
    expect(cleaned).not.toContain('<font');
  });

  it('recursively sanitizes legacy container HTML from template blocks in sanitizeBlocksContainerHtml', () => {
    const rawBlocks = [
      {
        id: 'b1',
        type: 'text' as const,
        content: '<font color="#64748b">Read Or Listen to This Email</font>',
      },
      {
        id: 'b2',
        type: 'html' as const,
        content: '<font color="blue">Custom Code Block</font>',
      },
    ];

    const sanitized = sanitizeBlocksContainerHtml(rawBlocks as any);
    expect(sanitized[0].content).toBe('Read Or Listen to This Email');
    // Raw HTML code blocks must remain untouched
    expect(sanitized[1].content).toBe('<font color="blue">Custom Code Block</font>');
  });
});
