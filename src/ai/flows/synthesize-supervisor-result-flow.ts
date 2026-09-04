'use server';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Result Synthesis Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Grounded Result Synthesis:
 *    - Combines outputs from all executed plan steps and citations into a comprehensive,
 *      truthful executive synthesis conforming to PRD Section 56.
 * 2. Actionable Proposals:
 *    - Surfaces structured follow-up action recommendations that map to governed tools.
 * 3. Resilient Deterministic Fallback:
 *    - If Gemini API is offline or unconfigured, produces a structured analytical
 *      synthesis without failure.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 *
 * @testability Covered in `src/lib/supervisor/__tests__/supervisor-engine.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type { AgentFinding, AgentActionProposal } from '@/lib/supervisor/types';
import type { McpPayloadValue } from '@/lib/mcp/types';

export const synthesizeResultInputSchema = z.object({
  objective: z.string(),
  subjectId: z.string().optional(),
  subjectType: z.string().optional(),
  completedSteps: z.array(
    z.object({
      stepNumber: z.number(),
      title: z.string(),
      toolName: z.string(),
      outputSummary: z.string(),
      rawOutput: z.string().optional(),
    })
  ),
  citations: z.array(
    z.object({
      sourceId: z.string(),
      sourceTitle: z.string(),
      excerpt: z.string(),
      author: z.string(),
    })
  ),
});

export type SynthesizeResultInput = z.infer<typeof synthesizeResultInputSchema>;

export const synthesizeResultOutputSchema = z.object({
  executiveSummary: z.string().describe('Comprehensive markdown briefing summarizing conclusions and evidence.'),
  findings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.enum(['risk', 'opportunity', 'contradiction', 'insight', 'trend']),
      sourceIds: z.array(z.string()),
    })
  ),
  proposedActions: z.array(
    z.object({
      id: z.string(),
      toolName: z.string(),
      title: z.string(),
      description: z.string(),
      parameters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
      riskLevel: z.enum(['read_only', 'low_risk', 'high_risk', 'critical']),
      requiresApproval: z.boolean(),
    })
  ),
});

export type SynthesizeResultOutput = z.infer<typeof synthesizeResultOutputSchema>;

/**
 * Deterministic fallback synthesizer when LLM is unavailable.
 */
export function synthesizeResultDeterministic(input: SynthesizeResultInput): SynthesizeResultOutput {
  const { objective, completedSteps, citations } = input;

  const findings: SynthesizeResultOutput['findings'] = [];
  const proposedActions: SynthesizeResultOutput['proposedActions'] = [];

  // Derive findings from completed step summaries
  for (const step of completedSteps) {
    findings.push({
      id: `fnd_${step.stepNumber}_${Date.now().toString(36)}`,
      title: `${step.title} Findings`,
      description: step.outputSummary || `Completed execution of tool "${step.toolName}".`,
      confidence: 0.9,
      category: 'insight',
      sourceIds: citations.map((c) => c.sourceId),
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: `fnd_default_${Date.now().toString(36)}`,
      title: 'Mission Assessment',
      description: `Analyzed objective "${objective}" across available workspace repositories.`,
      confidence: 0.85,
      category: 'insight',
      sourceIds: [],
    });
  }

  // Suggest default action if none generated
  proposedActions.push({
    id: `act_followup_${Date.now().toString(36)}`,
    toolName: 'task.create',
    title: 'Review Mission Synthesis',
    description: `Conduct operational review of mission: "${objective.slice(0, 50)}..."`,
    parameters: {
      title: `Mission Action Item: ${objective.slice(0, 40)}`,
      priority: 'medium',
    },
    riskLevel: 'low_risk',
    requiresApproval: false,
  });

  const stepBullets = completedSteps
    .map((s) => `* **Step ${s.stepNumber} (${s.title}):** ${s.outputSummary}`)
    .join('\n');

  const executiveSummary = `### Executive Mission Synthesis

**Objective:** ${objective}

**Execution Summary:**
${stepBullets || '* Mission compiled without step execution notes.'}

**Conclusions:**
The workspace context and MCP tools have been queried to fulfill this mission. Review the structured findings and proposed actions below to proceed with operational implementation.`;

  return {
    executiveSummary,
    findings,
    proposedActions,
  };
}

/**
 * Genkit Flow: Synthesizes final agent results, structured findings, and action proposals.
 */
export const synthesizeSupervisorResultFlow = ai.defineFlow(
  {
    name: 'synthesizeSupervisorResultFlow',
    inputSchema: synthesizeResultInputSchema,
    outputSchema: synthesizeResultOutputSchema,
  },
  async (input: SynthesizeResultInput): Promise<SynthesizeResultOutput> => {
    if (!process.env.GEMINI_API_KEY) {
      return synthesizeResultDeterministic(input);
    }

    try {
      const stepDetails = input.completedSteps
        .map((s) => `### Step ${s.stepNumber}: ${s.title} (Tool: ${s.toolName})\nSummary: ${s.outputSummary}\nOutput: ${s.rawOutput || 'N/A'}`)
        .join('\n\n');

      const citationDetails = input.citations
        .map((c) => `- [${c.sourceTitle}] by ${c.author}: "${c.excerpt}" (ID: ${c.sourceId})`)
        .join('\n');

      const systemPrompt = `You are the SmartSapp CompanyBrain Supervisor Agent synthesizing the final outcome of an autonomous mission.
Your task is to review all executed step outputs and citations to produce a clear, authoritative executive brief.

REQUIREMENTS:
1. "executiveSummary": Write a well-structured markdown summary. Include key metrics, decisions, and commercial implications.
2. "findings": Identify concrete insights, risks, opportunities, or contradictions supported by the evidence.
3. "proposedActions": Recommend high-impact next steps with specific parameters mapping to governed tools (e.g. task.create, deal.update_stage). Assign proper riskLevel and requiresApproval flags.`;

      const userPrompt = `Mission Objective: "${input.objective}"
Target Subject: ${input.subjectId ? `${input.subjectType} (${input.subjectId})` : 'General Workspace'}

EXECUTED STEPS:
${stepDetails || 'No steps executed.'}

GROUNDED CITATIONS:
${citationDetails || 'No direct citations.'}

Synthesize the final mission briefing.`;

      const response = await ai.generate({
        model: getModel('gemini-2.5-flash'),
        system: systemPrompt,
        prompt: userPrompt,
        output: { schema: synthesizeResultOutputSchema },
        config: { temperature: 0.2 },
      });

      if (!response.output || !response.output.executiveSummary) {
        return synthesizeResultDeterministic(input);
      }

      return response.output;
    } catch (err) {
      console.warn('[synthesizeSupervisorResultFlow] AI generation failed, using fallback:', err);
      return synthesizeResultDeterministic(input);
    }
  }
);
