/**
 * @fileOverview Central Agent Persona Registry (Phase 3 Milestone 1)
 *
 * Implements Rules 1, 2, 3, 10, 11, 12, 16, 23, and Master Roadmap Section 4 / Document 07.
 * Single source of truth for specialized agent personas, allowed capability domains,
 * risk ceilings, and deterministic resource budgets.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Built-in personas are immutable defaults registered on startup.
 * - Legacy CompanyBrain 2.0 specialist aliases (e.g. `knowledge_specialist`) resolve
 *   automatically to their canonical Phase 3 persona.
 * - `validatePersonaCapability` evaluates whether an agent persona is authorized to execute
 *   a target capability's domain and risk level.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { type RiskLevel } from '../capabilities/contracts/risk-levels';
import {
  type AgentPersonaDefinition,
  type AgentPersonaId,
  AgentPersonaDefinitionSchema,
  isAgentPersonaId,
} from './agent-persona-types';
import { CRM_PERSONA_DEFINITIONS } from '../agents/crm/personas/crm-persona-definitions';

export type AgentPersona = AgentPersonaDefinition;

/** Numeric rank for comparing risk levels deterministically */
const RISK_LEVEL_ORDER: Readonly<Record<RiskLevel, number>> = {
  L0_READ: 0,
  L1_INTERNAL_DRAFT: 1,
  L2_STATE_MUTATION: 2,
  L3_EXTERNAL_COMMUNICATION_FINANCE: 3,
  L4_PRIVILEGED_DESTRUCTIVE: 4,
};

