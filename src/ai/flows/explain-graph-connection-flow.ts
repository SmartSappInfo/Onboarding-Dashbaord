// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via KnowledgeGraphService on server.

/**
 * @fileOverview CompanyBrain 2.0: AI Graph Connection Explanation Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Grounded Relationship Reasoning (PRD Section 25 & UI Section 25):
 *    - Synthesizes a natural-language narrative answering: "Explain why these nodes are connected."
 *    - Strictly bounded by verified graph paths and event citations to prevent LLM hallucinations.
 * 2. Deterministic Fallback:
 *    - If Genkit is unconfigured or rate limited, generates a deterministic semantic path explanation.
 * 3. Strict Zero-`any` typing:
 *    - Fully validated with Zod schemas.
 *
 * @testability Covered in `src/lib/memory/__tests__/knowledge-graph-service.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';

export const explainGraphConnectionInputSchema = z.object({
  startNodeId: z.string().describe('ID of starting node'),
  startNodeLabel: z.string().describe('Display label of starting node'),
  targetNodeId: z.string().describe('ID of destination node'),
  targetNodeLabel: z.string().describe('Display label of destination node'),
  pathSteps: z
    .array(
      z.object({
        sourceLabel: z.string(),
        sourceType: z.string(),
        relationshipType: z.string(),
        targetLabel: z.string(),
        targetType: z.string(),
        eventContext: z.string().optional(),
      })
    )
    .describe('Sequential traversal steps along the shortest path'),
  workspaceId: z.string().optional(),
});

export type ExplainGraphConnectionInput = z.infer<typeof explainGraphConnectionInputSchema>;

export const explainGraphConnectionOutputSchema = z.object({
  narrative: z.string().describe('A 2-4 sentence narrative explaining the connection'),
  summary: z.string().describe('A concise 1-sentence headline'),
  confidence: z.number().min(0).max(1).describe('Confidence score of the explanation'),
  eventsCited: z.array(z.string()).describe('Specific meetings, deals, or dates cited'),
});

export type ExplainGraphConnectionOutput = z.infer<typeof explainGraphConnectionOutputSchema>;

export const explainGraphConnectionFlow = ai.defineFlow(
  {
    name: 'explainGraphConnectionFlow',
    inputSchema: explainGraphConnectionInputSchema,
    outputSchema: explainGraphConnectionOutputSchema,
  },
  async (input: ExplainGraphConnectionInput): Promise<ExplainGraphConnectionOutput> => {
    const { startNodeLabel, targetNodeLabel, pathSteps } = input;

    if (pathSteps.length === 0) {
      return {
        narrative: `${startNodeLabel} and ${targetNodeLabel} are not currently connected by any recorded path in the knowledge graph.`,
        summary: 'No path discovered between entities.',
        confidence: 0.0,
        eventsCited: [],
      };
    }

    // Prepare path summary for prompt
    const stepsText = pathSteps
      .map(
        (s, i) =>
          `Step ${i + 1}: ${s.sourceLabel} (${s.sourceType}) --[${s.relationshipType}]--> ${s.targetLabel} (${s.targetType})${s.eventContext ? ` [Context: ${s.eventContext}]` : ''}`
      )
      .join('\n');

    try {
      const prompt = `You are the CompanyBrain Knowledge Graph Reasoning Engine.
Analyze the following multi-hop path connecting "${startNodeLabel}" to "${targetNodeLabel}":

${stepsText}

Instructions:
1. Explain WHY and HOW these two entities/memories are connected in natural business language.
2. Cite the intermediate meetings, deals, tasks, or notes that form the bridge.
3. Be concise (2 to 3 sentences). Do NOT invent facts or events not listed in the path steps.
4. Output JSON matching the requested schema.`;

      const { modelString, customAi } = await getModel('gemini-3.6-flash');
      const generator = customAi || ai;
      const response = await generator.generate({
        model: modelString,
        prompt,
        output: { schema: explainGraphConnectionOutputSchema },
        config: {
          temperature: 0.1,
        },
      });

      if (response.output) {
        return response.output;
      }
    } catch (err) {
      console.warn('[explainGraphConnectionFlow] LLM call failed, using deterministic synthesis:', err);
    }

    // Deterministic fallback if Genkit/Gemini is offline or unconfigured
    const intermediateLabels = pathSteps
      .map((s) => s.targetLabel)
      .filter((l) => l !== targetNodeLabel);

    const bridgeText =
      intermediateLabels.length > 0
        ? ` through intermediate connections including ${intermediateLabels.join(', ')}`
        : ' directly';

    const eventsCited = pathSteps
      .map((s) => s.eventContext)
      .filter((c): c is string => Boolean(c));

    return {
      narrative: `"${startNodeLabel}" is connected to "${targetNodeLabel}"${bridgeText} across ${pathSteps.length} hop(s) via ${pathSteps.map((s) => s.relationshipType).join(' -> ')}.`,
      summary: `Connected via ${pathSteps.length} relationship hop(s).`,
      confidence: 0.85,
      eventsCited,
    };
  }
);
