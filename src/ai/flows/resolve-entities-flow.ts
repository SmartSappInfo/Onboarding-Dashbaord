import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * Entity Resolution Flow (Phase 3).
 *
 * Scans notes, meeting transcripts, and interaction logs to identify mentions of
 * CRM entities (Contacts, Schools/Institutions, Leads, Deals) and match them
 * against workspace candidates with high precision.
 */
export const entityResolutionMatchSchema = z.object({
  entityId: z.string().describe('Matched ID from candidate list, or generated identifier'),
  entityName: z.string().describe('Name of the detected entity'),
  entityType: z.enum(['contact', 'school', 'lead', 'deal']).describe('Type of CRM entity'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0'),
  matchReason: z.string().describe('Rationale explaining why this entity was identified'),
});

export const entityResolutionOutputSchema = z.object({
  detectedEntities: z.array(entityResolutionMatchSchema).describe('All detected CRM entity mentions'),
  suggestedPrimaryLink: entityResolutionMatchSchema.optional().describe('Top suggested entity to link to'),
  extractedKeyTopics: z.array(z.string()).describe('Topical themes extracted from text'),
  buyingSignals: z.array(z.string()).describe('Customer buying signals or expansion indicators'),
  objections: z.array(z.string()).describe('Customer objections, friction points, or concerns'),
});

export type EntityResolutionOutput = z.infer<typeof entityResolutionOutputSchema>;

export const resolveEntitiesFlow = ai.defineFlow(
  {
    name: 'resolveEntitiesFlow',
    inputSchema: z.object({
      text: z.string(),
      candidateEntities: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.enum(['contact', 'school', 'lead', 'deal']),
          })
        )
        .optional()
        .describe('List of workspace candidate entities to match against'),
      workspaceContext: z.string().optional(),
    }),
    outputSchema: entityResolutionOutputSchema,
  },
  async (input) => {
    const rawText = input.text.trim();
    if (!rawText) {
      return {
        detectedEntities: [],
        extractedKeyTopics: [],
        buyingSignals: [],
        objections: [],
      };
    }

    const candidateListStr = input.candidateEntities?.length
      ? input.candidateEntities.map((c) => `- [${c.type}] "${c.name}" (ID: ${c.id})`).join('\n')
      : 'No pre-fetched candidate list provided.';

    const prompt = `You are an expert CRM Entity Resolution Agent for SmartSapp.
Analyze the following text or transcript and identify all explicit or strongly implied mentions of CRM entities (Contacts, Schools/Institutions, Leads, Deals).

Text Content:
"""
${rawText}
"""

Workspace Known Candidates:
${candidateListStr}

Instructions:
1. Match entity names mentioned in the text against the Workspace Known Candidates if available.
2. If an entity is mentioned that is not in the candidate list, extract its name and classify its type based on context.
3. Determine confidence score (0.0 to 1.0) and match reason.
4. If buying signals (e.g. asking for pricing, expressing urgency, requesting demo, expansion) are present, list them in buyingSignals.
5. If objections or friction (e.g. budget constraints, competitor preference, technical blockers) are present, list them in objections.
6. Designate the most prominent or central entity as the suggestedPrimaryLink (if confidence > 0.6).`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: entityResolutionOutputSchema },
    });

    return output || {
      detectedEntities: [],
      extractedKeyTopics: [],
      buyingSignals: [],
      objections: [],
    };
  }
);
