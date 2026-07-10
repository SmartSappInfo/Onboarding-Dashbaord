import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PageBlock, BuilderResources } from '@/lib/types';

// The component's import graph transitively reaches @/ai/genkit, whose
// module-level genkit({ plugins: [anthropic()] }) instantiates the Anthropic
// client at import time — which refuses to run in a jsdom environment.
// Stub the server-only leaves so the suite can load the UI under test.
vi.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => vi.fn(),
    defineFlow: () => vi.fn(),
    defineTool: () => vi.fn(),
    generate: vi.fn(),
  },
  getModel: vi.fn(),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {},
  adminAuth: {},
}));

import { AutoBlockEditor } from '../AutoBlockEditor';
import '@/lib/page-builder/blocks'; // register blocks

const resources: BuilderResources = { forms: [], surveys: [], agreements: [] };

describe('AutoBlockEditor', () => {
  it('shows an empty state when no block is selected', () => {
    render(<AutoBlockEditor block={null} resources={resources} onUpdateProps={() => {}} />);
    expect(screen.getByText('No block selected')).toBeInTheDocument();
  });

  it('renders a labelled control per field of the block', () => {
    const block: PageBlock = { id: 'h1', type: 'hero', props: { imageUrl: 'https://foo.jpg' } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={() => {}} />);
    expect(screen.getByLabelText('Background Image URL')).toBeInTheDocument();
  });

  it('emits a prop patch when a field changes', () => {
    const onUpdateProps = vi.fn();
    const block: PageBlock = { id: 'h1', type: 'hero', props: { imageUrl: 'https://foo.jpg' } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);
    fireEvent.change(screen.getByLabelText('Background Image URL'), { target: { value: 'https://bar.jpg' } });
    expect(onUpdateProps).toHaveBeenCalledWith('h1', { imageUrl: 'https://bar.jpg' });
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
