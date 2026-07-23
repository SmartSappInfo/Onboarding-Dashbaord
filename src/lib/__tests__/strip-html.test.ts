import { describe, it, expect } from 'vitest';
import { stripHtml } from '../utils';

describe('stripHtml utility', () => {
  it('should preserve double-brace template variables', () => {
    const input = 'Hello {{entity_name}}, welcome to our portal!';
    expect(stripHtml(input)).toBe('Hello {{entity_name}}, welcome to our portal!');
  });

  it('should preserve template variables with fallback options', () => {
    const input = 'Special offer for {{primary_contact_name | Valued Customer}}';
    expect(stripHtml(input)).toBe('Special offer for {{primary_contact_name | Valued Customer}}');
  });

  it('should preserve single curly braces', () => {
    const input = 'Sample {key: value} text';
    expect(stripHtml(input)).toBe('Sample {key: value} text');
  });

  it('should strip HTML tags while keeping text content and variables', () => {
    const input = '<h1>Welcome <span>{{contact_name}}</span></h1><p>Check your <b>account</b>.</p>';
    expect(stripHtml(input)).toBe('Welcome {{contact_name}}Check your account.');
  });

  it('should strip <style> blocks and internal CSS completely', () => {
    const input = `
      <html>
        <head>
          <style>
            #outlook a { padding:0; }
            body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
            table, td { border-collapse:collapse; }
          </style>
        </head>
        <body>
          <p>Dear {{entity_name}}, your invoice is ready.</p>
        </body>
      </html>
    `;
    expect(stripHtml(input)).toBe('Dear {{entity_name}}, your invoice is ready.');
  });

  it('should strip <script> blocks completely', () => {
    const input = '<div>Hello</div><script>console.log("secret")</script><span>World</span>';
    expect(stripHtml(input)).toBe('HelloWorld');
  });

  it('should decode common HTML entities', () => {
    const input = 'Tom &amp; Jerry &nbsp; &lt;rocks&gt; &quot;quote&quot;';
    expect(stripHtml(input)).toBe('Tom & Jerry <rocks> "quote"');
  });

  it('should handle empty or undefined input gracefully', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null as unknown as string)).toBe('');
  });
});
