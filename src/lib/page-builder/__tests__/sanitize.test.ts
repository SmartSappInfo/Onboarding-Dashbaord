import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeCss } from '../sanitize';

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).not.toContain('onerror');
  });

  it('keeps safe formatting markup', () => {
    expect(sanitizeHtml('<strong>hi</strong>')).toBe('<strong>hi</strong>');
  });

  it('removes javascript: protocol hrefs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });
});

describe('sanitizeCss', () => {
  it('strips embedded style/script tags', () => {
    expect(sanitizeCss('.a{}</style><script>alert(1)</script>')).not.toContain('<script>');
  });

  it('strips css expression()', () => {
    expect(sanitizeCss('.a{width:expression(alert(1))}')).not.toContain('expression(');
  });

  it('keeps plain declarations intact', () => {
    expect(sanitizeCss('.a{color:red}')).toBe('.a{color:red}');
  });
});
