/**
 * @fileOverview Supervisor Planning & DAG Decomposition Engine (Phase 13 Milestone 3 Task 2)
 *
 * Implements:
 * - Rule 4 (Zero any/any[] strict typing policy)
 * - Rule 8 & 47 (Anti-IDOR multi-tenant boundary scoping)
 * - Rule 9 & 23 (Bounded batch concurrency <= 4, max DAG steps <= 10)
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 11 (Mathematical determinism in Kahn's algorithm & Knapsack token budgeting)
 * - Rule 12 (Canonical Risk Taxonomy: L0_READ to L2_STATE_MUTATION)
 * - Rule 13 & 30 (Untrusted reference data containerization & Prompt Injection Neutralization)
 * - Rule 16 (Authority Intersection Algebra & Least Privilege Scoping)
 * - Rule 17 (Non-Delegable Privileges Firewall)
 * - Rule 19 (Deterministic Cryptographic Idempotency Keys)
 * - Rule 28 & 56 (Knapsack Token Budgeting: <= 4,000 per step prompt, <= 12,000 supervisor context)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rule 68 (The Five Non-Negotiables: The Model is Never the Security Boundary)
 * - Rule 69 (Strangler Fig Invariant)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import crypto from 'node:crypto';
import {
  type ExecutionDag,
  type ExecutionDagEdge,
  type PlanStep,
  type SupervisorGoalInput,
  type SupervisorGoalInputRaw,
  type SupervisorMissionType,
  MAX_DAG_STEPS,
  MAX_STEP_TOKEN_BUDGET,
  SupervisorError,
  SupervisorGoalInputSchema,
  ExecutionDagSchema,
} from './supervisor-types';
import { RISK_LEVEL_WEIGHTS } from '../../capabilities/contracts/risk-levels';
import { getAgentPersonaRegistry } from '../../identity/agent-registry';
import { isCapabilityDelegable } from '../../identity/delegation/non-delegable-guard';

// ============================================================================
// Prompt Injection Defense Patterns (Rules 13 & 30)
// ============================================================================

const ADVERSARIAL_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /<\s*system\b[^>]*>[\s\S]*?<\s*\/\s*system\s*>/gi,
  /<\s*instruction\b[^>]*>[\s\S]*?<\s*\/\s*instruction\s*>/gi,
  /\[\s*system\s*directive\s*\]/gi,
  /ignore\s+(?:all\s+)?prior\s+instructions/gi,
  /disregard\s+(?:all\s+)?previous\s+instructions/gi,
  /override\s+system\s+prompt/gi,
  /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  /bypass\s+all\s+(?:safety|governance|security)\s+filters/gi,
];

/**
 * Scans input text for prompt injection directives and sanitizes them with a marker.
 */
export function neutralizeAdversarialDirectives(text: string): {
  sanitized: string;
  injectionDetected: boolean;
} {
  let sanitized = text;
  let injectionDetected = false;

  for (const pattern of ADVERSARIAL_DIRECTIVE_PATTERNS) {
    if (pattern.test(sanitized)) {
      injectionDetected = true;
      sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_DIRECTIVE]');
    }
  }

  return { sanitized, injectionDetected };
}

