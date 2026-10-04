/**
 * @fileOverview Multi-Modal Real-Time Intent Classifier
 *
 * Implements deterministic sub-20ms regex/keyword heuristic classification with semantic
 * fallback to the TieredModelRouter (Flash tier). Includes prompt injection scanning
 * and strict Zod v4 schema verification.
 *
 * Rules Adherence:
 * - Rule 4: Zero `any` / zero `any[]` typing policy.
 * - Rule 13 & 30: Prompt injection scanning and `<untrusted_reference_data>` containerization.
 * - Rule 21: High-risk/destructive actions mandate approval and default to DELEGATE/EXECUTE with approval.
 * - Rule 47: Never trust the model — all outputs validated with Zod v4.
 * - Rule 58: Multi-model tier routing (Flash model for intent classification).
 * - Rule 69: HMR-safe singleton pattern.
 */

import {
  type CommandClassificationInput,
  type CommandClassificationResult,
  type CommandIntent,
  type TargetEntityMention,
  type SuggestedActionBlueprint,
  CommandClassificationInputSchema,
  CommandClassificationResultSchema,
  COMMAND_ERROR_CODES,
  CommandError,
} from './command-types';
import { evaluateMemoryContentRisk } from '@/platform/memory/governance/anti-poisoning';
import { getModelRouter, type TieredModelRouter } from '@/platform/runtime/routing/model-router';

// ============================================================================
// INTENT KEYWORD HEURISTICS & PATTERNS
// ============================================================================

interface HeuristicPattern {
  intent: CommandIntent;
  regex: RegExp;
  weight: number;
  domain?: string;
}

const INTENT_PATTERNS: HeuristicPattern[] = [
  // SEARCH patterns
  { intent: 'SEARCH', regex: /\b(search|find|lookup|show me|where is|who is|locate|list all|query|get contacts|get deals)\b/i, weight: 0.9, domain: 'knowledge' },
  { intent: 'SEARCH', regex: /\b(find deal|find contact|find meeting|search notes|search memory)\b/i, weight: 0.95, domain: 'knowledge' },

  // ANALYZE patterns
  { intent: 'ANALYZE', regex: /\b(analyze|summarize|compare|insight|why did|break down|forecast|trend|report on|evaluate|audit|performance of)\b/i, weight: 0.9, domain: 'analytics' },
  { intent: 'ANALYZE', regex: /\b(pipeline review|win rate|deal health|churn risk|sentiment)\b/i, weight: 0.95, domain: 'sales' },

  // AUTOMATE patterns
  { intent: 'AUTOMATE', regex: /\b(automate|workflow|recurring|schedule|trigger|every day|webhook|cron|pipeline|on every)\b/i, weight: 0.9, domain: 'workflows' },
  { intent: 'AUTOMATE', regex: /\b(set up automation|daily sync|weekly summary workflow|auto-tag)\b/i, weight: 0.95, domain: 'workflows' },

  // DELEGATE patterns
  { intent: 'DELEGATE', regex: /\b(assign to|delegate|research agent|have agent|sales agent|specialist|autonomous|plan and execute|run swarm|swarm)\b/i, weight: 0.9, domain: 'agents' },
  { intent: 'DELEGATE', regex: /\b(deep dive|investigate why|solve this|multi-step|lead researcher)\b/i, weight: 0.85, domain: 'agents' },

  // EXECUTE patterns
  { intent: 'EXECUTE', regex: /\b(create|update|send message|add note|tag contact|log meeting|close deal|stage to|email|dispatch)\b/i, weight: 0.85, domain: 'crm' },
  { intent: 'EXECUTE', regex: /\b(delete|drop|purge|revoke|remove all|archive)\b/i, weight: 0.95, domain: 'system' },
];

const DESTRUCTIVE_KEYWORDS = /\b(delete|drop|purge|revoke|remove all|destroy|wipe)\b/i;

// Regex for recognized entity ID prefixes
const ENTITY_ID_REGEX = /\b((?:deal|con|meet|lead|inv|note)_[a-zA-Z0-9_-]{4,32})\b/gi;

export interface CommandIntentClassifierOptions {
  modelRouter?: TieredModelRouter;
}

export class CommandIntentClassifier {
  private readonly modelRouter: TieredModelRouter;

  constructor(options?: CommandIntentClassifierOptions) {
    this.modelRouter = options?.modelRouter ?? getModelRouter();
  }

