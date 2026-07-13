import { expect, test, describe } from 'vitest';
import { FONT_PAIRINGS, SHAPE_PATH_REGISTRY, getEffectStyle } from '../design-system-presets';

describe('Design System Presets Registry', () => {
  test('defines font pairings correctly', () => {
    expect(FONT_PAIRINGS.length).toBeGreaterThan(0);
    expect(FONT_PAIRINGS[0].headline).toBeDefined();
    expect(FONT_PAIRINGS[0].sub).toBeDefined();
  });

  test('contains vector shape paths', () => {
    const star = SHAPE_PATH_REGISTRY.find(s => s.id === 'star-5');
    expect(star).toBeDefined();
    expect(star?.path).toContain('M50 0');
  });

  test('resolves text effects css maps', () => {
    const neon = getEffectStyle('neon', '#ff00ff');
    expect(neon.textShadow).toContain('#ff00ff');

    const ext3D = getEffectStyle('3d', '#ffffff');
    expect(ext3D.textShadow).toContain('5px 5px 0px');

    const grad = getEffectStyle('gradient', '#ffffff');
    expect(grad.WebkitBackgroundClip).toBe('text');
    expect(grad.WebkitTextFillColor).toBe('transparent');
  });
});
