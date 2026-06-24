import { describe, it, expect } from 'vitest';
import type { CampaignPageStructure } from '@/lib/types';
import {
  addSection,
  removeSection,
  moveSection,
  reorderSections,
  updateSectionProps,
  createBlock,
  insertBlock,
  removeBlock,
  updateBlockProps,
  moveBlock,
  reorderBlocks,
  moveBlockToSection,
  duplicateBlock,
  findBlock,
} from '../tree-operations';

function base(): CampaignPageStructure {
  return {
    sections: [
      {
        id: 's1',
        type: 'section',
        props: {},
        blocks: [
          { id: 'b1', type: 'text', props: { content: 'x' } },
          { id: 'b2', type: 'cta', props: { label: 'go' } },
        ],
      },
      { id: 's2', type: 'section', props: {}, blocks: [] },
    ],
  };
}

describe('section operations', () => {
  it('addSection appends a new empty section without mutating the input', () => {
    const input = base();
    const next = addSection(input);
    expect(next.sections).toHaveLength(3);
    expect(next.sections[2].blocks).toEqual([]);
    expect(input.sections).toHaveLength(2); // immutability
  });

  it('removeSection drops the matching section', () => {
    const next = removeSection(base(), 's1');
    expect(next.sections.map((s) => s.id)).toEqual(['s2']);
  });

  it('moveSection up swaps with the previous section', () => {
    const next = moveSection(base(), 's2', 'up');
    expect(next.sections.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('moveSection is a no-op at the boundary', () => {
    const next = moveSection(base(), 's1', 'up');
    expect(next.sections.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('reorderSections moves a section by index', () => {
    const next = reorderSections(base(), 0, 1);
    expect(next.sections.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('updateSectionProps merges props', () => {
    const next = updateSectionProps(base(), 's1', { background: 'muted' });
    expect(next.sections[0].props).toEqual({ background: 'muted' });
  });
});

describe('block operations', () => {
  it('createBlock produces a typed block with default props and a prefixed id', () => {
    const block = createBlock('hero');
    expect(block.type).toBe('hero');
    expect(block.id.split('_')[0]).toBe('hero');
    expect(block.props).toMatchObject({ title: 'New Hero' });
  });

  it('insertBlock appends to the target section', () => {
    const block = createBlock('image');
    const next = insertBlock(base(), block, 1);
    expect(next.sections[1].blocks).toHaveLength(1);
    expect(next.sections[1].blocks[0].id).toBe(block.id);
  });

  it('insertBlock creates a section when none exist', () => {
    const block = createBlock('text');
    const next = insertBlock({ sections: [] }, block);
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0].blocks[0].id).toBe(block.id);
  });

  it('removeBlock removes the block from its section', () => {
    const next = removeBlock(base(), 'b1');
    expect(next.sections[0].blocks.map((b) => b.id)).toEqual(['b2']);
  });

  it('updateBlockProps merges props on the matching block only', () => {
    const next = updateBlockProps(base(), 'b1', { content: 'y' });
    expect(next.sections[0].blocks[0].props).toEqual({ content: 'y' });
    expect(next.sections[0].blocks[1].props).toEqual({ label: 'go' });
  });

  it('moveBlock down swaps with the next block', () => {
    const next = moveBlock(base(), 'b1', 'down');
    expect(next.sections[0].blocks.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('reorderBlocks moves a block within its section by index', () => {
    const next = reorderBlocks(base(), 's1', 1, 0);
    expect(next.sections[0].blocks.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('moveBlockToSection preserves total block count (no loss or dupe)', () => {
    const before = base().sections.flatMap((s) => s.blocks).length;
    const next = moveBlockToSection(base(), 'b1', 's1', 's2', 0);
    const after = next.sections.flatMap((s) => s.blocks).length;
    expect(after).toBe(before);
    expect(next.sections[1].blocks[0].id).toBe('b1');
    expect(next.sections[0].blocks.map((b) => b.id)).toEqual(['b2']);
  });

  it('moveBlockToSection is a no-op for an unknown block', () => {
    const next = moveBlockToSection(base(), 'nope', 's1', 's2', 0);
    expect(next).toEqual(base());
  });

  it('duplicateBlock inserts a clone with a new id directly after the source', () => {
    const next = duplicateBlock(base(), 'b1');
    expect(next.sections[0].blocks).toHaveLength(3);
    expect(next.sections[0].blocks[1].id).not.toBe('b1');
    expect(next.sections[0].blocks[1].props).toEqual({ content: 'x' });
  });

  it('findBlock returns the block and its section', () => {
    const found = findBlock(base(), 'b2');
    expect(found?.block.id).toBe('b2');
    expect(found?.section.id).toBe('s1');
  });

  it('findBlock returns null when absent', () => {
    expect(findBlock(base(), 'nope')).toBeNull();
  });
});
