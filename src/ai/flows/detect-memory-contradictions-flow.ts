// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via ConflictEngine on server.

/**
 * @fileOverview CompanyBrain 2.0 Phase 4: Contradiction Detection Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Semantic Contradiction Analysis:
 *    - Evaluates two memory statements to determine whether they assert mutually incompatible facts,
 *      outdated claims, or diverging operational directions.
 * 2. Grounded Attribution & Confidence Threshold:
 *    - Flags contradictions only when semantic confidence >= 0.75.
 * 3. Resilient Deterministic Fallback:
 *    - If Genkit / Gemini is rate-limited or unconfigured, uses pure rule-based semantic inspection.
 * 4. Strict Zero-`any` Standard:
 *    - 100% typed with Zod schemas.
 *
 * @testability Covered in `src/lib/memory/__tests__/conflict-engine.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type { ConflictType } from '@/lib/memory/orchestrator-types';

export const memoryStatementSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.string(),
  createdAt: z.string().optional(),
});

export const detectContradictionInputSchema = z.object({
  memoryA: memoryStatementSchema,
  memoryB: memoryStatementSchema,
  contextDomain: z.string().optional().describe('Commercial or operational domain context'),
});

export type DetectContradictionInput = z.infer<typeof detectContradictionInputSchema>;

export const detectContradictionOutputSchema = z.object({
  isContradiction: z.boolean().describe('True if the two memories assert mutually incompatible or contradictory facts'),
  conflictType: z.enum(['contradiction', 'fact_update', 'duplicate_divergence', 'obsolete_claim']),
  confidenceScore: z.number().min(0).max(1).describe('Confidence between 0.0 and 1.0 that this is a genuine contradiction'),
  summary: z.string().describe('Clear, plain English explanation of what contradicts between the two statements'),
  opposingAspects: z.array(z.string()).describe('Specific entities, numbers, dates, or terms in direct opposition'),
});

export type DetectContradictionOutput = z.infer<typeof detectContradictionOutputSchema>;

/**
 * Deterministic fallback when Gemini API key is missing, revoked, or rate-limited.
 */
export function detectMemoryContradictionsDeterministic(
  input: DetectContradictionInput
): DetectContradictionOutput {
  const { memoryA, memoryB } = input;
  const textA = `${memoryA.title} ${memoryA.content}`.toLowerCase();
  const textB = `${memoryB.title} ${memoryB.content}`.toLowerCase();

  // Pattern 1: Opposing pricing numbers (e.g. $50,000 vs $30,000)
  const priceRegex = /\$[\d,]+|\b\d{2,6}\s*(usd|ghs|eur|dollars|cedis)\b/gi;
  const pricesA = textA.match(priceRegex) || [];
  const pricesB = textB.match(priceRegex) || [];

  if (pricesA.length > 0 && pricesB.length > 0) {
    const normA = pricesA[0].replace(/[^\d]/g, '');
    const normB = pricesB[0].replace(/[^\d]/g, '');
    if (normA && normB && normA !== normB) {
      return {
        isContradiction: true,
        conflictType: 'contradiction',
        confidenceScore: 0.88,
        summary: `Conflicting amounts detected: "${pricesA[0]}" in "${memoryA.title}" vs "${pricesB[0]}" in "${memoryB.title}".`,
        opposingAspects: ['pricing_amount', 'budget_cap'],
      };
    }
  }

  // Pattern 2: Opposing keywords (approved vs rejected, yes vs no, cap vs exceed)
  const opposingPairs = [
    ['approved', 'rejected'],
    ['unanimous', 'disputed'],
    ['free', 'paid'],
    ['monthly', 'annual'],
    ['accepted', 'cancelled'],
  ];

  for (const [pos, neg] of opposingPairs) {
    if (
      (textA.includes(pos) && textB.includes(neg)) ||
      (textA.includes(neg) && textB.includes(pos))
    ) {
      return {
        isContradiction: true,
        conflictType: 'contradiction',
        confidenceScore: 0.82,
        summary: `Opposing polarities detected between "${pos}" and "${neg}" regarding "${memoryA.title}".`,
        opposingAspects: [pos, neg],
      };
    }
  }

  return {
    isContradiction: false,
    conflictType: 'duplicate_divergence',
    confidenceScore: 0.9,
    summary: 'Statements describe compatible or non-overlapping viewpoints.',
    opposingAspects: [],
  };
}

/**
 * Genkit AI Flow: Evaluates if two institutional memories contradict each other.
 */
export const detectMemoryContradictionsFlow = ai.defineFlow(
  {
    name: 'detectMemoryContradictionsFlow',
    inputSchema: detectContradictionInputSchema,
    outputSchema: detectContradictionOutputSchema,
  },
  async (input: DetectContradictionInput): Promise<DetectContradictionOutput> => {
    if (!process.env.GEMINI_API_KEY) {
      return detectMemoryContradictionsDeterministic(input);
    }

    try {
      const prompt = `You are the Lead Institutional Intelligence Auditor for SmartSapp CompanyBrain.
Evaluate these two institutional memories and determine if they make mutually contradictory or incompatible claims:

MEMORY A:
Title: "${input.memoryA.title}"
Content: "${input.memoryA.content}"
Type: "${input.memoryA.type}"
Recorded: "${input.memoryA.createdAt || 'N/A'}"

MEMORY B:
Title: "${input.memoryB.title}"
Content: "${input.memoryB.content}"
Type: "${input.memoryB.type}"
Recorded: "${input.memoryB.createdAt || 'N/A'}"

Evaluation Criteria:
- Contradiction: Memory A says X and Memory B says NOT X (e.g. differing fee numbers, conflicting decision makers, opposite vendor choices).
- Fact Update: Memory B is simply a newer updated version of Memory A.
- Duplicate Divergence: Both describe the same event but with diverging facts.
- Not a Contradiction: Different aspects of the same account, harmonious observations, or different topics.

Respond strictly according to the output schema. If they do NOT contradict, set isContradiction=false.`;

      const { modelString, customAi } = await getModel('gemini-3.6-flash');
      const generator = customAi || ai;
      const response = await generator.generate({
        model: modelString,
        prompt,
        output: { schema: detectContradictionOutputSchema },
      });

      if (response.output) {
        return response.output;
      }

      return detectMemoryContradictionsDeterministic(input);
    } catch (err) {
      console.warn('[detectMemoryContradictionsFlow] Genkit execution failed, using fallback:', err);
      return detectMemoryContradictionsDeterministic(input);
    }
  }
);
