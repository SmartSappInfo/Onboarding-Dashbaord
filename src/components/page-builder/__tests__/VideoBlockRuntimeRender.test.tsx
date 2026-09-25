import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks/video';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  theme: resolveTheme(),
  interpolate: (t) => t,
  resources: { forms: [], surveys: [], agreements: [] },
};

describe('Video Block Runtime Presets', () => {
  it('renders ambient reactive glow aura behind video container', () => {
    const block: PageBlock = {
      id: 'vid-1',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'ambient-loop',
        ambientGlow: true,
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const glow = container.querySelector('[data-testid="ambient-reactive-glow"]');
    expect(glow).toBeInTheDocument();
  });

  it('renders desktop browser window frame for hero walkthrough', () => {
    const block: PageBlock = {
      id: 'vid-2',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'hero-walkthrough',
        elevation: 'browser',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const browserBar = container.querySelector('[data-testid="browser-chrome-header"]');
    expect(browserBar).toBeInTheDocument();
  });

  it('renders radar pulse play button trigger', () => {
    const block: PageBlock = {
      id: 'vid-3',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'hero-walkthrough',
        playMode: 'modal',
        playButtonArchetype: 'pulse',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const radar = container.querySelector('[data-testid="radar-pulse-trigger"]');
    expect(radar).toBeInTheDocument();
  });

  it('renders 9:16 vertical mobile phone chassis for social reel', () => {
    const block: PageBlock = {
      id: 'vid-4',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'social-reel',
        aspectRatio: '9:16',
        elevation: 'mobile',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const speaker = container.querySelector('[data-testid="mobile-speaker-bar"]');
    expect(speaker).toBeInTheDocument();
  });
});
