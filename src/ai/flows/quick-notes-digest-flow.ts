import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * Workspace / category digest for Quick Notes — summarises a set of notes into
 * an overview, recurring themes, and outstanding action items.
 */
export const quickNotesDigestSchema = z.object({
  overview: z.string().describe('A 2–3 sentence overview of the notes as a whole'),
  themes: z.array(z.string()).describe('Recurring topics across the notes'),
  outstandingActions: z.array(z.string()).describe('Open action items worth following up'),
});

export type QuickNotesDigest = z.infer<typeof quickNotesDigestSchema>;

export const quickNotesDigestFlow = ai.defineFlow(
  {
    name: 'quickNotesDigestFlow',
    inputSchema: z.object({
      scopeLabel: z.string().optional(),
      notes: z.array(
        z.object({
          title: z.string().optional(),
          plainText: z.string(),
          createdAt: z.string().optional(),
        })
      ),
    }),
    outputSchema: quickNotesDigestSchema,
  },
  async (input) => {
    if (input.notes.length === 0) {
      return { overview: 'There are no notes to summarise.', themes: [], outstandingActions: [] };
    }

    const corpus = input.notes
      .map((n, i) => `#${i + 1} ${n.title ? `[${n.title}] ` : ''}${n.plainText}`)
      .join('\n\n');

    const { output } = await ai.generate({
      prompt: `You are an assistant summarising a collection of CRM notes${
        input.scopeLabel ? ` for "${input.scopeLabel}"` : ''
      }.

Notes:
${corpus}

Produce a brief overview, the recurring themes, and the outstanding action items across all of these notes.`,
      output: { schema: quickNotesDigestSchema },
    });

    if (!output) throw new Error('AI failed to generate a digest.');
    return output;
  }
);
