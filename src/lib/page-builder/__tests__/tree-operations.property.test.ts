import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CampaignPageStructure, PageSection } from '@/lib/types';
import {
  moveBlock,
  reorderBlocks,
  moveBlockToSection,
  duplicateBlock,
  removeBlock,
} from '../tree-operations';

/**
 * The invariant that matters for tree safety (Risk R8): structural moves must
 * never lose or duplicate a block. We generate random structures with globally
 * unique block ids and assert the multiset of ids is preserved under moves, and
 * changes predictably under add/remove.
 */
function structureArb(): fc.Arbitrary<CampaignPageStructure> {
  return fc
    .array(fc.nat({ max: 4 }), { minLength: 1, maxLength: 4 })
    .map((blockCounts) => {
      let blockSeq = 0;
      const sections: PageSection[] = blockCounts.map((count, si) => ({
        id: `s${si}`,
        type: 'section',
        props: {},
        blocks: Array.from({ length: count }, () => {
          const id = `b${blockSeq++}`;
          return { id, type: 'text' as const, props: {} };
        }),
      }));
      return { sections };
    });
}

function blockIds(structure: CampaignPageStructure): string[] {
  return structure.sections.flatMap((s) => s.blocks.map((b) => b.id)).sort();
}

describe('tree-operations invariants', () => {
  it('moveBlock preserves the block-id multiset', () => {
    fc.assert(
      fc.property(structureArb(), fc.boolean(), (structure, down) => {
        const ids = blockIds(structure);
        const target = ids[0];
        if (!target) return; // empty structure: nothing to move
        const next = moveBlock(structure, target, down ? 'down' : 'up');
        expect(blockIds(next)).toEqual(ids);
      }),
    );
  });

  it('reorderBlocks preserves the block-id multiset', () => {
    fc.assert(
      fc.property(structureArb(), (structure) => {
        const ids = blockIds(structure);
        const section = structure.sections.find((s) => s.blocks.length > 1);
        if (!section) return;
        const next = reorderBlocks(structure, section.id, 0, section.blocks.length - 1);
        expect(blockIds(next)).toEqual(ids);
      }),
    );
  });

  it('moveBlockToSection preserves the block-id multiset', () => {
    fc.assert(
      fc.property(structureArb(), (structure) => {
        const ids = blockIds(structure);
        const from = structure.sections.find((s) => s.blocks.length > 0);
        if (!from) return;
        const to = structure.sections[structure.sections.length - 1];
        const next = moveBlockToSection(structure, from.blocks[0].id, from.id, to.id, 0);
        expect(blockIds(next)).toEqual(ids);
      }),
    );
  });

  it('duplicateBlock increases the count by exactly one with a fresh id', () => {
    fc.assert(
      fc.property(structureArb(), (structure) => {
        const ids = blockIds(structure);
        if (ids.length === 0) return;
        const next = duplicateBlock(structure, ids[0]);
        expect(blockIds(next).length).toBe(ids.length + 1);
        expect(new Set(blockIds(next)).size).toBe(ids.length + 1); // all unique
      }),
    );
  });

  it('removeBlock decreases the count by exactly one', () => {
    fc.assert(
      fc.property(structureArb(), (structure) => {
        const ids = blockIds(structure);
        if (ids.length === 0) return;
        const next = removeBlock(structure, ids[0]);
        expect(blockIds(next).length).toBe(ids.length - 1);
      }),
    );
  });
});
