import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/list';
import type { ListItem, ListProps } from '@/lib/page-builder/blocks/list';

describe('List Block Intro Paragraph & Extended Presets Schema', () => {
  const listDef = getBlock('list');

  it('registers list block schema with default intro text disabled (List Only mode)', () => {
    expect(listDef).toBeDefined();
    const parsed = listDef?.schema.safeParse({});
    expect(parsed?.success).toBe(true);

    if (parsed?.success) {
      const data = parsed.data as ListProps;
      expect(data.showIntroText).toBe(false);
      expect(data.introTitle).toBe('');
      expect(data.introText).toBe('');
      expect(data.introAlignment).toBe('left');
      expect(data.preset).toBe('checklist');
    }
  });

  it('normalizes legacy title property to introTitle and activates showIntroText', () => {
    const legacyProps = {
      title: 'Tuition Payment Guide & Steps',
      preset: 'numbered',
    };

    const parsed = listDef?.schema.safeParse(legacyProps);
    expect(parsed?.success).toBe(true);

    if (parsed?.success) {
      const data = parsed.data as ListProps;
      expect(data.introTitle).toBe('Tuition Payment Guide & Steps');
      expect(data.showIntroText).toBe(true);
      expect(data.preset).toBe('numbered');
    }
  });

  it('supports explicit introTitle, multiline introText, and introAlignment', () => {
    const customProps = {
      showIntroText: true,
      introTitle: 'Program Prerequisites',
      introText: 'Please review all administrative requirements before commencing your formal course modules.',
      introAlignment: 'center',
      preset: 'stepped-gradient',
      items: [
        { id: '1', title: 'Submit Identification', description: 'National ID or Passport scan.' },
      ],
    };

    const parsed = listDef?.schema.safeParse(customProps);
    expect(parsed?.success).toBe(true);

    if (parsed?.success) {
      const data = parsed.data as ListProps;
      expect(data.showIntroText).toBe(true);
      expect(data.introTitle).toBe('Program Prerequisites');
      expect(data.introText).toBe('Please review all administrative requirements before commencing your formal course modules.');
      expect(data.introAlignment).toBe('center');
      expect(data.preset).toBe('stepped-gradient');
    }
  });

  it('accepts both new presets stepped-gradient and bordered-rows alongside original presets', () => {
    const steppedParsed = listDef?.schema.safeParse({ preset: 'stepped-gradient' });
    expect(steppedParsed?.success).toBe(true);

    const borderedParsed = listDef?.schema.safeParse({ preset: 'bordered-rows' });
    expect(borderedParsed?.success).toBe(true);

    const checklistParsed = listDef?.schema.safeParse({ preset: 'checklist' });
    expect(checklistParsed?.success).toBe(true);
  });
});
