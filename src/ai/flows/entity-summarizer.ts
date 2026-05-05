import { ai } from '../genkit';
import { z } from 'genkit';
import { EntityNote } from '@/lib/types';

export const entitySummarySchema = z.object({
  executiveSummary: z.string().describe('A 2-sentence high-level overview of the entity status'),
  keyThemes: z.array(z.string()).describe('List of main topics or issues identified from notes'),
  recentSentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']).describe('Overall tone of recent interactions'),
  actionItems: z.array(z.string()).describe('Suggested next steps based on the notes'),
  lastInteraction: z.string().describe('Summary of the very last interaction')
});

export const summarizeEntityNotesFlow = ai.defineFlow(
  {
    name: 'summarizeEntityNotesFlow',
    inputSchema: z.object({
      notes: z.array(z.any()),
      entityName: z.string().optional(),
    }),
    outputSchema: entitySummarySchema,
  },
  async (input) => {
    const { notes, entityName } = input;
    
    if (notes.length === 0) {
      return {
        executiveSummary: 'No interaction history available.',
        keyThemes: [] as string[],
        recentSentiment: 'neutral' as 'positive' | 'neutral' | 'negative' | 'urgent',
        actionItems: ['Start documenting interactions to generate insights.'],
        lastInteraction: 'None recorded.'
      };
    }

    const notesContext = notes
      .map((n: EntityNote) => `[${n.createdAt}] ${n.createdByName} (${n.noteType}): ${n.content}`)
      .join('\n');

    const { output } = await ai.generate({
      prompt: `
        You are an expert CRM analyst. Summarize the following interaction history for an entity named "${entityName || 'the client'}".
        
        Notes History:
        ${notesContext}
        
        Provide a concise, professional executive briefing.
      `,
      output: { schema: entitySummarySchema }
    });

    if (!output) throw new Error('AI failed to generate summary');
    return output;
  }
);
