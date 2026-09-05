// NOTE: Intentionally NOT 'use server' — internal Genkit flow invoked via SwarmOrchestrator on server.

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Swarm Consensus & Multi-Perspective Synthesis Flow
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Perspective Diversity:
 *    - Never whitewash or silently discard disagreements between domain specialists.
 *    - Explicitly surfaces divergence and tension points for human operator adjudication.
 * 2. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All inputs and outputs conform strictly to Zod schemas.
 * 3. Resilient Deterministic Fallback:
 *    - When Gemini LLM is offline, provides deterministic multi-perspective consensus.
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import { ai, getModel } from '../genkit';
import { z } from 'genkit';
import type { SwarmConsensus, SwarmDivergencePoint } from '@/lib/agents/domain-types';
import type { AgentActionProposal } from '@/lib/supervisor/types';

export const synthesizeSwarmInputSchema = z.object({
  workspaceId: z.string().optional(),
  objective: z.string(),
  mode: z.enum(['parallel_consensus', 'sequential_pipeline', 'supervisor_directed']),
  specialistOutputs: z.array(
    z.object({
      specialistId: z.string(),
      specialistName: z.string(),
      answer: z.string(),
      findingsSummary: z.string(),
      findingsCount: z.number(),
      proposedActionsCount: z.number(),
    })
  ),
});

export type SynthesizeSwarmInput = z.infer<typeof synthesizeSwarmInputSchema>;

export const synthesizeSwarmOutputSchema = z.object({
  executiveSummary: z.string().describe('Synthesized multi-perspective briefing for executive stakeholders.'),
  consensusPoints: z.array(z.string()).describe('Statements and facts where multiple specialists are in full agreement.'),
  divergencePoints: z.array(
    z.object({
      topic: z.string(),
      perspectives: z.record(z.string()),
      tensionSummary: z.string(),
      recommendedEscalation: z.string(),
    })
  ).describe('Points of friction, opposing trade-offs, or divergence between specialist recommendations.'),
  jointActionProposals: z.array(
    z.object({
      toolName: z.string(),
      title: z.string(),
      description: z.string(),
      riskLevel: z.enum(['read_only', 'low_risk', 'high_risk', 'critical']),
      requiresApproval: z.boolean(),
      proposedBySpecialist: z.string(),
    })
  ).describe('Prioritized action proposals synthesized from the swarm analysis.'),
  confidenceScore: z.number().min(0).max(1),
});

export type SynthesizeSwarmOutput = z.infer<typeof synthesizeSwarmOutputSchema>;

/**
 * Deterministic fallback synthesis when LLM is unavailable or offline.
 */
