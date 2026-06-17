'use server';
/**
 * @fileOverview An AI flow to generate automation workflow step architectures.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAutomationInputSchema = z.object({
  prompt: z.string().describe("Natural language description of the automation flow."),
  availableTemplates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string()
  })).describe("Templates registered in the workspace that the AI can reference and trigger."),
  organizationId: z.string().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});
export type GenerateAutomationInput = z.infer<typeof GenerateAutomationInputSchema>;

const GenerateAutomationOutputSchema = z.object({
  name: z.string().describe("A professional name for this automation workflow."),
  description: z.string().describe("A concise summary of what this automation does."),
  trigger: z.object({
    type: z.string().describe("The trigger type: 'tag_added', 'survey_submitted', 'form_submitted', 'deal_stage_changed', 'manual'"),
    config: z.record(z.any()).describe("Configuration options for the trigger (e.g. tagId, surveyId)."),
  }),
  steps: z.array(z.object({
    id: z.string().describe("Unique identifier for this step node (e.g. step_send_welcome)."),
    type: z.enum(['action', 'condition', 'delay']),
    config: z.record(z.any()).describe("Configuration options matching the node type (e.g. actionType = 'send_email', templateId, durationDays)."),
    nextStepId: z.string().optional().describe("The ID of the next step to execute in sequence."),
  })).describe("Sequential order of actions, delays, or conditions in the workflow."),
});
export type GenerateAutomationOutput = z.infer<typeof GenerateAutomationOutputSchema>;

function renderAutomationPrompt(input: {
  prompt: string;
  availableTemplates: { id: string; name: string; type: string }[];
}): string {
  return `You are a Lead Workflow Architect and Business Intelligence Analyst. Your task is to generate a structured automation rule engine blueprint based on natural language instructions.

### ARCHITECTURAL STANDARDS:
1. **Trigger Types**: Choose from 'tag_added', 'survey_submitted', 'form_submitted', 'deal_stage_changed', 'manual'.
2. **Step Node Types**:
   - **action**: Configures a concrete operation. Common action types include:
     - 'send_email': Requires a 'templateId' parameter.
     - 'send_sms': Requires a 'templateId' or raw 'message' parameter.
     - 'add_tag': Requires 'tagId'.
     - 'update_deal_stage': Requires 'stageId'.
   - **delay**: Sets a pause in the execution chain. Config contains 'duration' (number) and 'unit' ('minutes' | 'hours' | 'days').
   - **condition**: Checks a field value. Config contains 'field', 'operator', 'value'.
3. **Template Referencing**: If the instructions mention sending an email or message, try to match it with one of the available templates below. If a match is found, assign the 'templateId' configuration parameter.
Available Templates:
${input.availableTemplates.map(t => `- Name: "${t.name}" (ID: "${t.id}", Type: "${t.type}")`).join('\n')}

Instructions:
"""
${input.prompt}
"""
`;
}

const generateAutomationFlow = ai.defineFlow(
  {
    name: 'generateAutomationFlow',
    inputSchema: GenerateAutomationInputSchema,
    outputSchema: GenerateAutomationOutputSchema,
  },
  async (input) => {
    const { organizationId, provider = 'anthropic', modelId = 'claude-sonnet-4-6' } = input;

    const resolvedModel = await getModel({
      organizationId,
      provider,
      modelId,
    });

    const generatorAi = resolvedModel.customAi || ai;

    const promptText = renderAutomationPrompt({
      prompt: input.prompt,
      availableTemplates: input.availableTemplates,
    });

    const { output } = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: promptText,
      output: { schema: GenerateAutomationOutputSchema }
    });

    if (!output) {
      throw new Error("Failed to generate structured automation workflow steps.");
    }

    return output;
  }
);

export async function generateAutomation(input: GenerateAutomationInput): Promise<GenerateAutomationOutput> {
  return generateAutomationFlow(input);
}
