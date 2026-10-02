/**
 * @fileOverview Evidence Pack Compiler & XML Serializer (Phase 4 Milestone 2)
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 13, 16, 21, 30):
 * 1. Provenance Citations: Generates human-readable citation strings for every item (Rule 16).
 * 2. Deduplication: Suppresses duplicate items based on unique ID and content (Rule 22).
 * 3. XML Isolation Container: Wraps untrusted retrieved data in <untrusted_reference_data> (Rule 30).
 * 4. Zero-`any` typing with strict contracts and interfaces.
 *
 * @testability Covered in `src/platform/__tests__/memory/evidence-compiler.test.ts`.
 */

import { wrapUntrustedReference } from '../governance/anti-poisoning';
import { SensitivityLevel } from '../contracts/memory-types';

export interface EvidenceItemInput {
  id: string;
  content: string;
  sourceType: string;
  sourceId: string;
  authorName?: string;
  createdAt: string;
  confidence?: number;
  sensitivity?: SensitivityLevel;
  sourceHash?: string;
}

export interface EvidenceCitation {
  itemId: string;
  citationText: string;
  sourceType: string;
  sourceId: string;
  timestamp: string;
}

export interface EvidencePack {
  objective: string;
  organizationId: string;
  workspaceId: string;
  items: EvidenceItemInput[];
  citations: EvidenceCitation[];
  promptContext: string;
  itemCount: number;
  compiledAt: string;
}

export function compileEvidencePack(options: {
  items: EvidenceItemInput[];
  objective: string;
  organizationId: string;
  workspaceId: string;
}): EvidencePack {
  const { items, objective, organizationId, workspaceId } = options;

  // Deduplicate items by ID and content/source hash
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  const dedupedItems: EvidenceItemInput[] = [];

  for (const item of items) {
    const hash = item.sourceHash || item.content.trim().toLowerCase();
    if (!seenIds.has(item.id) && !seenHashes.has(hash)) {
      seenIds.add(item.id);
      seenHashes.add(hash);
      dedupedItems.push(item);
    }
  }

  // Generate citations
  const citations: EvidenceCitation[] = dedupedItems.map((item) => {
    const author = item.authorName ? ` by ${item.authorName}` : '';
    return {
      itemId: item.id,
      citationText: `[${item.sourceType}: ${item.sourceId}${author}]`,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      timestamp: item.createdAt,
    };
  });

  // Build prompt context with XML isolation containers (Rule 30)
  const xmlBlocks = dedupedItems.map((item) =>
    wrapUntrustedReference({
      content: item.content,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      sensitivity: item.sensitivity,
    })
  );

  const promptContext = xmlBlocks.join('\n\n');

  return {
    objective,
    organizationId,
    workspaceId,
    items: dedupedItems,
    citations,
    promptContext,
    itemCount: dedupedItems.length,
    compiledAt: new Date().toISOString(),
  };
}
