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

  it('testimonial block renders with custom background styling', () => {
    const block: PageBlock = {
      id: 'test-card',
      type: 'testimonial',
      props: {
        cardBgType: 'color',
        cardBgColor: '#ff0000',
        cardTextColor: '#00ff00',
        cardBorderColor: '#0000ff'
      }
    };
    const { container } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    const figure = container.querySelector('figure');
    expect(figure).toBeInTheDocument();
    expect(figure?.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(figure?.style.color).toBe('rgb(0, 255, 0)');
    expect(figure?.style.borderColor).toBe('rgb(0, 0, 255)');
  });

  it('testimonial_grid block renders with custom background styling on cards', () => {
    const block: PageBlock = {
      id: 'test-grid',
      type: 'testimonial_grid',
      props: {
        cardBgType: 'gradient',
        cardBgGradientFrom: '#ff0000',
        cardBgGradientTo: '#0000ff',
        cardTextColor: '#ffff00',
        cardBorderColor: '#00ff00',
        items: [
          { id: 'item1', author: 'User A', role: 'Role A', quote: 'Great!', videoUrl: '', thumbnailUrl: '', badgeText: '', avatarUrl: '' }
        ]
      }
    };
    const { container } = render(<BlockRenderer block={block} ctx={ctx('view')} />);
    const card = container.querySelector('.grid > div');
    expect(card).toBeInTheDocument();
    const style = (card as HTMLElement).style;
    expect(style.backgroundImage).toContain('linear-gradient');
    expect(style.color).toBe('rgb(255, 255, 0)');
    expect(style.borderColor).toBe('rgb(0, 255, 0)');
  });
});
