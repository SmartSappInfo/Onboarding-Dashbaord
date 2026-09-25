import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/divider';

describe('Divider Block Schema & Extended Attributes', () => {
  const dividerDef = getBlock('divider')!;

  it('registers the divider block with fields for style, width, thickness, spacing, alignment, and color', () => {
    expect(dividerDef).toBeDefined();
    expect(dividerDef.type).toBe('divider');
    const fieldKeys = dividerDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('style');
    expect(fieldKeys).toContain('width');
    expect(fieldKeys).toContain('thickness');
    expect(fieldKeys).toContain('spacing');
    expect(fieldKeys).toContain('alignment');
    expect(fieldKeys).toContain('color');
  });

  it('safely parses legacy divider block props without breaking defaults', () => {
    const legacyProps = {
      style: 'solid',
      color: '#e2e8f0',
    };

    const parsed = dividerDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.style).toBe('solid');
      expect(parsed.data.color).toBe('#e2e8f0');
      expect(parsed.data.width).toBe('full');
      expect(parsed.data.thickness).toBe('hairline');
      expect(parsed.data.spacing).toBe('medium');
      expect(parsed.data.alignment).toBe('center');
      expect(parsed.data.label).toBe('');
    }
  });

  it('parses extended divider styles and custom options accurately', () => {
    const extendedProps = {
      style: 'glow',
      width: 'wide',
      thickness: 'thick',
      spacing: 'relaxed',
      alignment: 'left',
      color: '#3B82F6',
      label: 'SECTION BREAK',
    };

    const parsed = dividerDef.schema.safeParse(extendedProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.style).toBe('glow');
      expect(parsed.data.width).toBe('wide');
      expect(parsed.data.thickness).toBe('thick');
      expect(parsed.data.spacing).toBe('relaxed');
      expect(parsed.data.alignment).toBe('left');
      expect(parsed.data.color).toBe('#3B82F6');
      expect(parsed.data.label).toBe('SECTION BREAK');
    }
  });
});
