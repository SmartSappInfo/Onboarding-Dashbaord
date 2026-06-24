import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PageBlock, BuilderResources } from '@/lib/types';
import { AutoBlockEditor } from '../AutoBlockEditor';
import '@/lib/page-builder/blocks'; // register blocks

const resources: BuilderResources = { forms: [], surveys: [], agreements: [] };

describe('AutoBlockEditor', () => {
  it('shows an empty state when no block is selected', () => {
    render(<AutoBlockEditor block={null} resources={resources} onUpdateProps={() => {}} />);
    expect(screen.getByText('No block selected')).toBeInTheDocument();
  });

  it('renders a labelled control per field of the block', () => {
    const block: PageBlock = { id: 'h1', type: 'hero', props: { title: 'Hi' } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={() => {}} />);
    expect(screen.getByLabelText('Headline')).toBeInTheDocument();
    expect(screen.getByLabelText('Subtitle')).toBeInTheDocument();
  });

  it('emits a prop patch when a field changes', () => {
    const onUpdateProps = vi.fn();
    const block: PageBlock = { id: 'h1', type: 'hero', props: { title: 'Hi' } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'New Title' } });
    expect(onUpdateProps).toHaveBeenCalledWith('h1', { title: 'New Title' });
  });

  it('adds an item to a list field', () => {
    const onUpdateProps = vi.fn();
    const block: PageBlock = { id: 's1', type: 'stats', props: { items: [] } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);
    fireEvent.click(screen.getByText('Add'));
    expect(onUpdateProps).toHaveBeenCalledTimes(1);
    const [, patch] = onUpdateProps.mock.calls[0];
    expect(Array.isArray(patch.items)).toBe(true);
    expect(patch.items).toHaveLength(1);
  });
});
