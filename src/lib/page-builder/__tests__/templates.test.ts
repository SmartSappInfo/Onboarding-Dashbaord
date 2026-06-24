import { describe, it, expect } from 'vitest';
import type { CampaignPageStructure, PageBlock } from '@/lib/types';
import { pageStructureSchema } from '../schema';
import { getBlock } from '../registry';
import '../blocks'; // register blocks
import { ALL_TEMPLATES } from '../templates';

const VALID_GOALS = ['lead_capture', 'registration', 'information', 'payment', 'thank_you'];

function flattenBlocks(structure: CampaignPageStructure): PageBlock[] {
  const out: PageBlock[] = [];
  const walk = (blocks: PageBlock[]) => {
    for (const b of blocks) {
      out.push(b);
      if (b.blocks) walk(b.blocks);
    }
  };
  for (const section of structure.sections) walk(section.blocks);
  return out;
}

describe('template library', () => {
  it('has at least one template per vertical and unique ids', () => {
    expect(ALL_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    const ids = ALL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const template of ALL_TEMPLATES) {
    describe(template.id, () => {
      it('has a valid goal', () => {
        expect(VALID_GOALS).toContain(template.goal);
      });

      it('passes the page structure schema', () => {
        expect(pageStructureSchema.safeParse(template.structureJson).success).toBe(true);
      });

      it('references only registered block types', () => {
        for (const block of flattenBlocks(template.structureJson)) {
          expect(getBlock(block.type), `${template.id}: block "${block.type}" is not registered`).toBeDefined();
        }
      });

      it('has unique block ids', () => {
        const ids = flattenBlocks(template.structureJson).map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
      });
    });
  }
});
