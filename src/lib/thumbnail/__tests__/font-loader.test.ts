import { expect, test, describe, beforeEach, vi } from 'vitest';
import { FontLoader } from '../font-loader';

describe('FontLoader Utility', () => {
  beforeEach(() => {
    FontLoader.clearCache();
    vi.restoreAllMocks();
  });

  test('resolves false on server-side rendering (window/document undefined)', async () => {
    // Save globals
    const originalWindow = global.window;
    const originalDocument = global.document;

    // Temporarily delete window/document globals
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as any).window;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as any).document;

    const res = FontLoader.loadFont('Montserrat');
    await expect(res).resolves.toBe(false);

    // Restore globals
    global.window = originalWindow;
    global.document = originalDocument;
  });

  test('caches loaded fonts and doesn\'t inject the same stylesheet twice', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild');

    // Mock document.fonts.load to resolve immediately
    if (!document.fonts) {
      (document as any).fonts = { load: vi.fn().mockResolvedValue([]) };
    } else {
      vi.spyOn(document.fonts, 'load').mockResolvedValue([]);
    }

    const firstLoad = await FontLoader.loadFont('Oswald');
    expect(firstLoad).toBe(true);
    expect(FontLoader.isFontLoaded('Oswald')).toBe(true);
    expect(appendSpy).toHaveBeenCalledTimes(1);

    // Second load should resolve instantly and bypass appendChild
    const secondLoad = await FontLoader.loadFont('Oswald');
    expect(secondLoad).toBe(true);
    expect(appendSpy).toHaveBeenCalledTimes(1);
  });
});
