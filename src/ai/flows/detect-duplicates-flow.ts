import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Semantic Duplicate Detection Flow (Company Brain Phase 7).
 *
 * Compares a candidate note with existing notes to determine semantic overlap,
 * recommending whether to Merge, Link, or Keep Separate.
 */

export const detectDuplicatesInputSchema = z.object({
  targetNote: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
  }),
  candidateNotes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
    })
  ),
  similarityThreshold: z.number().min(0.5).max(1.0).default(0.75),
});

export const detectDuplicatesOutputSchema = z.object({
  duplicates: z
    .array(
      z.object({
        candidateNoteId: z.string().describe('ID of the duplicate candidate note'),
        candidateTitle: z.string().describe('Title of the duplicate candidate note'),
        similarityScore: z.number().min(0).max(1).describe('Semantic similarity score (0.0 to 1.0)'),
        overlappingTopics: z.array(z.string()).describe('Core themes or topics covered in both notes'),
        explanation: z.string().describe('Explanation of why these two notes are considered duplicates or redundant'),
        recommendedAction: z
          .enum(['merge', 'link', 'keep_separate'])
          .describe('Recommended organizational action: merge into one, link via relations, or keep separate'),
        mergedDraftSummary: z
          .string()
          .optional()
          .describe('Proposed combined summary if the user chooses to merge'),
      })
    )
    .describe('List of detected duplicates exceeding similarity threshold'),
});

export type DetectDuplicatesInput = z.infer<typeof detectDuplicatesInputSchema>;
export type DetectDuplicatesOutput = z.infer<typeof detectDuplicatesOutputSchema>;

export const detectDuplicatesFlow = ai.defineFlow(
  {
    name: 'detectDuplicatesFlow',
    inputSchema: detectDuplicatesInputSchema,
    outputSchema: detectDuplicatesOutputSchema,
  },
  async (input): Promise<DetectDuplicatesOutput> => {
    const { targetNote, candidateNotes, similarityThreshold } = input;

    if (!candidateNotes || candidateNotes.length === 0 || !targetNote.content.trim()) {
      return { duplicates: [] };
    }

    const candidatesFormatted = candidateNotes
      .slice(0, 10)
      .map(
        (c, idx) =>
          `[Candidate ${idx + 1} | ID: ${c.id} | Title: ${c.title}]\nContent:\n${c.content.substring(0, 500)}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `
You are the SmartSapp Governance & Knowledge De-duplication Agent.
Your role is to assess semantic overlap between a Target Note and a set of candidate notes in the workspace.

Guidelines:
1. High Semantic Similarity (>=0.80): Notes cover virtually identical topics, meeting findings, or customer feedback with slight wording differences. Recommend 'merge'.
2. Partial Semantic Similarity (0.65 - 0.79): Notes cover related aspects of the same initiative or account but have distinct details. Recommend 'link'.
3. Low Similarity (<0.65): Distinct documents. Recommend 'keep_separate'.
4. Provide a crisp mergedDraftSummary combining the key takeaways if recommending 'merge'.

Target Note:
[ID: ${targetNote.id} | Title: ${targetNote.title}]
Content:
${targetNote.content}

Candidate Notes:
${candidatesFormatted}
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: detectDuplicatesOutputSchema },
      config: {
        temperature: 0.15,
      },
    });

    if (!response.output) {
      return { duplicates: [] };
    }

    // Filter by similarity threshold
    const filtered = response.output.duplicates.filter((d) => d.similarityScore >= similarityThreshold);
    return { duplicates: filtered };
  }
);
