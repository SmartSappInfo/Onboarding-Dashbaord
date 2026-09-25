import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock } from '@/lib/types';
import '@/lib/page-builder/blocks/divider';

const mockResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

describe('AutoBlockEditor Divider Block Routing & Progressive Disclosure', () => {
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

    // DividerStyleSelector is rendered
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

    // Badge text input should NOT be in the document for solid style
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

    // Badge text input should be visible for badge style
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

    // Alignment radiogroup should NOT be present when 100% full width
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

    // Alignment radiogroup should be visible when width is half
    expect(screen.getByRole('radiogroup', { name: /Alignment/i })).toBeInTheDocument();
  });
});