/** Built-in canonical agent personas */
export const BUILT_IN_AGENT_PERSONAS: readonly AgentPersonaDefinition[] = [
  {
    id: 'crm_researcher',
    name: 'CRM Researcher Agent',
    version: '1.0.0',
    role: 'Account Intelligence Specialist',
    description: 'Reconstructs comprehensive 360-degree account histories across entities, notes, meetings, and communications.',
    icon: 'UserSearch',
    allowedDomains: ['crm_contacts', 'knowledge_memory', 'meetings_conversations', 'tasks_productivity'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:studios.tags.view',
      'rbac:operations.tasks.view',
      'rbac:operations.dashboard.view',
      'workspace:read',
      'crm:timeline:view',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp CRM Researcher Agent. You explore account histories, synthesize notes, analyze timelines, and build structured dossiers. You are strictly read-only.',
  },
  {
    id: 'lead_sdr',
    name: 'Autonomous Lead SDR Agent',
    version: '1.0.0',
    role: 'Lead Discovery & Outreach Specialist',
    description: 'Discovers, enriches, technographically profiles, scores, and prepares personalized outreach for prospective leads.',
    icon: 'Target',
    allowedDomains: ['lead_intelligence', 'crm_contacts', 'communication_messaging'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.campuses.create',
      'rbac:operations.campuses.edit',
      'rbac:operations.pipeline.view',
      'rbac:social.campaigns.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 25,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Autonomous Lead SDR Agent. You qualify prospects, enrich company intelligence, update contact tags, and draft personalized outreach. All outbound message dispatching requires human approval.',
  },
  {
    id: 'deal_coach',
    name: 'Deal Strategy & Coach Agent',
    version: '1.0.0',
    role: 'Revenue Acceleration Coach',
    description: 'Monitors pipeline velocity, identifies stalled opportunities, detects competitor objections, and proposes win strategies.',
    icon: 'TrendingUp',
    allowedDomains: ['deals_revenue', 'crm_contacts', 'knowledge_memory', 'tasks_productivity'],
    allowedPermissions: [
      'rbac:operations.pipeline.view',
      'rbac:operations.pipeline.create',
      'rbac:operations.pipeline.edit',
      'rbac:operations.tasks.view',
      'rbac:operations.tasks.create',
      'rbac:operations.tasks.edit',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 25,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Deal Strategy & Coach Agent. You inspect pipeline stages, detect stalled deals, analyze win probabilities, and create tactical follow-up tasks for sales reps.',
  },
  {
    id: 'portal_guide',
    name: 'Portal Experience Guide Agent',
    version: '1.0.0',
    role: 'Student & Member AI Tutor',
    description: 'Assists members inside Experience Portals, answers lesson queries, tracks progress, and provides personalized study recommendations.',
    icon: 'GraduationCap',
    allowedDomains: ['experience_portal', 'knowledge_memory'],
    allowedPermissions: [
      'app:portals_view',
      'rbac:studios.courses.view',
      'rbac:studios.community.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Portal Experience Guide Agent. You assist learners inside student portals, guide course navigation, explain difficult concepts, and track enrollment milestones.',
  },
  {
    id: 'meeting_prep',
    name: 'Meeting Dossier & Prep Agent',
    version: '1.0.0',
    role: 'Executive Meeting Strategist',
    description: 'Synthesizes participant background, previous interactions, and active deal status into structured meeting preparation briefs.',
    icon: 'CalendarCheck',
    allowedDomains: ['meetings_conversations', 'crm_contacts', 'knowledge_memory'],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.pipeline.view',
      'rbac:operations.tasks.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L0_READ',
    budgets: {
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      maxRecordsMutated: 0,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Meeting Dossier & Prep Agent. You compile executive meeting briefs, review past conversation history, identify high-priority discussion topics, and propose meeting agendas.',
  },
  {
    id: 'supervisor',
    name: 'Supervisor Orchestrator Agent',
    version: '1.0.0',
    role: 'Multi-Agent Workforce Coordinator',
    description: 'Orchestrates multi-agent collaboration, decomposes broad goals into domain steps, and synthesizes outputs.',
    icon: 'Workflow',
    allowedDomains: [
      'crm_contacts',
      'deals_revenue',
      'tasks_productivity',
      'identity_access',
      'platform_integrations',
      'lead_intelligence',
    ],
    allowedPermissions: [
      'rbac:operations.campuses.view',
      'rbac:operations.pipeline.view',
      'rbac:operations.tasks.view',
      'rbac:operations.tasks.create',
      'rbac:operations.dashboard.view',
      'workspace:read',
    ],
    maxAutonomousRiskLevel: 'L2_STATE_MUTATION',
    budgets: {
      maxDurationMs: 180000,
      maxTokens: 100000,
      maxToolCalls: 30,
      maxRecordsMutated: 50,
      maxOutboundMessages: 0,
    },
    systemPromptSnippet: 'You are the SmartSapp Supervisor Orchestrator Agent. You plan and delegate multi-step workflows to specialized domain agents, ensuring all actions strictly conform to tenant policies and human approval boundaries.',
  },
  // Domain Specialist CRM Personas (Phase 9 Milestone 2)
  CRM_PERSONA_DEFINITIONS.crm_assistant,
  CRM_PERSONA_DEFINITIONS.lead_analyst,
  CRM_PERSONA_DEFINITIONS.deal_strategist,
  CRM_PERSONA_DEFINITIONS.task_coordinator,
  CRM_PERSONA_DEFINITIONS.knowledge_analyst,
];

/** Backward compatibility alias mapping for CompanyBrain 2.0 specialist prototypes and CRM agents */
const SPECIALIST_ALIAS_MAP: Readonly<Record<string, AgentPersonaId>> = {
  knowledge_specialist: 'crm_researcher',
  revenue_specialist: 'deal_coach',
  sdr_specialist: 'lead_sdr',
  meeting_specialist: 'meeting_prep',
  operations_specialist: 'deal_coach',
  governance_specialist: 'supervisor',
  crm_copilot: 'crm_assistant',
  account_intelligence: 'crm_researcher',
  qualification_analyst: 'lead_analyst',
  pipeline_analyst: 'deal_strategist',
  commitment_coordinator: 'task_coordinator',
  memory_analyst: 'knowledge_analyst',
};

export interface RegisterPersonaOptions {
  allowOverride?: boolean;
}

export interface PersonaCapabilityValidation {
  allowed: boolean;
  reason?: string;
}

export interface AgentPersonaRegistryStore {
  registerPersona(persona: AgentPersonaDefinition, options?: RegisterPersonaOptions): void;
  getPersona(personaId: string): AgentPersonaDefinition | null;
  listPersonas(): readonly AgentPersonaDefinition[];
  hasPersona(personaId: string): boolean;
  resolvePersonaId(idOrAlias: string): AgentPersonaId | null;
  validatePersonaCapability(
    personaId: string,
    capability: { domain?: string | null | undefined; risk: { level: RiskLevel } }
  ): PersonaCapabilityValidation;
  resetForTests(): void;
}

export type AgentPersonaRegistry = AgentPersonaRegistryStore;

/**
 * Creates an isolated AgentPersonaRegistry instance (for tests and runtime SSOT).
 */
export function createAgentPersonaRegistry(): AgentPersonaRegistryStore {
  const store = new Map<AgentPersonaId, AgentPersonaDefinition>();

  const populateBuiltIns = () => {
    store.clear();
    for (const persona of BUILT_IN_AGENT_PERSONAS) {
      store.set(persona.id, persona);
    }
  };

  populateBuiltIns();

  return {
    registerPersona(persona: AgentPersonaDefinition, options?: RegisterPersonaOptions): void {
      const parsed = AgentPersonaDefinitionSchema.safeParse(persona);
      if (!parsed.success) {
        throw new Error(`Invalid persona definition '${persona.id}': ${parsed.error.message}`);
      }

      if (store.has(persona.id) && !options?.allowOverride) {
        const existing = store.get(persona.id);
        if (existing !== persona) {
          throw new Error(`Persona '${persona.id}' is already registered with a different definition.`);
        }
        return;
      }

      store.set(persona.id, persona);
    },

    getPersona(personaId: string): AgentPersonaDefinition | null {
      const canonicalId = this.resolvePersonaId(personaId);
      if (!canonicalId) return null;
      return store.get(canonicalId) ?? null;
    },

    listPersonas(): readonly AgentPersonaDefinition[] {
      return Array.from(store.values());
    },

    hasPersona(personaId: string): boolean {
      return this.getPersona(personaId) !== null;
    },

    resolvePersonaId(idOrAlias: string): AgentPersonaId | null {
      const trimmed = idOrAlias.trim();
      if (isAgentPersonaId(trimmed)) return trimmed;
      if (trimmed in SPECIALIST_ALIAS_MAP) return SPECIALIST_ALIAS_MAP[trimmed];
      return null;
    },

    validatePersonaCapability(
      personaId: string,
      capability: { domain?: string | null | undefined; risk: { level: RiskLevel } }
    ): PersonaCapabilityValidation {
      const persona = this.getPersona(personaId);
      if (!persona) {
        return {
          allowed: false,
          reason: `Unknown agent persona '${personaId}'`,
        };
      }

      if (!capability.domain) {
        return {
          allowed: false,
          reason: `Capability is missing a required domain`,
        };
      }

      // 1. Domain Boundary Check
      const allowedDomains = persona.allowedDomains as readonly string[];
      if (!allowedDomains.includes(capability.domain)) {
        return {
          allowed: false,
          reason: `Domain '${capability.domain}' is not permitted for persona '${persona.name}' (allowed: ${persona.allowedDomains.join(', ')})`,
        };
      }

      // 2. Risk Ceiling Check
      const capabilityRiskRank = RISK_LEVEL_ORDER[capability.risk.level];
      const personaRiskRank = RISK_LEVEL_ORDER[persona.maxAutonomousRiskLevel];

      if (capabilityRiskRank > personaRiskRank) {
        return {
          allowed: false,
          reason: `Capability risk level '${capability.risk.level}' exceeds persona '${persona.name}' autonomous ceiling '${persona.maxAutonomousRiskLevel}'`,
        };
      }

      return { allowed: true };
    },

    resetForTests(): void {
      populateBuiltIns();
    },
  };
}

// Global Singleton Store with HMR Preservation
const globalRef = globalThis as { __smartsappAgentPersonaRegistry?: AgentPersonaRegistryStore };
if (!globalRef.__smartsappAgentPersonaRegistry) {
  globalRef.__smartsappAgentPersonaRegistry = createAgentPersonaRegistry();
}

export const globalAgentPersonaRegistry: AgentPersonaRegistryStore = globalRef.__smartsappAgentPersonaRegistry;

export function getAgentPersonaRegistry(): AgentPersonaRegistryStore {
  return globalAgentPersonaRegistry;
}

export function getPersona(personaId: string): AgentPersonaDefinition | null {
  return globalAgentPersonaRegistry.getPersona(personaId);
}

export function listPersonas(): readonly AgentPersonaDefinition[] {
  return globalAgentPersonaRegistry.listPersonas();
}

export function validatePersonaCapability(
  personaId: string,
  capability: { domain?: string | null | undefined; risk: { level: RiskLevel } }
): PersonaCapabilityValidation {
  return globalAgentPersonaRegistry.validatePersonaCapability(personaId, capability);
}
