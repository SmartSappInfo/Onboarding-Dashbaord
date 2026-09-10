/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Domain Specialists & Agent Swarm Contracts
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All specialist properties, inputs, outputs, and swarm states are strictly typed.
 *    - Arbitrary JSON payloads are typed using bounded recursive `McpPayloadValue`.
 * 2. Model Context Protocol (MCP) Grounding:
 *    - Specialists must only invoke MCP tools that match their explicit `allowedTools` whitelist.
 *    - Specialists NEVER query or mutate Firestore directly for domain items.
 * 3. Human-in-the-Loop & Code-Free Autonomy Governance:
 *    - Autonomy levels (`read_only`, `supervised`, `autonomous`) allow administrators
 *      to govern specialist actions dynamically from the backoffice without touching code.
 * 4. Grounded Swarm Consensus:
 *    - Swarm collaboration preserves multi-perspective diversity, identifying both areas of
 *      consensus and critical points of tension/divergence.
 *
 * @testability Covered in `src/lib/agents/__tests__/domain-agents.test.ts`.
 */

import { z } from 'zod';
import type {
  SmartSappAgent,
  AgentCapability,
  AgentActionProposal,
  AgentResult,
} from '@/lib/supervisor/types';

/**
 * Standard identifiers for built-in domain specialist personas.
 */
export type DomainSpecialistId =
  | 'knowledge_specialist'
  | 'revenue_specialist'
  | 'meeting_specialist'
  | 'sdr_specialist'
  | 'operations_specialist'
  | 'governance_specialist';

/**
 * Autonomy levels for domain specialists, configurable per workspace.
 */
export type SpecialistAutonomyLevel = 'read_only' | 'supervised' | 'autonomous';

/**
 * Read and write domain scopes for a specialist.
 */
export interface SpecialistMemoryScope {
  readDomains: string[];
  writeDomains: string[];
  disallowedDomains: string[];
}

/**
 * Full public metadata descriptor for a domain specialist.
 */
export interface SpecialistDescriptor {
  id: DomainSpecialistId;
  name: string;
  version: string;
  category: 'domain' | 'utility';
  roleTitle: string;
  personaDescription: string;
  systemDirective: string;
  capabilities: AgentCapability[];
  allowedTools: string[];
  memoryScope: SpecialistMemoryScope;
  defaultAutonomy: SpecialistAutonomyLevel;
  avatarIcon: string;
  colorTheme: string;
}

/**
 * Collaboration modes for executing multi-agent swarms.
 */
export type SwarmMode =
  | 'parallel_consensus' // Fan-out / Fan-in concurrent multi-perspective review
  | 'sequential_pipeline' // Ordered handoff between specialists
  | 'supervisor_directed'; // Plan steps assigned by root Supervisor

/**
 * A divergence or tension point surfaced during swarm consensus.
 */
export interface SwarmDivergencePoint {
  topic: string;
  perspectives: Record<string, string>; // specialistId -> opinion
  tensionSummary: string;
  recommendedEscalation: string;
}

/**
 * Structured consensus produced by the swarm synthesis flow.
 */
export interface SwarmConsensus {
  executiveSummary: string;
  consensusPoints: string[];
  divergencePoints: SwarmDivergencePoint[];
  jointActions: AgentActionProposal[];
  confidenceScore: number;
}

/**
 * Envelope for triggering a swarm mission.
 */
export interface SwarmMissionRequest {
  workspaceId: string;
  organizationId: string;
  actor: {
    type: 'user' | 'agent' | 'system';
    id: string;
    name?: string;
  };
  objective: string;
  specialistIds: DomainSpecialistId[];
  mode: SwarmMode;
  subject?: {
    type: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
    id: string;
    title?: string;
  };
  customInstructions?: string;
  maxRounds?: number;
}

/**
 * Durable execution record of a swarm mission, persisted in `/swarm_runs/{id}`.
 */
export interface SwarmRun {
  id: string;
  workspaceId: string;
  organizationId: string;
  objective: string;
  mode: SwarmMode;
  specialistIds: DomainSpecialistId[];
  status: 'pending' | 'running' | 'completed' | 'needs_approval' | 'failed' | 'cancelled';
  actor: {
    type: 'user' | 'agent' | 'system';
    id: string;
    name?: string;
  };
  subject?: {
    type: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
    id: string;
    title?: string;
  };
  specialistRuns: Record<string, AgentResult>;
  consensus?: SwarmConsensus;
  pendingApprovalId?: string;
  pausedSpecialistId?: string;
  errorMessage?: string;
  metrics: {
    durationMs: number;
    specialistsInvoked: number;
    totalFindings: number;
    totalToolCalls: number;
    completedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Workspace-level policy and configuration override for a specialist.
 * Stored in `/agent_specialists/{workspaceId}_{specialistId}`.
 */
export interface SpecialistWorkspaceConfig {
  workspaceId: string;
  specialistId: DomainSpecialistId;
  autonomyLevel: SpecialistAutonomyLevel;
  disabledTools: string[];
  customDirective?: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * Runtime interface for a Domain Specialist conforming to SmartSappAgent.
 */
export interface SmartSappDomainSpecialist extends SmartSappAgent {
  readonly specialistId: DomainSpecialistId;
  readonly descriptor: SpecialistDescriptor;
  getAllowedTools(): string[];
  getMemoryScope(): SpecialistMemoryScope;
}

// --- Zod Schemas for Runtime Validation ---

export const zDomainSpecialistId = z.enum([
  'knowledge_specialist',
  'revenue_specialist',
  'meeting_specialist',
  'sdr_specialist',
  'operations_specialist',
  'governance_specialist',
]);

export const zSpecialistAutonomyLevel = z.enum(['read_only', 'supervised', 'autonomous']);

export const zSwarmMode = z.enum([
  'parallel_consensus',
  'sequential_pipeline',
  'supervisor_directed',
]);

export const zSwarmMissionRequest = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  actor: z.object({
    type: z.enum(['user', 'agent', 'system']),
    id: z.string().min(1),
    name: z.string().optional(),
  }),
  objective: z.string().min(3),
  specialistIds: z.array(zDomainSpecialistId).min(1),
  mode: zSwarmMode,
  subject: z
    .object({
      type: z.enum(['entity', 'deal', 'task', 'meeting', 'ticket']),
      id: z.string().min(1),
      title: z.string().optional(),
    })
    .optional(),
  customInstructions: z.string().optional(),
  maxRounds: z.number().int().min(1).max(5).optional(),
});