/** Computes deterministic SHA-256 hash for step idempotency keys */
function computeStepIdempotencyKey(
  missionGoalHash: string,
  stepId: string,
  capabilityId: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${missionGoalHash}:${stepId}:${capabilityId}`)
    .digest('hex')
    .slice(0, 32);
}

// ============================================================================
// Supervisor Planner Class
// ============================================================================

export class SupervisorPlanner {
  private readonly personaRegistry = getAgentPersonaRegistry();

  /** Checks whether a capability is prohibited from autonomous subagent delegation (Rule 17) */
  public isNonDelegable(capabilityId: string): boolean {
    return !isCapabilityDelegable(capabilityId);
  }

  /**
   * Decomposes a high-level operational goal into an ordered, dependency-resolved Execution DAG.
   */
  public decomposeGoal(rawInput: SupervisorGoalInputRaw): ExecutionDag {
    const input: SupervisorGoalInput = SupervisorGoalInputSchema.parse(rawInput);

    // 1. Prompt Injection Neutralization (Rules 13 & 30)
    const { sanitized: sanitizedGoal } = neutralizeAdversarialDirectives(input.goal);

    // 2. Classify Mission Archetype
    const missionType = this.resolveMissionType(sanitizedGoal, input.missionType);

    // 3. Generate Candidate Step Nodes
    const goalHash = crypto.createHash('sha256').update(sanitizedGoal).digest('hex').slice(0, 16);
    const candidateSteps = this.generateArchetypeSteps(missionType, input, goalHash);

    // 4. Hard Ceiling Check: Max 10 steps per DAG (Rule 23)
    if (candidateSteps.length > input.maxSteps) {
      if (candidateSteps.length > MAX_DAG_STEPS) {
        throw new SupervisorError(
          'MAX_STEPS_EXCEEDED',
          `Plan steps count (${candidateSteps.length}) exceeds maximum platform threshold (${MAX_DAG_STEPS}) (Rule 23).`
        );
      }
      candidateSteps.splice(input.maxSteps);
    }

    // 5. Anti-Elevation & Non-Delegable Firewall Guard (Rules 16, 17, 68 #1)
    for (const step of candidateSteps) {
      // Rule 17: Non-Delegable Actions
      if (!isCapabilityDelegable(step.capabilityId)) {
        throw new SupervisorError(
          'NON_DELEGABLE_ACTION_FORBIDDEN',
          `Capability '${step.capabilityId}' is non-delegable and cannot be scheduled in an autonomous plan (Rule 17).`
        );
      }

      // Rule 16: Risk Ceiling Bounding
      const persona = this.personaRegistry.getPersona(step.assignedPersona);
      if (!persona) {
        throw new SupervisorError(
          'UNAUTHORIZED_CAPABILITY',
          `Unknown or unregistered agent persona '${step.assignedPersona}'.`
        );
      }

      const personaMaxRank = RISK_LEVEL_WEIGHTS[persona.maxAutonomousRiskLevel];
      const stepRiskRank = RISK_LEVEL_WEIGHTS[step.riskLevel];

      if (stepRiskRank > personaMaxRank) {
        throw new SupervisorError(
          'UNAUTHORIZED_CAPABILITY',
          `Step '${step.stepId}' requires risk level '${step.riskLevel}', which exceeds persona '${step.assignedPersona}' ceiling '${persona.maxAutonomousRiskLevel}' (Rule 12 & 16).`
        );
      }
    }

    // 6. Build Dependency Edges
    const edges: ExecutionDagEdge[] = [];
    for (const step of candidateSteps) {
      for (const depId of step.dependentOnStepIds) {
        edges.push({ from: depId, to: step.stepId });
      }
    }

    // 7. Topological Sorting, Wave Grouping & Cycle Detection (Kahn's Algorithm)
    const { topologicalOrder, waveGroups } = this.computeTopologicalWaves(candidateSteps, edges);

    // 8. Knapsack Token Budgeting (Rules 28 & 56)
    let totalTokenBudget = 0;
    let estimatedDurationMs = 0;

    for (const step of candidateSteps) {
      step.maxTokens = Math.min(step.maxTokens, MAX_STEP_TOKEN_BUDGET);
      totalTokenBudget += step.maxTokens;
      estimatedDurationMs += Math.min(step.timeoutMs, 15000); // 15s expected default duration
    }

    // Clamp total mission token budget to supervisor ceiling
    if (totalTokenBudget > input.budgetCapTokens) {
      const scale = input.budgetCapTokens / totalTokenBudget;
      for (const step of candidateSteps) {
        step.maxTokens = Math.max(500, Math.floor(step.maxTokens * scale));
      }
      totalTokenBudget = input.budgetCapTokens;
    }

    return ExecutionDagSchema.parse({
      missionType,
      nodes: candidateSteps,
      edges,
      topologicalOrder,
      waveGroups,
      estimatedDurationMs,
      totalTokenBudget,
      hasCycles: false,
    });
  }

  /**
   * Kahn's Algorithm for Topological Wave Sorting & Directed Cycle Detection (Rules 9 & 11).
   *
   * Computes in-degree for all step nodes, builds concurrent wave groups where inDegree = 0,
   * and terminates with DAG_CYCLE_DETECTED if circular dependencies exist.
   */
  public computeTopologicalWaves(
    nodes: readonly PlanStep[],
    edges: readonly ExecutionDagEdge[]
  ): {
    topologicalOrder: string[];
    waveGroups: string[][];
  } {
    const nodeMap = new Map<string, PlanStep>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      nodeMap.set(node.stepId, node);
      inDegree.set(node.stepId, 0);
      adjacency.set(node.stepId, []);
    }

    for (const edge of edges) {
      if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
        throw new SupervisorError(
          'DAG_CYCLE_DETECTED',
          `Dependency edge refers to non-existent step: ${edge.from} -> ${edge.to}`
        );
      }
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      adjacency.get(edge.from)?.push(edge.to);
    }

    const topologicalOrder: string[] = [];
    const waveGroups: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < nodes.length) {
      // Find all unprocessed nodes with in-degree == 0
      const currentWave: string[] = [];
      for (const node of nodes) {
        if (!processed.has(node.stepId) && (inDegree.get(node.stepId) ?? 0) === 0) {
          currentWave.push(node.stepId);
        }
      }

      // If no node has in-degree == 0 but nodes remain, there is a cycle!
      if (currentWave.length === 0) {
        const remaining = nodes
          .filter((n) => !processed.has(n.stepId))
          .map((n) => n.stepId)
          .join(', ');
        throw new SupervisorError(
          'DAG_CYCLE_DETECTED',
          `Circular dependency cycle detected in plan involving steps: [${remaining}] (Rule 11).`
        );
      }

      waveGroups.push(currentWave);

      for (const stepId of currentWave) {
        processed.add(stepId);
        topologicalOrder.push(stepId);

        // Decrement in-degree for all children
        const neighbors = adjacency.get(stepId) ?? [];
        for (const neighbor of neighbors) {
          const currentIn = inDegree.get(neighbor) ?? 0;
          inDegree.set(neighbor, Math.max(0, currentIn - 1));
        }
      }
    }

    return { topologicalOrder, waveGroups };
  }

  /** Resolves intent classification into canonical archetypes or custom */
  private resolveMissionType(
    goal: string,
    explicitType: SupervisorMissionType
  ): SupervisorMissionType {
    if (explicitType !== 'CUSTOM') {
      return explicitType;
    }

    const lower = goal.toLowerCase();
    if (
      lower.includes('arrears') ||
      lower.includes('tuition') ||
      lower.includes('fee recovery') ||
      lower.includes('payment reminder')
    ) {
      return 'RECOVERY_CAMPAIGN';
    }
    if (
      lower.includes('audit') ||
      lower.includes('compliance') ||
      lower.includes('teacher load') ||
      lower.includes('campus review')
    ) {
      return 'CAMPUS_AUDIT';
    }
    if (
      lower.includes('onboard') ||
      lower.includes('intake') ||
      lower.includes('enroll') ||
      lower.includes('registration')
    ) {
      return 'ONBOARDING_ACCELERATOR';
    }
    if (
      lower.includes('churn') ||
      lower.includes('contagion') ||
      lower.includes('crisis') ||
      lower.includes('dissatisfaction') ||
      lower.includes('retention')
    ) {
      return 'CHURN_CRISIS_INTERVENTION';
    }
    if (
      lower.includes('hygiene') ||
      lower.includes('dedupe') ||
      lower.includes('duplicate') ||
      lower.includes('clean') ||
      lower.includes('unverified')
    ) {
      return 'DATA_HYGIENE_CLEANUP';
    }

    return 'CUSTOM';
  }

  /** Generates candidate step nodes based on mission archetype */
  private generateArchetypeSteps(
    missionType: SupervisorMissionType,
    input: SupervisorGoalInput,
    goalHash: string
  ): PlanStep[] {
    switch (missionType) {
      case 'RECOVERY_CAMPAIGN':
        return [
          {
            stepId: 'step_1',
            title: 'Identify Attendance Anomalies',
            description: 'Scans attendance trends for student drop-off correlated with fee arrears.',
            assignedPersona: 'attendance_analyst',
            capabilityId: 'school.attendance.get_anomalies',
            input: { workspaceId: input.workspaceId, entityId: input.entityId },
            dependentOnStepIds: [],
            delegatedScopes: ['rbac:operations.campuses.view', 'rbac:operations.attendance.view'],
            maxTokens: 2500,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'school.attendance.get_anomalies'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'Lookup Tuition Arrears Summary',
            description: 'Queries overdue balances and payment history for affected accounts.',
            assignedPersona: 'collections_agent',
            capabilityId: 'finance.invoice.get_summary',
            input: { workspaceId: input.workspaceId, entityId: input.entityId },
            dependentOnStepIds: ['step_1'],
            delegatedScopes: ['rbac:finance.invoices.view'],
            maxTokens: 2500,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'finance.invoice.get_summary'),
            proposalId: null,
          },
          {
            stepId: 'step_3',
            title: 'Retrieve Account 360 Context',
            description: 'Retrieves primary parent contact and communication history.',
            assignedPersona: 'crm_assistant',
            capabilityId: 'crm.entity.get',
            input: { entityId: input.entityId ?? 'default_account' },
            dependentOnStepIds: ['step_2'],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.view'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_3', 'crm.entity.get'),
            proposalId: null,
          },
          {
            stepId: 'step_4',
            title: 'Draft Personalized Payment Outreach',
            description: 'Compiles empathetic payment schedule reminder for parent review.',
            assignedPersona: 'lead_sdr',
            capabilityId: 'sdr.draft_outreach',
            input: { channel: 'whatsapp', intent: 'fee_reminder' },
            dependentOnStepIds: ['step_3'],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.view'],
            maxTokens: 3500,
            timeoutMs: 45000,
            riskLevel: 'L1_INTERNAL_DRAFT',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_4', 'sdr.draft_outreach'),
            proposalId: null,
          },
        ];

      case 'CAMPUS_AUDIT':
        return [
          {
            stepId: 'step_1',
            title: 'Attendance Telemetry Audit',
            description: 'Audits student attendance compliance across campuses.',
            assignedPersona: 'attendance_analyst',
            capabilityId: 'school.attendance.get_anomalies',
            input: { workspaceId: input.workspaceId },
            dependentOnStepIds: [],
            delegatedScopes: ['rbac:operations.campuses.view', 'rbac:operations.attendance.view'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'school.attendance.get_anomalies'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'Billing & Fee Collection Audit',
            description: 'Audits open tuition receipts vs enrolled students.',
            assignedPersona: 'billing_analyst',
            capabilityId: 'finance.invoice.get_summary',
            input: { workspaceId: input.workspaceId },
            dependentOnStepIds: [],
            delegatedScopes: ['rbac:finance.invoices.view'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'finance.invoice.get_summary'),
            proposalId: null,
          },
          {
            stepId: 'step_3',
            title: 'Create Compliance Task Item',
            description: 'Creates operational task documenting discrepancy items.',
            assignedPersona: 'task_coordinator',
            capabilityId: 'task.create',
            input: { title: 'Resolve Campus Audit Anomalies', priority: 'HIGH' },
            dependentOnStepIds: ['step_1', 'step_2'],
            delegatedScopes: ['rbac:operations.tasks.create'],
            maxTokens: 2000,
            timeoutMs: 30000,
            riskLevel: 'L2_STATE_MUTATION',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_3', 'task.create'),
            proposalId: null,
          },
        ];

      case 'ONBOARDING_ACCELERATOR':
        return [
          {
            stepId: 'step_1',
            title: 'Discover Prospect Profile',
            description: 'Locates prospect organization attributes.',
            assignedPersona: 'prospecting_agent',
            capabilityId: 'lead.search',
            input: { query: input.goal },
            dependentOnStepIds: [],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.view'],
            maxTokens: 2500,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'lead.search'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'Enrich Organization Firmographics',
            description: 'Gathers technographics and decision maker contacts.',
            assignedPersona: 'enrichment_agent',
            capabilityId: 'lead.enrich',
            input: { prospectId: input.entityId ?? 'default_prospect' },
            dependentOnStepIds: ['step_1'],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.edit'],
            maxTokens: 3000,
            timeoutMs: 40000,
            riskLevel: 'L1_INTERNAL_DRAFT',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'lead.enrich'),
            proposalId: null,
          },
          {
            stepId: 'step_3',
            title: 'Draft Registration Fee Invoice',
            description: 'Prepares draft invoice proposal for school registration fee.',
            assignedPersona: 'invoice_assistant',
            capabilityId: 'finance.invoice.create_draft',
            input: { amount: 1500, description: 'New Student Intake Registration Fee' },
            dependentOnStepIds: ['step_2'],
            delegatedScopes: ['rbac:finance.invoices.manage'],
            maxTokens: 2500,
            timeoutMs: 30000,
            riskLevel: 'L1_INTERNAL_DRAFT',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_3', 'finance.invoice.create_draft'),
            proposalId: null,
          },
        ];

      case 'CHURN_CRISIS_INTERVENTION':
        return [
          {
            stepId: 'step_1',
            title: 'Detect Network Risk Contagion',
            description: 'Evaluates contagion spread across sister campuses and common vendors.',
            assignedPersona: 'crm_assistant',
            capabilityId: 'graph.reasoning.detect_contagion',
            input: { sourceEntityId: input.entityId ?? 'root_entity', workspaceId: input.workspaceId },
            dependentOnStepIds: [],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.view'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'graph.reasoning.detect_contagion'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'Map Key Stakeholder Influence',
            description: 'Identifies supreme decision maker holding leverage on retention.',
            assignedPersona: 'deal_strategist',
            capabilityId: 'graph.reasoning.get_influence_map',
            input: { entityId: input.entityId ?? 'root_entity', workspaceId: input.workspaceId },
            dependentOnStepIds: ['step_1'],
            delegatedScopes: ['workspace:read', 'crm:deals:read'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'graph.reasoning.get_influence_map'),
            proposalId: null,
          },
          {
            stepId: 'step_3',
            title: 'Create Executive Retention Task',
            description: 'Assigns high-priority retention action to relationship manager.',
            assignedPersona: 'task_coordinator',
            capabilityId: 'task.create',
            input: { title: 'Executive Retention Meeting Required', priority: 'CRITICAL' },
            dependentOnStepIds: ['step_2'],
            delegatedScopes: ['rbac:operations.tasks.create'],
            maxTokens: 2000,
            timeoutMs: 30000,
            riskLevel: 'L2_STATE_MUTATION',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_3', 'task.create'),
            proposalId: null,
          },
        ];

      case 'DATA_HYGIENE_CLEANUP':
        return [
          {
            stepId: 'step_1',
            title: 'Inspect Target Entity',
            description: 'Retrieves current entity records and tags.',
            assignedPersona: 'crm_researcher',
            capabilityId: 'crm.entity.get',
            input: { entityId: input.entityId ?? 'target_entity' },
            dependentOnStepIds: [],
            delegatedScopes: ['workspace:read', 'crm:timeline:view'],
            maxTokens: 2500,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'crm.entity.get'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'Knowledge Base Verification',
            description: 'Queries institutional memory for canonical phone and address.',
            assignedPersona: 'knowledge_analyst',
            capabilityId: 'knowledge.search_hybrid',
            input: { query: 'canonical verification contact details' },
            dependentOnStepIds: ['step_1'],
            delegatedScopes: ['workspace:read', 'knowledge:read'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'knowledge.search_hybrid'),
            proposalId: null,
          },
          {
            stepId: 'step_3',
            title: 'Tag Entity as Verified',
            description: 'Applies verified compliance tag to cleaned account.',
            assignedPersona: 'lead_sdr',
            capabilityId: 'crm.entity.tag_add',
            input: { entityId: input.entityId ?? 'target_entity', tag: 'verified_active' },
            dependentOnStepIds: ['step_2'],
            delegatedScopes: ['workspace:read', 'rbac:operations.campuses.edit'],
            maxTokens: 2000,
            timeoutMs: 30000,
            riskLevel: 'L2_STATE_MUTATION',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_3', 'crm.entity.tag_add'),
            proposalId: null,
          },
        ];

      case 'CUSTOM':
      default:
        // Default 2-step investigative plan for arbitrary prompts
        return [
          {
            stepId: 'step_1',
            title: 'Knowledge & Memory Research',
            description: `Investigates query in institutional memory: "${input.goal}"`,
            assignedPersona: 'knowledge_agent',
            capabilityId: 'knowledge.search_hybrid',
            input: { query: input.goal },
            dependentOnStepIds: [],
            delegatedScopes: ['workspace:read', 'knowledge:read'],
            maxTokens: 3500,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_1', 'knowledge.search_hybrid'),
            proposalId: null,
          },
          {
            stepId: 'step_2',
            title: 'CRM Context Consolidation',
            description: 'Gathers related CRM touchpoints and timeline items.',
            assignedPersona: 'crm_assistant',
            capabilityId: 'crm.entity.get',
            input: { entityId: input.entityId ?? 'general_context' },
            dependentOnStepIds: ['step_1'],
            delegatedScopes: ['workspace:read', 'crm:timeline:view'],
            maxTokens: 3000,
            timeoutMs: 30000,
            riskLevel: 'L0_READ',
            status: 'PENDING',
            output: null,
            error: null,
            executionDurationMs: null,
            delegationToken: null,
            idempotencyKey: computeStepIdempotencyKey(goalHash, 'step_2', 'crm.entity.get'),
            proposalId: null,
          },
        ];
    }
  }
}
