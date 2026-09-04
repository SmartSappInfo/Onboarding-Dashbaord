import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Campaign Concept Generation Flow (Company Brain Phase 8).
 *
 * Automatically transforms validated Ideas, customer feedback, and objections into
 * a high-converting, omnichannel Campaign Concept with Value Pillars, Hook, Personas,
 * Objection Rebuttals, and Channel Mix grounded in real customer quotes.
 */

export const generateCampaignConceptInputSchema = z.object({
  sourceIdea: z
    .object({
      id: z.string(),
      title: z.string(),
      problemStatement: z.string().optional(),
      proposedSolution: z.string().optional(),
      targetAudience: z.string().optional(),
      valueProposition: z.string().optional(),
    })
    .optional()
    .describe('Optional source Idea entity to base the campaign concept upon'),
  customerNotes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        date: z.string().optional(),
        entityNames: z.array(z.string()).optional(),
      })
    )
    .describe('List of relevant customer feedback notes, call summaries, and objection records'),
  workspaceContext: z
    .object({
      organizationName: z.string().optional(),
      industry: z.string().optional(),
      customDirectives: z.string().optional(),
      preferredChannels: z.array(z.enum(['whatsapp', 'sms', 'email', 'call_center'])).optional(),
    })
    .optional()
    .describe('Workspace market context and strategic guidance'),
});

export const generateCampaignConceptOutputSchema = z.object({
  title: z.string().describe('Catchy, conversion-focused campaign title'),
  targetAudience: z.string().describe('Specific customer segment or job role targeted'),
  targetPersonaSummary: z.string().describe('Summary of the buyer persona, daily pressures, and core aspirations'),
  valueProposition: z.string().describe('Clear 1-sentence value proposition articulating the transformation'),
  valuePillars: z.array(z.string()).describe('Top 3 core benefit pillars supporting the value proposition'),
  coreMessageHook: z.string().describe('High-converting opening hook / headline for messaging'),
  objectionRebuttals: z
    .array(
      z.object({
        id: z.string().describe('Unique ID for this rebuttal item'),
        objection: z.string().describe('Specific objection or friction point raised by customers'),
        rebuttal: z.string().describe('Tactical, persuasive rebuttal script'),
        counterProofPoints: z.array(z.string()).describe('Evidence or data points validating the rebuttal'),
        frequencyCount: z.number().describe('Estimated frequency or severity score (1-20)'),
        sourceQuotes: z.array(z.string()).describe('Exact verbatim quotes from customer notes showing this objection'),
        confidence: z.number().describe('Confidence score between 0.0 and 1.0'),
      })
    )
    .describe('Top customer objections and verified rebuttal arguments'),
  recommendedChannels: z
    .array(z.enum(['whatsapp', 'sms', 'email', 'call_center']))
    .describe('Recommended delivery channels prioritized by audience reach and conversion likelihood'),
  callToAction: z.string().describe('Clear, low-friction next step for the recipient'),
  copyVariations: z
    .array(
      z.object({
        channel: z.enum(['whatsapp', 'sms', 'email', 'call_center']),
        hook: z.string().describe('Channel-specific subject line or opening line'),
        bodyText: z.string().describe('Channel-optimized message copy'),
        callToAction: z.string().describe('Channel-optimized CTA button / action prompt'),
      })
    )
    .describe('Ready-to-use omnichannel copy snippets'),
  relevanceScore: z.number().describe('Calculated relevance & conversion confidence score (0-100)'),
});

export type GenerateCampaignConceptInput = z.infer<typeof generateCampaignConceptInputSchema>;
export type GenerateCampaignConceptOutput = z.infer<typeof generateCampaignConceptOutputSchema>;

export const generateCampaignConceptFlow = ai.defineFlow(
  {
    name: 'generateCampaignConceptFlow',
    inputSchema: generateCampaignConceptInputSchema,
    outputSchema: generateCampaignConceptOutputSchema,
  },
  async (input): Promise<GenerateCampaignConceptOutput> => {
    const { sourceIdea, customerNotes, workspaceContext } = input;

    // Bounded context formatting
    const notesFormatted = (customerNotes || [])
      .slice(0, 25)
      .map(
        (n, idx) =>
          `[Note ${idx + 1} | ID: ${n.id} | Date: ${n.date || 'Recent'}]\nTitle: ${n.title}\n${
            n.entityNames && n.entityNames.length > 0 ? `Entities: ${n.entityNames.join(', ')}\n` : ''
          }Content: ${n.content.substring(0, 500)}`
      )
      .join('\n\n---\n\n');

    const ideaFormatted = sourceIdea
      ? `SOURCE IDEA CONTEXT:\n- Title: ${sourceIdea.title}\n- Problem: ${sourceIdea.problemStatement || 'N/A'}\n- Proposed Solution: ${
          sourceIdea.proposedSolution || 'N/A'
        }\n- Target Audience: ${sourceIdea.targetAudience || 'N/A'}\n- Value Prop: ${sourceIdea.valueProposition || 'N/A'}`
      : 'NO SPECIFIC SOURCE IDEA PROVIDED — SYNTHESIZE DIRECTLY FROM CUSTOMER NOTES & CRM FEEDBACK.';

    const systemPrompt = `
You are the SmartSapp Lead Campaign Strategist & Direct Response Marketing Copywriter.
Your mission is to transform organizational customer intelligence, sales call notes, and validated strategic ideas into a high-converting, omnichannel Campaign Concept.

CORE REQUIREMENTS:
1. Ground every claim in real customer pain points and quotes from the provided notes.
2. Focus on high-converting value propositions (save time, recover lost revenue, eliminate manual errors, ensure peace of mind).
3. Identify the TOP 2-4 actual customer objections cited in the notes (e.g. pricing, fear of change, technical complexity, timing) and write empathetic, bulletproof rebuttals.
4. Provide channel-specific copy variations (WhatsApp: conversational with Momo/link CTA; SMS: concise under 160 chars; Email: professional with narrative proof; Call Center: conversational agent script).
5. NEVER fabricate false pricing discounts, unapproved guarantees, or unsupported assertions.

MARKET CONTEXT:
${workspaceContext?.organizationName ? `Organization: ${workspaceContext.organizationName}` : ''}
${workspaceContext?.industry ? `Industry: ${workspaceContext.industry}` : 'Education & Enterprise Software (SmartSapp EdTech/SaaS ecosystem)'}
${workspaceContext?.customDirectives ? `Directives: ${workspaceContext.customDirectives}` : ''}

${ideaFormatted}

CUSTOMER NOTES & CALL TRANSCRIPTS:
${notesFormatted || 'No historical notes provided. Generate a flagship campaign based on standard school management & tuition collection best practices.'}
`;

    const { output } = await ai.generate({
      system: systemPrompt,
      prompt: 'Synthesize a structured, production-ready Campaign Concept ready for immediate deployment into Campaign Studio.',
      output: { schema: generateCampaignConceptOutputSchema },
      config: {
        temperature: 0.2, // Low temperature for high factual grounding
      },
    });

    if (!output) {
      throw new Error('Failed to generate campaign concept from AI flow.');
    }

    return output;
  }
);
