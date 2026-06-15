import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * Per-note AI insight for Quick Notes. Mirrors the entity-summarizer pattern:
 * a single structured generation over the note's plain text. Kept small and
 * cheap; the calling action caps input length and caches the result.
 */
export const quickNoteInsightSchema = z.object({
  summary: z.string().describe('A 1–2 sentence TL;DR of the note'),
  suggestedTags: z.array(z.string()).max(6).describe('Up to 6 short, lowercase topical tags'),
  sentiment: z
    .enum(['positive', 'neutral', 'negative', 'urgent'])
    .describe('Overall tone of the note'),
  actionItems: z.array(z.string()).describe('Concrete next steps implied by the note'),
});

export type QuickNoteInsight = z.infer<typeof quickNoteInsightSchema>;

export const summarizeQuickNoteFlow = ai.defineFlow(
  {
    name: 'summarizeQuickNoteFlow',
    inputSchema: z.object({
      title: z.string().optional(),
      content: z.string(),
    }),
    outputSchema: quickNoteInsightSchema,
  },
  async (input) => {
    const content = input.content.trim();
    if (!content) {
      return {
        summary: 'This note has no text to summarise yet.',
        suggestedTags: [],
        sentiment: 'neutral' as const,
        actionItems: [],
      };
    }

    const { output } = await ai.generate({
      prompt: `You are an assistant that helps a CRM user organise their notes.
Analyse the following note and produce a concise, professional insight.

Title: ${input.title || '(untitled)'}
Note:
${content}

Return a short summary, up to 6 lowercase topical tags, the overall sentiment, and any concrete action items implied by the note (empty array if none).`,
      output: { schema: quickNoteInsightSchema },
    });

    if (!output) throw new Error('AI failed to generate a note insight.');
    return output;
  }
);
