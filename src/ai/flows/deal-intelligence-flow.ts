import { ai, getModel } from '../genkit';
import { z } from 'genkit';

/**
 * @fileoverview Genkit Flow: Deal Intelligence & Next-Best-Action Engine
 *
 * ARCHITECTURAL POINTER (AI Revenue Insights):
 * Evaluates deal stage velocity, notes, stakeholder composition, and commercial line items
 * to produce:
 * - Executive opportunity summaries
 * - Grounded win probability assessment with key drivers
 * - Critical risk factor identification
 * - 3 prioritized next-best actions convertible to tasks
 */

export const dealIntelligenceInputSchema = z.object({
  dealName: z.string(),
  dealValue: z.number(),
  currency: z.string().default('USD'),
  stageName: z.string(),
  daysInStage: z.number(),
  status: z.string(),
  notes: z.array(z.string()).optional(),
  focalContacts: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
  })).optional(),
  lineItems: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })).optional(),
});

export const dealIntelligenceOutputSchema = z.object({
  executiveSummary: z.string().describe('Executive 2-sentence synthesis of deal health and strategic opportunity'),
  winProbability: z.number().min(0).max(100).describe('Estimated win probability percentage (0 to 100)'),
  winDrivers: z.array(z.string()).describe('Top 2-3 factors increasing deal likelihood'),
  riskFactors: z.array(z.string()).describe('Top 2-3 potential obstacles, stalls, or risks'),
  dealHealthAssessment: z.enum(['healthy', 'at_risk', 'stalled']).describe('Overall opportunity health assessment'),
  nextBestActions: z.array(
    z.object({
      title: z.string().describe('Actionable imperative next step (e.g. Schedule Executive Demo)'),
      rationale: z.string().describe('Why this step accelerates closing'),
      priority: z.enum(['high', 'medium', 'low']),
      suggestedType: z.enum(['task', 'meeting', 'call', 'follow_up']),
    })
  ).describe('3 highly specific, prioritized next best actions'),
});

export const dealIntelligenceFlow = ai.defineFlow(
  {
    name: 'dealIntelligenceFlow',
    inputSchema: dealIntelligenceInputSchema,
    outputSchema: dealIntelligenceOutputSchema,
  },
  async (input) => {
    const prompt = `You are a Principal Revenue Operations Consultant and AI Sales Coach for enterprise software and B2B SaaS.
Analyze the following deal opportunity and provide grounded, highly actionable intelligence.

Deal Name: "${input.dealName}"
Deal Value: ${input.currency} ${input.dealValue}
Current Stage: "${input.stageName}" (${input.daysInStage} days in stage)
Lifecycle Status: ${input.status}
Stakeholders: ${input.focalContacts?.map(c => `${c.name} (${c.role || 'Stakeholder'})`).join(', ') || 'No focal stakeholders specified'}
Line Items: ${input.lineItems?.map(l => `${l.quantity}x ${l.name} (${input.currency} ${l.total})`).join(', ') || 'No itemized line items'}
Recent Notes / Context:
${input.notes?.map(n => `- ${n}`).join('\n') || 'No specific notes recorded.'}

Provide an executive assessment adhering strictly to the structured schema:
1. Executive Summary: Crisp, professional synthesis.
2. Win Probability & Key Drivers: Realistic probability based on stage, velocity, and stakeholders.
3. Identified Risk Factors: Stagnation, missing decision-makers, or lack of commercial items.
4. Next-Best-Actions: 3 prioritized, immediate actions for the account executive.`;

    const resolvedModel = await getModel({
      provider: 'googleai',
      modelId: 'gemini-2.5-flash',
    });
    const activeAi = resolvedModel.customAi || ai;

    const response = await activeAi.generate({
      model: resolvedModel.modelString,
      prompt,
      output: {
        schema: dealIntelligenceOutputSchema,
      },
    });

    if (!response.output) {
      throw new Error('AI failed to generate deal intelligence');
    }

    return response.output;
  }
);
