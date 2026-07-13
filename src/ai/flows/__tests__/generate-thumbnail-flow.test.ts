import { expect, test, describe, vi } from 'vitest';
import { generateThumbnailDesign } from '../generate-thumbnail-flow';
import { modifyThumbnailDesign } from '../modify-thumbnail-flow';

vi.mock('../generate-thumbnail-flow', () => {
  return {
    generateThumbnailDesign: vi.fn(async () => {
      return {
        backgroundColor: '#0f172a',
        elements: [
          { id: 'el-mock-1', type: 'text', x: 10, y: 10, width: 80, height: 20, zIndex: 1, text: 'MOCK AI TEXT' }
        ],
        explanation: 'Mocked successful architect generation.'
      };
    })
  };
});

vi.mock('../modify-thumbnail-flow', () => {
  return {
    modifyThumbnailDesign: vi.fn(async () => {
      return {
        backgroundColor: '#0f172a',
        elements: [
          { id: 'el-mock-1', type: 'text', x: 10, y: 10, width: 80, height: 20, zIndex: 1, text: 'MODIFIED TEXT' }
        ],
        explanation: 'Mocked successful modification.'
      };
    })
  };
});

describe('Genkit AI flows logic', () => {
  test('generate flow returns structured canvas layout', async () => {
    const res = await generateThumbnailDesign({ prompt: 'Create layout' });
    expect(res.backgroundColor).toBe('#0f172a');
    expect(res.elements.length).toBe(1);
    expect(res.elements[0].text).toBe('MOCK AI TEXT');
  });

  test('modify flow updates coordinates/styles', async () => {
    const res = await modifyThumbnailDesign({
      backgroundColor: '#000000',
      elements: [],
      instruction: 'Change text to MODIFIED TEXT'
    });
    expect(res.elements[0].text).toBe('MODIFIED TEXT');
  });
});
