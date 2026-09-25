import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/video';

describe('Video Block Schema & Archetype Bundles', () => {
  const videoDef = getBlock('video')!;

  it('registers the video block with extended preset, button archetype, and glow fields', () => {
    expect(videoDef).toBeDefined();
    expect(videoDef.type).toBe('video');
    const fieldKeys = videoDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('preset');
    expect(fieldKeys).toContain('aspectRatio');
    expect(fieldKeys).toContain('playButtonArchetype');
    expect(fieldKeys).toContain('ambientGlow');
    expect(fieldKeys).toContain('hoverPreview');
    expect(fieldKeys).toContain('controlsTheme');
    expect(fieldKeys).toContain('overlayTint');
  });

  it('safely parses legacy video block props without breaking defaults', () => {
    const legacyProps = {
      url: 'https://youtube.com/watch?v=12345678901',
      playMode: 'modal',
      title: 'Legacy Title',
    };

    const parsed = videoDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.preset).toBe('hero-walkthrough');
      expect(parsed.data.playMode).toBe('modal');
      expect(parsed.data.playButtonArchetype).toBe('pulse');
    }
  });

  it('applies ambient-loop defaults accurately', () => {
    const ambientProps = {
      url: 'https://example.com/loop.mp4',
      preset: 'ambient-loop',
    };

    const parsed = videoDef.schema.safeParse(ambientProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.autoPlay).toBe(true);
      expect(parsed.data.muted).toBe(true);
      expect(parsed.data.loop).toBe(true);
      expect(parsed.data.ambientGlow).toBe(true);
      expect(parsed.data.overlayTint).toBe('dark-30');
    }
  });
});
