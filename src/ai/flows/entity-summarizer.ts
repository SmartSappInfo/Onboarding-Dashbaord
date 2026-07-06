import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import { EntityNote } from '@/lib/types';
import { resolveAndCompilePrompt } from '@/lib/pms-resolver';

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
      notes: z.array(z.object({
        createdAt: z.string(),
        createdByName: z.string().optional(),
        noteType: z.string().optional(),
        content: z.string()
      })),
      entityName: z.string().optional(),
      workspaceId: z.string().optional(),
      organizationId: z.string().optional(),
    }),
    outputSchema: entitySummarySchema,
  },
  async (input) => {
    const { notes, entityName, workspaceId = '', organizationId = '' } = input;
    
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
      .map((n: { createdAt: string; createdByName?: string; noteType?: string; content: string }) => 
        `[${n.createdAt}] ${n.createdByName || 'Unknown'} (${n.noteType || 'general'}): ${n.content}`
      )
      .join('\n');

    // Dynamically resolve prompt via PMS
    const resolved = await resolveAndCompilePrompt(
      'summarizeEntityNotesFlow',
      organizationId,
      workspaceId,
      {
        entityName: entityName || 'the client',
        notesContext
      }
    );

    const fullModelString = resolved.aiModels?.[0] || 'googleai/gemini-3.5-flash';
    const [provider, ...rest] = fullModelString.split('/');
    const modelId = rest.join('/');

    const { modelString, customAi } = await getModel({
      organizationId,
      provider,
      modelId
    });

    const activeAi = customAi || ai;

    const { output } = await activeAi.generate({
      model: modelString,
      system: resolved.systemInstructions,
      prompt: resolved.userPrompt,
      output: { schema: entitySummarySchema }
    });

    if (!output) throw new Error('AI failed to generate summary');
    return output;
  }
);
