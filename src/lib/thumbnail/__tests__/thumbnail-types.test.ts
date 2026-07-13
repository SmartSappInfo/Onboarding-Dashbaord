import { expect, test, describe } from 'vitest';
import { makeUniqueId, CTR_TEMPLATES } from '../thumbnail-types';

describe('Thumbnail Types & Presets', () => {
  test('generates unique element IDs', () => {
    const id1 = makeUniqueId();
    const id2 = makeUniqueId();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('el-')).toBe(true);
  });

  test('contains required CTR templates', () => {
    expect(CTR_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const hasReaction = CTR_TEMPLATES.some(t => t.id === 'reaction-surprise');
    expect(hasReaction).toBe(true);
  });
});
