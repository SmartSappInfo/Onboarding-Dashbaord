import { describe, it, expect } from 'vitest';
import { buildPageImagePath } from '../upload';

describe('buildPageImagePath', () => {
  it('scopes the path to media/page-builder and the workspace', () => {
    const path = buildPageImagePath('ws1', 'photo.png', 'abc');
    expect(path).toBe('media/page-builder/ws1/abc-photo.png');
  });

  it('sanitizes unsafe characters in the filename', () => {
    const path = buildPageImagePath('ws1', 'my photo (1).png', 'abc');
    expect(path).toBe('media/page-builder/ws1/abc-my_photo__1_.png');
  });
});
