import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock, BuilderResources } from '@/lib/types';
import '@/lib/page-builder/blocks/list';

const mockResources: BuilderResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

describe('AutoBlockEditor List Block Presets Integration', () => {
  it('renders ListPresetSelector for list block without duplicate outer label', () => {
    const block: PageBlock = {
      id: 'list-edit-test',
      type: 'list',
      props: {
        preset: 'checklist',
        items: [
          { id: '1', title: 'Task 1', description: 'Desc 1' },
        ],
      },
    };

    render(
      <AutoBlockEditor
        block={block}
        resources={mockResources}
        onUpdateProps={() => {}}
      />
    );

    // List preset radiogroup is present
    const presetGroup = screen.getByRole('radiogroup', { name: /List Preset Style/i });
    expect(presetGroup).toBeInTheDocument();

    // Verify all 6 preset radios exist
    expect(screen.getByRole('radio', { name: /Checkmark Feature List/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Classic Bulleted List/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Numbered Steps/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Item Cards/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Minimal Dash/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Compact Pills/i })).toBeInTheDocument();
  });

  it('calls onUpdateProps when changing list preset', () => {
    const handleUpdate = vi.fn();
    const block: PageBlock = {
      id: 'list-edit-test-2',
      type: 'list',
      props: {
        preset: 'checklist',
        items: [],
      },
    };

    render(
      <AutoBlockEditor
        block={block}
        resources={mockResources}
        onUpdateProps={handleUpdate}
      />
    );

    const cardsRadio = screen.getByRole('radio', { name: /Item Cards/i });
    fireEvent.click(cardsRadio);

    expect(handleUpdate).toHaveBeenCalledWith('list-edit-test-2', { preset: 'cards' });
  });
});
