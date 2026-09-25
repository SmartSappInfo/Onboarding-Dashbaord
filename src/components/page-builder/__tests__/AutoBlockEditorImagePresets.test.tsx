import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

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
vi.mock('@/firebase/provider', () => ({
  useFirebase: () => ({ firestore: {}, auth: {} }),
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'test-user-id' } }),
}));

import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock } from '@/lib/types';
import '@/lib/page-builder/blocks/image';

describe('AutoBlockEditor Image Preset Routing', () => {
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
        onUpdateProps={vi.fn()}
      />
    );

    expect(screen.getByRole('radiogroup', { name: /image preset style/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /aspect ratio/i })).toBeInTheDocument();
  });
});
