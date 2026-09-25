import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

  it('renders 9:16 mobile phone chassis when programmatic block only specifies preset: social-reel', () => {
    const block: PageBlock = {
      id: 'vid-programmatic-reel',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'social-reel', // Notice: no aspectRatio or elevation passed; must resolve bundle defaults even after BlockRenderer merges defaults
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const speaker = container.querySelector('[data-testid="mobile-speaker-bar"]');
    expect(speaker).toBeInTheDocument();
  });

  it('renders tap-to-unmute button with >= 44px touch target on muted autoplaying video', () => {
    const block: PageBlock = {
      id: 'vid-autoplay-muted',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'ambient-loop',
        autoPlay: true,
        muted: true,
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const unmuteBtn = container.querySelector('[data-testid="tap-to-unmute-toggle"]');
    expect(unmuteBtn).toBeInTheDocument();
    expect(unmuteBtn?.className).toContain('min-h-[44px]');
  });

  it('dispatches postMessage to iframe without reloading or changing iframe src when unmute button is clicked', () => {
    const block: PageBlock = {
      id: 'vid-unmute-msg',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'ambient-loop',
        autoPlay: true,
        muted: true,
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    const originalSrc = iframe?.getAttribute('src');

    const postMessageSpy = vi.fn();
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage = postMessageSpy;
    }

    const unmuteBtn = container.querySelector('[data-testid="tap-to-unmute-toggle"]');
    expect(unmuteBtn).toBeInTheDocument();
    if (unmuteBtn) {
      unmuteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    // Verify postMessage was called with unMute command
    expect(postMessageSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'unMute' }),
      '*'
    );
    // Verify iframe src did NOT change or reload
    expect(iframe?.getAttribute('src')).toBe(originalSrc);
  });
});
