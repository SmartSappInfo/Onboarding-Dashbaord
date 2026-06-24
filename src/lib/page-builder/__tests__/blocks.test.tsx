import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { PageBlock } from '@/lib/types';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import { resolveTheme } from '../resolve-theme';
import { getBlock, allBlocks, type BlockRenderContext, type BlockMode } from '../registry';
import '../blocks';

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

const EXPECTED_TYPES = [
  'hero', 'text', 'cta', 'image', 'video', 'spacer', 'divider',
  'faq', 'testimonial', 'stats', 'logo_grid', 'payment_methods', 'procedure_list',
  'columns', 'container', 'form', 'survey', 'agreement', 'html',
] as const;

describe('block registry coverage', () => {
  it('registers every expected block type', () => {
    for (const type of EXPECTED_TYPES) {
      expect(getBlock(type), `${type} should be registered`).toBeDefined();
    }
  });

  it('renders every block in both modes without throwing', () => {
    for (const def of allBlocks()) {
      const block: PageBlock = { id: `b-${def.type}`, type: def.type, props: {} };
      expect(() => {
        const a = render(<BlockRenderer block={block} ctx={ctx('view')} />);
        a.unmount();
        const b = render(<BlockRenderer block={block} ctx={ctx('edit')} />);
        b.unmount();
      }, `${def.type} threw while rendering`).not.toThrow();
    }
  });
});

describe('representative block output (view mode)', () => {
  it('faq renders a question', () => {
    const block: PageBlock = { id: 'f', type: 'faq', props: { items: [{ id: 'q1', question: 'How?', answer: 'Like this' }] } };
    const { getByText } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(getByText('How?')).toBeInTheDocument();
  });

  it('stats renders a value', () => {
    const block: PageBlock = { id: 's', type: 'stats', props: { items: [{ id: 's1', value: '99%', label: 'Uptime' }] } };
    const { getByText } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(getByText('99%')).toBeInTheDocument();
  });

  it('payment_methods renders a method name', () => {
    const block: PageBlock = { id: 'p', type: 'payment_methods', props: { methods: [{ name: 'GT Bank', details: [{ label: 'Acct', value: '123' }] }] } };
    const { getByText } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(getByText('GT Bank')).toBeInTheDocument();
    expect(getByText('123')).toBeInTheDocument();
  });

  it('columns renders its nested children', () => {
    const block: PageBlock = {
      id: 'c',
      type: 'columns',
      props: { variant: '1-1' },
      blocks: [
        { id: 'c1', type: 'text', props: { content: '<p>Left</p>' } },
        { id: 'c2', type: 'text', props: { content: '<p>Right</p>' } },
      ],
    };
    const { getByText } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    expect(getByText('Left')).toBeInTheDocument();
    expect(getByText('Right')).toBeInTheDocument();
  });
});
