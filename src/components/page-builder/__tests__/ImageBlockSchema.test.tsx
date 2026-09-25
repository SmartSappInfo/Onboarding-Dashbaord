import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

describe('Image Block Schema & Backward Compatibility', () => {
  const imageDef = getBlock('image')!;

  it('registers the image block with extended preset and framing fields', () => {
    expect(imageDef).toBeDefined();
    expect(imageDef.type).toBe('image');
    const fieldKeys = imageDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('elevation');
    expect(fieldKeys).toContain('hoverEffect');
    expect(fieldKeys).toContain('objectFit');
  });

  it('safely parses legacy image block props without new preset fields', () => {
    const legacyProps = {
      src: 'https://images.unsplash.com/photo-1',
      alt: 'Test Alt',
      borderRadius: 'circle',
      width: 'medium',
      alignment: 'center',
    };

    const parsed = imageDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.borderRadius).toBe('circle');
      expect(parsed.data.preset).toBe('circular-avatar');
      expect(parsed.data.aspectRatio).toBe('1:1');
    }
  });

  it('applies preset defaults accurately when preset is selected', () => {
    const browserMockupProps = {
      src: 'https://images.unsplash.com/photo-2',
      preset: 'browser-mockup',
    };

    const parsed = imageDef.schema.safeParse(browserMockupProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.elevation).toBe('browser');
      expect(parsed.data.borderRadius).toBe('rounded');
      expect(parsed.data.aspectRatio).toBe('16:9');
    }
  });
});
