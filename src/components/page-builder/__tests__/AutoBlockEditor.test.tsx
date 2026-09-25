import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user-id' } }),
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
    const block: PageBlock = { id: 'h1', type: 'hero', props: { lightRaysEnabled: false } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={() => {}} />);
    expect(screen.getByText('Enable Light Rays')).toBeInTheDocument();
  });

  it('emits a prop patch when a field changes', () => {
    const onUpdateProps = vi.fn();
    const block: PageBlock = { id: 'h1', type: 'hero', props: { lightRaysEnabled: false } };
    render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Light Rays' }));
    expect(onUpdateProps).toHaveBeenCalledWith('h1', { lightRaysEnabled: true });
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

  describe('Title Block Enhancements', () => {
    it('correctly formats the header title without duplicate "Block Block"', () => {
      const block: PageBlock = { id: 't1', type: 'title', props: { preset: 'section-heading' } };
      render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={() => {}} />);
      expect(screen.getByText('Title Block')).toBeInTheDocument();
      expect(screen.queryByText('Title Block Block')).not.toBeInTheDocument();
    });

    it('renders miniature visual preset style thumbnails and allows selection', () => {
      const onUpdateProps = vi.fn();
      const block: PageBlock = { id: 't1', type: 'title', props: { preset: 'section-heading' } };
      render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);

      // Radiogroup for preset styles
      const presetGroup = screen.getByRole('radiogroup', { name: 'Preset Style' });
      expect(presetGroup).toBeInTheDocument();

      // Find and click 'Hero Headline'
      const heroButton = screen.getByRole('radio', { name: /Hero Headline/i });
      expect(heroButton).toBeInTheDocument();
      fireEvent.click(heroButton);

      expect(onUpdateProps).toHaveBeenCalledWith('t1', { preset: 'hero-title' });
    });

    it('renders segmented alignment options and allows selection', () => {
      const onUpdateProps = vi.fn();
      const block: PageBlock = { id: 't1', type: 'title', props: { alignment: 'center' } };
      render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={onUpdateProps} />);

      const alignGroup = screen.getByRole('radiogroup', { name: 'Text Alignment' });
      expect(alignGroup).toBeInTheDocument();

      const leftButton = within(alignGroup).getByRole('radio', { name: /^Left$/i });
      fireEvent.click(leftButton);

      expect(onUpdateProps).toHaveBeenCalledWith('t1', { alignment: 'left' });
    });

    it('renders size sliders for typography sizes and suppresses duplicate outer labels', () => {
      const block: PageBlock = { id: 't1', type: 'title', props: { customTitleSize: 'default' } };
      render(<AutoBlockEditor block={block} resources={resources} onUpdateProps={() => {}} />);

      // Should render size sliders with their own internal headers
      const headlineSliders = screen.getAllByRole('slider');
      expect(headlineSliders.length).toBeGreaterThan(0);
      expect(screen.getByText(/headline size/i)).toBeInTheDocument();
    });

    it('conditionally hides gradientColor when useGradient is false', () => {
      const blockWithoutGradient: PageBlock = {
        id: 't1',
        type: 'title',
        props: { useGradient: false },
      };
      const { rerender } = render(
        <AutoBlockEditor block={blockWithoutGradient} resources={resources} onUpdateProps={() => {}} />
      );

      expect(screen.queryByText('Gradient Accent Color')).not.toBeInTheDocument();

      const blockWithGradient: PageBlock = {
        id: 't1',
        type: 'title',
        props: { useGradient: true },
      };
      rerender(
        <AutoBlockEditor block={blockWithGradient} resources={resources} onUpdateProps={() => {}} />
      );

      expect(screen.getByText('Gradient Accent Color')).toBeInTheDocument();
    });
  });
});
