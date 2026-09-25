import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { getBlock } from '@/lib/page-builder/registry';
import { BlockRenderer } from '../BlockRenderer';
import { AutoBlockEditor } from '../AutoBlockEditor';
import type { PageBlock } from '@/lib/types';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import { resolveTheme } from '@/lib/page-builder/resolve-theme';
import '@/lib/page-builder/blocks/text';

const mockCtx: BlockRenderContext = {
  mode: 'view',
  theme: resolveTheme(),
  interpolate: (t) => t,
  resources: { forms: [], surveys: [], agreements: [] },
};

const mockResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

describe('Rich Text Block Alignment & Line Spacing', () => {
  const textDef = getBlock('text')!;

  it('exposes textAlign and lineHeight in block definition fields', () => {
    expect(textDef).toBeDefined();
    const fieldKeys = textDef.fields.map((f) => f.key);
    expect(fieldKeys).toContain('textAlign');
    expect(fieldKeys).toContain('lineHeight');
  });

  it('safely parses legacy text blocks with defaults for textAlign and lineHeight', () => {
    const legacyProps = {
      content: '<p>Legacy paragraph</p>',
    };

    const parsed = textDef.schema.safeParse(legacyProps);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.textAlign).toBe('left');
      expect(parsed.data.lineHeight).toBe('normal');
    }
  });

  it('injects text-align and line-height CSS rules into runtime container', () => {
    const block: PageBlock = {
      id: 'txt-align-lead',
      type: 'text',
      props: {
        content: '<p>Centered relaxed paragraph</p>',
        textAlign: 'center',
        lineHeight: 'relaxed',
      },
    };

    const { container } = render(<BlockRenderer block={block} ctx={mockCtx} />);
    const styleTag = container.querySelector('style');
    expect(styleTag).toBeInTheDocument();
    const cssText = styleTag?.innerHTML || '';
    expect(cssText).toContain('text-align: center !important');
    expect(cssText).toContain('line-height: 1.75 !important');
  });

  it('renders alignment and line spacing controls in AutoBlockEditor', () => {
    const block: PageBlock = {
      id: 'txt-editor-test',
      type: 'text',
      props: {
        content: '<p>Editor test</p>',
        textAlign: 'left',
        lineHeight: 'normal',
      },
    };

    render(
      <AutoBlockEditor
        block={block}
        resources={mockResources}
        onUpdateProps={() => {}}
      />
    );

    // Alignment radiogroup with left, center, right, justify
    expect(screen.getByRole('radiogroup', { name: /Text Alignment/i })).toBeInTheDocument();
    // Line spacing radiogroup with tight, normal, relaxed, loose
    expect(screen.getByRole('radiogroup', { name: /Line Spacing/i })).toBeInTheDocument();
  });
});
