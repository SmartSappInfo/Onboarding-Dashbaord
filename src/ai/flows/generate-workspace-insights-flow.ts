import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Workspace Insights Generation Flow (Company Brain Phase 7).
 *
 * Analyzes workspace knowledge objects, CRM notes, calls, and ideas to synthesize
 * organizational insights: Emerging Trends, Recurring Objections, Critical Risks,
 * and Growth Opportunities with direct quote-proof evidence citations.
 */

export const generateWorkspaceInsightsInputSchema = z.object({
  knowledgeItems: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        content: z.string(),
        date: z.string().optional(),
        entityNames: z.array(z.string()).optional(),
      })
    )
    .describe('List of workspace knowledge objects, CRM notes, and transcripts to analyze'),
  customDirectives: z.string().optional().describe('Optional workspace strategic priorities or guidelines'),
});

export const generateWorkspaceInsightsOutputSchema = z.object({
  insights: z
    .array(
      z.object({
        type: z
          .enum(['trend', 'recurring_problem', 'risk', 'opportunity', 'emerging_theme', 'pattern'])
          .describe('Category of organizational insight'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Business importance or risk level'),
        title: z.string().describe('Crisp, executive summary title of the insight'),
        summary: z.string().describe('Detailed narrative explanation of the insight and underlying pattern'),
        evidenceSources: z
          .array(
            z.object({
              id: z.string().describe('ID of the source knowledge object'),
              title: z.string().describe('Title of the source knowledge object'),
              type: z.string().describe('Type of knowledge object (e.g. note, call, meeting)'),
              quote: z.string().describe('Exact verbatim quote snippet proving this insight'),
              date: z.string().describe('Date of the source evidence'),
            })
          )
          .describe('List of traceable supporting evidence sources'),
        suggestedActions: z
          .array(
            z.object({
              id: z.string().describe('Unique action ID'),
              label: z.string().describe('Action title (e.g. "Create Campaign: WhatsApp Fee Reminders")'),
              actionType: z.enum(['create_task', 'create_idea', 'create_campaign_concept', 'link_entities']),
              description: z.string().optional(),
            })
          )
          .describe('1-click recommended next steps'),
      })
    )
    .describe('List of discovered high-confidence organizational insights'),
});

export type GenerateWorkspaceInsightsInput = z.infer<typeof generateWorkspaceInsightsInputSchema>;
export type GenerateWorkspaceInsightsOutput = z.infer<typeof generateWorkspaceInsightsOutputSchema>;

export const generateWorkspaceInsightsFlow = ai.defineFlow(
  {
    name: 'generateWorkspaceInsightsFlow',
    inputSchema: generateWorkspaceInsightsInputSchema,
    outputSchema: generateWorkspaceInsightsOutputSchema,
  },
  async (input): Promise<GenerateWorkspaceInsightsOutput> => {
    const { knowledgeItems, customDirectives } = input;

    if (!knowledgeItems || knowledgeItems.length === 0) {
      return { insights: [] };
    }

    // Bounded context formatting to avoid token overflow
    const itemsFormatted = knowledgeItems
      .slice(0, 40)
      .map(
        (k, idx) =>
          `[Item ${idx + 1} | ID: ${k.id} | Type: ${k.type} | Date: ${k.date || 'Recent'}]\nTitle: ${k.title}\n${
            k.entityNames && k.entityNames.length > 0 ? `Entities: ${k.entityNames.join(', ')}\n` : ''
          }Content: ${k.content.substring(0, 600)}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `
You are the SmartSapp Senior Executive Intelligence & Knowledge Synthesis Agent.
Your job is to read organizational notes, customer call transcripts, CRM feedback, and strategy ideas to discover high-value organizational insights.

You must categorize findings into 4 key quadrants:
1. TRENDS & PATTERNS: Emerging customer behaviors, adoption trends, or market shifts.
2. RECURRING PROBLEMS / OBJECTIONS: Friction points, pricing concerns, or workflow bottlenecks cited across multiple accounts.
3. OPERATIONAL RISKS: Critical system issues, customer churn signals, compliance risks, or broken assumptions.
4. GROWTH OPPORTUNITIES: Unmet customer demands, new campaign angles, upsell moments, or product expansion vectors.

GROUNDING & ANTI-HALLUCINATION RULES:
- Every insight MUST be backed by at least 1 (preferably 2+) specific source items.
- For each evidenceSource, you MUST extract an EXACT verbatim quote snippet from the text. Do not fabricate quotes.
- Provide actionable suggestedActions that can be executed as tasks or structured ideas.

${customDirectives ? `Workspace Directives:\n${customDirectives}\n` : ''}

Knowledge Data:
${itemsFormatted}
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: generateWorkspaceInsightsOutputSchema },
      config: {
        temperature: 0.25,
      },
    });

    if (!response.output) {
      return { insights: [] };
    }

    return response.output;
  }
);
