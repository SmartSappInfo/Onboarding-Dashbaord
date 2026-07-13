import { expect, test, describe } from 'vitest';
import { removeImageBackgroundAction } from '../media-actions';

describe('Media Server Actions', () => {
  test('removeImageBackgroundAction resolves original image URL after delay', async () => {
    const start = Date.now();
    const url = 'https://firebasestorage.googleapis.com/subject.png';
    const res = await removeImageBackgroundAction(url);
    const duration = Date.now() - start;

    expect(res).toBe(url);
    expect(duration).toBeGreaterThanOrEqual(500);
  });

  test('throws error when imageUrl is empty', async () => {
    await expect(removeImageBackgroundAction('')).rejects.toThrow('Image URL is required');
  });
});
