/**
 * Runtime validation for page structures.
 *
 * `parseStructure` is the resilient boundary used when loading author content
 * from Firestore: it NEVER throws (Risk R4). Malformed or partial data resolves
 * to a safe, renderable structure rather than crashing the page. Block `type`
 * is intentionally validated as a free string — the renderer falls back
 * gracefully for unknown/future block types instead of rejecting the page.
 */
import { z } from 'zod';
import type { CampaignPageStructure } from '@/lib/types';

const blockSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.unknown()).default({}),
    blocks: z.array(blockSchema).optional(),
  }),
);

export const pageSectionSchema = z.object({
  id: z.string(),
  type: z.literal('section'),
  props: z.record(z.unknown()).default({}),
  blocks: z.array(blockSchema).default([]),
});

export const pageStructureSchema = z.object({
  sections: z.array(pageSectionSchema).default([]),
});

const EMPTY_STRUCTURE: CampaignPageStructure = { sections: [] };

/** Validate and normalize raw structure data; returns an empty structure on failure. */
export function parseStructure(raw: unknown): CampaignPageStructure {
  const result = pageStructureSchema.safeParse(raw);
  if (result.success) {
    return result.data as unknown as CampaignPageStructure;
  }
  return EMPTY_STRUCTURE;
}
