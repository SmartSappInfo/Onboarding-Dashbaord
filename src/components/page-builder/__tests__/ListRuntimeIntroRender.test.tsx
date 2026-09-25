import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BlockRenderer } from '../BlockRenderer';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks/list';

function createMockCtx(mode: 'view' | 'edit' = 'view', onPropChange = vi.fn()): BlockRenderContext {
  return {
    mode,
    theme: resolveTheme(),
    interpolate: (t: string) => t,
    resources: { forms: [], surveys: [], agreements: [] },
    onPropChange,
  };
}

describe('List Block Runtime Intro Paragraph & New Presets', () => {
  it('renders in List Only mode without intro headline or paragraph when showIntroText is false', () => {
    const block: PageBlock = {
      id: 'lst-only-1',
      type: 'list',
      props: {
        showIntroText: false,
        introTitle: 'Hidden Title',
        introText: 'Hidden paragraph',
        preset: 'checklist',
        items: [
          { id: '1', title: 'Standalone checklist item' },
        ],
      },
    };

    render(<BlockRenderer block={block} ctx={createMockCtx('view')} />);
    expect(screen.queryByText('Hidden Title')).toBeNull();
    expect(screen.queryByText('Hidden paragraph')).toBeNull();
    expect(screen.getByText('Standalone checklist item')).toBeInTheDocument();
  });

  it('renders intro headline and lead paragraph above list items when showIntroText is true', () => {
    const block: PageBlock = {
      id: 'lst-intro-1',
      type: 'list',
      props: {
        showIntroText: true,
        introTitle: 'Course Deliverables & Perks',
        introText: 'All enrolled students receive comprehensive onboarding support and verifiable graduation credentials.',
        introAlignment: 'center',
        preset: 'checklist',
        items: [
          { id: '1', title: '1-on-1 mentorship sessions' },
          { id: '2', title: 'Lifetime portal community access' },
        ],
      },
    };

    render(<BlockRenderer block={block} ctx={createMockCtx('view')} />);
    expect(screen.getByText('Course Deliverables & Perks')).toBeInTheDocument();
    expect(screen.getByText('All enrolled students receive comprehensive onboarding support and verifiable graduation credentials.')).toBeInTheDocument();
    expect(screen.getByText('1-on-1 mentorship sessions')).toBeInTheDocument();
  });

  it('renders stepped-gradient preset with gradient numbered nodes and connecting line', () => {
    const block: PageBlock = {
      id: 'lst-stepped-1',
      type: 'list',
      props: {
        preset: 'stepped-gradient',
        items: [
          { id: '1', title: 'Milestone 1: Fundamentals', description: 'Complete core lessons.' },
          { id: '2', title: 'Milestone 2: Practice lab', description: 'Submit capstone code.' },
        ],
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={createMockCtx('view')} />);
    expect(container.querySelector('[data-preset="stepped-gradient"]')).toBeInTheDocument();
    expect(screen.getByText('Milestone 1: Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders bordered-rows preset with horizontal divider borders', () => {
    const block: PageBlock = {
      id: 'lst-rows-1',
      type: 'list',
      props: {
        preset: 'bordered-rows',
        items: [
          { id: '1', title: 'Module 1: Introduction to Next.js', description: 'Routing and SSR basics.' },
          { id: '2', title: 'Module 2: Server Actions & Cache', description: 'Data mutation protocols.' },
        ],
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={createMockCtx('view')} />);
    expect(container.querySelector('[data-preset="bordered-rows"]')).toBeInTheDocument();
    expect(screen.getByText('Module 1: Introduction to Next.js')).toBeInTheDocument();
  });

  it('renders inline editable controls in edit mode and allows adding a first item when empty', () => {
    const onPropChange = vi.fn();
    const block: PageBlock = {
      id: 'lst-empty-edit',
      type: 'list',
      props: {
        showIntroText: true,
        introTitle: '',
        introText: '',
        items: [],
      },
    };

    render(<BlockRenderer block={block} ctx={createMockCtx('edit', onPropChange)} />);
    const addBtn = screen.getByRole('button', { name: /add first item/i });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(onPropChange).toHaveBeenCalledTimes(1);
    expect(onPropChange.mock.calls[0][0].items).toHaveLength(1);
  });
});
