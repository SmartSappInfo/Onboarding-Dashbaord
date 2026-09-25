import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks/list';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  theme: resolveTheme(),
  interpolate: (t) => t,
  resources: { forms: [], surveys: [], agreements: [] },
};

describe('List Block Runtime Rendering', () => {
  it('renders feature checklist preset with checkmark items', () => {
    const block: PageBlock = {
      id: 'lst-chk-1',
      type: 'list',
      props: {
        preset: 'checklist',
        items: [
          { id: '1', title: 'Zero latency syncing', description: 'Real-time database replication.' },
          { id: '2', title: 'Automated roster verification', description: 'Federal guidelines audit.' },
        ],
      },
    };

    render(<BlockRenderer block={block} ctx={mockCtx} />);
    expect(screen.getByText('Zero latency syncing')).toBeInTheDocument();
    expect(screen.getByText('Real-time database replication.')).toBeInTheDocument();
    expect(screen.getByText('Automated roster verification')).toBeInTheDocument();
  });

  it('renders numbered preset with sequence badges', () => {
    const block: PageBlock = {
      id: 'lst-num-1',
      type: 'list',
      props: {
        preset: 'numbered',
        items: [
          { id: '1', title: 'Step 1: Invite users' },
          { id: '2', title: 'Step 2: Assign roles' },
        ],
      },
    };

    render(<BlockRenderer block={block} ctx={mockCtx} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Invite users')).toBeInTheDocument();
  });

  it('renders cards preset with responsive columns', () => {
    const block: PageBlock = {
      id: 'lst-crd-1',
      type: 'list',
      props: {
        preset: 'cards',
        columns: '2',
        items: [
          { id: '1', title: 'Card 1 Title', description: 'Card 1 Desc' },
          { id: '2', title: 'Card 2 Title', description: 'Card 2 Desc' },
        ],
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const listElement = container.querySelector('ul');
    expect(listElement).toHaveClass('grid-cols-1');
    expect(listElement).toHaveClass('md:grid-cols-2');
    expect(screen.getByText('Card 1 Title')).toBeInTheDocument();
  });

  it('renders friendly placeholder when items are empty in edit mode', () => {
    const block: PageBlock = {
      id: 'lst-empty-1',
      type: 'list',
      props: {
        items: [],
      },
    };

    const editCtx: BlockRenderContext = { ...mockCtx, mode: 'edit' };
    render(<BlockRenderer block={block} ctx={editCtx} />);
    expect(screen.getByText(/No list items added yet/i)).toBeInTheDocument();
  });
});
