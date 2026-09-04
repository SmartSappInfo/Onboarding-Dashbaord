import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Deal & Objection Battlecard Generation Flow (Company Brain Phase 8).
 *
 * Synthesizes tactical Objection Battlecards for sales representatives and account executives
 * handling complex enterprise / school CRM deals.
 */

export const generateDealBattlecardInputSchema = z.object({
  targetTopicOrCompetitor: z.string().describe('The competitor, pricing model, or friction point to address'),
  category: z.enum(['pricing', 'feature', 'trust', 'competitor', 'timing', 'general']),
  customerQuotes: z.array(z.string()).describe('Direct quotes from customer notes expressing the objection'),
  productValuePillars: z.array(z.string()).optional().describe('Core differentiators and strengths of SmartSapp'),
  customDirectives: z.string().optional().describe('Sales team guidance'),
});

export const generateDealBattlecardOutputSchema = z.object({
  topic: z.string().describe('Crisp battlecard header (e.g. "Overcoming Competitor X Feature Parity")'),
  category: z.enum(['pricing', 'feature', 'trust', 'competitor', 'timing', 'general']),
  objection: z.string().describe('Clear, realistic statement of how the prospect states the objection'),
  rebuttalScript: z.string().describe('Conversational 2-3 sentence rebuttal script for sales reps on live calls'),
  killerQuestion: z.string().describe('A powerful question that reframes the prospect perspective and exposes competitor weaknesses'),
  proofPoints: z.array(z.string()).describe('3-4 empirical data points, customer proof stats, or feature differentiators'),
  confidence: z.number().describe('Grounded confidence score (0.0 to 1.0)'),
});

export type GenerateDealBattlecardInput = z.infer<typeof generateDealBattlecardInputSchema>;
export type GenerateDealBattlecardOutput = z.infer<typeof generateDealBattlecardOutputSchema>;

export const generateDealBattlecardFlow = ai.defineFlow(
  {
    name: 'generateDealBattlecardFlow',
    inputSchema: generateDealBattlecardInputSchema,
    outputSchema: generateDealBattlecardOutputSchema,
  },
  async (input): Promise<GenerateDealBattlecardOutput> => {
    const { targetTopicOrCompetitor, category, customerQuotes, productValuePillars, customDirectives } = input;

    const quotesFormatted = customerQuotes.length > 0
      ? customerQuotes.slice(0, 10).map((q, idx) => `${idx + 1}. "${q}"`).join('\n')
      : 'No verbatim quotes available.';

    const systemPrompt = `
You are the SmartSapp Senior Sales Enablement & Competitive Intelligence Strategist.
Your task is to build a tactical, battle-tested Objection Battlecard for sales representatives speaking with school owners, bursars, and corporate executives.

TARGET OBJECTION / TOPIC: ${targetTopicOrCompetitor}
CATEGORY: ${category}

CUSTOMER STATEMENTS & QUOTES FROM SALES CALLS:
${quotesFormatted}

PRODUCT STRENGTHS:
${productValuePillars && productValuePillars.length > 0 ? productValuePillars.join('\n• ') : '• Seamless Mobile Money payments\n• Automated reconciliation\n• 99.8% uptime\n• Dedicated local onboarding specialists'}

${customDirectives ? `DIRECTIVES: ${customDirectives}` : ''}

INSTRUCTIONS:
1. Rebuttal script must sound natural, consultative, and confident — not aggressive or defensive.
2. The "Killer Question" must gently lead the buyer to evaluate the total cost of inertia or hidden competitor shortcomings.
3. Proof points must be tangible and believable.
`;

    const { output } = await ai.generate({
      system: systemPrompt,
      prompt: 'Synthesize a high-impact tactical Objection Battlecard for the sales team.',
      output: { schema: generateDealBattlecardOutputSchema },
      config: {
        temperature: 0.25,
      },
    });

    if (!output) {
      throw new Error('Failed to generate deal battlecard.');
    }

    return output;
  }
);
