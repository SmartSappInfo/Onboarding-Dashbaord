/**
 * Pure structural operations over a `CampaignPageStructure`.
 *
 * Every function takes a structure and returns a NEW structure (structural
 * sharing: only changed branches get new references, so React memoisation stays
 * effective). No React, no Firestore — fully unit-testable. The builder's
 * reducer delegates to these so mutation logic has a single, tested home.
 */
import type {
  CampaignPageStructure,
  PageSection,
  PageBlock,
  PageBlockType,
} from '@/lib/types';

// ─── Id generation ───────────────────────────────────────────────────────────
let idCounter = 0;

/**
 * Generate a unique id prefixed by the node type, e.g. `hero_lx9f2a3`.
 * The prefix is load-bearing: the editor derives a block's type badge from
 * `id.split('_')[0]`, so the `${prefix}_` shape must be preserved.
 */
export function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

// ─── Default block props ─────────────────────────────────────────────────────
/** Initial props applied when a block is first created, keyed by block type. */
export const DEFAULT_BLOCK_PROPS: Partial<Record<PageBlockType, Record<string, unknown>>> = {
  hero: { title: 'New Hero', subtitle: 'Describe your campaign here.' },
  text: { content: '<p>Start writing your content here...</p>' },
  cta: { label: 'Click Here', url: '', variant: 'primary' },
  image: { src: '', alt: '', caption: '' },
  video: { url: '', provider: 'youtube' },
  spacer: { height: 48 },
  divider: { style: 'solid', color: '#e2e8f0' },
  faq: { items: [] },
  testimonial: { author: '', role: '', quote: '', avatarUrl: '' },
  stats: { items: [] },
  logo_grid: { logos: [] },
};

// ─── Factories ───────────────────────────────────────────────────────────────
/** Build a fresh block of `type` with its default props and a unique id. */
export function createBlock(type: PageBlockType): PageBlock {
  return {
    id: genId(type),
    type,
    props: { ...(DEFAULT_BLOCK_PROPS[type] ?? {}) },
  };
}

/** Build a fresh section, optionally cloning a saved template's structure. */
export function createSection(template?: { structure: PageSection }): PageSection {
  if (template) {
    return { ...template.structure, id: genId('sec') };
  }
  return {
    id: genId('sec'),
    type: 'section',
    props: {},
    blocks: [],
  };
}

// ─── Section operations ──────────────────────────────────────────────────────
export function addSection(
  structure: CampaignPageStructure,
  template?: { structure: PageSection },
): CampaignPageStructure {
  return { ...structure, sections: [...structure.sections, createSection(template)] };
}

export function removeSection(
  structure: CampaignPageStructure,
  sectionId: string,
): CampaignPageStructure {
  return { ...structure, sections: structure.sections.filter((s) => s.id !== sectionId) };
}

export function moveSection(
  structure: CampaignPageStructure,
  sectionId: string,
  direction: 'up' | 'down',
): CampaignPageStructure {
  const sections = [...structure.sections];
  const index = sections.findIndex((s) => s.id === sectionId);
  if (index === -1) return structure;
  if (direction === 'up' && index === 0) return structure;
  if (direction === 'down' && index === sections.length - 1) return structure;
  const target = direction === 'up' ? index - 1 : index + 1;
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...structure, sections };
}

export function reorderSections(
  structure: CampaignPageStructure,
  fromIndex: number,
  toIndex: number,
): CampaignPageStructure {
  const sections = [...structure.sections];
  const [moved] = sections.splice(fromIndex, 1);
  if (!moved) return structure;
  sections.splice(toIndex, 0, moved);
  return { ...structure, sections };
}

export function updateSectionProps(
  structure: CampaignPageStructure,
  sectionId: string,
  newProps: Record<string, unknown>,
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((s) =>
      s.id === sectionId ? { ...s, props: { ...s.props, ...newProps } } : s,
    ),
  };
}

// ─── Block operations ────────────────────────────────────────────────────────
/**
 * Insert an existing block. When the structure has no sections, a section is
 * created to hold it; otherwise the block is appended to the section at
 * `sectionIndex` (defaulting to the first, clamped to range).
 */
export function insertBlock(
  structure: CampaignPageStructure,
  block: PageBlock,
  sectionIndex?: number,
): CampaignPageStructure {
  if (structure.sections.length === 0) {
    return {
      ...structure,
      sections: [{ id: genId('sec'), type: 'section', props: {}, blocks: [block] }],
    };
  }
  const targetIdx = sectionIndex ?? 0;
  const idx = Math.min(Math.max(targetIdx, 0), structure.sections.length - 1);
  return {
    ...structure,
    sections: structure.sections.map((section, i) =>
      i === idx ? { ...section, blocks: [...section.blocks, block] } : section,
    ),
  };
}

export function removeBlock(
  structure: CampaignPageStructure,
  blockId: string,
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((s) => ({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== blockId),
    })),
  };
}

export function updateBlockProps(
  structure: CampaignPageStructure,
  blockId: string,
  newProps: Record<string, unknown>,
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, props: { ...b.props, ...newProps } } : b,
      ),
    })),
  };
}

export function moveBlock(
  structure: CampaignPageStructure,
  blockId: string,
  direction: 'up' | 'down',
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((section) => {
      const blocks = [...section.blocks];
      const index = blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return section;
      if (direction === 'up' && index === 0) return section;
      if (direction === 'down' && index === blocks.length - 1) return section;
      const target = direction === 'up' ? index - 1 : index + 1;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...section, blocks };
    }),
  };
}

export function reorderBlocks(
  structure: CampaignPageStructure,
  sectionId: string,
  fromIndex: number,
  toIndex: number,
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const blocks = [...section.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      if (!moved) return section;
      blocks.splice(toIndex, 0, moved);
      return { ...section, blocks };
    }),
  };
}

/** Move a block from one section to a position in another (or the same) section. */
export function moveBlockToSection(
  structure: CampaignPageStructure,
  blockId: string,
  fromSectionId: string,
  toSectionId: string,
  toIndex: number,
): CampaignPageStructure {
  let moved: PageBlock | null = null;
  const without = structure.sections.map((section) => {
    if (section.id !== fromSectionId) return section;
    const found = section.blocks.find((b) => b.id === blockId);
    if (found) moved = found;
    return { ...section, blocks: section.blocks.filter((b) => b.id !== blockId) };
  });
  if (moved === null) return structure;
  const movedBlock: PageBlock = moved;
  return {
    ...structure,
    sections: without.map((section) => {
      if (section.id !== toSectionId) return section;
      const blocks = [...section.blocks];
      blocks.splice(toIndex, 0, movedBlock);
      return { ...section, blocks };
    }),
  };
}

/** Duplicate a block, inserting a deep clone (new id) directly after the source. */
export function duplicateBlock(
  structure: CampaignPageStructure,
  blockId: string,
): CampaignPageStructure {
  return {
    ...structure,
    sections: structure.sections.map((section) => {
      const idx = section.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return section;
      const original = section.blocks[idx];
      const clone: PageBlock = {
        ...structuredClone(original),
        id: genId(original.type),
      };
      const blocks = [...section.blocks];
      blocks.splice(idx + 1, 0, clone);
      return { ...section, blocks };
    }),
  };
}

/** Locate a block and its containing section, or `null` if absent. */
export function findBlock(
  structure: CampaignPageStructure,
  blockId: string,
): { block: PageBlock; section: PageSection } | null {
  for (const section of structure.sections) {
    const block = section.blocks.find((b) => b.id === blockId);
    if (block) return { block, section };
  }
  return null;
}
