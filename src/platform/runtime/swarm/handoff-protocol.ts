/**
 * @fileOverview Multi-Agent Handoff Protocol (Phase 6 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any`/`any[]` strict typing.
 * - Rule 8 & 47: Tenant isolation and Anti-IDOR enforcement.
 * - Rule 13 & 30: Untrusted containerization of handed-off state (`<untrusted_reference_data>`)
 *   and linear non-backtracking prompt injection sanitization.
 * - Rule 16: Agent identity as security principal and monotonic downward scope attenuation.
 * - Rule 17: Non-delegable permissions unconditionally stripped from transferred authority.
 * - Rule 23: Maximum delegation depth ceiling enforcement (depth <= 4).
 * - Rule 40: Immutable provenance tracking via `delegationChain` and EventBus audit logging.
 * - Rule 60: Step 1 emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch`).
 */

import crypto from 'node:crypto';
import type { AgentPersonaId } from '@/platform/identity/agent-persona-types';
import type { CapabilityDomain } from '@/platform/capabilities/contracts/capability-definition';
import { isNonDelegableAction } from '@/platform/capabilities/contracts/risk-levels';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { StepValidator } from '@/platform/runtime/execution/step-validator';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  type SwarmHandoff,
  SwarmError,
} from './swarm-types';

export interface ExecuteHandoffParams {
  fromPersonaId: AgentPersonaId;
  toPersonaId: AgentPersonaId;
  handoffReason: string;
  payload: Record<string, unknown>;
  currentDelegationChain: string[];
  tenantContext: {
    organizationId: string;
    workspaceId: string;
  };
  requiredDomain?: CapabilityDomain;
  requestedPermissions?: string[];
  suggestedCapabilities?: string[];
  boundaryConstraints?: Record<string, unknown>;
}

export interface ExecuteHandoffResult {
  success: boolean;
  handoff: SwarmHandoff;
  effectivePermissions: string[];
}

export class HandoffProtocol {
  private static readonly MAX_DELEGATION_DEPTH = 4;

  /**
   * Executes a structured handoff between two agent personas in a swarm.
   */
  public async executeHandoff(params: ExecuteHandoffParams): Promise<ExecuteHandoffResult> {
    // 1. Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch();
    } catch {
      throw new SwarmError('SWARM_DEAD_MAN_PAUSED', 'Governance emergency dead-man switch is ACTIVE');
    }

    // 2. Delegation Depth Enforcement (Rule 23)
    if (params.currentDelegationChain.length >= HandoffProtocol.MAX_DELEGATION_DEPTH) {
      throw new SwarmError(
        'HANDOFF_REJECTED',
        `Maximum delegation depth exceeded (depth <= ${HandoffProtocol.MAX_DELEGATION_DEPTH})`,
        { currentChain: params.currentDelegationChain }
      );
    }

    // 3. Resolve Target Persona (Rule 16)
    const toPersona = globalAgentPersonaRegistry.getPersona(params.toPersonaId);
    if (!toPersona) {
      throw new SwarmError(
        'SPECIALIST_UNAUTHORIZED',
        `Target specialist persona "${params.toPersonaId}" is not registered in AgentPersonaRegistry`,
        { toPersonaId: params.toPersonaId }
      );
    }

    // 4. Domain Authorization Gate (Rule 16 & Rule 47)
    if (params.requiredDomain && !toPersona.allowedDomains.includes(params.requiredDomain)) {
      throw new SwarmError(
        'SPECIALIST_UNAUTHORIZED',
        `Target specialist persona "${params.toPersonaId}" is not authorized for domain "${params.requiredDomain}"`,
        {
          toPersonaId: params.toPersonaId,
          requiredDomain: params.requiredDomain,
          allowedDomains: toPersona.allowedDomains,
        }
      );
    }

    // 5. Monotonic Scope Attenuation & Non-Delegable Stripping (Rules 16 & 17)
    const basePermissions = params.requestedPermissions && params.requestedPermissions.length > 0
      ? toPersona.allowedPermissions.filter((p) => params.requestedPermissions!.includes(p))
      : [...toPersona.allowedPermissions];

    // Unconditionally strip non-delegables
    const effectivePermissions = basePermissions.filter((p) => !isNonDelegableAction(p));

    // 6. Prompt Injection Defense & XML Reference Containerization (Rules 13 & 30)
    const rawPayloadJson = JSON.stringify(params.payload);
    const sanitizedPayloadJson = StepValidator.redactAdversarialDirectives(rawPayloadJson);
    const handoffId = `ho_${crypto.randomUUID().slice(0, 8)}`;
    const isolatedXmlState = `<untrusted_reference_data id="handoff_${handoffId}">\n${sanitizedPayloadJson}\n</untrusted_reference_data>`;

    // 7. Construct Provenance Chain (Rule 40)
    const nextDelegationChain = [...params.currentDelegationChain, params.toPersonaId];

    const handoff: SwarmHandoff = {
      handoffId,
      fromAgentId: params.fromPersonaId,
      toAgentId: params.toPersonaId,
      handoffReason: params.handoffReason,
      transferredState: params.payload,
      isolatedXmlState,
      delegationChain: nextDelegationChain,
      suggestedCapabilities: params.suggestedCapabilities ?? [],
      boundaryConstraints: params.boundaryConstraints ?? {},
      createdAt: new Date().toISOString(),
    };

    // 8. EventBus Audit Emission (Rule 40)
    await defaultEventBus.publish(
      createDomainEvent({
        type: 'agent.swarm.handoff_executed',
        organizationId: params.tenantContext.organizationId,
        workspaceId: params.tenantContext.workspaceId,
        actor: {
          type: 'agent',
          id: params.fromPersonaId,
        },
        entity: {
          type: 'agent_handoff',
          id: handoffId,
        },
        correlationId: `corr_${crypto.randomUUID()}`,
        source: 'swarm-handoff-protocol',
        payload: {
          handoffId,
          fromAgentId: params.fromPersonaId,
          toAgentId: params.toPersonaId,
          handoffReason: params.handoffReason,
          delegationChain: nextDelegationChain,
        },
      })
    );

    return {
      success: true,
      handoff,
      effectivePermissions,
    };
  }
}
