// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../../../lib/survey-variable-utils';

function convertToVisualHtml(text: string): string {
  if (!text) return '';
  const parsed = text.replace(/\{\{(.*?)\}\}/g, (match, rawKey) => {
    const parts = rawKey.split(/\|\||\|/);
    const varName = parts[0].trim();
    const fallback = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
    const fallbackText = fallback ? ` (${fallback})` : '';

    return `<span contenteditable="false" data-variable="${varName}" data-fallback="${fallback}" class="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none hover:bg-blue-200/20 dark:hover:bg-blue-900/30 transition-all">
      <span>${varName}${fallbackText}</span>
      <button type="button" data-variable-settings="${varName}" class="hover:bg-blue-500/20 p-0.5 rounded transition-all inline-flex items-center justify-center ml-1 text-[9px] cursor-pointer border-0 bg-transparent" title="Configure fallback">⚙️</button>
    </span>`;
  });
  return parsed;
}

describe('Survey Builder Serialization & XSS Sanitization Tests', () => {
  it('should serialize simple plain text and preserve variable tokens', () => {
    const text = 'Hello {{contact_name}} from {{entity_name}}!';
    const visual = convertToVisualHtml(text);
    
    expect(visual).toContain('data-variable="contact_name"');
    expect(visual).toContain('data-variable="entity_name"');
  });

  it('should support fallbacks in visual conversion', () => {
    const text = 'Hello {{contact_name | Guest}}!';
    const visual = convertToVisualHtml(text);
    
    expect(visual).toContain('data-fallback="Guest"');
    expect(visual).toContain('contact_name (Guest)');
  });

  it('should strip script tags and onload event attributes during HTML sanitization', () => {
    const maliciousHtml = 'Hello <strong>Alice</strong><script>alert(1)</script><img src=x onerror=alert(2) />';
    const sanitized = sanitizeHtml(maliciousHtml);
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).toContain('<strong>Alice</strong>');
    expect(sanitized).toContain('<img src="x">');
  });

  it('should strip iframe and form elements during sanitization', () => {
    const maliciousHtml = 'Hello <iframe src="http://hack.com"></iframe><form action="/hack"></form>';
    const sanitized = sanitizeHtml(maliciousHtml);
    
    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('form');
  });
});
