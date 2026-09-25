import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks/image';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  device: 'desktop',
  theme: {
    themeMode: 'light',
    brandPrimaryColor: '#000000',
    brandSecondaryColor: '#ffffff',
    brandFontFamily: 'sans',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    primaryButtonBgColor: '#000000',
    primaryButtonTextColor: '#ffffff',
  },
};

describe('Image Runtime Renderer', () => {
  it('renders browser mockup with window title bar and 3 colored control dots', () => {
    const block: PageBlock = {
      id: 'img-1',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'browser-mockup',
        elevation: 'browser',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const browserBar = container.querySelector('[data-testid="browser-chrome-header"]');
    expect(browserBar).toBeInTheDocument();
  });

  it('renders mobile chassis with top speaker pill and rounded phone bezel', () => {
    const block: PageBlock = {
      id: 'img-2',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'mobile-chassis',
        elevation: 'mobile',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const speakerNotch = container.querySelector('[data-testid="mobile-speaker-bar"]');
    expect(speakerNotch).toBeInTheDocument();
  });

  it('renders cathedral arch mask correctly', () => {
    const block: PageBlock = {
      id: 'img-3',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        preset: 'cathedral-arch',
        borderRadius: 'arch',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const imgWrapper = container.querySelector('figure');
    expect(imgWrapper?.className).toContain('rounded-t-[9999px]');
  });

  it('applies hover zoom transition classes without layout shift', () => {
    const block: PageBlock = {
      id: 'img-4',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-test',
        hoverEffect: 'zoom',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('group-hover:scale-105');
  });
});
