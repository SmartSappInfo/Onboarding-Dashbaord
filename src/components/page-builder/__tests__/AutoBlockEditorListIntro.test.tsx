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
import '@/lib/page-builder/blocks/list';

describe('AutoBlockEditor List Intro Paragraph & Progressive Disclosure', () => {
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
        onUpdateProps={vi.fn()}
      />
    );

    // List preset wireframe selector should be present
    expect(screen.getByRole('radiogroup', { name: /list preset style/i })).toBeInTheDocument();

    // Include Intro Paragraph toggle should be present
    expect(screen.getByText(/include intro paragraph/i)).toBeInTheDocument();

    // Intro headline and paragraph should be hidden by progressive disclosure
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
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
        resources={{ forms: [], surveys: [], agreements: [], meetings: [], qrCodes: [] }}
        onUpdateProps={onUpdateProps}
      />
    );

    // Click on Stepped Gradient Milestones preset radio
    const steppedRadio = screen.getByRole('radio', { name: /stepped gradient milestones/i });
    fireEvent.click(steppedRadio);
    expect(onUpdateProps).toHaveBeenCalledWith('block-list-1', { preset: 'stepped-gradient' });

    // Click on the Include Intro Paragraph switch
    const introSwitch = screen.getByRole('switch', { name: /include intro paragraph/i });
    fireEvent.click(introSwitch);
    expect(onUpdateProps).toHaveBeenCalledWith('block-list-1', { showIntroText: true });
  });
});
