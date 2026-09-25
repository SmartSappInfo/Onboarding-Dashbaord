import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks/divider';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  theme: resolveTheme(),
  interpolate: (t) => t,
  resources: { forms: [], surveys: [], agreements: [] },
};

describe('Divider Runtime Rendering', () => {
  it('renders double hairline divider rule', () => {
    const block: PageBlock = {
      id: 'div-1',
      type: 'divider',
      props: {
        style: 'double',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const doubleElem = container.querySelector('[data-testid="divider-double"]');
    expect(doubleElem).toBeInTheDocument();
  });

  it('renders neon glow aura divider', () => {
    const block: PageBlock = {
      id: 'div-2',
      type: 'divider',
      props: {
        style: 'glow',
        color: '#3B82F6',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const glowElem = container.querySelector('[data-testid="divider-glow"]');
    expect(glowElem).toBeInTheDocument();
  });

  it('renders center text badge pill with custom label', () => {
    const block: PageBlock = {
      id: 'div-3',
      type: 'divider',
      props: {
        style: 'badge',
        label: 'CHAPTER 2',
      },
    };

    const { container, getByText } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const badgeElem = container.querySelector('[data-testid="divider-badge"]');
    expect(badgeElem).toBeInTheDocument();
    expect(getByText('CHAPTER 2')).toBeInTheDocument();
  });

  it('renders center diamond notch glyph', () => {
    const block: PageBlock = {
      id: 'div-4',
      type: 'divider',
      props: {
        style: 'notch',
      },
    };

    const { container, getByText } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const notchElem = container.querySelector('[data-testid="divider-notch"]');
    expect(notchElem).toBeInTheDocument();
    expect(getByText('◆')).toBeInTheDocument();
  });

  it('applies custom width and alignment classes', () => {
    const block: PageBlock = {
      id: 'div-5',
      type: 'divider',
      props: {
        style: 'solid',
        width: 'medium',
        alignment: 'left',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const outer = container.querySelector('[data-testid="divider-container"]');
    const inner = container.querySelector('[data-testid="divider-inner"]');
    expect(outer?.className).toContain('justify-start');
    expect(inner?.className).toContain('w-1/2');
  });
});
