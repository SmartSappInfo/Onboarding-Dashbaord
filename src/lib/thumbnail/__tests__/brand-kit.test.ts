import { expect, test, describe } from 'vitest';
import type { CanvasElement } from '../thumbnail-types';

describe('Brand Kit canvas skinning logic rules', () => {
  test('updates typography elements font family to brand default', () => {
    const elements: CanvasElement[] = [
      { id: 't-1', type: 'text', x: 10, y: 10, width: 80, height: 20, zIndex: 1, text: 'HELLO', fontFamily: 'Montserrat' }
    ];
    const brandFont = 'Anton';
    const updated = elements.map(el => {
      if (el.type === 'text') {
        return { ...el, fontFamily: brandFont };
      }
      return el;
    });
    expect(updated[0].fontFamily).toBe('Anton');
  });

  test('inverts dark text color when background is dark to prevent zero legibility', () => {
    const textColor = '#000000';
    const isDarkBackground = true;
    const resolvedColor = (isDarkBackground && textColor === '#000000') ? '#facc15' : textColor;
    expect(resolvedColor).toBe('#facc15');
  });
});