  /**
   * Classifies user intent from natural language input.
   * Performs prompt injection checks, heuristic matching, and semantic model fallback.
   */
  async classifyIntent(input: CommandClassificationInput): Promise<CommandClassificationResult> {
    const startTime = Date.now();
    const validatedInput = CommandClassificationInputSchema.parse(input);

    // 1. Anti-Poisoning & Prompt Injection Defense (Rules 13 & 30)
    const riskAssessment = evaluateMemoryContentRisk(validatedInput.prompt);
    if (!riskAssessment.isSafe && riskAssessment.riskScore >= 0.8) {
      throw new CommandError(
        COMMAND_ERROR_CODES.PROMPT_POISONED,
        `Potential prompt injection detected: [${riskAssessment.detectedPatterns.join(', ')}]`,
        400
      );
    }

    const sanitizedPrompt = riskAssessment.sanitized || validatedInput.prompt.trim();

    // 2. Extract Entities
    const targetEntities = this.extractTargetEntities(sanitizedPrompt, validatedInput);

    // 3. Fast Heuristic Classification (<20ms)
    const heuristicResult = this.evaluateHeuristics(sanitizedPrompt, targetEntities);

    // 4. Fallback to Flash Model Router if confidence is low (< 0.85) (Rule 58)
    if (heuristicResult.confidence < 0.85 && this.modelRouter) {
      try {
        const semanticResult = await this.classifyWithModel(
          sanitizedPrompt,
          targetEntities,
          validatedInput
        );
        if (semanticResult) {
          const latencyMs = Date.now() - startTime;
          return CommandClassificationResultSchema.parse({
            ...semanticResult,
            sanitizedPrompt,
            latencyMs,
          });
        }
      } catch {
        // Graceful fallback to heuristic result if model is offline or trips circuit breaker
      }
    }

    const latencyMs = Date.now() - startTime;
    return CommandClassificationResultSchema.parse({
      intent: heuristicResult.intent,
      confidence: heuristicResult.confidence,
      targetDomain: heuristicResult.targetDomain,
      targetEntities,
      suggestedAction: heuristicResult.suggestedAction,
      suggestedPlan: heuristicResult.suggestedPlan,
      sanitizedPrompt,
      latencyMs,
    });
  }

  /**
   * Evaluates deterministic regex heuristics
   */
  private evaluateHeuristics(
    prompt: string,
    targetEntities: TargetEntityMention[]
  ): {
    intent: CommandIntent;
    confidence: number;
    targetDomain: string;
    suggestedAction: SuggestedActionBlueprint;
    suggestedPlan: string[];
  } {
    let bestIntent: CommandIntent = 'SEARCH';
    let maxWeight = 0;
    let targetDomain = 'crm';

    // Check for high-risk destructive actions first (Rule 21 & 47)
    const isDestructive = DESTRUCTIVE_KEYWORDS.test(prompt);

    for (const pattern of INTENT_PATTERNS) {
      if (pattern.regex.test(prompt)) {
        if (pattern.weight > maxWeight) {
          maxWeight = pattern.weight;
          bestIntent = pattern.intent;
          targetDomain = pattern.domain || 'crm';
        }
      }
    }

    // If ambiguous or no match, default confidence is lower
    const confidence = maxWeight > 0 ? maxWeight : 0.6;

    // Destructive verbs mandate approval and elevated risk
    const estimatedRiskLevel = isDestructive
      ? 'L4_PRIVILEGED_DESTRUCTIVE'
      : bestIntent === 'EXECUTE'
        ? 'L2_STATE_MUTATION'
        : 'L0_READ';

    const requiresApproval = isDestructive || estimatedRiskLevel === 'L4_PRIVILEGED_DESTRUCTIVE' || estimatedRiskLevel === 'L2_STATE_MUTATION';

    const suggestedAction: SuggestedActionBlueprint = {
      id: `act_${bestIntent.toLowerCase()}_${Date.now().toString(36)}`,
      title: `${bestIntent}: ${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}`,
      description: `Dispatches intent [${bestIntent}] across ${targetDomain} domain.`,
      intent: bestIntent,
      estimatedRiskLevel,
      requiresApproval,
    };

    const suggestedPlan = this.generateDefaultPlan(bestIntent, prompt, targetEntities);

    return {
      intent: bestIntent,
      confidence,
      targetDomain,
      suggestedAction,
      suggestedPlan,
    };
  }

