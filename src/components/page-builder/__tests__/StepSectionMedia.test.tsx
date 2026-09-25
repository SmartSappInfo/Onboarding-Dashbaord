import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import { BlockRenderer } from '../BlockRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/step-section';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  theme: resolveTheme(),
  interpolate: (t) => t,
  resources: { forms: [], surveys: [], agreements: [] },
};

describe('Step Section Unified Media & Schema', () => {
  const stepDef = getBlock('step_section')!;

  it('registers a single video field for unified step media and removes separate videoUrl/imageUrl fields', () => {
    expect(stepDef).toBeDefined();
    const fieldKeys = stepDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('videoData');
    expect(fieldKeys).not.toContain('videoUrl');
    expect(fieldKeys).not.toContain('imageUrl');

    const videoField = stepDef.fields.find((f) => f.key === 'videoData');
    expect(videoField?.kind).toBe('video');
    expect(videoField?.label).toBe('Step Media');
  });

  it('safely parses legacy props containing videoUrl and imageUrl strings', () => {
    const legacyProps = {
      stepNumber: 2,
      heading: 'Legacy Step',
      description: 'Legacy description',
      videoUrl: 'https://youtube.com/watch?v=12345678901',
      imageUrl: 'https://example.com/fallback.jpg',
      mediaPosition: 'right',
    };

    const parsed = stepDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.videoUrl).toBe('https://youtube.com/watch?v=12345678901');
      expect(parsed.data.imageUrl).toBe('https://example.com/fallback.jpg');
    }
  });

  it('safely parses new unified videoData props', () => {
    const newProps = {
      stepNumber: 3,
      heading: 'New Step',
      videoData: {
        videoUrl: 'https://youtube.com/watch?v=abcdefghijk',
        thumbnailUrl: 'https://example.com/poster.jpg',
      },
    };

    const parsed = stepDef.schema.safeParse(newProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.videoData?.videoUrl).toBe('https://youtube.com/watch?v=abcdefghijk');
      expect(parsed.data.videoData?.thumbnailUrl).toBe('https://example.com/poster.jpg');
    }
  });

  it('renders media from videoData in runtime BlockRenderer', () => {
    const block: PageBlock = {
      id: 'step-1',
      type: 'step_section',
      props: {
        stepNumber: 1,
        heading: 'Unified Media Step',
        videoData: {
          videoUrl: 'https://youtube.com/watch?v=12345678901',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
        mediaPosition: 'bottom',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img?.getAttribute('src') || '')).toContain('example.com/thumb.jpg');
  });

  it('renders media from legacy imageUrl fallback when videoData is not provided', () => {
    const block: PageBlock = {
      id: 'step-2',
      type: 'step_section',
      props: {
        stepNumber: 2,
        heading: 'Legacy Image Step',
        imageUrl: 'https://example.com/legacy.jpg',
        mediaPosition: 'left',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/legacy.jpg');
  });
});
