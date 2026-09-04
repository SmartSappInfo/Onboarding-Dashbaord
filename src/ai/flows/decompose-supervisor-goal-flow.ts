'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Goal Decomposition Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Intent Detection & Goal Decomposition:
 *    - Decomposes high-level natural language user objectives into an ordered,
 *      executable sequence of governed MCP tools or subagent calls.
 * 2. Bounded Execution Budget:
 *    - Hard upper bound of 10 steps to prevent runaway loops or budget exhaustion.
 * 3. Resilient Deterministic Fallback:
 *    - If Gemini 2.5 is unavailable or unconfigured, produces a rule-based
 *      multi-step plan mapping to core MCP tools.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 *
 * @testability Covered in `src/lib/supervisor/__tests__/supervisor-engine.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type { SupervisorPlan, SupervisorPlanStep } from '@/lib/supervisor/types';
import type { McpPayloadValue } from '@/lib/mcp/types';

export const decomposeGoalInputSchema = z.object({
  objective: z.string().min(1).describe('The natural language objective or mission command.'),
  subjectId: z.string().optional().describe('Optional target entity ID, deal ID, or meeting ID.'),
  subjectType: z.string().optional().describe('Optional subject type (entity, deal, task, meeting).'),
  contextSummary: z.string().optional().describe('Summary of relevant institutional context assembled from Phase 5.'),
  availableTools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      category: z.string().optional(),
      riskLevel: z.string().optional(),
      requiresApproval: z.boolean().optional(),
    })
  ).optional().describe('Catalog of active MCP tools available for selection.'),
  maxSteps: z.number().int().min(1).max(10).optional().default(5),
});

export type DecomposeGoalInput = z.infer<typeof decomposeGoalInputSchema>;

export const planStepSchema = z.object({
  stepNumber: z.number().int(),
  title: z.string(),
  intent: z.string(),
  assignedAgentOrTool: z.string(),
  arguments: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  whyThisStep: z.string(),
});

export const decomposeGoalOutputSchema = z.object({
  goalInterpretation: z.string().describe('Interpretation of user intent and success criteria.'),
  summary: z.string().describe('Executive summary of the execution roadmap.'),
  steps: z.array(planStepSchema).max(10),
});

export type DecomposeGoalOutput = z.infer<typeof decomposeGoalOutputSchema>;

/**
 * Deterministic rule-based decomposition fallback when AI model is offline or unconfigured.
 */
export function decomposeGoalDeterministic(input: DecomposeGoalInput): DecomposeGoalOutput {
  const { objective, subjectId, subjectType, availableTools, maxSteps = 5 } = input;
  const lowerObj = objective.toLowerCase();

  const toolNames = new Set(availableTools.map((t) => t.name));
  const steps: Array<z.infer<typeof planStepSchema>> = [];

  // Step 1: Context Assembly or Entity Lookup
  if (toolNames.has('context.build')) {
    const args: Record<string, string | number | boolean | null> = {
      objective,
    };
    if (subjectId) args.subjectId = subjectId;
    if (subjectType) args.subjectType = subjectType;

    steps.push({
      stepNumber: 1,
      title: 'Assemble Grounded Context & Institutional Memory',
      intent: 'Compile relevant memories, citations, and relation graph nodes for this objective.',
      assignedAgentOrTool: 'context.build',
      arguments: args,
      whyThisStep: 'Grounds the agent with verified facts and active contradiction warnings before taking action.',
    });
  }

  // Step 2: Knowledge Recall or Domain Query
  if (lowerObj.includes('deal') || lowerObj.includes('stage') || subjectType === 'deal') {
    if (toolNames.has('deal.get') && subjectId) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Retrieve Pipeline Deal Details',
        intent: 'Fetch current stage, value, and stakeholder metadata for the target deal.',
        assignedAgentOrTool: 'deal.get',
        arguments: { dealId: subjectId },
        whyThisStep: 'Examines commercial terms and stage velocity to inform recommendations.',
      });
    }
  } else if (lowerObj.includes('task') || lowerObj.includes('action item')) {
    if (toolNames.has('task.list')) {
      const args: Record<string, string | number | boolean | null> = { limit: 5 };
      if (subjectId) args.entityId = subjectId;

      steps.push({
        stepNumber: steps.length + 1,
        title: 'Inspect Pending Workspace Tasks',
        intent: 'Check open action items linked to this workspace or entity.',
        assignedAgentOrTool: 'task.list',
        arguments: args,
        whyThisStep: 'Avoids duplicate operational task creation.',
      });
    }
  } else {
    if (toolNames.has('memory.recall')) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Search Institutional Memory Mesh',
        intent: 'Recall cross-departmental notes, decisions, and agreements.',
        assignedAgentOrTool: 'memory.recall',
        arguments: { query: objective, limit: 5 },
        whyThisStep: 'Surfaces historical precedent and institutional insights.',
      });
    }
  }

  // Step 3: Synthesis or Follow-up Action
  if (lowerObj.includes('create task') || lowerObj.includes('follow up') || lowerObj.includes('action')) {
    if (toolNames.has('task.create')) {
      const taskArgs: Record<string, string | number | boolean | null> = {
        title: `Follow up: ${objective.slice(0, 40)}...`,
        priority: 'medium',
      };
      if (subjectId) taskArgs.entityId = subjectId;

      steps.push({
        stepNumber: steps.length + 1,
        title: 'Create Follow-up Action Item',
        intent: 'Persist an operational task for human completion.',
        assignedAgentOrTool: 'task.create',
        arguments: taskArgs,
        whyThisStep: 'Translates agent findings into durable workspace operational tasks.',
      });
    }
  }

  // Cap steps at maxSteps
  const boundedSteps = steps.slice(0, maxSteps).map((s, idx) => ({
    ...s,
    stepNumber: idx + 1,
  }));

  return {
    goalInterpretation: `Mission interpreted: "${objective}". Strategic focus on ${subjectType || 'general operations'}.`,
    summary: `Synthesized a ${boundedSteps.length}-step execution plan leveraging governed MCP capabilities.`,
    steps: boundedSteps,
  };
}

/**
 * Genkit Flow: Decomposes a mission goal into an executable supervisor plan.
 */
export const decomposeSupervisorGoalFlow = ai.defineFlow(
  {
    name: 'decomposeSupervisorGoalFlow',
    inputSchema: decomposeGoalInputSchema,
    outputSchema: decomposeGoalOutputSchema,
  },
  async (input: DecomposeGoalInput): Promise<DecomposeGoalOutput> => {
    // If no API key is set, use deterministic fallback
    if (!process.env.GEMINI_API_KEY) {
      return decomposeGoalDeterministic(input);
    }

    try {
      const toolDescriptions = input.availableTools
        .map((t) => `- Tool: "${t.name}" | Category: ${t.category} | Risk: ${t.riskLevel} | Needs Approval: ${t.requiresApproval}\n  Description: ${t.description}`)
        .join('\n');

      const systemPrompt = `You are the SmartSapp CompanyBrain Supervisor Agent.
