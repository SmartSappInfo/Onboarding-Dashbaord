import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/list';
import type { ListItem } from '@/lib/page-builder/blocks/list';

describe('List Block Registration & Schema', () => {
  const listDef = getBlock('list');

  it('registers the list block with canonical type and metadata', () => {
    expect(listDef).toBeDefined();
    expect(listDef?.type).toBe('list');
    expect(listDef?.category).toBe('content');
    expect(listDef?.label).toMatch(/List/i);
  });

  it('exposes all key configuration fields including preset, items, columns, and spacing', () => {
    expect(listDef).toBeDefined();
    const fieldKeys = listDef?.fields.map((f) => f.key) || [];

    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('items');
    expect(fieldKeys).toContain('columns');
    expect(fieldKeys).toContain('spacing');
    expect(fieldKeys).toContain('bulletColor');
    expect(fieldKeys).toContain('textColor');
    expect(fieldKeys).toContain('showDescriptions');
  });

  it('provides all 6 archetypal preset style options in the preset field', () => {
    const presetField = listDef?.fields.find((f) => f.key === 'preset');
    expect(presetField).toBeDefined();
    expect(presetField?.kind).toBe('select');

    if (presetField?.kind === 'select') {
      const presetValues = presetField.options.map((o) => o.value);
      expect(presetValues).toContain('checklist');
      expect(presetValues).toContain('bullet');
      expect(presetValues).toContain('numbered');
      expect(presetValues).toContain('cards');
      expect(presetValues).toContain('minimal-dash');
      expect(presetValues).toContain('icon-pill');
    }
  });

  it('safely parses empty or default props and populates default items', () => {
    const parsed = listDef?.schema.safeParse({});
    expect(parsed?.success).toBe(true);

    if (parsed?.success) {
      expect(parsed.data.preset).toBe('checklist');
      expect(parsed.data.columns).toBe('1');
      expect(parsed.data.spacing).toBe('normal');
      expect(parsed.data.showDescriptions).toBe(true);
      expect(Array.isArray(parsed.data.items)).toBe(true);
      const items = parsed.data.items as ListItem[];
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it('parses custom items and validated attributes', () => {
    const customProps = {
      preset: 'numbered',
      columns: '2',
      spacing: 'relaxed',
      bulletColor: '#3b82f6',
      items: [
        { id: 'item-1', title: 'Step 1: Account setup', description: 'Configure organization keys.' },
        { id: 'item-2', title: 'Step 2: Sync rosters', description: 'Link to regional database.' },
      ],
    };

    const parsed = listDef?.schema.safeParse(customProps);
    expect(parsed?.success).toBe(true);
    if (parsed?.success) {
      expect(parsed.data.preset).toBe('numbered');
      expect(parsed.data.columns).toBe('2');
      const items = parsed.data.items as ListItem[];
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Step 1: Account setup');
    }
  });
});
