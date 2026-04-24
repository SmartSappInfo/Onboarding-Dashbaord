import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  extractVariables,
  validateTemplateVariables,
  hasTemplateVariables,
  escapeHtml,
  renderTemplateWithEscaping,
} from '../template-utils';

describe('template-utils', () => {
  describe('renderTemplate', () => {
    it('should replace single variable', () => {
      const template = 'Hello {{name}}!';
      const vars = { name: 'John' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const vars = { name: 'John', email: 'john@example.com' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John, your email is john@example.com');
    });

    it('should replace duplicate variables', () => {
      const template = 'Hello {{name}}, welcome {{name}}!';
      const vars = { name: 'John' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John, welcome John!');
    });

    it('should replace variables with whitespace', () => {
      const template = 'Hello {{ name }}, your email is {{  email  }}';
      const vars = { name: 'John', email: 'john@example.com' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John, your email is john@example.com');
    });

    it('should replace missing variables with empty string', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const vars = { name: 'John' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John, your email is ');
    });

    it('should handle null and undefined values', () => {
      const template = 'Hello {{name}}, {{age}}, {{city}}';
      const vars = { name: 'John', age: null, city: undefined };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello John, , ');
    });

    it('should convert non-string values to strings', () => {
      const template = 'Count: {{count}}, Active: {{active}}';
      const vars = { count: 42, active: true };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Count: 42, Active: true');
    });

    it('should handle empty template', () => {
      const template = '';
      const vars = { name: 'John' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'Hello World!';
      const vars = { name: 'John' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Hello World!');
    });

    it('should handle nested braces', () => {
      const template = 'Data: {{json}}';
      const vars = { json: '{"key": "value"}' };
      const result = renderTemplate(template, vars);
      expect(result).toBe('Data: {"key": "value"}');
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const template = 'Hello {{name}}!';
      const vars = extractVariables(template);
      expect(vars).toEqual(['name']);
    });

    it('should extract multiple variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const vars = extractVariables(template);
      expect(vars).toEqual(['name', 'email']);
    });

    it('should extract unique variables only', () => {
      const template = 'Hello {{name}}, welcome {{name}}!';
      const vars = extractVariables(template);
      expect(vars).toEqual(['name']);
    });

    it('should trim whitespace from variable names', () => {
      const template = 'Hello {{ name }}, your email is {{  email  }}';
      const vars = extractVariables(template);
      expect(vars).toEqual(['name', 'email']);
    });

    it('should return empty array for template with no variables', () => {
      const template = 'Hello World!';
      const vars = extractVariables(template);
      expect(vars).toEqual([]);
    });

    it('should handle empty template', () => {
      const template = '';
      const vars = extractVariables(template);
      expect(vars).toEqual([]);
    });
  });

  describe('validateTemplateVariables', () => {
    it('should validate when all variables are provided', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const vars = { name: 'John', email: 'john@example.com' };
      const result = validateTemplateVariables(template, vars);
      expect(result.isValid).toBe(true);
      expect(result.missingVariables).toEqual([]);
    });

    it('should detect missing variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const vars = { name: 'John' };
      const result = validateTemplateVariables(template, vars);
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toEqual(['email']);
    });

    it('should detect multiple missing variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}, phone: {{phone}}';
      const vars = { name: 'John' };
      const result = validateTemplateVariables(template, vars);
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toEqual(['email', 'phone']);
    });

    it('should treat null and undefined as missing', () => {
      const template = 'Hello {{name}}, {{age}}';
      const vars = { name: 'John', age: null };
      const result = validateTemplateVariables(template, vars);
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toEqual(['age']);
    });

    it('should validate template with no variables', () => {
      const template = 'Hello World!';
      const vars = {};
      const result = validateTemplateVariables(template, vars);
      expect(result.isValid).toBe(true);
      expect(result.missingVariables).toEqual([]);
    });
  });

  describe('hasTemplateVariables', () => {
    it('should return true for template with variables', () => {
      const template = 'Hello {{name}}!';
      expect(hasTemplateVariables(template)).toBe(true);
    });

    it('should return false for template without variables', () => {
      const template = 'Hello World!';
      expect(hasTemplateVariables(template)).toBe(false);
    });

    it('should return false for empty template', () => {
      const template = '';
      expect(hasTemplateVariables(template)).toBe(false);
    });

    it('should return true for template with multiple variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      expect(hasTemplateVariables(template)).toBe(true);
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('Say "Hello"')).toBe('Say &quot;Hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's working")).toBe('It&#x27;s working');
    });

    it('should escape forward slash', () => {
      expect(escapeHtml('path/to/file')).toBe('path&#x2F;to&#x2F;file');
    });

    it('should escape multiple special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should not modify safe strings', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('renderTemplateWithEscaping', () => {
    it('should render and escape HTML in variables', () => {
      const template = 'Hello {{name}}!';
      const vars = { name: '<script>alert("XSS")</script>' };
      const result = renderTemplateWithEscaping(template, vars);
      expect(result).toBe('Hello &lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;!');
    });

    it('should escape multiple variables', () => {
      const template = 'User: {{name}}, Bio: {{bio}}';
      const vars = {
        name: 'John <admin>',
        bio: 'Developer & Designer',
      };
      const result = renderTemplateWithEscaping(template, vars);
      expect(result).toBe('User: John &lt;admin&gt;, Bio: Developer &amp; Designer');
    });

    it('should handle missing variables with escaping', () => {
      const template = 'Hello {{name}}, {{email}}';
      const vars = { name: 'John <test>' };
      const result = renderTemplateWithEscaping(template, vars);
      expect(result).toBe('Hello John &lt;test&gt;, ');
    });

    it('should not escape template text, only variables', () => {
      const template = '<p>Hello {{name}}!</p>';
      const vars = { name: 'John' };
      const result = renderTemplateWithEscaping(template, vars);
      expect(result).toBe('<p>Hello John!</p>');
    });
  });
});
