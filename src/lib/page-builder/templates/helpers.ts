import type { PageBlock, PageBlockType, PageSection } from '@/lib/types';

/** Build a block for a template definition. */
export function blk(id: string, type: PageBlockType, props: Record<string, unknown> = {}, children?: PageBlock[]): PageBlock {
  return children ? { id, type, props, blocks: children } : { id, type, props };
}

/** Build a section for a template definition. */
export function sec(id: string, blocks: PageBlock[], props: Record<string, unknown> = {}): PageSection {
  return { id, type: 'section', props, blocks };
}