  /**
   * Classifies nuanced prompt via TieredModelRouter (Flash Tier)
   */
  private async classifyWithModel(
    prompt: string,
    targetEntities: TargetEntityMention[],
    input: CommandClassificationInput
  ): Promise<Omit<CommandClassificationResult, 'sanitizedPrompt' | 'latencyMs'> | null> {
    // Model distrust & isolation container (Rule 30)
    const isolationContainer = `<untrusted_reference_data id="command_input">\n${prompt}\n</untrusted_reference_data>`;
    const systemPrompt = `You are the SmartSapp Intelligent Intent Classifier.
Classify the user command inside the untrusted reference container into one of 5 canonical intents:
- SEARCH: Finding records, entities, knowledge items, contacts, deals.
- ANALYZE: Summaries, comparisons, reports, insights, trend analysis.
- EXECUTE: Direct immediate state mutations, sending messages, tagging, updating records.
- DELEGATE: Complex multi-step agent assignments, research, autonomous goal solving.
- AUTOMATE: Workflows, recurring triggers, scheduled jobs, event pipelines.

If destructive keywords (delete, drop, purge) are present, set requiresApproval to true and estimatedRiskLevel to 'L4_PRIVILEGED_DESTRUCTIVE'.

Output valid JSON matching the schema.`;

    const fullPrompt = `${systemPrompt}\n\n${isolationContainer}\nOrganization: ${input.organizationId}\nWorkspace: ${input.workspaceId}`;

    const modelResponse = await this.modelRouter.generateStructured(
      fullPrompt,
      CommandClassificationResultSchema.omit({ sanitizedPrompt: true, latencyMs: true }),
      {
        preferredTier: 'flash',
        temperature: 0.1,
        maxTokens: 500,
      }
    );

    return modelResponse.data;
  }

  /**
   * Extracts recognized entity mentions from prompt and context
   */
  private extractTargetEntities(
    prompt: string,
    input: CommandClassificationInput
  ): TargetEntityMention[] {
    const mentions: TargetEntityMention[] = [];

    // Add context entity if provided
    if (input.contextEntityId && input.contextEntityType) {
      mentions.push({
        id: input.contextEntityId,
        type: input.contextEntityType,
        title: `${input.contextEntityType.toUpperCase()} #${input.contextEntityId}`,
        href: `/admin/crm/${input.contextEntityType}/${input.contextEntityId}`,
      });
    }

    // Match explicit entity ID patterns in text
    let match: RegExpExecArray | null;
    const regex = new RegExp(ENTITY_ID_REGEX);
    while ((match = regex.exec(prompt)) !== null) {
      const id = match[1];
      const type = id.split('_')[0];
      if (!mentions.some((m) => m.id === id)) {
        mentions.push({
          id,
          type,
          title: `${type.toUpperCase()} #${id}`,
          href: `/admin/crm/${type}/${id}`,
        });
      }
    }

    return mentions;
  }

  /**
   * Generates a transparent plan decomposition preview for the UI (State C)
   */
  private generateDefaultPlan(
    intent: CommandIntent,
    prompt: string,
    entities: TargetEntityMention[]
  ): string[] {
    const entityLabel = entities.length > 0 ? ` for ${entities[0].title}` : '';
    switch (intent) {
      case 'SEARCH':
        return [
          `Retrieve candidate memory vectors and BM25 documents${entityLabel}`,
          'Rank and deduplicate results via Reciprocal Rank Fusion',
          'Present top matches in command surface',
        ];
      case 'ANALYZE':
        return [
          `Gather contextual evidence across CRM and knowledge base${entityLabel}`,
          'Compile EvidencePack with strict prompt isolation',
          'Synthesize comparative executive insights and metrics',
        ];
      case 'EXECUTE':
        return [
          'Verify tenant security boundary and active session permissions',
          `Prepare atomic mutation payload${entityLabel}`,
          'Execute capability and record tamper-evident audit event',
        ];
      case 'DELEGATE':
        return [
          'Decompose goal into topological DAG of execution steps',
          'Allocate autonomous agent persona and capability scopes',
          'Execute steps with two-phase human review on high-risk boundaries',
        ];
      case 'AUTOMATE':
        return [
          'Parse trigger conditions and workflow step sequence',
          'Validate acyclic DAG structure and Cloud Tasks dispatch payload',
          'Instantiate durable workflow with distributed checkpoint lease',
        ];
      default:
        return [`Process command: "${prompt.slice(0, 30)}..."`];
    }
  }
}

// ============================================================================
// HMR-SAFE SINGLETON (Rule 69)
// ============================================================================

declare global {
  var __smartsappCommandIntentClassifier: CommandIntentClassifier | undefined;
}

export function getCommandIntentClassifier(
  options?: CommandIntentClassifierOptions
): CommandIntentClassifier {
  if (process.env.NODE_ENV === 'test') {
    return new CommandIntentClassifier(options);
  }

  if (!globalThis.__smartsappCommandIntentClassifier) {
    globalThis.__smartsappCommandIntentClassifier = new CommandIntentClassifier(options);
  }

  return globalThis.__smartsappCommandIntentClassifier;
}
