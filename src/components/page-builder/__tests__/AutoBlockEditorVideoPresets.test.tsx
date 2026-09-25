import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PageBlock } from '@/lib/types';

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
import '@/lib/page-builder/blocks/video';

describe('AutoBlockEditor Video Preset Routing', () => {
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
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
