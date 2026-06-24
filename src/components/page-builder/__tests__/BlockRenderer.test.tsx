import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PageBlock } from '@/lib/types';
import { BlockRenderer } from '../BlockRenderer';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext, BlockMode } from '@/lib/page-builder/registry';
import { allBlocks } from '@/lib/page-builder/registry';
import '@/lib/page-builder/blocks'; // side-effect: register all blocks

function ctx(mode: BlockMode): BlockRenderContext {
  return {
    mode,
    theme: resolveTheme(),
    interpolate: (t) => t,
    resources: { forms: [], surveys: [], agreements: [] },
    onPropChange: () => {},
    fireTrigger: () => {},
  };
}

describe('BlockRenderer', () => {
  it('renders a text block content in view mode', () => {
    const block: PageBlock = { id: 't1', type: 'text', props: { content: '<p>Hello world</p>' } };
    render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders an editable input for a hero block in edit mode', () => {
    const block: PageBlock = { id: 'h1', type: 'hero', props: { title: 'My Title' } };
    const { container } = render(<BlockRenderer block={block} ctx={ctx('edit')} />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).value).toBe('My Title');
  });

  it('renders a non-throwing fallback for an unknown block type', () => {
    const block = { id: 'x', type: 'future_widget', props: {} } as unknown as PageBlock;
    expect(() => render(<BlockRenderer block={block} ctx={ctx('edit')} />)).not.toThrow();
    expect(screen.getByText(/Unknown block: future_widget/)).toBeInTheDocument();
  });

  it('renders nothing for an unknown block type in view mode', () => {
    const block = { id: 'x', type: 'future_widget', props: {} } as unknown as PageBlock;
    const { container } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes no edit affordances in view mode for any registered block (R11)', () => {
    for (const def of allBlocks()) {
      const block: PageBlock = { id: `b-${def.type}`, type: def.type, props: {} };
      const { container, unmount } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
      const editable = container.querySelector('input, textarea, [contenteditable="true"]');
      expect(editable, `${def.type} leaked an edit control into view mode`).toBeNull();
      unmount();
    }
  });
});
