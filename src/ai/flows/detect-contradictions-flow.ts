import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Contradiction Detection Flow (Company Brain Phase 7).
 *
 * Compares claims, hypotheses, assumptions, customer feedback, and meeting notes
 * to detect conflicting statements, surfacing thesis vs. antithesis with exact source quotes.
 */

export const detectContradictionsInputSchema = z.object({
  targetNote: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    content: z.string(),
  }),
  candidateNotes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      content: z.string(),
      date: z.string().optional(),
    })
  ),
  sensitivity: z.enum(['strict', 'balanced', 'permissive']).default('balanced'),
});

export const detectContradictionsOutputSchema = z.object({
  contradictions: z
    .array(
      z.object({
        thesis: z.object({
          claim: z.string().describe('The primary assertion in the target note'),
          quote: z.string().describe('Exact quote from target note making this claim'),
        }),
        antithesis: z.object({
          claim: z.string().describe('The conflicting assertion in the candidate note'),
          sourceId: z.string().describe('ID of the candidate note containing the contradiction'),
          sourceTitle: z.string().describe('Title of the candidate note'),
          quote: z.string().describe('Exact quote from candidate note making the conflicting claim'),
        }),
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Impact of this contradiction'),
        confidence: z.number().min(0).max(1).describe('Confidence score in this contradiction (0.0 to 1.0)'),
        explanation: z.string().describe('Clear reasoning explaining why these two statements conflict'),
        suggestedResolution: z
          .string()
          .describe('Actionable recommendation to resolve the contradiction (e.g. conduct user interview, update policy)'),
      })
    )
    .describe('List of verified contradictions found'),
});

export type DetectContradictionsInput = z.infer<typeof detectContradictionsInputSchema>;
export type DetectContradictionsOutput = z.infer<typeof detectContradictionsOutputSchema>;

export const detectContradictionsFlow = ai.defineFlow(
  {
    name: 'detectContradictionsFlow',
    inputSchema: detectContradictionsInputSchema,
    outputSchema: detectContradictionsOutputSchema,
  },
  async (input): Promise<DetectContradictionsOutput> => {
    const { targetNote, candidateNotes, sensitivity } = input;

    if (!candidateNotes || candidateNotes.length === 0 || !targetNote.content.trim()) {
      return { contradictions: [] };
    }

    const candidatesFormatted = candidateNotes
      .slice(0, 15)
      .map(
        (c, idx) =>
          `[Candidate ${idx + 1} | ID: ${c.id} | Type: ${c.type} | Title: ${c.title}]\nContent: ${c.content.substring(0, 500)}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `
You are the SmartSapp Governance & Contradiction Detection Agent.
Your objective is to examine a Target Note and determine if any statements, assumptions, or factual claims inside it DIRECTLY CONTRADICT claims in existing workspace notes.

Sensitivity Level: ${sensitivity.toUpperCase()}
- STRICT: Only flag direct, mutually exclusive factual or strategic conflicts (e.g. "Fee is \$500" vs "Fee is \$300").
- BALANCED: Flag direct factual conflicts, opposing customer opinions, or broken idea assumptions.
- PERMISSIVE: Flag nuanced divergence in expectations, conflicting priorities, and divergent team statements.

GROUNDING & INTEGRITY RULES:
1. Every contradiction MUST have an exact verbatim quote from the Target Note (thesis) and an exact verbatim quote from the Candidate Note (antithesis).
2. DO NOT hallucinate conflicts. If two statements simply discuss different aspects without contradiction, return no contradictions.
3. Assign confidence from 0.0 to 1.0 based on how unequivocal the conflict is.

Target Note:
[ID: ${targetNote.id} | Type: ${targetNote.type} | Title: ${targetNote.title}]
Content:
${targetNote.content}

Candidate Notes to Compare Against:
${candidatesFormatted}
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: detectContradictionsOutputSchema },
      config: {
        temperature: 0.15,
      },
    });

    if (!response.output) {
      return { contradictions: [] };
    }

    // Filter by sensitivity threshold
    const minThreshold = sensitivity === 'strict' ? 0.8 : sensitivity === 'balanced' ? 0.65 : 0.5;
    const verified = response.output.contradictions.filter((c) => c.confidence >= minThreshold);

    return { contradictions: verified };
  }
);
