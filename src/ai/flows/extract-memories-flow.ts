// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via NoteMemoryPipeline on server.

/**
 * @fileOverview CompanyBrain 2.0: AI Memory Extraction Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Memory & Entity Extraction:
 *    - Ingests raw note text and decomposes it into:
 *      * Executive Summary & Sentiment
 *      * Topical classification tags (topics)
 *      * CRM Entity mentions (schools, contacts, deals)
 *      * Atomic memory candidates (insight, decision, problem, opportunity, risk, observation, action_item)
 *        each with verbatim evidence citations and confidence scores.
 * 2. Token Bounding & Guardrails:
 *    - Notes are capped at 20,000 characters to prevent token exhaustion.
 *    - Short notes (< 15 words) return early with clean empty candidates.
 * 3. Strict Zero-`any` typing:
 *    - Zod schemas validate both input and LLM output.
 *
 * @testability Tested via `src/lib/memory/__tests__/memory-pipeline.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type {
  MemoryCandidate,
  ExtractedEntity,
} from '@/lib/memory/types';

export const MEMORY_CANDIDATE_TYPES = [
  'fact',
  'observation',
  'decision',
  'insight',
  'problem',
  'opportunity',
  'risk',
  'preference',
  'instruction',
  'action_item',
  'customer_feedback',
] as const;

export const extractMemoriesInputSchema = z.object({
  noteTitle: z.string().optional().describe('Title of the source note if provided'),
  plainText: z.string().describe('The plain text body of the note or transcript'),
  workspaceId: z.string().optional().describe('Current workspace ID for contextual routing'),
  organizationId: z.string().optional().describe('Organization ID for API key resolution'),
  contextHint: z.string().optional().describe('Known active entity names or terminology hints'),
});

export type ExtractMemoriesInput = z.infer<typeof extractMemoriesInputSchema>;

export const extractMemoriesOutputSchema = z.object({
  executiveSummary: z
    .string()
    .describe('A 1-2 sentence high-level synthesis of the note content'),
  overallSentiment: z
    .enum(['positive', 'neutral', 'negative', 'urgent'])
    .describe('Dominant emotional tone or urgency level'),
  topics: z
    .array(z.string())
    .max(6)
    .describe('Up to 6 normalized lowercase topical tags (e.g. "enrollment", "pricing", "parent_app")'),
  extractedEntities: z
    .array(
      z.object({
        entityName: z.string().describe('Organization, school, client, person, or deal name mentioned'),
        entityType: z.enum(['institution', 'person', 'contact', 'deal', 'unknown']),
        confidenceScore: z.number().min(0).max(1).describe('Confidence between 0.0 and 1.0'),
      })
    )
    .describe('Entities, stakeholders, and deals discovered in the text'),
  memoryCandidates: z
    .array(
      z.object({
        type: z.enum(MEMORY_CANDIDATE_TYPES).describe('Atomic memory classification'),
        title: z.string().max(80).describe('Crisp, descriptive headline (max 80 chars)'),
        content: z.string().describe('Complete, self-contained proposition or insight'),
        importance: z.number().min(0).max(1).describe('Strategic value (0.0 to 1.0)'),
        confidence: z.number().min(0).max(1).describe('Confidence in deduction (0.0 to 1.0)'),
        evidence: z.string().optional().describe('Verbatim quote or sentence excerpt from text'),
        relatedEntityNames: z.array(z.string()).optional().describe('Names of related entities for this memory'),
      })
    )
    .describe('Discrete, atomic memory items ready for Organization Memory ingestion'),
});

export type ExtractMemoriesOutput = z.infer<typeof extractMemoriesOutputSchema>;

function buildPrompt(input: {
  noteTitle?: string;
  plainText: string;
  contextHint?: string;
}): string {
  return `You are the SmartSapp Organization Memory Ingestion Analyst.
Your role is to decompose customer meeting notes, call records, and internal notes into discrete, durable "Memory Objects".

### EXTRACTION OBJECTIVES:
1. **Executive Summary**: 1–2 sentences synthesizing what occurred or what was discussed.
2. **Sentiment & Urgency**: Classify as 'positive', 'neutral', 'negative', or 'urgent'.
3. **Topical Tags**: Up to 6 concise, lowercase tags (e.g. "payment_delay", "parent_portal", "objection").
4. **Entity Recognition**: Detect any institution, company, school, person, role, or deal name mentioned.
5. **Memory Candidates**: Identify atomic, actionable propositions. Categorize each into:
   - 'insight': Strategic revelation or behavioral observation.
   - 'problem': Customer pain point, friction, complaint, or obstacle.
   - 'opportunity': Commercial opening, upsell, trial interest, or partnership potential.
   - 'decision': Agreement made, contract settled, or firm conclusion reached.
   - 'risk': Threat of churn, competitor encroachment, or stalled implementation.
   - 'action_item': Next step or task committed to.
   - 'customer_feedback': Explicit praise, critique, or feature request from customer.

For each memory candidate:
- Give a concise, professional title (max 80 chars).
- Write a clear, standalone proposition in 'content'.
- Extract the exact verbatim excerpt in 'evidence'.
- Rate 'importance' (0.0 to 1.0) and 'confidence' (0.0 to 1.0).

${input.contextHint ? `Context Hint: ${input.contextHint}\n` : ''}
--- SOURCE NOTE ---
Title: ${input.noteTitle || '(Untitled Note)'}
Content:
"""
${input.plainText}
"""
`;
}

export const extractMemoriesFlow = ai.defineFlow(
  {
    name: 'extractMemoriesFlow',
    inputSchema: extractMemoriesInputSchema,
    outputSchema: extractMemoriesOutputSchema,
  },
  async (input) => {
    const rawText = (input.plainText || '').trim();

    // Guard against empty or ultra-short input
    const words = rawText.split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      return {
        executiveSummary: rawText || 'Note contains insufficient text for memory extraction.',
        overallSentiment: 'neutral' as const,
        topics: [],
        extractedEntities: [],
        memoryCandidates: [],
      };
    }

    // Length capping to prevent token overflow (20k chars)
    const cappedText = rawText.length > 20000 ? rawText.substring(0, 20000) : rawText;

    const { modelString, customAi } = await getModel({
      organizationId: input.organizationId,
      provider: 'googleai',
      modelId: 'gemini-3.6-flash',
    });

    const activeAi = customAi || ai;
    const promptText = buildPrompt({
      noteTitle: input.noteTitle,
      plainText: cappedText,
      contextHint: input.contextHint,
    });

    const { output } = await activeAi.generate({
      model: modelString,
      prompt: promptText,
      output: { schema: extractMemoriesOutputSchema },
    });

    if (!output) {
      throw new Error('AI extraction flow returned an empty response.');
    }

    return output;
  }
);

export async function extractMemories(
  input: ExtractMemoriesInput
): Promise<ExtractMemoriesOutput> {
  return extractMemoriesFlow(input);
}
