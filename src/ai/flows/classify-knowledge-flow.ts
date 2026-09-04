import { ai } from '../genkit';
import { z } from 'genkit';
import { KNOWLEDGE_TYPES } from '@/lib/quick-notes-types';

/**
 * AI Capture Agent Schema (Phase 2).
 *
 * Infers semantic classification, derives a concise title, extracts key takeaways,
 * discovers implied actions, and identifies potential CRM entity mentions from raw text.
 */
export const knowledgeClassificationResultSchema = z.object({
  suggestedType: z
    .enum(KNOWLEDGE_TYPES)
    .describe('The most accurate semantic knowledge type for this content'),
  suggestedTitle: z
    .string()
    .max(80)
    .describe('A concise, compelling human-readable title for the note (max 80 chars)'),
  suggestedTags: z
    .array(z.string())
    .max(6)
    .describe('Up to 6 lowercase topical tags relevant to the content'),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0 for the type classification'),
  sentiment: z
    .enum(['positive', 'neutral', 'negative', 'urgent'])
    .describe('Overall sentiment or urgency of the note'),
  extractedActions: z
    .array(z.string())
    .describe('Concrete action items or next steps mentioned in or implied by the content'),
  keyTakeaway: z
    .string()
    .describe('One clear, single-sentence summary of the core insight or message'),
  suggestedLinks: z
    .object({
      entityName: z.string().optional().describe('Organization, school, or company name mentioned'),
      dealName: z.string().optional().describe('Deal, project, or contract name mentioned'),
      contactName: z.string().optional().describe('Person or stakeholder name mentioned'),
    })
    .optional(),
});

export type KnowledgeClassificationResult = z.infer<typeof knowledgeClassificationResultSchema>;

export const classifyKnowledgeFlow = ai.defineFlow(
  {
    name: 'classifyKnowledgeFlow',
    inputSchema: z.object({
      text: z.string(),
      contextHint: z.string().optional(),
    }),
    outputSchema: knowledgeClassificationResultSchema,
  },
  async (input) => {
    const rawText = input.text.trim();
    if (!rawText) {
      return {
        suggestedType: 'note' as const,
        suggestedTitle: 'Quick Note',
        suggestedTags: [],
        confidenceScore: 0.5,
        sentiment: 'neutral' as const,
        extractedActions: [],
        keyTakeaway: 'Empty draft note.',
      };
    }

    const prompt = `You are an expert Chief Knowledge Officer and AI Capture Agent for SmartSapp (a CRM, Sales, and School Operations platform).
Analyze the following raw draft text (or transcribed voice note) and produce an intelligent, highly structured classification.

Context Hint: ${input.contextHint || 'None'}

Draft Content:
"""
${rawText}
"""

Classification Rules:
1. Knowledge Types:
   - 'idea': Creative concepts, product features, innovations, strategic hypotheses.
   - 'decision': Resolutions, architectural choices, policy determinations, agreements.
   - 'feedback': Direct quotes, client complaints, objections, praise, reviews.
   - 'observation': Field notes, school visit observations, behavioral trends.
   - 'action': Operational commitments, to-dos, deadlines, follow-ups.
   - 'research': Market data, benchmarks, competitive analysis, documentation findings.
   - 'strategy': High-level roadmaps, OKRs, campaign concepts, positioning.
   - 'insight': Analytical takeaways, derived customer patterns, revenue insights.
   - 'note': General scratchpad notes, meeting minutes, miscellaneous thoughts.

2. Derive a punchy, professional title that captures the essence in under 80 characters.
3. Extract concrete next steps into extractedActions (empty array if none).
4. If a school, organization, person, or deal is referenced in the text, extract it into suggestedLinks.
5. Provide a confidence score (0.0 to 1.0) reflecting your classification certainty.`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: knowledgeClassificationResultSchema },
    });

    if (!output) {
      throw new Error('AI failed to classify knowledge draft.');
    }

    return output;
  }
);
