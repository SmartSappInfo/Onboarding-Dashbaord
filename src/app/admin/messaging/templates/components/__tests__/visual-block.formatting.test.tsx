import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderHtmlWithVariablePills } from '../visual-block';
import { render } from '@testing-library/react';
import { convertToVisualHtml, convertToCleanHtml, cleanContainerHtml } from '@/components/messaging/SlashInput';
import { sanitizeBlocksContainerHtml } from '../template-workshop';
import { renderBlocksToHtml } from '@/lib/messaging-utils';
import type { MessageBlock } from '@/lib/types';

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

  it('resolves score-card scoreValue fallback correctly in renderBlocksToHtml', () => {
    const block: MessageBlock = {
      id: 'score-1',
      type: 'score-card',
      scoreValue: '85',
      pillText: 'Result',
      content: 'Points'
    };

    // 1. Unpopulated variables.score uses scoreValue fallback ('85')
    const htmlFallback = renderBlocksToHtml([block], {});
    expect(htmlFallback).toContain('>85<');

    // 2. Numeric 0 variables.score preserves '0'
    const htmlZero = renderBlocksToHtml([block], { score: 0 });
    expect(htmlZero).toContain('>0<');

    // 3. Populated variables.score (e.g. 95) overrides scoreValue fallback
    const htmlScore = renderBlocksToHtml([block], { score: 95 });
    expect(htmlScore).toContain('>95<');

    // 4. Verifies HTML entity escaping on unescaped input strings
    const unsafeBlock: MessageBlock = {
      id: 'score-2',
      type: 'score-card',
      scoreValue: '<script>alert(1)</script>',
      pillText: 'Unsafe <b>Badge</b>',
      content: 'Unsafe <img src=x>'
    };
    const unsafeHtml = renderBlocksToHtml([unsafeBlock], {});
    expect(unsafeHtml).not.toContain('<script>');
    expect(unsafeHtml).toContain('&lt;script&gt;');
    expect(unsafeHtml).toContain('Unsafe &lt;b&gt;Badge&lt;&#x2F;b&gt;');
  });
});

describe('SlashInput HTML Converters & Rich Formatting Persistence', () => {
  it('converts plain variables to visual spans', () => {
    const text = 'Hello {{first_name}}!';
    const html = convertToVisualHtml(text, true);
    expect(html).toContain('data-variable="first_name"');
    expect(html).toContain('first_name</span>');
  });

  it('serializes visual spans back to variable tokens with rich formatting preserved', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Welcome to <font color="#3b82f6"><b>SmartSapp!</b></font> <span data-variable="last_name">last_name</span>!';
    const cleaned = convertToCleanHtml(div, true);
    expect(cleaned).toContain('<font color="#3b82f6"><b>SmartSapp!</b></font>');
    expect(cleaned).toContain('{{last_name}}');
  });

  it('preserves text color and font styles across convertToVisualHtml and convertToCleanHtml in rich text mode', () => {
    const richInput = 'Congratulations and welcome to <font color="#3b82f6">SmartSapp!</font> We are thrilled to have {{contact_name | Partner}} on board.';
    const visualHtml = convertToVisualHtml(richInput, true);
    expect(visualHtml).toContain('<font color="#3b82f6">SmartSapp!</font>');
    expect(visualHtml).toContain('data-variable="contact_name"');
    expect(visualHtml).toContain('contact_name (Partner)');

    const div = document.createElement('div');
    div.innerHTML = visualHtml;
    const cleanOutput = convertToCleanHtml(div, true);
    expect(cleanOutput).toContain('<font color="#3b82f6">SmartSapp!</font>');
    expect(cleanOutput).toContain('{{contact_name | Partner}}');
  });

  it('preserves span styles (e.g. style="color: rgb(59, 130, 246)") in rich text mode', () => {
    const richInput = 'Highlight: <span style="color: rgb(59, 130, 246); font-weight: bold;">Important</span>';
    const visualHtml = convertToVisualHtml(richInput, true);
    expect(visualHtml).toContain('<span style="color: rgb(59, 130, 246); font-weight: bold;">Important</span>');

    const div = document.createElement('div');
    div.innerHTML = visualHtml;
    const cleanOutput = convertToCleanHtml(div, true);
    expect(cleanOutput).toContain('color: rgb(59, 130, 246)');
  });

  it('strips all HTML tags and converts breaks to newlines when enableFormatting is false (SMS/Plain Text mode)', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Dear <span data-variable="contact_name">contact_name</span>,</p><br><font color="#64748b">Your code is 1234.</font>';
    const plainOutput = convertToCleanHtml(div, false);
    expect(plainOutput).toBe('Dear {{contact_name}},\nYour code is 1234.');
    expect(plainOutput).not.toContain('<font');
    expect(plainOutput).not.toContain('<p');
  });

  it('recursively preserves safe rich text while sanitizing dangerous tags in sanitizeBlocksContainerHtml', () => {
    const rawBlocks: MessageBlock[] = [
      {
        id: 'b1',
        type: 'text',
        content: 'Welcome to <font color="#3b82f6"><b>SmartSapp!</b></font><script>alert("xss")</script>',
      },
      {
        id: 'b2',
        type: 'heading',
        title: 'Title with <span style="color: #ef4444;">Red Accent</span>',
      },
      {
        id: 'b3',
        type: 'html',
        content: '<font color="blue">Custom Code Block</font>',
      },
    ];

    const sanitized = sanitizeBlocksContainerHtml(rawBlocks);
    // Preserves safe rich formatting
    expect(sanitized[0].content).toContain('<font color="#3b82f6"><b>SmartSapp!</b></font>');
    // Strips script tag
    expect(sanitized[0].content).not.toContain('<script>');
    expect(sanitized[0].content).not.toContain('alert');
    // Heading title preserves span color
    expect(sanitized[1].title).toContain('<span style="color: #ef4444;">Red Accent</span>');
    // Raw HTML block remains untouched
    expect(sanitized[2].content).toBe('<font color="blue">Custom Code Block</font>');
  });
});
