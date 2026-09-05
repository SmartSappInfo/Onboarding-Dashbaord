// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via MemoryConsolidationEngine on server.

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Memory Consolidation Genkit Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Memory Knowledge Synthesis:
 *    - Synthesizes 2 to 5 overlapping memory fragments into a single canonical, durable memory.
 * 2. Information Preservation:
 *    - Ensures all distinct data points (pricing figures, dates, entity names, policies) are retained.
 * 3. Resilient Deterministic Fallback:
 *    - Provides a bullet-proof rule-based fallback if Genkit / Gemini API is unreachable.
 * 4. Strict Zero-`any` Standard:
 *    - All schemas and types are enforced with Zod.
 *
 * @testability Covered in `src/lib/memory/__tests__/memory-consolidation.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type { MemoryType } from '@/lib/memory/types';

export const memoryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.string(),
  topics: z.array(z.string()).optional(),
  entityNames: z.array(z.string()).optional(),
});

export const consolidateMemoriesInputSchema = z.object({
  workspaceId: z.string().optional().describe('Active workspace ID for model routing'),
  memories: z.array(memoryItemSchema).min(2).max(10).describe('Cluster of overlapping memory items to synthesize'),
  contextDomain: z.string().optional().describe('Commercial or operational domain context'),
});

export type ConsolidateMemoriesInput = z.infer<typeof consolidateMemoriesInputSchema>;

export const consolidateMemoriesOutputSchema = z.object({
  proposedTitle: z.string().describe('Clear, concise canonical title for the consolidated memory'),
  proposedContent: z.string().describe('Synthesized, comprehensive memory text retaining all core facts without duplication'),
  proposedType: z.string().describe('Canonical MemoryType for this consolidated knowledge (fact, decision, insight, etc.)'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0 of the synthesis quality'),
  reasoning: z.string().describe('Clear rationale for how the input memories were consolidated'),
  synthesizedTopics: z.array(z.string()).describe('Deduplicated high-level topics representing the consolidated memory'),
  synthesizedEntityNames: z.array(z.string()).describe('Deduplicated entity names referenced in the consolidated memory'),
});

export type ConsolidateMemoriesOutput = z.infer<typeof consolidateMemoriesOutputSchema>;

/**
 * Deterministic fallback when Gemini API key is missing or rate-limited.
 */
export function consolidateMemoriesDeterministic(
  input: ConsolidateMemoriesInput
): ConsolidateMemoriesOutput {
  const { memories } = input;
  const first = memories[0];

  // Merge unique sentences across all memories
  const sentenceSet = new Set<string>();
  const topicSet = new Set<string>();
  const entitySet = new Set<string>();

  for (const mem of memories) {
    const sentences = mem.content.split(/(?<=[.?!])\s+/);
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed.length > 5) sentenceSet.add(trimmed);
    }
    if (mem.topics) {
      for (const t of mem.topics) topicSet.add(t.toLowerCase());
    }
    if (mem.entityNames) {
      for (const e of mem.entityNames) entitySet.add(e);
    }
  }

  const synthesizedContent = Array.from(sentenceSet).join(' ');
  const synthesizedTopics = Array.from(topicSet);
  const synthesizedEntityNames = Array.from(entitySet);

  return {
    proposedTitle: first.title.startsWith('Consolidated:')
      ? first.title
      : `Consolidated: ${first.title}`,
    proposedContent: synthesizedContent || first.content,
    proposedType: (first.type as MemoryType) || 'fact',
    confidenceScore: 0.85,
    reasoning: `Rule-based consolidation merged ${memories.length} related memory items and deduplicated distinct assertions.`,
    synthesizedTopics,
    synthesizedEntityNames,
  };
}

/**
 * Genkit Flow for synthesizing multiple memories into a canonical truth item.
 */
export const consolidateMemoriesFlow = ai.defineFlow(
  {
    name: 'consolidateMemoriesFlow',
    inputSchema: consolidateMemoriesInputSchema,
    outputSchema: consolidateMemoriesOutputSchema,
  },
  async (input: ConsolidateMemoriesInput): Promise<ConsolidateMemoriesOutput> => {
    // Check for API key availability
    const hasApiKey =
      Boolean(process.env.GEMINI_API_KEY) ||
      Boolean(process.env.GOOGLE_GENAI_API_KEY);

    if (!hasApiKey) {
      return consolidateMemoriesDeterministic(input);
    }

    try {
      const memorySummaries = input.memories
        .map(
          (m, idx) =>
            `[Memory ${idx + 1}] ID: ${m.id}\nType: ${m.type}\nTitle: ${m.title}\nContent: "${m.content}"\nTopics: ${(m.topics || []).join(', ')}`
        )
        .join('\n\n');

      const prompt = `You are the Principal Memory Architect for CompanyBrain.
Analyze the following ${input.memories.length} organizational memory fragments and synthesize them into a single, high-fidelity canonical memory.

Guidelines:
1. Merge complementary and overlapping details into a unified narrative.
2. Retain all specific numbers, metrics, pricing, dates, and named entities.
3. Remove redundant chatter, greeting phrases, or repeated statements.
4. Select the most accurate MemoryType (e.g. 'fact', 'decision', 'insight', 'preference').
5. Provide a crisp canonical title and an explanatory rationale.

${input.contextDomain ? `Domain Context: ${input.contextDomain}\n\n` : ''}Memory Fragments:
${memorySummaries}`;

      const { modelString, customAi } = await getModel({
        workspaceId: input.workspaceId,
        tier: 'reasoning',
      });
      const generator = customAi || ai;
      const { output } = await generator.generate({
        model: modelString,
        prompt,
        output: { schema: consolidateMemoriesOutputSchema },
        config: { temperature: 0.2 },
      });

      if (!output) {
        return consolidateMemoriesDeterministic(input);
      }

      return output;
    } catch (err) {
      console.warn('[consolidateMemoriesFlow] LLM error, falling back to deterministic synthesis:', err);
      return consolidateMemoriesDeterministic(input);
    }
  }
);
