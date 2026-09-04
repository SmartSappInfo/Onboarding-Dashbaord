import { ai } from '../genkit';
import { z } from 'genkit';

/**
 * AI Canvas Node Expansion Flow (Company Brain Phase 6).
 *
 * Takes an existing node on the visual Idea Canvas (e.g. Problem, Solution, Hypothesis)
 * and generates sub-branches or related exploratory nodes (e.g. root causes, alternatives,
 * specific risk factors, testing metrics).
 */

export const decomposeIdeaCanvasInputSchema = z.object({
  nodeType: z
    .enum(['core_idea', 'problem', 'solution', 'assumption', 'hypothesis', 'evidence', 'experiment', 'crm_entity'])
    .describe('Type of the node being expanded'),
  nodeTitle: z.string().describe('Title of the node'),
  nodeDescription: z.string().optional().describe('Description of the node'),
  ideaTitle: z.string().describe('Contextual idea title'),
  existingConnectedNodes: z.array(z.string()).optional().describe('Titles of nodes already connected'),
});

export const decomposeIdeaCanvasOutputSchema = z.object({
  suggestedNodes: z
    .array(
      z.object({
        type: z
          .enum(['core_idea', 'problem', 'solution', 'assumption', 'hypothesis', 'evidence', 'experiment', 'crm_entity'])
          .describe('Node type for the new sub-node'),
        title: z.string().describe('Short title for the new canvas node'),
        description: z.string().describe('Brief explanatory text for the node'),
        relationLabel: z.string().describe('Relationship edge label (e.g. causes, solves, requires, tested_by)'),
        color: z.string().optional().describe('Hex color accent for the node'),
      })
    )
    .describe('List of 2 to 4 suggested child nodes'),
  explanation: z.string().describe('Strategic reasoning for these additions'),
});

export type DecomposeIdeaCanvasInput = z.infer<typeof decomposeIdeaCanvasInputSchema>;
export type DecomposeIdeaCanvasOutput = z.infer<typeof decomposeIdeaCanvasOutputSchema>;

export const decomposeIdeaCanvasFlow = ai.defineFlow(
  {
    name: 'decomposeIdeaCanvasFlow',
    inputSchema: decomposeIdeaCanvasInputSchema,
    outputSchema: decomposeIdeaCanvasOutputSchema,
  },
  async (input): Promise<DecomposeIdeaCanvasOutput> => {
    const { nodeType, nodeTitle, nodeDescription, ideaTitle, existingConnectedNodes } = input;

    const systemPrompt = `
You are the Visual Idea Canvas Assistant in SmartSapp Company Brain.
Your task is to propose 2 to 4 high-value sub-nodes to branch off an existing canvas node to help the team explore this idea more deeply.

Core Idea Context: "${ideaTitle}"
Node to Expand:
- Type: ${nodeType}
- Title: "${nodeTitle}"
- Description: ${nodeDescription || 'None'}

Already Connected Nodes:
${existingConnectedNodes?.map((t) => `- "${t}"`).join('\n') || 'None'}

Branching Rules:
- If expanding a 'problem': Propose root causes ('problem'), affected stakeholders ('crm_entity'), or evidence ('evidence').
- If expanding a 'solution': Propose specific mechanism components ('solution'), prerequisite assumptions ('assumption'), or experiments ('experiment').
- If expanding an 'assumption': Propose potential failure modes ('problem'), validation tests ('experiment'), or supporting citations ('evidence').
- If expanding a 'hypothesis': Propose concrete experiments ('experiment') or metric target outcomes ('solution').

Keep node titles under 8 words. Ensure edge labels are active verbs ('causes', 'solves', 'requires', 'tested_by', 'evidenced_by').
`;

    const response = await ai.generate({
      prompt: systemPrompt,
      output: { schema: decomposeIdeaCanvasOutputSchema },
      config: {
        temperature: 0.35,
      },
    });

    if (!response.output) {
      throw new Error('Failed to generate canvas decomposition nodes');
    }

    return response.output;
  }
);
