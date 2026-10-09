/**
 * AutoBlockEditorPresets.test.tsx
 * Consolidated test suite for AutoBlockEditor Preset Routing, Wireframe Selectors,
 * and Progressive Disclosure across blocks (Divider, Image, List, Procedure, Video).
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PageBlock, BuilderResources } from '@/lib/types';

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
  useFirebase: () => ({ firestore: {}, auth: {} }),
}));

vi.mock('@/firebase/provider', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user-id' } }),
  useFirebase: () => ({ firestore: {}, auth: {} }),
}));

import { AutoBlockEditor } from '../AutoBlockEditor';
import '@/lib/page-builder/blocks/divider';
import '@/lib/page-builder/blocks/image';
import '@/lib/page-builder/blocks/list';
import '@/lib/page-builder/blocks/procedure-list';
import '@/lib/page-builder/blocks/video';

const mockResources: BuilderResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

describe('AutoBlockEditor Preset Routing & Progressive Disclosure', () => {
  /* --------------------------------------------------------------------------
   * 1. Divider Block
   * -------------------------------------------------------------------------- */
  describe('Divider Block Routing & Progressive Disclosure', () => {
    it('routes divider style to DividerStyleSelector and suppresses duplicate outer label', () => {
      const block: PageBlock = {
        id: 'div-test-1',
        type: 'divider',
        props: {
          style: 'solid',
          width: 'full',
        },
      };

      render(
        <AutoBlockEditor
          block={block}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Divider Style/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Solid Continuous/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Neon Glow Aura/i })).toBeInTheDocument();
    });

    it('routes width, thickness, and spacing to segmented controls', () => {
      const block: PageBlock = {
        id: 'div-test-2',
        type: 'divider',
        props: {
          style: 'solid',
          width: 'wide',
          thickness: 'hairline',
          spacing: 'medium',
        },
      };

      render(
        <AutoBlockEditor
          block={block}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Line Width/i })).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: /Stroke Thickness/i })).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: /Vertical Padding/i })).toBeInTheDocument();
    });

    it('progressively discloses badge label only when style is badge or notch', () => {
      const solidBlock: PageBlock = {
        id: 'div-solid',
        type: 'divider',
        props: {
          style: 'solid',
        },
      };

      const { rerender } = render(
        <AutoBlockEditor
          block={solidBlock}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.queryByPlaceholderText(/e\.g\. OR, CHAPTER, ✦/i)).toBeNull();

      const badgeBlock: PageBlock = {
        id: 'div-badge',
        type: 'divider',
        props: {
          style: 'badge',
          label: 'OR',
        },
      };

      rerender(
        <AutoBlockEditor
          block={badgeBlock}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.getByPlaceholderText(/e\.g\. OR, CHAPTER, ✦/i)).toBeInTheDocument();
    });

    it('progressively discloses alignment only when width is not full', () => {
      const fullBlock: PageBlock = {
        id: 'div-full',
        type: 'divider',
        props: {
          style: 'solid',
          width: 'full',
        },
      };

      const { rerender } = render(
        <AutoBlockEditor
          block={fullBlock}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.queryByRole('radiogroup', { name: /Alignment/i })).toBeNull();

      const mediumBlock: PageBlock = {
        id: 'div-medium',
        type: 'divider',
        props: {
          style: 'solid',
          width: 'medium',
        },
      };

      rerender(
        <AutoBlockEditor
          block={mediumBlock}
          resources={mockResources}
          onUpdateProps={() => {}}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /Alignment/i })).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 2. Image Block
   * -------------------------------------------------------------------------- */
  describe('Image Preset Routing', () => {
    const imageBlock: PageBlock = {
      id: 'block-img-1',
      type: 'image',
      props: {
        src: 'https://images.unsplash.com/photo-1',
        preset: 'clean-card',
        aspectRatio: '16:9',
        borderRadius: 'rounded',
        width: 'full',
        alignment: 'center',
      },
    };

    it('renders ImagePresetSelector for image preset field without duplicate label', () => {
      render(
        <AutoBlockEditor
          block={imageBlock}
          resources={mockResources}
          onUpdateProps={vi.fn()}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /image preset style/i })).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: /aspect ratio/i })).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 3. List Block
   * -------------------------------------------------------------------------- */
  describe('List Block Presets & Intro Paragraph', () => {
    const baseListBlock: PageBlock = {
      id: 'block-list-1',
      type: 'list',
      props: {
        preset: 'checklist',
        showIntroText: false,
        introTitle: '',
        introText: '',
        introAlignment: 'left',
        items: [
          { id: '1', title: 'Feature 1', description: 'Description 1' },
        ],
      },
    };

    it('renders ListPresetSelector and progressive disclosure hides intro fields when showIntroText is false', () => {
      render(
        <AutoBlockEditor
          block={baseListBlock}
          resources={mockResources}
          onUpdateProps={vi.fn()}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /list preset style/i })).toBeInTheDocument();
      expect(screen.getByText(/include intro paragraph/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/intro headline/i)).toBeNull();
      expect(screen.queryByLabelText(/^intro paragraph$/i)).toBeNull();
    });

    it('reveals intro headline, paragraph, and alignment when showIntroText is true', () => {
      const listWithIntro: PageBlock = {
        ...baseListBlock,
        props: {
          ...baseListBlock.props,
          showIntroText: true,
          introTitle: 'Welcome to the Program',
          introText: 'Lead text explaining the milestones.',
        },
      };

      render(
        <AutoBlockEditor
          block={listWithIntro}
          resources={mockResources}
          onUpdateProps={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/intro headline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^intro paragraph$/i)).toBeInTheDocument();
      expect(screen.getByText(/intro alignment/i)).toBeInTheDocument();
    });

    it('calls onUpdateProps when changing list preset or toggling intro paragraph', () => {
      const onUpdateProps = vi.fn();
      render(
        <AutoBlockEditor
          block={baseListBlock}
          resources={mockResources}
          onUpdateProps={onUpdateProps}
        />
      );

      const steppedRadio = screen.getByRole('radio', { name: /stepped gradient milestones/i });
      fireEvent.click(steppedRadio);
      expect(onUpdateProps).toHaveBeenCalledWith('block-list-1', { preset: 'stepped-gradient' });

      const introSwitch = screen.getByRole('switch', { name: /include intro paragraph/i });
      fireEvent.click(introSwitch);
      expect(onUpdateProps).toHaveBeenCalledWith('block-list-1', { showIntroText: true });
    });
  });

  /* --------------------------------------------------------------------------
   * 4. Procedure Block
   * -------------------------------------------------------------------------- */
  describe('Procedure Block Integration', () => {
    const procBlock: PageBlock = {
      id: 'test-proc-1',
      type: 'procedure_list',
      props: {
        preset: 'connected-timeline',
        title: 'Payment Steps',
        subtitle: 'Guidelines',
        steps: [
          { id: 's1', title: 'Dial *170#', description: 'Enter code', timeEstimate: '30s', badgeText: 'Step 1' },
        ],
        imageUrl: '',
        mediaPosition: 'top',
        accentColor: '#10b981',
      },
    };

    it('renders ProcedurePresetSelector with 5 miniature wireframe cards', () => {
      const onUpdateProps = vi.fn();
      render(
        <AutoBlockEditor
          block={procBlock}
          resources={mockResources}
          onUpdateProps={onUpdateProps}
        />
      );

      const radiogroup = screen.getByRole('radiogroup', { name: /procedure preset archetype/i });
      expect(radiogroup).toBeDefined();

      const options = within(radiogroup).getAllByRole('radio');
      expect(options).toHaveLength(5);

      const mediaGroup = screen.getByRole('radiogroup', { name: /media align placement/i });
      expect(mediaGroup).toBeDefined();
      expect(within(mediaGroup).getAllByRole('radio')).toHaveLength(5);
    });

    it('renders ListField for procedure steps and allows adding a step', () => {
      const onUpdateProps = vi.fn();
      render(
        <AutoBlockEditor
          block={procBlock}
          resources={mockResources}
          onUpdateProps={onUpdateProps}
        />
      );

      expect(screen.getByText('Procedure Steps')).toBeDefined();
      expect(screen.getByText('Dial *170#')).toBeDefined();

      const addBtn = screen.getByRole('button', { name: /add/i });
      expect(addBtn).toBeDefined();

      fireEvent.click(addBtn);
      expect(onUpdateProps).toHaveBeenCalledTimes(1);
      expect(onUpdateProps.mock.calls[0][0]).toBe('test-proc-1');
      expect(onUpdateProps.mock.calls[0][1].steps).toHaveLength(2);
    });
  });

  /* --------------------------------------------------------------------------
   * 5. Video Block
   * -------------------------------------------------------------------------- */
  describe('Video Preset Routing', () => {
    const videoBlock: PageBlock = {
      id: 'block-vid-1',
      type: 'video',
      props: {
        url: 'https://youtube.com/watch?v=12345678901',
        preset: 'hero-walkthrough',
        aspectRatio: '16:9',
        playButtonArchetype: 'pulse',
      },
    };

    it('renders VideoPresetSelector for video preset field and PlayButtonArchetypeSelector without duplicate outer labels', () => {
      render(
        <AutoBlockEditor
          block={videoBlock}
          resources={mockResources}
          onUpdateProps={vi.fn()}
        />
      );

      expect(screen.getByRole('radiogroup', { name: /video preset archetype/i })).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: /play button style/i })).toBeInTheDocument();
    });

    it('updates props with full archetype bundle when selecting a video preset', () => {
      const handleUpdate = vi.fn();
      render(
        <AutoBlockEditor
          block={videoBlock}
          resources={mockResources}
          onUpdateProps={handleUpdate}
        />
      );

      const ambientCard = screen.getByRole('radio', { name: /ambient background loop/i });
      fireEvent.click(ambientCard);

      expect(handleUpdate).toHaveBeenCalledWith(
        'block-vid-1',
        expect.objectContaining({
          preset: 'ambient-loop',
          autoPlay: true,
          muted: true,
          ambientGlow: true,
          overlayTint: 'dark-30',
        })
      );
    });
  });
});
