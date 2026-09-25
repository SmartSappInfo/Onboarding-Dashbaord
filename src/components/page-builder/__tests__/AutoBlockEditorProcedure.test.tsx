import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

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
import '@/lib/page-builder/blocks/procedure-list';

describe('AutoBlockEditor Procedure Block Integration', () => {
  const block: PageBlock = {
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

  const resources = {
    forms: [],
    surveys: [],
    agreements: [],
    meetings: [],
    qrCodes: [],
  };

  it('renders ProcedurePresetSelector with 5 miniature wireframe cards', () => {
    const onUpdateProps = vi.fn();
    render(
      <AutoBlockEditor
        block={block}
        resources={resources}
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
        block={block}
        resources={resources}
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