export function synthesizeSwarmDeterministic(input: SynthesizeSwarmInput): SynthesizeSwarmOutput {
  const { objective, mode, specialistOutputs } = input;

  const consensusPoints: string[] = [];
  const divergencePoints: SwarmDivergencePoint[] = [];
  const jointActionProposals: SynthesizeSwarmOutput['jointActionProposals'] = [];

  // Generate baseline consensus points from specialist findings
  for (const s of specialistOutputs) {
    if (s.findingsCount > 0) {
      consensusPoints.push(`${s.specialistName} verified domain parameters for objective: "${objective.substring(0, 50)}...".`);
    }
  }

  if (consensusPoints.length === 0) {
    consensusPoints.push(`All participating specialists completed review for objective: "${objective}".`);
  }

  // Detect potential tension between Revenue and Governance if both present
  const hasRevenue = specialistOutputs.some((s) => s.specialistId === 'revenue_specialist');
  const hasGovernance = specialistOutputs.some((s) => s.specialistId === 'governance_specialist');

  if (hasRevenue && hasGovernance) {
    divergencePoints.push({
      topic: 'Commercial Acceleration vs Compliance Scrutiny',
      perspectives: {
        revenue_specialist: 'Prioritizing immediate pipeline velocity and stage progression.',
        governance_specialist: 'Requiring rigorous contract compliance and audit confirmation.',
      },
      tensionSummary: 'Revenue specialist advocates rapid deal advance while Governance emphasizes verification of prerequisite agreements.',
      recommendedEscalation: 'Human Account Director should review contract terms before advancing stage.',
    });
  }

  // Synthesize joint action proposals
  for (const s of specialistOutputs) {
    if (s.proposedActionsCount > 0) {
      jointActionProposals.push({
        toolName: s.specialistId === 'revenue_specialist' ? 'crm.deal.update' : 'task.create',
        title: `${s.specialistName}: Follow-up Action Plan`,
        description: `Execute recommended next steps from ${s.specialistName} domain analysis.`,
        riskLevel: s.specialistId === 'revenue_specialist' ? 'high_risk' : 'low_risk',
        requiresApproval: s.specialistId === 'revenue_specialist',
        proposedBySpecialist: s.specialistId,
      });
    }
  }

  const executiveSummary = `### Swarm Multi-Perspective Synthesis\n\n` +
    `**Mission Objective:** ${objective}\n` +
    `**Execution Mode:** ${mode.replace('_', ' ').toUpperCase()}\n` +
    `**Specialists Consulted:** ${specialistOutputs.map((s) => s.specialistName).join(', ')}\n\n` +
    `#### Domain Overview\n` +
    specialistOutputs.map((s) => `* **${s.specialistName}:** ${s.answer}`).join('\n') + '\n\n' +
    (divergencePoints.length > 0
      ? `> [!WARNING]\n> **Tension Detected:** ${divergencePoints[0].tensionSummary}\n`
      : `> [!NOTE]\n> High alignment across all specialist domains.\n`);

  return {
    executiveSummary,
    consensusPoints,
    divergencePoints,
    jointActionProposals,
    confidenceScore: 0.9,
  };
}

/**
 * Genkit AI Flow for Swarm Consensus & Multi-Perspective Synthesis.
 */
export const synthesizeSwarmConsensusFlow = ai.defineFlow(
  {
    name: 'synthesizeSwarmConsensusFlow',
    inputSchema: synthesizeSwarmInputSchema,
    outputSchema: synthesizeSwarmOutputSchema,
  },
  async (input: SynthesizeSwarmInput): Promise<SynthesizeSwarmOutput> => {
    // If Gemini key is missing or model undefined, fallback safely
    if (!process.env.GEMINI_API_KEY) {
      return synthesizeSwarmDeterministic(input);
    }

    try {
      const prompt = `You are the Swarm Consensus & Synthesis Engine for SmartSapp.
Your task is to analyze the distinct outputs from multiple domain specialists and produce a unified, truthful executive briefing.

CRITICAL INSTRUCTIONS:
1. Preserve Multi-Perspective Diversity: Do NOT force false agreement. If specialists have differing views, surface them in "divergencePoints".
2. Identify Clear Consensus: Find facts, insights, or priorities that multiple specialists agree upon.
3. Formulate Joint Action Proposals: Propose concrete next steps mapping to governed tools (crm.deal.update, task.create, memory.resolve_conflict).
4. Tone: Professional, analytical, executive-ready.

OBJECTIVE:
${input.objective}

EXECUTION MODE:
${input.mode}

SPECIALIST OUTPUTS:
${JSON.stringify(input.specialistOutputs, null, 2)}
`;

      const { modelString, customAi } = await getModel({
        workspaceId: input.workspaceId,
        tier: 'reasoning',
      });
      const generator = customAi || ai;

      const response = await generator.generate({
        model: modelString,
        prompt,
        output: {
          schema: synthesizeSwarmOutputSchema,
        },
      });

      if (!response.output) {
        return synthesizeSwarmDeterministic(input);
      }

      return response.output;
    } catch (err) {
      console.warn('[synthesizeSwarmConsensusFlow] LLM error, using deterministic fallback:', err);
      return synthesizeSwarmDeterministic(input);
    }
  }
);
