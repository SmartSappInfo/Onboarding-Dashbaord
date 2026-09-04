import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Campaign Learnings Synthesis Flow (Company Brain Phase 8).
 *
 * Ingests post-campaign execution delivery metrics and qualitative recipient replies
 * to synthesize structured Knowledge Insights and strategic learnings for the Knowledge Graph.
 */

export const synthesizeCampaignLearningsInputSchema = z.object({
  campaignId: z.string(),
  campaignTitle: z.string(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'call_center', 'multi_channel']),
  metrics: z.object({
    totalSent: z.number(),
    deliveredCount: z.number().optional(),
    openedCount: z.number().optional(),
    clickedCount: z.number().optional(),
    convertedCount: z.number().optional(),
    unsubscribedCount: z.number().optional(),
  }),
  qualitativeReplies: z
    .array(
      z.object({
        recipientId: z.string().optional(),
        replyText: z.string(),
        sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']).optional(),
        date: z.string().optional(),
      })
    )
    .optional()
    .describe('List of inbound responses, customer queries, and objections received during campaign'),
  customDirectives: z.string().optional().describe('Optional evaluation instructions'),
});

export const synthesizeCampaignLearningsOutputSchema = z.object({
  overallSentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  summaryNarrative: z.string().describe('Executive narrative summarizing what worked and what failed in this campaign'),
  insights: z
    .array(
      z.object({
        type: z.enum(['trend', 'recurring_problem', 'risk', 'opportunity', 'emerging_theme', 'pattern']),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        title: z.string().describe('Concise headline of the learning insight'),
        summary: z.string().describe('Detailed qualitative and quantitative explanation of this insight'),
        evidenceQuotes: z.array(z.string()).describe('Direct quote snippets from customer replies proving this insight'),
        strategicRecommendations: z.array(z.string()).describe('Concrete action items for the next marketing iteration'),
      })
    )
    .describe('Structured insights ready to be saved into the Knowledge Graph'),
});

export type SynthesizeCampaignLearningsInput = z.infer<typeof synthesizeCampaignLearningsInputSchema>;
export type SynthesizeCampaignLearningsOutput = z.infer<typeof synthesizeCampaignLearningsOutputSchema>;

export const synthesizeCampaignLearningsFlow = ai.defineFlow(
  {
    name: 'synthesizeCampaignLearningsFlow',
    inputSchema: synthesizeCampaignLearningsInputSchema,
    outputSchema: synthesizeCampaignLearningsOutputSchema,
  },
  async (input): Promise<SynthesizeCampaignLearningsOutput> => {
    const { campaignId, campaignTitle, channel, metrics, qualitativeReplies, customDirectives } = input;

    const repliesFormatted = (qualitativeReplies || [])
      .slice(0, 30)
      .map((r, idx) => `[Reply ${idx + 1} | Sentiment: ${r.sentiment || 'unspecified'}]\n"${r.replyText}"`)
      .join('\n\n');

    const conversionRate = metrics.totalSent > 0 ? (((metrics.convertedCount || 0) / metrics.totalSent) * 100).toFixed(1) : '0';
    const openRate = metrics.totalSent > 0 ? (((metrics.openedCount || 0) / metrics.totalSent) * 100).toFixed(1) : 'N/A';

    const systemPrompt = `
You are the SmartSapp Lead Campaign Analytics & Qualitative Post-Mortem Intelligence Agent.
Your job is to analyze post-campaign performance data and qualitative replies to extract actionable organizational knowledge.

CAMPAIGN DETAILS:
- Campaign ID: ${campaignId}
- Title: ${campaignTitle}
- Channel: ${channel}
- Total Sent: ${metrics.totalSent}
- Delivered: ${metrics.deliveredCount ?? 'N/A'}
- Opens: ${metrics.openedCount ?? 'N/A'} (${openRate}%)
- Clicks: ${metrics.clickedCount ?? 'N/A'}
- Conversions: ${metrics.convertedCount ?? 'N/A'} (${conversionRate}%)
- Unsubscribes / Opt-outs: ${metrics.unsubscribedCount ?? 'N/A'}

${customDirectives ? `DIRECTIVES: ${customDirectives}` : ''}

QUALITATIVE INBOUND RECIPIENT REPLIES & OBJECTIONS:
${repliesFormatted || 'No qualitative reply text provided. Evaluate strictly from delivery and conversion funnel anomalies.'}

REQUIREMENTS:
1. Synthesize 2 to 4 high-impact, grounded Knowledge Insights (e.g. Messaging mismatch, Pricing barrier, Top performing offer angle).
2. Mandate verbatim quote evidence from replies where applicable.
3. Recommend practical next steps for copywriters and product strategists.
`;

    const { output } = await ai.generate({
      system: systemPrompt,
      prompt: 'Synthesize structured campaign post-mortem insights and strategic recommendations.',
      output: { schema: synthesizeCampaignLearningsOutputSchema },
      config: {
        temperature: 0.2,
      },
    });

    if (!output) {
      throw new Error('Failed to synthesize campaign learnings.');
    }

    return output;
  }
);