Your role is to decompose high-level organizational objectives into a strictly-ordered execution plan.
You do NOT execute actions directly; you delegate to governed Model Context Protocol (MCP) tools.

AVAILABLE MCP TOOLS:
${toolDescriptions}

PLANNING RULES:
1. Every step MUST use an "assignedAgentOrTool" that exactly matches an available tool name above.
2. Order steps logically: gather context/data first, execute mutations later.
3. Keep the plan focused: max ${input.maxSteps || 5} steps.
4. Arguments must match tool parameter conventions.
5. Ground your choices in the provided objective and target subject.`;

      const userPrompt = `Objective: "${input.objective}"
Target Subject ID: ${input.subjectId || 'None'}
Target Subject Type: ${input.subjectType || 'None'}
Institutional Context Summary:
${input.contextSummary || 'None provided'}

Generate a structured execution plan.`;

      const { modelString, customAi } = await getModel('gemini-2.5-flash');
      const generator = customAi || ai;
      const response = await generator.generate({
        model: modelString,
        system: systemPrompt,
        prompt: userPrompt,
        output: { schema: decomposeGoalOutputSchema },
        config: { temperature: 0.2 },
      });

      if (!response.output || response.output.steps.length === 0) {
        return decomposeGoalDeterministic(input);
      }

      // Validate all tool names exist in availableTools
      const validToolNames = new Set(input.availableTools.map((t) => t.name));
      const sanitizedSteps = response.output.steps
        .filter((s) => validToolNames.has(s.assignedAgentOrTool))
        .slice(0, input.maxSteps || 5)
        .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

      if (sanitizedSteps.length === 0) {
        return decomposeGoalDeterministic(input);
      }

      return {
        goalInterpretation: response.output.goalInterpretation,
        summary: response.output.summary,
        steps: sanitizedSteps,
      };
    } catch (err) {
      console.warn('[decomposeSupervisorGoalFlow] AI generation failed, using deterministic fallback:', err);
      return decomposeGoalDeterministic(input);
    }
  }
);
