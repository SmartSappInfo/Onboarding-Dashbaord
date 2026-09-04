import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Entity Brief Flow (Phase 3).
 *
 * Synthesizes a federated stream of interaction history (notes, calls, meetings,
 * tasks, and deal milestones) for an entity into a high-level executive brief.
 */
export const timelineAiBriefOutputSchema = z.object({
  executiveSummary: z
    .string()
    .describe('A concise, 2-3 sentence executive synthesis of interaction history and status'),
  keyThemes: z
    .array(z.string())
    .describe('Prominent recurring topics, themes, or organizational priorities'),
  actionItems: z
    .array(z.string())
    .describe('Pending commitments, next steps, or unresolved follow-up tasks'),
  buyingSignals: z
    .array(z.string())
    .describe('Positive signals indicating buying intent, willingness to expand, or high engagement'),
  objections: z
    .array(z.string())
    .describe('Key customer objections, technical blockers, pricing friction, or risks'),
  recentSentiment: z
    .enum(['positive', 'neutral', 'negative', 'urgent'])
    .describe('Overall prevailing sentiment from recent interactions'),
});

export type TimelineAiBriefOutput = z.infer<typeof timelineAiBriefOutputSchema>;

export const summarizeEntityTimelineFlow = ai.defineFlow(
  {
    name: 'summarizeEntityTimelineFlow',
    inputSchema: z.object({
      entityName: z.string(),
      entityType: z.string().optional().default('institution'),
      timelineItems: z.array(
        z.object({
          source: z.string(),
          title: z.string(),
          content: z.string(),
          timestamp: z.string(),
          sentiment: z.string().optional(),
        })
      ),
    }),
    outputSchema: timelineAiBriefOutputSchema,
  },
  async (input) => {
    const items = input.timelineItems || [];
    if (items.length === 0) {
      return {
        executiveSummary: `No interaction history recorded for ${input.entityName} yet.`,
        keyThemes: [],
        actionItems: [],
        buyingSignals: [],
        objections: [],
        recentSentiment: 'neutral' as const,
      };
    }

    // Cap items to avoid token overload
    const cappedItems = items.slice(0, 40);
    const historyText = cappedItems
      .map(
        (it, idx) =>
          `[${idx + 1}] (${it.timestamp}) [Source: ${it.source}] ${it.title}\n${it.content.slice(0, 400)}`
      )
      .join('\n\n');

    const prompt = `You are a Senior Strategic Advisor and CRM Intelligence Analyst for SmartSapp.
Analyze the following chronological interaction history for "${input.entityName}" (Type: ${input.entityType}).
Produce a clear, structured Executive Brief for the account team.

Interaction History:
${historyText}

Instructions:
1. Executive Summary: Provide an insightful 2-3 sentence executive synthesis of account status, recent momentum, and primary focus areas.
2. Key Themes: Identify up to 4 key operational or commercial themes discussed.
3. Action Items: List concrete upcoming actions or next steps required from the team.
4. Buying Signals: Identify any indicators of buying intent, upgrades, renewals, or enthusiasm.
5. Objections: Identify any concerns, billing friction, competitor mentions, or risks.
6. Sentiment: Evaluate the prevailing sentiment (positive, neutral, negative, urgent).`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: timelineAiBriefOutputSchema },
    });

    return (
      output || {
        executiveSummary: `Generated brief for ${input.entityName}.`,
        keyThemes: [],
        actionItems: [],
        buyingSignals: [],
        objections: [],
        recentSentiment: 'neutral' as const,
      }
    );
  }
);
