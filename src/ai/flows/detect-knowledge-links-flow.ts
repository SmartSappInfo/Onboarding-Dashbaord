import { ai } from '../genkit';
import { z } from 'genkit';
import { KNOWLEDGE_RELATION_TYPES } from '@/lib/quick-notes-types';

/**
 * AI Linking Agent Flow (Company Brain Phase 5).
 *
 * Automatically detects meaningful semantic relationships (e.g. supports,
 * contradicts, depends on, derived from, evidences, addresses) between a target
 * note/idea and surrounding organizational knowledge objects.
 *
 * Anti-hallucination guardrail: the LLM must provide exact quote excerpts
 * from both documents to validate any suggested relationship.
 */

export const candidateObjectSchema = z.object({
  id: z.string().describe('Unique identifier for this knowledge object or CRM record'),
  title: z.string().describe('Title or label of the object'),
  content: z.string().describe('Plain text content or excerpt of the object'),
  knowledgeType: z.string().describe('Semantic knowledge or entity type'),
  authorName: z.string().optional().describe('Author or creator name'),
});

export const detectKnowledgeLinksInputSchema = z.object({
  targetObject: candidateObjectSchema.describe('The central note or idea being linked'),
  candidateObjects: z
    .array(candidateObjectSchema)
    .max(15)
    .describe('Candidate knowledge objects to evaluate for connections'),
  minConfidence: z.number().min(0).max(1).default(0.65).describe('Minimum confidence score threshold'),
  customDirectives: z.string().optional().describe('Optional workspace grounding directives'),
});

export const aiLinkSuggestionOutputSchema = z.object({
  fromObjectId: z.string().describe('Source object ID'),
  fromObjectTitle: z.string().optional().describe('Source object title'),
  toObjectId: z.string().describe('Target object ID'),
  toObjectTitle: z.string().optional().describe('Target object title'),
  relationType: z.enum(KNOWLEDGE_RELATION_TYPES).describe('Typed relationship category'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0'),
  reasoning: z.string().describe('Concise rationale explaining the exact semantic connection'),
  evidenceQuotes: z
    .array(z.string())
    .describe('Exact supporting quote fragments from the respective documents'),
});

export const detectKnowledgeLinksOutputSchema = z.object({
  suggestions: z.array(aiLinkSuggestionOutputSchema).describe('List of discovered link suggestions'),
  analyzedCount: z.number().describe('Total candidate objects evaluated'),
  explanation: z.string().describe('Summary of the linking analysis'),
});

export type DetectKnowledgeLinksInput = z.infer<typeof detectKnowledgeLinksInputSchema>;
export type DetectKnowledgeLinksOutput = z.infer<typeof detectKnowledgeLinksOutputSchema>;

export const detectKnowledgeLinksFlow = ai.defineFlow(
  {
    name: 'detectKnowledgeLinksFlow',
    inputSchema: detectKnowledgeLinksInputSchema,
    outputSchema: detectKnowledgeLinksOutputSchema,
  },
  async (input): Promise<DetectKnowledgeLinksOutput> => {
    const { targetObject, candidateObjects, minConfidence = 0.65, customDirectives } = input;

    // Edge case: No candidates to compare against
    if (!candidateObjects || candidateObjects.length === 0) {
      return {
        suggestions: [],
        analyzedCount: 0,
        explanation: 'No candidate knowledge objects were provided for relationship analysis.',
      };
    }

    const candidateFormatted = candidateObjects
      .map(
        (c, idx) =>
          `[Candidate #${idx + 1}] ID: ${c.id}\nType: ${c.knowledgeType}\nTitle: ${c.title}\nContent:\n${c.content.slice(0, 1000)}\n`
      )
      .join('\n---\n');

    const systemPrompt = `
You are the SmartSapp Knowledge Graph Linking Agent.
Your objective is to discover meaningful, genuine semantic relationships between the target knowledge object and the provided candidate objects.

Target Object:
- ID: ${targetObject.id}
- Type: ${targetObject.knowledgeType}
- Title: ${targetObject.title}
- Content:
${targetObject.content.slice(0, 2000)}

Candidate Objects:
${candidateFormatted}

${customDirectives ? `Custom Workspace Directives:\n${customDirectives}\n` : ''}

CRITICAL RULES:
1. Supported Relationship Types:
   - 'supports': Object provides arguments, evidence, or customer validation for the other.
   - 'contradicts': Object contains conflicting findings, objections, or opposing hypotheses.
   - 'depends_on': Object requires the other to be completed or resolved first.
   - 'derived_from': Object was inspired by or originated from the other.
   - 'evidences': Object (e.g. quote, call, survey) proves or backs up the idea/decision.
   - 'solves': Object resolves a problem or addresses an objection stated in the other.
   - 'about_contact' / 'about_school' / 'about_deal': Knowledge directly discusses or references that CRM entity.
   - 'related_to': General semantic relationship when no specific causal relationship applies.
2. Anti-Hallucination: Do NOT fabricate connections. Every suggestion MUST include verbatim excerpts in 'evidenceQuotes' from the documents.
3. Only output suggestions where confidenceScore is >= ${minConfidence}.
4. Return an empty suggestions array if no strong relationships exist.
`;

    try {
      const { output } = await ai.generate({
        prompt: systemPrompt,
        output: { schema: detectKnowledgeLinksOutputSchema },
        config: {
          temperature: 0.2, // Low temperature for high precision and zero hallucination
        },
      });

      if (!output) {
        return {
          suggestions: [],
          analyzedCount: candidateObjects.length,
          explanation: 'No high-confidence relationships were discovered.',
        };
      }

      // Filter and sanitize suggestions
      const validatedSuggestions = (output.suggestions || [])
        .filter((s) => s.confidenceScore >= minConfidence)
        .map((s) => ({
          ...s,
          fromObjectId: s.fromObjectId || targetObject.id,
          fromObjectTitle: s.fromObjectTitle || targetObject.title,
          toObjectTitle:
            s.toObjectTitle ||
            candidateObjects.find((c) => c.id === s.toObjectId)?.title ||
            'Knowledge Object',
        }));

      return {
        suggestions: validatedSuggestions,
        analyzedCount: candidateObjects.length,
        explanation: output.explanation || `Discovered ${validatedSuggestions.length} connection(s).`,
      };
    } catch (err) {
      console.warn('[detectKnowledgeLinksFlow] Inference error:', err);
      return {
        suggestions: [],
        analyzedCount: candidateObjects.length,
        explanation: 'AI link detection encountered an unexpected processing error.',
      };
    }
  }
);
