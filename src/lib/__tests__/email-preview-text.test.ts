import { describe, it, expect } from 'vitest';
import { injectPreviewTextIntoHtml } from '../messaging-utils';

describe('Email Preview Text Injection Helper', () => {
  it('returns original HTML if preview text is empty or undefined', () => {
    const html = '<html><body>Hello World</body></html>';
    expect(injectPreviewTextIntoHtml(html, '')).toBe(html);
  });

  it('prepends preheader HTML if <body> tag is absent', () => {
    const html = 'Hello World';
    const preview = 'Awesome Preview';
    const result = injectPreviewTextIntoHtml(html, preview);
    expect(result).toContain(preview);
    expect(result).toContain('&nbsp;&zwnj;');
    expect(result.startsWith('<div style="display: none;')).toBe(true);
    expect(result.endsWith('Hello World')).toBe(true);
  });

  it('injects preheader HTML immediately after the opening <body> tag if present', () => {
    const html = '<html><body class="bg-gray-100"><h1>Hello</h1></body></html>';
    const preview = 'Preview Text';
    const result = injectPreviewTextIntoHtml(html, preview);
    
    expect(result).toContain('<html><body class="bg-gray-100"><div style="display: none;');
    expect(result).toContain(preview);
    expect(result).toContain('&nbsp;&zwnj;');
    expect(result).toContain('<h1>Hello</h1></body></html>');
  });

  it('is case-insensitive when detecting the opening <body> tag', () => {
    const html = '<html><BODY style="color:red;"><h1>Hi</h1></BODY></html>';
    const preview = 'Hi there';
    const result = injectPreviewTextIntoHtml(html, preview);
    
    expect(result).toContain('<html><BODY style="color:red;"><div style="display: none;');
    expect(result).toContain(preview);
  });
});
