/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Thread-Safe Agent Registry
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for SmartSapp Agents:
 *    - Central repository where root Supervisor Agent and Domain Specialists (Phase 8) register.
 * 2. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1):
 *    - All registered agents conform to `SmartSappAgent` interface.
 * 3. Immutable Agent Definitions:
 *    - Prevents runtime agent tampering or capability shadowing.
 *
 * @testability Covered in `src/lib/supervisor/__tests__/supervisor-engine.test.ts`.
 */

import type {
  SmartSappAgent,
  AgentDescriptor,
  AgentCategory,
  AgentCapability,
  AgentRequest,
  AgentResult,
} from './types';

export class AgentRegistry {
  private readonly agents: Map<string, SmartSappAgent> = new Map();

  /**
   * Registers a new agent into the registry.
   * Throws an error if an agent with the same ID is already registered.
   */
  public registerAgent(agent: SmartSappAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID "${agent.id}" is already registered.`);
    }
    this.agents.set(agent.id, agent);
  }

  /**
   * Retrieves an agent by its unique identifier.
   */
  public getAgent(id: string): SmartSappAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Checks whether an agent ID is registered.
   */
  public hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Lists all registered agents, optionally filtered by category.
   */
  public listAgents(category?: AgentCategory): SmartSappAgent[] {
    const all = Array.from(this.agents.values());
    if (!category) {
      return all;
    }
    return all.filter((a) => a.category === category);
  }

  /**
   * Returns public descriptors of registered agents for client discovery and planning.
   */
  public getAgentDescriptors(category?: AgentCategory): AgentDescriptor[] {
    const agents = this.listAgents(category);
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      version: agent.version,
      category: agent.category,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  /**
   * Finds registered agents that possess a specific capability.
   */
  public findByCapability(capability: AgentCapability): SmartSappAgent[] {
    return Array.from(this.agents.values()).filter((a) =>
      a.capabilities.includes(capability)
    );
  }

  /**
   * Clears all registered agents. Used strictly for isolated test suites.
   */
  public clear(): void {
    this.agents.clear();
  }
}

/**
 * Global singleton instance of the Agent Registry.
 */
export const globalAgentRegistry = new AgentRegistry();

// Initialize default system agents
globalAgentRegistry.registerAgent({
  id: 'supervisor-prime',
  name: 'Supervisor Orchestration Agent',
  version: '1.0.0',
  category: 'supervisor',
  description: 'Central coordinating agent that breaks down multi-step organizational objectives, creates execution plans, dispatches tools, and delivers executive summaries.',
  capabilities: ['planning', 'synthesis', 'task_orchestration', 'approval_routing'],
  execute: async (request: AgentRequest): Promise<AgentResult> => {
    const { SupervisorEngine } = await import('./services/supervisor-engine');
    const run = await SupervisorEngine.startMission(request);
    return (
      run.result || {
        runId: run.id,
        status: run.status === 'completed' ? 'completed' : 'failed',
        answer: run.errorMessage || 'Execution completed without structured result.',
        findings: [],
        actions: [],
        toolCalls: run.toolCalls,
        sources: [],
      }
    );
  },
});

import { KnowledgeSpecialist } from '@/lib/agents/specialists/knowledge-specialist';
import { RevenueSpecialist } from '@/lib/agents/specialists/revenue-specialist';
import { MeetingSpecialist } from '@/lib/agents/specialists/meeting-specialist';
import { SdrSpecialist } from '@/lib/agents/specialists/sdr-specialist';
import { OperationsSpecialist } from '@/lib/agents/specialists/operations-specialist';
import { GovernanceSpecialist } from '@/lib/agents/specialists/governance-specialist';

// Register Phase 8 Domain Specialists
export const globalKnowledgeSpecialist = new KnowledgeSpecialist();
export const globalRevenueSpecialist = new RevenueSpecialist();
export const globalMeetingSpecialist = new MeetingSpecialist();
export const globalSdrSpecialist = new SdrSpecialist();
export const globalOperationsSpecialist = new OperationsSpecialist();
export const globalGovernanceSpecialist = new GovernanceSpecialist();

globalAgentRegistry.registerAgent(globalKnowledgeSpecialist);
globalAgentRegistry.registerAgent(globalRevenueSpecialist);
globalAgentRegistry.registerAgent(globalMeetingSpecialist);
globalAgentRegistry.registerAgent(globalSdrSpecialist);
globalAgentRegistry.registerAgent(globalOperationsSpecialist);
globalAgentRegistry.registerAgent(globalGovernanceSpecialist);

// Backwards-compatibility aliases for Phase 7 stubs
globalAgentRegistry.registerAgent({
  id: 'research-specialist',
  name: 'Knowledge & Research Specialist (Alias)',
  version: '1.0.0',
  category: 'domain',
  description: globalKnowledgeSpecialist.description,
  capabilities: globalKnowledgeSpecialist.capabilities,
  execute: (req) => globalKnowledgeSpecialist.execute(req),
});

globalAgentRegistry.registerAgent({
  id: 'crm-specialist',
  name: 'CRM & Pipeline Specialist (Alias)',
  version: '1.0.0',
  category: 'domain',
  description: globalRevenueSpecialist.description,
  capabilities: globalRevenueSpecialist.capabilities,
  execute: (req) => globalRevenueSpecialist.execute(req),
});

globalAgentRegistry.registerAgent({
  id: 'memory-governance-agent',
  name: 'Memory Governance Agent (Alias)',
  version: '1.0.0',
  category: 'utility',
  description: globalGovernanceSpecialist.description,
  capabilities: globalGovernanceSpecialist.capabilities,
  execute: (req) => globalGovernanceSpecialist.execute(req),
});

