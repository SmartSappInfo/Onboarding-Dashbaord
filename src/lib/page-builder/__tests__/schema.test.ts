import { describe, it, expect } from 'vitest';
import { parseStructure } from '../schema';

describe('parseStructure', () => {
  it('returns an empty structure for malformed input instead of throwing', () => {
    // The empty structure now carries header/footer defaults — assert the
    // behavior (no sections, defaults present, no throw), not the literal.
    for (const malformed of [null, 'garbage', { sections: 'nope' }]) {
      const parsed = parseStructure(malformed);
      expect(parsed.sections).toEqual([]);
      expect(parsed.header).toBeDefined();
      expect(parsed.footer).toBeDefined();
    }
  });

  it('preserves a valid structure', () => {
    const valid = {
      sections: [
        { id: 's1', type: 'section', props: {}, blocks: [{ id: 'b1', type: 'text', props: { content: 'x' } }] },
      ],
    };
    const parsed = parseStructure(valid);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].blocks[0].id).toBe('b1');
  });

  it('defaults missing props and blocks rather than rejecting', () => {
    const parsed = parseStructure({ sections: [{ id: 's1', type: 'section' }] });
    expect(parsed.sections[0].props).toEqual({});
    expect(parsed.sections[0].blocks).toEqual([]);
  });

  it('accepts unknown block types (renderer handles fallback)', () => {
    const parsed = parseStructure({
      sections: [{ id: 's1', type: 'section', props: {}, blocks: [{ id: 'b1', type: 'future_widget', props: {} }] }],
    });
    expect(parsed.sections[0].blocks[0].type).toBe('future_widget');
  });
});
