import { describe, it, expect } from 'vitest';
import { resolveTextWithMap } from '@/lib/utils/variable-replacer';
import { interpolateWithMap, interpolateManyWithMap } from '@/lib/survey-variable-utils';

describe('Inline Variable Resolution with Fallbacks & Aliases', () => {
  describe('resolveTextWithMap (SSOT Variable Replacer)', () => {
    it('resolves direct variables from values map', () => {
      const map = new Map<string, unknown>([
        ['entity_name', 'Kofi Annan Institute'],
        ['contact_name', 'Dr. Kwame'],
      ]);

      const template = "Welcome to {{entity_name}}! Hello {{contact_name}}.";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Welcome to Kofi Annan Institute! Hello Dr. Kwame.");
    });

    it('resolves dot-notation alias keys when valuesMap has underscore format', () => {
      const map = new Map<string, unknown>([
        ['entity_name', 'Kofi Annan Institute'],
        ['contact_name', 'Ama Konadu'],
      ]);

      const template = "Your School: {{entity.name}}, Contact: {{contact.name}}";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Your School: Kofi Annan Institute, Contact: Ama Konadu");
    });

    it('resolves school.name and contact.email aliases', () => {
      const map = new Map<string, unknown>([
        ['entity_name', 'Achimota High'],
        ['contact_email', 'admin@achimota.edu'],
      ]);

      const template = "School: {{school.name}}, Email: {{contact.email}}";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("School: Achimota High, Email: admin@achimota.edu");
    });

    it('uses user-specified inline fallback when variable is missing', () => {
      const map = new Map<string, unknown>();

      const template = "Your School's Setup Data for {{entity.name|SmartSapp}}";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Your School's Setup Data for SmartSapp");
    });

    it('prioritizes tracked value over user inline fallback', () => {
      const map = new Map<string, unknown>([
        ['entity_name', 'Kofi Annan Institute'],
      ]);

      const template = "Your School's Setup Data for {{entity.name|SmartSapp}}";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Your School's Setup Data for Kofi Annan Institute");
    });

    it('prioritizes user inline fallback over system pre-defined default', () => {
      const map = new Map<string, unknown>([
        ['__fallback__contact_name', 'there'],
      ]);

      const template = "Hello {{contact_name|Valued Partner}}!";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Hello Valued Partner!");
    });

    it('falls back to system pre-defined default if no inline fallback is provided', () => {
      const map = new Map<string, unknown>([
        ['__fallback__contact_name', 'there'],
      ]);

      const template = "Hello {{contact_name}}!";
      const result = resolveTextWithMap(template, map, false);
      expect(result).toBe("Hello there!");
    });
  });

  describe('interpolateWithMap & interpolateManyWithMap (Client Survey Interpolator)', () => {
    it('resolves inline fallback when valuesMap is empty (anonymous visitor)', () => {
      const valuesMap = {};
      const template = "Setup Data for {{entity.name|SmartSapp}} - Welcome {{contact.name|Valued Guest}}";
      const result = interpolateWithMap(template, valuesMap, false);
      expect(result).toBe("Setup Data for SmartSapp - Welcome Valued Guest");
    });

    it('resolves real entity data when valuesMap contains tracked entity (tracked visitor)', () => {
      const valuesMap = {
        entity_name: 'Kofi Annan Institute',
        contact_name: 'Mr. Mensah',
      };
      const template = "Setup Data for {{entity.name|SmartSapp}} - Welcome {{contact.name|Valued Guest}}";
      const result = interpolateWithMap(template, valuesMap, false);
      expect(result).toBe("Setup Data for Kofi Annan Institute - Welcome Mr. Mensah");
    });

    it('preserves text without double braces untouched', () => {
      const template = "Standard Survey Title without variables";
      const result = interpolateWithMap(template, {}, false);
      expect(result).toBe("Standard Survey Title without variables");
    });

    it('handles null, undefined, and empty string safely', () => {
      expect(interpolateWithMap(null, {}, false)).toBe('');
      expect(interpolateWithMap(undefined, {}, false)).toBe('');
      expect(interpolateWithMap('', {}, false)).toBe('');
    });

    it('batch interpolates multiple strings efficiently with fallbacks via interpolateManyWithMap', () => {
      const templates = [
        "Welcome to {{entity.name|SmartSapp}}",
        "Hello {{contact.name|Friend}}",
        "No variables here",
      ];
      const results = interpolateManyWithMap(templates, {}, false);
      expect(results).toEqual([
        "Welcome to SmartSapp",
        "Hello Friend",
        "No variables here",
      ]);
    });
  });
});
